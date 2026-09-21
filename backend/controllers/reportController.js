const mongoose = require("mongoose");
const https = require("https");
const { Report, GarbageArea, Fleet, Schedule, Route, Truck } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const { haversineDistanceMeters } = require("../utils/geoUtils");
const { awardResidentPoints, addBarangayScore } = require("../services/gamificationService");

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

// GET /api/reports/:id/suggestions
exports.getSuggestions = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: "Report not found" });

    const urgencyScore = (report.upvotes?.length || 0) - (report.downvotes?.length || 0);
    const suggestions = [];

    const [routes, trucks, fleet] = await Promise.all([
      Route.find({}).lean(),
      Truck.find({}).lean(),
      Fleet.find({}).lean(),
    ]);

    if (report.lat != null && report.lng != null) {
      let nearestRoute = null;
      let nearestDist = Infinity;

      const barangayRoutes = report.barangay
        ? routes.filter(
            (route) => route.barangay && route.barangay.trim().toLowerCase() === report.barangay.trim().toLowerCase()
          )
        : routes;

      for (const route of barangayRoutes) {
        for (const wp of route.waypoints || []) {
          if (wp.lat == null || wp.lng == null) continue;
          const d = haversineM(report.lat, report.lng, wp.lat, wp.lng);
          if (d < nearestDist) {
            nearestDist = d;
            nearestRoute = route;
          }
        }
      }

      if (nearestRoute && nearestDist < 5000) {
        suggestions.push({
          type: "route",
          title: `Add stop to "${nearestRoute.name}"`,
          description: `The nearest route passes ${Math.round(nearestDist)}m from this location. Adding it as a pickup stop will ensure the area is covered.`,
          action: {
            routeId: nearestRoute._id,
            routeName: nearestRoute.name,
            lat: report.lat,
            lng: report.lng,
            stopName: report.location || report.barangay || "Reported Location",
            distance: nearestDist,
          },
        });
      }

      let nearestTruck = null;
      let nearestTruckDist = Infinity;
      for (const truck of trucks) {
        if (truck.status !== "online" || truck.lat == null || truck.lng == null) continue;
        const d = haversineM(report.lat, report.lng, truck.lat, truck.lng);
        if (d < nearestTruckDist) {
          nearestTruckDist = d;
          nearestTruck = truck;
        }
      }

      if (nearestTruck) {
        const fleetEntry = fleet.find((f) => f.truckId === nearestTruck.truckId);
        suggestions.push({
          type: "truck",
          title: `Assign ${nearestTruck.truckId}`,
          description: `${fleetEntry?.driverName ? fleetEntry.driverName + " · " : ""}Nearest online truck, ${Math.round(nearestTruckDist)}m away.`,
          action: {
            truckId: nearestTruck.truckId,
            driverName: fleetEntry?.driverName || "",
          },
        });
      }
    }

    if (urgencyScore >= 5 && report.priority !== "Critical") {
      suggestions.push({
        type: "priority",
        title: "Escalate to Critical",
        description: `Community urgency score is +${urgencyScore}. High resident concern suggests this needs immediate attention.`,
        action: { priority: "Critical" },
      });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const routeContext = suggestions.find((s) => s.type === "route");

    if (GROQ_API_KEY) {
      const systemMsg = `You are a smart assistant for G-TRASH, a waste management system in Cebu City, Philippines. Give a 1-2 sentence practical, actionable recommendation for the barangay official.`;
      const userMsg = `Garbage report details:
- Category: ${report.category}
- Location: ${report.location || "Unknown"}, Barangay ${report.barangay}
- Description: ${report.description}
- Status: ${report.status}
- Community Urgency Score: +${urgencyScore}
${routeContext ? `- Nearest route in same barangay: ${routeContext.action.routeName} (${Math.round(routeContext.action.distance)} meters away)` : ""}

What should the official do first?`;

      const aiText = await new Promise((resolve) => {
        const body = JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          max_tokens: 120,
          temperature: 0.4,
        });
        const options = {
          hostname: "api.groq.com",
          path: "/openai/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Length": Buffer.byteLength(body),
          },
        };
        const groqReq = https.request(options, (r) => {
          let raw = "";
          r.on("data", (c) => (raw += c));
          r.on("end", () => {
            try {
              resolve(JSON.parse(raw).choices?.[0]?.message?.content?.trim() || null);
            } catch {
              resolve(null);
            }
          });
        });
        groqReq.on("error", () => resolve(null));
        groqReq.setTimeout(8000, () => {
          groqReq.destroy();
          resolve(null);
        });
        groqReq.write(body);
        groqReq.end();
      });

      if (aiText) {
        suggestions.push({ type: "ai", title: "AI Recommendation", description: aiText, action: null });
      } else {
        suggestions.push({
          type: "ai",
          title: "AI Recommendation (Offline)",
          description: `Dispatch a barangay personnel to check and verify the report status at ${report.location || "the location"} before dispatching a truck.`,
          action: null,
        });
      }
    } else {
      suggestions.push({
        type: "ai",
        title: "Recommended Action",
        description: `Dispatch a barangay personnel to check and verify the report status at ${report.location || "the location"} before assigning a collector.`,
        action: null,
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

    report.isPriorityArea = true;
    report.priority = priorityLevel;
    report.status = "in-progress";
    if (truckId) {
      report.assignedTruck = truckId;
      const fleetEntry = await Fleet.findOne({ truckId });
      if (fleetEntry) report.assignedDriver = fleetEntry.driverName;
    }
    await report.save();

    const io = getIO();
    if (io) io.emit("report:updated", report);
    res.json(report);
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
    if (updateData.status) {
      updateData.$push = {
        statusHistory: {
          status: updateData.status,
          changedBy: req.official?.name || "Official",
          changedAt: new Date(),
        },
      };

      if (updateData.status === "resolved") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.official?.name || req.official?.email || "Official";
        updateData.resolutionConfirmed = "pending";
        if (req.body.resolutionImage) {
          updateData.resolutionImage = req.body.resolutionImage;
        }
        // Award resident points for resolved report
        const existing = await Report.findById(req.params.id).select("userId").lean();
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
    res.json(report);
  } catch (err) {
    next(err);
  }
};
