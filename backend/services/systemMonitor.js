const os = require("os");
const https = require("https");
const mongoose = require("mongoose");
const { getIO } = require("../config/socket");

// --- API Metrics (in-memory, last 24h) ---
const apiMetrics = [];
const METRICS_TTL = 24 * 60 * 60 * 1000;

function pruneMetrics() {
  const cutoff = Date.now() - METRICS_TTL;
  while (apiMetrics.length && apiMetrics[0].timestamp < cutoff) apiMetrics.shift();
}
setInterval(pruneMetrics, 5 * 60 * 1000);

function recordApiMetric(metric) {
  apiMetrics.push(metric);
  pruneMetrics();
}

// --- CPU sampling ---
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();
let currentCpuPct = 0;

setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastCpuTime) * 1000; // µs
  const usage = process.cpuUsage(lastCpuUsage);
  if (elapsed > 0) currentCpuPct = Math.min(100, ((usage.user + usage.system) / elapsed) * 100);
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = now;
}, 5000);

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function pingService(host, path = "/") {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get({ host, path, timeout: 3000 }, (res) => {
      resolve({ status: "connected", latency: `${Date.now() - start}ms` });
      res.resume();
    });
    req.on("error", () => resolve({ status: "down", latency: "N/A" }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "down", latency: "N/A" });
    });
  });
}

// Map tracking active sockets to roles
const socketRoleMap = new Map();

async function buildSystemHealth() {
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = memTotal - memFree;
  const memPct = parseFloat(((memUsed / memTotal) * 100).toFixed(1));

  // DB status
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";
  let dbLatency = "N/A";
  if (dbState === 1) {
    const t = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      dbLatency = `${Date.now() - t}ms`;
    } catch (_) {}
  }

  // API metrics aggregation
  pruneMetrics();
  const now = Date.now();
  const metrics24 = apiMetrics.filter((m) => m.timestamp > now - METRICS_TTL);
  const totalReq = metrics24.length;
  const errorReq = metrics24.filter((m) => m.statusCode >= 400).length;
  const avgTime = totalReq ? Math.round(metrics24.reduce((s, m) => s + m.responseTime, 0) / totalReq) : 0;
  const errorRate = totalReq ? parseFloat(((errorReq / totalReq) * 100).toFixed(2)) : 0;

  // Per-endpoint aggregation
  const endpointMap = {};
  metrics24.forEach((m) => {
    const key = `${m.method} ${m.path}`;
    if (!endpointMap[key]) endpointMap[key] = { path: m.path, method: m.method, requests: 0, totalTime: 0, errors: 0 };
    endpointMap[key].requests++;
    endpointMap[key].totalTime += m.responseTime;
    if (m.statusCode >= 400) endpointMap[key].errors++;
  });
  const endpoints = Object.values(endpointMap)
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)
    .map((e) => ({
      path: e.path,
      method: e.method,
      requests: e.requests,
      avgTime: `${Math.round(e.totalTime / e.requests)}ms`,
      errors: e.errors,
      errorRate: parseFloat(((e.errors / e.requests) * 100).toFixed(1)),
    }));

  // External services
  const [cloudinaryStatus, groqStatus, geminiStatus] = await Promise.all([
    pingService("api.cloudinary.com", "/"),
    pingService("api.groq.com", "/"),
    pingService("generativelanguage.googleapis.com", "/"),
  ]);

  const io = getIO();
  const activeConnections = io?.sockets?.sockets ? io.sockets.sockets.size : 0;

  // Server overall status
  const serverStatus = memPct > 95 || currentCpuPct > 95 ? "degraded" : "online";

  return {
    server: {
      status: serverStatus,
      uptime: formatUptime(process.uptime()),
      nodeVersion: process.version,
      memoryUsage: { total: formatBytes(memTotal), used: formatBytes(memUsed), percentage: memPct },
      cpuUsage: { percentage: parseFloat(currentCpuPct.toFixed(1)) },
    },
    database: {
      status: dbStatus,
      type: "MongoDB",
      latency: dbLatency,
      lastBackup: null,
    },
    api: {
      totalRequests24h: totalReq,
      averageResponseTime: `${avgTime}ms`,
      errorRate24h: errorRate,
      endpoints,
    },
    externalServices: {
      cloudinary: cloudinaryStatus,
      groqApi: groqStatus,
      geminiApi: geminiStatus,
      socketio: { status: "connected", activeConnections },
    },
  };
}

module.exports = {
  buildSystemHealth,
  recordApiMetric,
  pruneMetrics,
  socketRoleMap,
};
