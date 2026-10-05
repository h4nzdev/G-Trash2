const axios = require("axios");
const { BarangayScore, BarangayPointHistory, Report, CollectionLog, GarbageArea } = require("../models");
const { addBarangayScore } = require("../services/gamificationService");
const { syncOverdueSLAPenalties } = require("../services/scheduleMonitor");

// GET /api/leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    await syncOverdueSLAPenalties().catch((e) => console.warn("SLA sync warning:", e.message));
    const scores = await BarangayScore.find().sort({ points: -1 }).lean();
    res.json(scores);
  } catch (err) {
    next(err);
  }
};

// POST /api/leaderboard/add-score
exports.addLeaderboardScore = async (req, res, next) => {
  try {
    const { barangay, reason } = req.body;
    if (!barangay || !reason) {
      return res.status(400).json({ error: "barangay and reason required" });
    }

    const CONFIG = {
      pickup: {
        points: 5,
        scoreCategory: "collectionScore",
        countField: "pickupCount",
      },
      vote: {
        points: 1,
        scoreCategory: "reportScore",
        countField: "reportVoteCount",
      },
      area_clean: {
        points: 3,
        scoreCategory: "iotScore",
        countField: "areaQualityPts",
      },
      area_moderate: {
        points: 1,
        scoreCategory: "iotScore",
        countField: "areaQualityPts",
      },
    };

    const cfg = CONFIG[reason];
    if (!cfg) return res.status(400).json({ error: "unknown reason" });

    const score = await addBarangayScore(
      barangay,
      cfg.points,
      cfg.scoreCategory,
      cfg.countField
    );
    res.json({ ok: true, points: cfg.points, total: score.points });
  } catch (err) {
    next(err);
  }
};

