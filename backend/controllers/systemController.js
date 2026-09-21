const https = require("https");
const { Fleet, Report, Official, Resident, BarangayScore, BugReport, ErrorLog } = require("../models");
const { buildSystemHealth, socketRoleMap } = require("../services/systemMonitor");

// GET /api/admin/stats
exports.getAdminStats = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }

    const [trucks, reports, officials, residents] = await Promise.all([
      Fleet.countDocuments(),
      Report.countDocuments(),
      Official.countDocuments({ role: "official" }),
      Resident.countDocuments(),
    ]);

    const leaderboardRaw = await BarangayScore.find().sort({ points: -1 }).limit(5).lean();
    const leaderboard = leaderboardRaw.map((b) => ({
      _id: b.barangay,
      count: b.points,
    }));

    const composition = await Report.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trends = await Report.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const resolvedCount = await Report.countDocuments({ status: "resolved" });
    const resolutionRate = reports > 0 ? Math.round((resolvedCount / reports) * 100) : 0;

    res.json({
      summary: { trucks, reports, officials, residents, resolutionRate },
      leaderboard,
      composition,
      trends,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/bugs
exports.createBugReport = async (req, res, next) => {
  try {
    const bug = await BugReport.create(req.body);
    res.status(201).json(bug);
  } catch (err) {
    next(err);
  }
};

// GET /api/bugs
exports.getBugReports = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    const bugs = await BugReport.find().sort({ createdAt: -1 });
    res.json(bugs);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bugs/:id
exports.updateBugReport = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    const bug = await BugReport.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(bug);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/system-health
exports.getSystemHealth = async (req, res, next) => {
  try {
    const health = await buildSystemHealth();
    res.json(health);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/error-logs
exports.getErrorLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, severity, startDate, endDate, resolved } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.resolved = resolved === "true";
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      ErrorLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      ErrorLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/error-logs/:id/resolve
exports.resolveErrorLog = async (req, res, next) => {
  try {
    const log = await ErrorLog.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedBy: req.official?.name || req.official?.email, resolvedAt: new Date() },
      { new: true }
    );
    if (!log) return res.status(404).json({ error: "Log not found" });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/error-logs/seed
exports.seedErrorLogs = async (req, res, next) => {
  try {
    const samples = [
      { severity: "error", source: "IoT Controller", message: "Sensor SENSOR-005 failed to respond after 3 retries", stack: "Error: Timeout\n    at IoTController.ping (iot.js:42)" },
      { severity: "warning", source: "API Gateway", message: "Rate limit approaching for /api/ai/chat (85% of quota)", stack: "" },
      { severity: "error", source: "Database", message: "Slow query detected: 1.2s on SensorReading.find()", stack: "" },
      { severity: "info", source: "Scheduler", message: "Monthly reward reset completed successfully", stack: "" },
      { severity: "warning", source: "Cloudinary", message: "Upload latency high: 2800ms (threshold: 2000ms)", stack: "" },
      { severity: "error", source: "Auth Service", message: "5 failed login attempts for admin@gtrash.ph", stack: "" },
    ];
    await ErrorLog.insertMany(samples.map((s) => ({ ...s, timestamp: new Date(Date.now() - Math.random() * 86400000 * 3) })));
    res.json({ inserted: samples.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/active-sessions
exports.getActiveSessions = async (req, res, next) => {
  try {
    const counts = { total: 0, residents: 0, drivers: 0, officials: 0, admins: 0, chd: 0, unknown: 0 };
    socketRoleMap.forEach((role) => {
      counts.total++;
      if (role === "resident") counts.residents++;
      else if (role === "driver") counts.drivers++;
      else if (role === "official") counts.officials++;
      else if (role === "superadmin" || role === "admin") counts.admins++;
      else if (role === "chd") counts.chd++;
      else counts.unknown++;
    });
    res.json(counts);
  } catch (err) {
    next(err);
  }
};

// POST /api/ai/chat
exports.aiChat = (req, res, next) => {
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY || GROQ_API_KEY === "your_groq_key_here") {
      return res.status(500).json({ error: "GROQ_API_KEY not configured in .env" });
    }
    const { messages = [], context = {} } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });

    const systemPrompt = `You are EcoAssist AI, a helpful assistant for garbage truck collectors in Cebu, Philippines working on the G-TRASH smart waste monitoring system. You help drivers with route tips, waste collection guidance, area-specific advice, and answering questions about their day.

Current session context:
- Driver: ${context.driverName || "Collector"}
- Truck ID: ${context.truckId || "Unknown"}
- Route: ${context.routeName || "Unassigned"}
- Current stop: ${context.currentStop || "None"}
- Progress: ${context.completed ?? 0} of ${context.total ?? 0} stops completed
- Total weight collected today: ${context.totalWeight ?? 0}kg

Keep responses short and practical — drivers read on a phone while working. Use plain language.`;

    const body = JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 256,
      temperature: 0.7,
    });

    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const request = https.request(options, (groqRes) => {
      let raw = "";
      groqRes.on("data", (chunk) => {
        raw += chunk;
      });
      groqRes.on("end", () => {
        try {
          const data = JSON.parse(raw);
          if (groqRes.statusCode >= 400) {
            return res.status(groqRes.statusCode).json({ error: data.error?.message || "Groq API error" });
          }
          res.json({ reply: data.choices[0].message.content });
        } catch {
          res.status(500).json({ error: "Failed to parse Groq response" });
        }
      });
    });

    request.on("error", (err) => res.status(500).json({ error: err.message }));
    request.write(body);
    request.end();
  } catch (err) {
    next(err);
  }
};
