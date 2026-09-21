require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const initializeSockets = require("./sockets");
const { runStartupTasks } = require("./services/startupService");
const {
  startScheduleMonitor,
  startSLAChecker,
  startRewardExpirer,
  startMonthlyReset,
} = require("./services/scheduleMonitor");
const { buildSystemHealth } = require("./services/systemMonitor");
const { logError } = require("./utils/logger");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSockets(server);

// Start server and lifecycle services
async function start() {
  try {
    await connectDB();
    await runStartupTasks();

    // Start background cron / monitors
    startScheduleMonitor();
    startSLAChecker();
    startRewardExpirer();
    startMonthlyReset();

    // Periodic system health broadcast (every 30 seconds)
    setInterval(async () => {
      try {
        const health = await buildSystemHealth();
        io.emit("system:health:update", health);

        const mem = health.server?.memoryUsage?.percentage;
        const cpu = health.server?.cpuUsage?.percentage;
        const errRate = health.api?.errorRate24h;

        if (mem > 85) logError(`Memory usage critical: ${mem.toFixed(1)}%`, { severity: "error", source: "System Monitor" });
        if (cpu > 90) logError(`CPU usage critical: ${cpu.toFixed(1)}%`, { severity: "error", source: "System Monitor" });
        if (errRate > 5) logError(`API error rate critical: ${errRate.toFixed(2)}%`, { severity: "error", source: "API Monitor" });
      } catch (_) {}
    }, 30000);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`OK: G-TRASH Unified Backend running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("FATAL: Failed to start server:", err);
    process.exit(1);
  }
}

start();

module.exports = { server, app, io };
