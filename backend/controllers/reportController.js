const mongoose = require("mongoose");
const https = require("https");
const { Report, GarbageArea, Fleet, Schedule, Route, Truck, Announcement, Sitio } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const { haversineDistanceMeters } = require("../utils/geoUtils");
const { awardResidentPoints, addBarangayScore } = require("../services/gamificationService");
const { getRouteDirections } = require("../services/routingService");

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/reports
exports.getReports = async (req, res, next) => {
  try {
    const { barangay, sitio, userId } = req.query;
    const filter = barangayFilter(req.official || req);
    if (barangay && barangay !== "All") filter.barangay = barangay;
    if (sitio) filter.sitio = sitio;
    if (userId) {
      filter.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "firstName lastName profilePicture")
      .populate("comments.userId", "firstName lastName profilePicture");
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/:id
exports.getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("userId", "firstName lastName profilePicture")
      .populate("comments.userId", "firstName lastName profilePicture");
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// POST /api/reports
exports.createReport = async (req, res, next) => {
  try {
    const { userId, lat, lng, barangay, force } = req.body;

    const isIot = (req.body.reportedBy || "").toLowerCase().startsWith("iot");
    const isTruck = (req.body.reportedBy || "").toLowerCase().startsWith("truck");
    if (!isIot && !isTruck && !req.body.reportImage) {
      return res.status(400).json({
        error: "photo_required",
        message: "Photo proof is required when submitting a report.",
      });
    }

    if (userId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await Report.countDocuments({
        userId,
        createdAt: { $gte: oneHourAgo },
      });
      if (recentCount >= 3) {
        return res.status(429).json({
          error: "rate_limit",
          message: "You have submitted 3 reports in the past hour. Please wait before submitting more.",
        });
      }
    }

    if (!force && lat != null && lng != null) {
      const openReports = await Report.find({
        status: { $in: ["pending", "in-progress"] },
        lat: { $ne: null },
        lng: { $ne: null },
        barangay: barangay || { $exists: true },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).select("lat lng _id title");

      const DUPLICATE_RADIUS_M = 100;
      const nearby = openReports.find(
        (r) => haversineDistanceMeters(lat, lng, r.lat, r.lng) <= DUPLICATE_RADIUS_M
      );
      if (nearby) {
        return res.status(409).json({
          error: "duplicate_nearby",
          message: "An open report already exists within 100 m of this location. Are you sure this is a different issue?",
          existingReportId: nearby._id,
        });
      }
    }

    const report = await Report.create({
      ...req.body,
      title: req.body.title || req.body.category,
      deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      statusHistory: [
        {
          status: "pending",
          changedBy: req.body.reportedBy || "Resident",
          changedAt: new Date(),
        },
      ],
    });

    const io = getIO();
    if (io) io.emit("report:new", report);

    if (lat && lng) {
      const nearbyArea = await GarbageArea.findOne({
        lat: { $gte: lat - 0.001, $lte: lat + 0.001 },
        lng: { $gte: lng - 0.001, $lte: lng + 0.001 },
      });
      if (nearbyArea) {
        nearbyArea.reportCount = (nearbyArea.reportCount || 0) + 1;
        if (nearbyArea.reportCount >= 3) {
          nearbyArea.status = "critical";
          nearbyArea.intensity = 0.8;
        } else if (nearbyArea.reportCount >= 1) {
          nearbyArea.status = "moderate";
          nearbyArea.intensity = 0.5;
        }
        await nearbyArea.save();
        if (io) io.emit("garbage-area:updated", nearbyArea);
      }
    }

    if (report.barangay) {
      await addBarangayScore(report.barangay, 2, "reportScore", "reportVoteCount").catch(() => {});
    }

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/:id/vote
exports.voteReport = async (req, res, next) => {
  try {
    const { userId, voteType } = req.body;
    if (!userId || !["up", "down"].includes(voteType)) {
      return res.status(400).json({ error: "userId and valid voteType (up/down) required" });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const upIdx = report.upvotes.findIndex((id) => id.toString() === userObjId.toString());
    const downIdx = report.downvotes.findIndex((id) => id.toString() === userObjId.toString());

    if (voteType === "up") {
      if (upIdx > -1) {
        report.upvotes.splice(upIdx, 1);
      } else {
        report.upvotes.push(userObjId);
        if (downIdx > -1) report.downvotes.splice(downIdx, 1);
      }
    } else {
      if (downIdx > -1) {
        report.downvotes.splice(downIdx, 1);
      } else {
        report.downvotes.push(userObjId);
        if (upIdx > -1) report.upvotes.splice(upIdx, 1);
      }
    }

    await report.save();
    const io = getIO();
    if (io) io.emit("report:updated", report);

    res.json({
      upvotesCount: report.upvotes.length,
      downvotesCount: report.downvotes.length,
      hasUpvoted: report.upvotes.some((id) => id.toString() === userObjId.toString()),
      hasDownvoted: report.downvotes.some((id) => id.toString() === userObjId.toString()),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/:id/comments
exports.addComment = async (req, res, next) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text?.trim()) {
      return res.status(400).json({ error: "userId and non-empty text required" });
    }

    const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const newComment = {
      userId: userObjId,
      text: text.trim(),
      createdAt: new Date(),
    };

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      { new: true }
    )
      .populate("userId", "firstName lastName profilePicture")
      .populate("comments.userId", "firstName lastName profilePicture");

    if (!report) return res.status(404).json({ error: "Report not found" });

    const io = getIO();
    if (io) io.emit("report:updated", report);

    res.status(201).json(report.comments[report.comments.length - 1]);
  } catch (err) {
    next(err);
  }
};

function isOverflowingGarbage(report) {
  const category = (report.category || "").toLowerCase();
  const title = (report.title || "").toLowerCase();
  const desc = (report.description || "").toLowerCase();
  const fullText = `${category} ${title} ${desc}`;

  // 1. Explicit categories indicating large volume or overflowing waste
  if (
    category.includes("overflow") ||
    category.includes("dump") ||
    category.includes("hazard")
  ) {
    return true;
  }

  // 2. Keywords indicating overflowing, high volume, tons, heavy waste
  const overflowKeywords = [
    "overflow",
    "overflowing",
    "apaw",
    "umaapaw",
    "lapaw",
    "ton",
    "tons",
    "tonelada",
    "2 ton",
    "2 tons",
    "kilo",
    "kg",
    "heavy",
    "huge",
    "massive",
    "pile",
    "piles",
    "mountain",
    "bulk",
    "bulky",
    "full",
    "puno",
    "marami",
    "daghan",
    "damak",
    "severe",
    "critical",
    "urgent",
    "emergency",
    "scattered everywhere",
    "spill",
    "spilling",
    "spilled",
  ];

  if (overflowKeywords.some((kw) => fullText.includes(kw))) {
    return true;
  }

  // 3. Priority level
  if (report.priority === "Critical" || report.priority === "High") {
    return true;
  }

  return false;
}

// GET /api/reports/:id/suggestions
exports.getSuggestions = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: "Report not found" });

    const [routes, trucks, fleet] = await Promise.all([
      Route.find({}).lean(),
      Truck.find({}).lean(),
      Fleet.find({}).lean(),
    ]);

    const suggestions = [];
    const isOverflowing = isOverflowingGarbage(report);

    if (isOverflowing) {
      // High volume / overflowing garbage (up to 2-ton truck capacity) -> Direct assign to driver
      let nearestTruck = null;
      let nearestTruckDist = Infinity;

      if (report.lat != null && report.lng != null) {
        for (const truck of trucks) {
          if (truck.status !== "online" || truck.lat == null || truck.lng == null) continue;
          const d = haversineM(report.lat, report.lng, truck.lat, truck.lng);
          if (d < nearestTruckDist) {
            nearestTruckDist = d;
            nearestTruck = truck;
          }
        }
      }

      if (!nearestTruck) {
        nearestTruck = trucks.find((t) => t.status === "online") || trucks[0];
      }

      const assignedTruckId = nearestTruck?.truckId || fleet[0]?.truckId || "GT-QSO";
      const fleetEntry = fleet.find((f) => f.truckId === assignedTruckId) || fleet[0];
      const driverName = fleetEntry?.driverName || "Driver";
      const distanceLabel =
        nearestTruckDist < Infinity
          ? `${Math.round(nearestTruckDist)}m away`
          : "Available in fleet";

      suggestions.push({
        type: "truck",
        title: `Direct Assign to ${assignedTruckId}`,
        description: `${driverName} · Heavy overflowing waste detected (within 2-ton truck capacity). Nearest active truck (${distanceLabel}) ready for direct dispatch and immediate collection.`,
        btnLabel: "Direct Assign",
        action: {
          truckId: assignedTruckId,
          driverName: driverName,
          directAssign: true,
        },
      });
    } else {
      // Bare minimum / small amount of garbage -> Recommend adding stop to next schedule
      let nearestRoute = null;
      let nearestDist = Infinity;

      if (report.lat != null && report.lng != null) {
        const barangayRoutes = report.barangay
          ? routes.filter(
              (route) =>
                route.barangay &&
                route.barangay.trim().toLowerCase() === report.barangay.trim().toLowerCase()
            )
          : routes;

        const candidateRoutes = barangayRoutes.length > 0 ? barangayRoutes : routes;

        for (const route of candidateRoutes) {
          for (const wp of route.waypoints || []) {
            if (wp.lat == null || wp.lng == null) continue;
            const d = haversineM(report.lat, report.lng, wp.lat, wp.lng);
            if (d < nearestDist) {
              nearestDist = d;
              nearestRoute = route;
            }
          }
        }
      }

      if (!nearestRoute && routes.length > 0) {
        nearestRoute =
          routes.find(
            (r) =>
              report.barangay &&
              r.barangay &&
              r.barangay.trim().toLowerCase() === report.barangay.trim().toLowerCase()
          ) || routes[0];
      }

      const routeName =
        nearestRoute?.name || `${report.barangay || "Barangay"} Regular Route`;
      const routeId = nearestRoute?._id;
      const distanceDesc =
        nearestDist < Infinity
          ? `passes ~${Math.round(nearestDist)}m from this spot`
          : "covers this collection area";

      suggestions.push({
        type: "route",
        title: `Add stop to next schedule ("${routeName}")`,
        description: `Bare minimum waste volume reported. Recommend adding this location as a pickup stop on the next scheduled route collection (${distanceDesc}).`,
        btnLabel: "Add Stop",
        action: {
          routeId: routeId,
          routeName: routeName,
          lat: report.lat,
          lng: report.lng,
          stopName:
            report.location || report.sitio || report.barangay || "Reported Location",
          distance: nearestDist < Infinity ? nearestDist : 0,
        },
      });
    }

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/:id/verify
exports.verifyReport = async (req, res, next) => {
  try {
    const { confirmed, userId, disputeImage, disputeReason } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Not found" });
    if (report.resolutionConfirmed !== "pending") {
      return res.status(400).json({ error: "Not awaiting verification" });
    }

    const outcome = confirmed ? "confirmed" : "disputed";
    const setOps = { resolutionConfirmed: outcome };
    const pushEntry = {
      status: outcome,
      changedBy: "Resident",
      changedAt: new Date(),
    };

    if (!confirmed) {
      // Image validation: Resident must provide photo proof showing the unresolved issue to prevent trolling
      if (!disputeImage || typeof disputeImage !== "string" || !disputeImage.trim()) {
        return res.status(400).json({
          error: "Photo evidence required to dispute resolution. Please upload a photo proof showing that the issue is still not resolved.",
        });
      }

      setOps.status = "pending";
      setOps.resolvedAt = null;
      setOps.disputeImage = disputeImage.trim();
      setOps.disputeReason = disputeReason ? disputeReason.trim() : "";
      pushEntry.status = "reopened";

      if (report.barangay) {
        await addBarangayScore(report.barangay, -15, "reportScore", null, "Resident disputed resolution with photo proof");
      }
    } else {
      if (report.barangay) {
        await addBarangayScore(report.barangay, 20, "reportScore", null, "Resident confirmed resolution");
      }
      if (userId) {
        awardResidentPoints(userId, 10, "verify_resolution", "Verified a reported issue was resolved", report._id).catch(() => {});
      }
    }

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: setOps, $push: { statusHistory: pushEntry } },
      { new: true }
    );

    const io = getIO();
    if (io) {
      io.emit("report:updated", updated);
      if (!confirmed) {
        io.emit("report:disputed", {
          reportId: updated._id,
          title: updated.title,
          category: updated.category,
          location: updated.location,
          barangay: updated.barangay,
          disputeImage: updated.disputeImage,
          disputeReason: updated.disputeReason,
          disputedAt: new Date(),
        });
      }
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/reports/:id/health-flag
exports.updateHealthFlag = async (req, res, next) => {
  try {
    if (req.official?.role !== "chd") {
      return res.status(403).json({ error: "Your role (CHD) does not have access to this feature." });
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { healthConcern: true }, { new: true });
    if (!report) return res.status(404).json({ error: "Report not found" });

    const io = getIO();
    if (io) io.emit("report:updated", report);
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/reports/:id/health-note
exports.updateHealthNote = async (req, res, next) => {
  try {
    if (req.official?.role !== "chd") {
      return res.status(403).json({ error: "Your role (CHD) does not have access to this feature." });
    }
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Note text required" });

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { healthNotes: { text: text.trim(), addedBy: req.official.name || req.official.email, createdAt: new Date() } } },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: "Report not found" });

    const io = getIO();
    if (io) io.emit("report:updated", report);
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/:id/assign-priority
exports.assignPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { truckId: rawTruckId, date, priorityLevel = "High", reason = "Priority Report Dispatch" } = req.body;
    const truckId = rawTruckId?.toUpperCase();

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (report.assignedTruck || report.priorityScheduleId) {
      return res.status(400).json({
        error: `This report is already assigned to Truck ${report.assignedTruck || "another schedule/truck"}. Dispatch is locked.`,
      });
    }
    if (report.status === "resolved") {
      return res.status(400).json({ error: "Cannot dispatch a report that is already resolved." });
    }

    report.isPriorityArea = true;
    report.priority = priorityLevel;
    report.status = "in-progress";
    if (truckId) {
      report.assignedTruck = truckId;
      const fleetEntry = await Fleet.findOne({ truckId });
      if (fleetEntry) report.assignedDriver = fleetEntry.driverName;
    }

    // Determine accurate coordinates
    let reportLat = report.lat;
    let reportLng = report.lng;
    if (!reportLat || !reportLng) {
      if (report.sitio && report.barangay) {
        const sitioDoc = await Sitio.findOne({ name: report.sitio, barangay: report.barangay });
        if (sitioDoc) {
          reportLat = sitioDoc.lat;
          reportLng = sitioDoc.lng;
        }
      }
    }
    if (!reportLat || !reportLng) {
      reportLat = 10.325;
      reportLng = 123.893;
    }

    const taskName = report.sitio || report.location || report.title || "Priority Cleanup Stop";
    let schedule = null;
    if (truckId) {
      const today = date || new Date().toISOString().substring(0, 10);
      schedule = await Schedule.findOne({ truckId, date: today, status: { $ne: "completed" } });
      if (!schedule) {
        schedule = await Schedule.findOne({ truckId, status: { $ne: "completed" } }).sort({ date: -1 });
      }

      if (schedule) {
        if (!Array.isArray(schedule.sitioTasks)) schedule.sitioTasks = [];
        const newTask = {
          name: `🚨 PRIORITY: ${taskName}`,
          lat: reportLat,
          lng: reportLng,
          completed: false,
          isPriority: true,
          reportId: report._id,
        };

        const nextIncompleteIdx = schedule.sitioTasks.findIndex((t) => !t.completed);
        if (nextIncompleteIdx >= 0) {
          schedule.sitioTasks.splice(nextIncompleteIdx, 0, newTask);
        } else {
          schedule.sitioTasks.unshift(newTask);
        }

        schedule.isPriority = true;
        schedule.priorityLevel = priorityLevel;
        schedule.priorityReason = reason;

        const validWaypoints = schedule.sitioTasks.filter((t) => t.lat && t.lng).map((t) => [t.lat, t.lng]);
        if (validWaypoints.length >= 2) {
          try {
            const directions = await getRouteDirections(validWaypoints);
            if (Array.isArray(directions) && directions.length > 0) {
              schedule.routeCoords = directions;
            } else if (directions?.coordinates?.length) {
              schedule.routeCoords = directions.coordinates;
            }
          } catch (_) {
            schedule.routeCoords = validWaypoints;
          }
        } else {
          schedule.routeCoords = validWaypoints;
        }

        await schedule.save();
        report.priorityScheduleId = schedule._id;
      }
    }

    await report.save();

    const io = getIO();
    if (io) {
      io.emit("report:updated", report);
      if (schedule) {
        io.emit("schedule:changed", {
          truckId: schedule.truckId,
          date: schedule.date,
          scheduleId: schedule._id,
          routeCoords: schedule.routeCoords,
        });
        io.emit("route:updated", {
          truckId: schedule.truckId,
          routeCoords: schedule.routeCoords,
        });
        io.emit("truck:priority:assigned", {
          truckId: schedule.truckId,
          report,
          schedule,
        });
      }
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/:id/apply-next-schedule
exports.applyNextSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduleId } = req.body;
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (report.priorityScheduleId || report.assignedTruck) {
      return res.status(400).json({
        error: `This report is already assigned to Truck ${report.assignedTruck || "another schedule/truck"}. Scheduling is locked.`,
      });
    }
    if (report.status === "resolved") {
      return res.status(400).json({ error: "Cannot schedule a report that is already resolved." });
    }

    let schedule = null;
    if (scheduleId) {
      schedule = await Schedule.findById(scheduleId);
    }
    if (!schedule) {
      const today = new Date().toISOString().substring(0, 10);
      schedule = await Schedule.findOne({
        date: { $gte: today },
        status: { $ne: "completed" },
      }).sort({ date: 1, startTime: 1 });
    }

    if (!schedule) {
      return res.status(404).json({ error: "No upcoming collection schedule found to apply to." });
    }

    // Determine accurate coordinates for the report
    let reportLat = report.lat;
    let reportLng = report.lng;
    if (!reportLat || !reportLng) {
      if (report.sitio && report.barangay) {
        const sitioDoc = await Sitio.findOne({ name: report.sitio, barangay: report.barangay });
        if (sitioDoc) {
          reportLat = sitioDoc.lat;
          reportLng = sitioDoc.lng;
        }
      }
    }
    if (!reportLat || !reportLng) {
      reportLat = 10.325;
      reportLng = 123.893;
    }

    const taskName = report.sitio || report.location || report.title || "Report Pickup Stop";
    if (!Array.isArray(schedule.sitioTasks)) schedule.sitioTasks = [];

    // Check if task is already in schedule
    const existingIndex = schedule.sitioTasks.findIndex(
      (t) => t.name.toLowerCase() === taskName.toLowerCase() ||
             (Math.abs((t.lat || 0) - reportLat) < 0.0001 && Math.abs((t.lng || 0) - reportLng) < 0.0001)
    );

    const newTask = {
      name: taskName,
      lat: reportLat,
      lng: reportLng,
      completed: false,
      isReport: true,
      reportId: report._id,
    };

    if (existingIndex === -1) {
      // Find optimal insertion point along the route to minimize detour
      if (schedule.sitioTasks.length < 2) {
        schedule.sitioTasks.push(newTask);
      } else {
        let bestIndex = schedule.sitioTasks.length;
        let minDetour = Infinity;
        for (let i = 0; i < schedule.sitioTasks.length - 1; i++) {
          const p1 = schedule.sitioTasks[i];
          const p2 = schedule.sitioTasks[i + 1];
          if (p1.lat && p1.lng && p2.lat && p2.lng) {
            const d1 = haversineM(p1.lat, p1.lng, reportLat, reportLng);
            const d2 = haversineM(reportLat, reportLng, p2.lat, p2.lng);
            const dDirect = haversineM(p1.lat, p1.lng, p2.lat, p2.lng);
            const detour = d1 + d2 - dDirect;
            if (detour < minDetour) {
              minDetour = detour;
              bestIndex = i + 1;
            }
          }
        }
        schedule.sitioTasks.splice(bestIndex, 0, newTask);
      }
    }

    // Recompute schedule routeCoords with actual road driving directions
    const validWaypoints = schedule.sitioTasks
      .filter((t) => t.lat && t.lng)
      .map((t) => [t.lat, t.lng]);

    if (validWaypoints.length >= 2) {
      try {
        const directions = await getRouteDirections(validWaypoints);
        if (Array.isArray(directions) && directions.length > 0) {
          schedule.routeCoords = directions;
        } else if (directions?.coordinates?.length) {
          schedule.routeCoords = directions.coordinates;
        }
      } catch (err) {
        console.warn("[applyNextSchedule] Failed to calculate road directions, using waypoints:", err.message);
        schedule.routeCoords = validWaypoints;
      }
    } else {
      schedule.routeCoords = validWaypoints;
    }

    // Also update linked route if exists
    if (schedule.routeId) {
      try {
        const linkedRoute = await Route.findById(schedule.routeId);
        if (linkedRoute) {
          linkedRoute.waypoints = schedule.sitioTasks.map((t) => ({ name: t.name, lat: t.lat, lng: t.lng }));
          linkedRoute.routeCoords = schedule.routeCoords;
          linkedRoute.totalStops = schedule.sitioTasks.length;
          await linkedRoute.save();
        }
      } catch (_) {}
    }

    await schedule.save();

    report.priorityScheduleId = schedule._id;
    report.assignedTruck = schedule.truckId;
    report.assignedDriver = schedule.driverName;
    report.status = "in-progress";
    report.isPriorityArea = false;
    await report.save();

    const io = getIO();
    if (io) {
      io.emit("report:updated", report);
      io.emit("schedule:changed", {
        truckId: schedule.truckId,
        date: schedule.date,
        scheduleId: schedule._id,
        routeCoords: schedule.routeCoords,
      });
      io.emit("route:updated", {
        truckId: schedule.truckId,
        routeCoords: schedule.routeCoords,
      });
    }

    res.json({ report, schedule });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reports/iot-bulk
exports.deleteIoTBulk = async (req, res, next) => {
  if (req.official?.role === "chd") {
    return res.status(403).json({ error: "Access denied: CHD role cannot delete reports" });
  }
  try {
    const result = await Report.deleteMany({ reportedBy: { $regex: /^IoT Sensor/i } });
    const io = getIO();
    if (io) io.emit("reports:batch-deleted", { isIotBulk: true });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/batch-delete
exports.batchDelete = async (req, res, next) => {
  if (req.official?.role === "chd") {
    return res.status(403).json({ error: "Access denied: CHD role cannot delete reports" });
  }
  const { reportIds } = req.body;
  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return res.status(400).json({ error: "reportIds array is required" });
  }
  try {
    const result = await Report.deleteMany({ _id: { $in: reportIds } });
    const io = getIO();
    if (io) io.emit("reports:batch-deleted", { ids: reportIds });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reports/:id
exports.deleteReport = async (req, res, next) => {
  if (req.official?.role === "chd") {
    return res.status(403).json({ error: "Access denied: CHD role cannot delete reports" });
  }
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (report.lat && report.lng) {
      await GarbageArea.updateOne(
        {
          lat: { $gte: report.lat - 0.001, $lte: report.lat + 0.001 },
          lng: { $gte: report.lng - 0.001, $lte: report.lng + 0.001 },
          reportCount: { $gt: 0 },
        },
        { $inc: { reportCount: -1 } }
      ).catch(() => {});
    }

    const io = getIO();
    if (io) io.emit("report:deleted", { id: req.params.id });
    res.json({ message: "Report deleted successfully", id: req.params.id });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/reports/:id
exports.updateReport = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    const actionNote = req.body.actionNote || req.body.notes || "";
    const officialName = req.official?.name || req.official?.email || "Barangay Official";

    if (updateData.status) {
      updateData.$push = {
        statusHistory: {
          status: updateData.status,
          changedBy: officialName,
          changedAt: new Date(),
          note: actionNote,
        },
      };

      if (req.body.resolutionImage) {
        updateData.resolutionImage = req.body.resolutionImage;
      }

      if (updateData.status === "resolved") {
        const existing = await Report.findById(req.params.id);
        const proof = req.body.resolutionImage || updateData.resolutionImage || existing?.resolutionImage;
        if (!proof) {
          return res.status(400).json({
            error: "Clean-up photo evidence is required before marking this report as resolved.",
          });
        }
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = officialName;
        updateData.resolutionConfirmed = "pending";
        // Award resident points for resolved report
        if (existing?.userId) {
          awardResidentPoints(
            existing.userId,
            15,
            "report_resolved",
            "Your garbage report was resolved by the barangay",
            req.params.id
          ).catch(() => {});
        }
      }
    }

    const report = await Report.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!report) return res.status(404).json({ error: "Report not found" });

    const io = getIO();
    if (io) io.emit("report:updated", report);

    // If requested, broadcast an official update/announcement to the resident community
    if (req.body.postToCommunity || req.body.notifyCommunity) {
      const isResolved = report.status === "resolved";
      const annTitle = isResolved
        ? `Issue Resolved: ${report.title}`
        : `Action in Progress: ${report.title}`;
      
      const locationSnippet = report.sitio
        ? `Sitio ${report.sitio}, Barangay ${report.barangay || "Area"}`
        : (report.location || report.barangay || "Barangay Area");

      const defaultMsg = isResolved
        ? `Barangay officials have resolved the reported issue at ${locationSnippet}.${actionNote ? ` Note: ${actionNote}` : ""}`
        : `Barangay response team has acknowledged and started action on the report at ${locationSnippet}.${actionNote ? ` Note: ${actionNote}` : ""}`;

      const announcement = await Announcement.create({
        title: annTitle,
        message: actionNote ? `${officialName}: ${actionNote}` : defaultMsg,
        type: isResolved ? "success" : "info",
        createdBy: officialName,
        barangay: report.barangay || "All",
        image: report.resolutionImage || report.reportImage || null,
        reportId: report._id,
      }).catch((err) => console.error("Failed to create community announcement:", err));

      if (announcement && io) {
        io.emit("announcement:new", announcement);
      }
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
};