// POST /api/leaderboard/seed
exports.seedLeaderboard = async (req, res, next) => {
  try {
    const seedData = [
      {
        barangay: "IT Park",
        points: 142,
        reportScore: 52,
        iotScore: 32,
        collectionScore: 58,
        responseScore: 0,
        pickupCount: 10,
        reportVoteCount: 52,
        areaQualityPts: 32,
      },
      {
        barangay: "Lahug",
        points: 119,
        reportScore: 45,
        iotScore: 27,
        collectionScore: 47,
        responseScore: 0,
        pickupCount: 8,
        reportVoteCount: 45,
        areaQualityPts: 27,
      },
      {
        barangay: "Banilad",
        points: 98,
        reportScore: 38,
        iotScore: 21,
        collectionScore: 39,
        responseScore: 0,
        pickupCount: 7,
        reportVoteCount: 38,
        areaQualityPts: 21,
      },
      {
        barangay: "Talamban",
        points: 85,
        reportScore: 33,
        iotScore: 18,
        collectionScore: 34,
        responseScore: 0,
        pickupCount: 6,
        reportVoteCount: 33,
        areaQualityPts: 18,
      },
      {
        barangay: "Mabolo",
        points: 74,
        reportScore: 27,
        iotScore: 18,
        collectionScore: 29,
        responseScore: 0,
        pickupCount: 5,
        reportVoteCount: 27,
        areaQualityPts: 18,
      },
    ];

    for (const item of seedData) {
      await BarangayScore.findOneAndUpdate(
        { barangay: item.barangay },
        { $set: item },
        { upsert: true }
      );
    }
    res.json({ ok: true, seeded: seedData.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/barangays
exports.getBarangays = async (req, res, next) => {
  try {
    const response = await axios.get("https://psgc.gitlab.io/api/cities-municipalities/072217000/barangays.json", { timeout: 4000 });
    if (Array.isArray(response.data)) {
      const names = response.data.map((b) => b.name).sort();
      return res.json(names);
    }
    throw new Error("Invalid response format");
  } catch (err) {
    console.warn("[Backend] PSGC API failed or timed out. Using fallback.");
    const fallbackBarangays = [
      "Apas", "Banilad", "Basak San Nicolas", "Basak Pardo", "Binasalan",
      "Buhisan", "Bulacao", "Busay", "Calamba", "Cambinocot", "Capitol Site",
      "Carreta", "Cogon Pardo", "Cogon Ramos", "Day-as", "Duljo Fatima",
      "Ermita", "Guadalupe", "Guba", "Inayawan", "Kalubihan", "Kalunasan",
      "Kamagayan", "Kamputhaw", "Kasambagan", "Kinasang-an Pardo",
      "Labangon", "Lahug", "Lorega San Miguel", "Lusaran", "Mabini",
      "Mabolo", "Malubog", "Mambaling", "Pahina San Nicolas", "Pahina Central",
      "Pardo", "Pari-an", "Pasil", "Pit-os", "Punta Princesa", "Quiot",
      "Sambag I", "Sambag II", "San Antonio", "San Jose", "San Nicolas Central",
      "San Roque", "Santa Cruz", "Sawang Calero", "Subandaku", "T. Padilla",
      "Talamban", "Tejero", "Tinago", "Tisa", "Toong", "Zapatera",
    ].sort();
    res.json(fallbackBarangays);
  }
};

// GET /api/analytics/report-trends
exports.getReportTrends = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trends = await Report.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            category: "$category",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const formatted = {};
    trends.forEach((t) => {
      const date = t._id.date;
      const cat = t._id.category || "Other";
      if (!formatted[date]) formatted[date] = { date };
      formatted[date][cat] = t.count;
    });

    res.json(Object.values(formatted));
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/hotspots
exports.getHotspots = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const reportHotspots = await Report.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { location: "$location", barangay: "$barangay" }, reportCount: { $sum: 1 } } },
      { $sort: { reportCount: -1 } },
      { $limit: 15 },
    ]);

    const formatted = reportHotspots.map((h) => ({
      location: h._id.location || "Unknown",
      barangay: h._id.barangay || "Unknown",
      reportCount: h.reportCount,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/collection-stats
exports.getCollectionStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = await CollectionLog.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          stopsCleared: { $sum: 1 },
          binsCleared: { $sum: "$bins" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formatted = stats.map((s) => ({
      date: s._id,
      stopsCleared: s.stopsCleared,
      binsCleared: s.binsCleared,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/sitios
exports.getSitioAnalytics = async (req, res, next) => {
  try {
    const { barangay } = req.query;
    const filter = {};
    if (barangay) {
      filter.barangay = barangay;
    }

    const reportStats = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$sitio",
          totalReports: { $sum: 1 },
          pendingReports: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          resolvedReports: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
        },
      },
    ]);

    const iotAreas = await GarbageArea.find(filter);
    const sitioMap = {};

    iotAreas.forEach((area) => {
      const key = area.name || "Unknown";
      sitioMap[key] = {
        sitio: key,
        lat: area.lat,
        lng: area.lng,
        status: area.status,
        ammonia: area.ammonia || "0 ppm",
        methane: area.methane || "0 ppm",
        bins: area.bins || 0,
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        hasSensor: true,
      };
    });

    reportStats.forEach((r) => {
      const key = r._id || "Uncategorized";
      if (!sitioMap[key]) {
        sitioMap[key] = {
          sitio: key,
          lat: null,
          lng: null,
          status: "inactive",
          ammonia: "N/A",
          methane: "N/A",
          bins: 0,
          hasSensor: false,
        };
      }
      sitioMap[key].totalReports = r.totalReports;
      sitioMap[key].pendingReports = r.pendingReports;
      sitioMap[key].resolvedReports = r.resolvedReports;
    });

    res.json(Object.values(sitioMap));
  } catch (err) {
    next(err);
  }
};

// GET /api/barangay-points-history
exports.getBarangayPointsHistory = async (req, res, next) => {
  const { barangay } = req.query;
  try {
    // Process overdue SLA penalties so they are always current and logged
    await syncOverdueSLAPenalties().catch((e) =>
      console.warn("SLA penalty sync error:", e.message)
    );

    const filter = barangay && barangay !== "All" ? { barangay } : {};
    let history = await BarangayPointHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Ensure overdue reports for this barangay have their SLA penalties recorded
    if (barangay && barangay !== "All") {
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const overdueReports = await Report.find({
        barangay,
        status: { $nin: ["resolved", "rejected", "closed", "completed"] },
        $or: [
          { deadline: { $lte: new Date() } },
          { createdAt: { $lte: seventyTwoHoursAgo } },
          { escalated: true },
        ],
      }).lean();

      for (const rep of overdueReports) {
        const repTitle = rep.title || "Waste Report";
        const hasPenalty = history.some(
          (h) =>
            h.points < 0 &&
            (h.description?.includes(repTitle) ||
              h.description?.toLowerCase().includes("overdue") ||
              h.description?.toLowerCase().includes("sla"))
        );

        if (!hasPenalty) {
          const createdMs = rep.createdAt ? new Date(rep.createdAt).getTime() : Date.now();
          const elapsedHours = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60));
          const elapsedDays = Math.floor(elapsedHours / 24);
          const timeStr = elapsedDays > 0 ? `${elapsedDays}d` : `${elapsedHours}h`;

          const penaltyEntry = await BarangayPointHistory.create({
            barangay,
            points: -10,
            category: "reportScore",
            description: `SLA Escalation Penalty: "${repTitle}" unresolved over 72h (${timeStr} overdue)`,
            createdAt: rep.deadline || rep.createdAt || new Date(),
          }).catch(() => null);

          if (penaltyEntry) {
            history.unshift(penaltyEntry.toObject ? penaltyEntry.toObject() : penaltyEntry);
          }
        }
      }
    }

    // If history is empty but barangay has scores/points, backfill meaningful history
    if (history.length === 0 && barangay && barangay !== "All") {
      const bScore = await BarangayScore.findOne({ barangay }).lean();
      const entriesToCreate = [];

      // Check resolved reports in this barangay
      const resolvedReports = await Report.find({ barangay, status: "resolved" })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean();

      if (resolvedReports.length > 0) {
        for (const rep of resolvedReports) {
          entriesToCreate.push({
            barangay,
            points: 20,
            category: "reportScore",
            description: `Incident Resolved & Verified: ${rep.title || "Waste Report"}`,
            createdAt: rep.updatedAt || rep.createdAt || new Date(),
          });
        }
      }

      // Check collection score from score document
      if (bScore) {
        if (bScore.collectionScore > 0 && entriesToCreate.length === 0) {
          entriesToCreate.push({
            barangay,
            points: bScore.collectionScore,
            category: "collectionScore",
            description: "Completed Waste Collection Runs",
            createdAt: bScore.updatedAt || new Date(),
          });
        }
        if (bScore.iotScore > 0) {
          entriesToCreate.push({
            barangay,
            points: bScore.iotScore,
            category: "iotScore",
            description: "Clean Air Quality Environmental Award",
            createdAt: bScore.updatedAt || new Date(),
          });
        }
        if (entriesToCreate.length === 0 && bScore.points > 0) {
          entriesToCreate.push({
            barangay,
            points: bScore.points,
            category: "points",
            description: "Performance Score Activity Baseline",
            createdAt: bScore.updatedAt || new Date(),
          });
        }
      }

      if (entriesToCreate.length > 0) {
        await BarangayPointHistory.insertMany(entriesToCreate);
        history = await BarangayPointHistory.find(filter)
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
      }
    }

    res.json(history);
  } catch (err) {
    next(err);
  }
};
