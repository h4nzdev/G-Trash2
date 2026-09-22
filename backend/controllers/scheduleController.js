const mongoose = require("mongoose");
const {
  Schedule,
  Fleet,
  Sitio,
  CollectionLog,
  Report,
  IoTAlert,
  GarbageArea,
  PickupRun,
  BinStatus,
} = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const { getRouteDirections } = require("../services/routingService");
const { addBarangayScore, awardResidentPoints } = require("../services/gamificationService");
const { notifyTruck } = require("../services/pushNotificationService");
const { recalculateAndEmitZone } = require("./areaController");

function getTodayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// Helper to enrich collection logs with Schedule details
async function enrichCollectionLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return logs;
  return await Promise.all(
    logs.map(async (rawLog) => {
      try {
        const isMissingInfo =
          !rawLog.routeName ||
          rawLog.routeName === "—" ||
          !rawLog.disposalFacility ||
          !rawLog.weight ||
          rawLog.weight === 0;

        if (isMissingInfo) {
          let schedule = null;
          if (rawLog.routeId) {
            schedule = await Schedule.findById(rawLog.routeId).catch(() => null);
          }
          if (!schedule) {
            schedule = await Schedule.findOne({
              truckId: rawLog.truckId,
              $or: [{ date: rawLog.date }, { "sitioTasks.name": rawLog.stopName }],
            })
              .sort({ completedAt: -1, createdAt: -1 })
              .catch(() => null);
          }

          if (schedule) {
            let updated = false;
            if ((!rawLog.routeName || rawLog.routeName === "—") && schedule.routeName) {
              rawLog.routeName = schedule.routeName;
              updated = true;
            }
            if (!rawLog.disposalFacility && schedule.disposalFacility) {
              rawLog.disposalFacility = schedule.disposalFacility;
              updated = true;
            }
            if (!rawLog.disposalPhoto && schedule.disposalPhoto) {
              rawLog.disposalPhoto = schedule.disposalPhoto;
              updated = true;
            }
            if ((!rawLog.weight || rawLog.weight === 0) && schedule.totalWeight > 0) {
              const stopCount = schedule.sitioTasks?.length || 1;
              rawLog.weight = Math.round((schedule.totalWeight / stopCount) * 100) / 100;
              rawLog.weightUnit = schedule.weightUnit || "kg";
              updated = true;
            }
            if (!rawLog.routeId) {
              rawLog.routeId = String(schedule._id);
              updated = true;
            }
            if (updated && typeof rawLog.save === "function") {
              rawLog.save().catch(() => {});
            }
          }
        }
      } catch (_) {}
      return rawLog;
    })
  );
}

// Bin counts helper
async function getBinCounts(barangay, date) {
  const base = { barangay, date };
  const [preparedCount, pickedUpCount] = await Promise.all([
    BinStatus.countDocuments({ ...base, status: { $in: ["prepared", "pickedup"] } }),
    BinStatus.countDocuments({ ...base, status: "pickedup" }),
  ]);
  return { preparedCount, pickedUpCount };
}

// GET /api/schedules
exports.getSchedules = async (req, res, next) => {
  try {
    const { date, truckId, status } = req.query;
    const filter = barangayFilter(req.official || req);
    if (date) filter.date = date;
    if (truckId) filter.truckId = truckId;
    if (status) filter.status = status;

    const schedules = await Schedule.find(filter).sort({ date: -1, startTime: 1 });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
};

// GET /api/schedules/today
exports.getTodaySchedules = async (req, res, next) => {
  try {
    const { truckId } = req.query;
    const today = getTodayYMD();
    const filter = { date: today, ...barangayFilter(req.official || req) };
    if (truckId) filter.truckId = truckId;

    const schedules = await Schedule.find(filter).sort({ startTime: 1 });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
};

// GET /api/schedules/calendar
exports.getCalendarSchedules = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month ? String(month).padStart(2, "0") : String(new Date().getMonth() + 1).padStart(2, "0");
    const datePrefix = `${currentYear}-${currentMonth}`;

    const filter = {
      date: { $regex: new RegExp(`^${datePrefix}`) },
      ...barangayFilter(req.official || req),
    };

    const schedules = await Schedule.find(filter).sort({ date: 1, startTime: 1 });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
};

// GET /api/schedules/truck/:truckId/today
exports.getTruckTodaySchedule = async (req, res, next) => {
  try {
    const truckId = req.params.truckId.toUpperCase();
    const today = req.query.date || getTodayYMD();

    const schedules = await Schedule.find({ truckId, date: today }).sort({ createdAt: -1 });
    schedules.sort((a, b) => {
      const aDone = a.status === "completed" ? 1 : 0;
      const bDone = b.status === "completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    res.json({ schedules, today });
  } catch (err) {
    next(err);
  }
};

// GET /api/schedules/truck/:truckId/priority-stops
exports.getPriorityStops = async (req, res, next) => {
  try {
    const truckId = req.params.truckId.toUpperCase();
    const today = req.query.date || getTodayYMD();

    const schedules = await Schedule.find({ truckId, date: today }).sort({ createdAt: -1 });
    schedules.sort((a, b) => {
      const aDone = a.status === "completed" ? 1 : 0;
      const bDone = b.status === "completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (schedules.length === 0) {
      return res.json({ schedules: [], today });
    }

    const prioritizedSchedules = [];

    for (const sched of schedules) {
      if (!sched.sitioTasks || sched.sitioTasks.length <= 1) {
        prioritizedSchedules.push(sched);
        continue;
      }

      const garbageAreas = await GarbageArea.find({ barangay: sched.barangay });

      const mappedTasks = sched.sitioTasks.map((task) => {
        const match = garbageAreas.find((area) => {
          if (area.name.toLowerCase() === task.name.toLowerCase()) return true;
          const dist = haversineM(task.lat, task.lng, area.lat, area.lng);
          return dist < 200;
        });

        const status = match ? match.status : "clean";
        const priorityScore = status === "critical" ? 3 : status === "moderate" ? 2 : 1;
        return { ...task.toObject(), status, priorityScore };
      });

      mappedTasks.sort((a, b) => {
        const aDone = a.completed ? 1 : 0;
        const bDone = b.completed ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return b.priorityScore - a.priorityScore;
      });

      const schedObj = sched.toObject();
      schedObj.sitioTasks = mappedTasks;
      prioritizedSchedules.push(schedObj);
    }

    res.json({ schedules: prioritizedSchedules, today });
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules
exports.createSchedule = async (req, res, next) => {
  try {
    const {
      date,
      truckId: rawTruckId,
      driverName,
      routeId,
      routeName,
      barangay,
      sitio,
      sitios: rawSitios,
      startTime,
      endTime,
      notes,
      isPriority,
      priorityLevel,
      priorityReason,
      wasteType: rawWasteType,
    } = req.body;

    const truckId = rawTruckId?.toUpperCase();
    if (!date || !truckId) {
      return res.status(400).json({ error: "date and truckId are required" });
    }
    if (!barangay) {
      return res.status(400).json({ error: "Barangay is required" });
    }

    const wasteType = ["Malata", "Di-Malata"].includes(rawWasteType) ? rawWasteType : "Malata";

    let sitios = [];
    if (Array.isArray(rawSitios)) {
      sitios = rawSitios;
    } else if (sitio) {
      sitios = [sitio];
    }

    let finalDriverName = driverName || "";
    if (!finalDriverName) {
      const fleetTruck = await Fleet.findOne({ truckId });
      if (fleetTruck?.driver) finalDriverName = fleetTruck.driver;
    }

    let sitioTasks = [];
    let scheduledWaypoints = [];
    if (sitios.length > 0) {
      const sitioDocs = await Sitio.find({ name: { $in: sitios }, barangay });
      const sitioMap = new Map(sitioDocs.map((s) => [s.name, s]));
      sitioTasks = sitios.map((name, i) => {
        const doc = sitioMap.get(name);
        return {
          sitioId: doc ? doc._id : new mongoose.Types.ObjectId(),
          name,
          order: i,
          completed: false,
          lat: doc ? doc.lat : 0,
          lng: doc ? doc.lng : 0,
        };
      });

      const validCoords = sitioTasks.filter((t) => t.lat && t.lng).map((t) => [t.lat, t.lng]);
      if (validCoords.length >= 2) {
        try {
          const routeResult = await getRouteDirections(validCoords);
          if (Array.isArray(routeResult) && routeResult.length > 0) {
            scheduledWaypoints = routeResult;
          } else if (routeResult?.coordinates?.length) {
            scheduledWaypoints = routeResult.coordinates;
          }
        } catch (_) {}
      }
    }

    const schedule = await Schedule.create({
      date,
      truckId,
      driverName: finalDriverName,
      routeId: routeId || "",
      routeName: routeName || (sitios.length ? `${sitios.join(" -> ")} Route` : "Collection Route"),
      barangay,
      sitio: sitios.length === 1 ? sitios[0] : "",
      sitios,
      sitioTasks,
      routeCoords: scheduledWaypoints,
      scheduledWaypoints,
      startTime: startTime || "",
      endTime: endTime || "",
      notes: notes || "",
      isPriority: !!isPriority,
      priorityLevel: priorityLevel || "normal",
      priorityReason: priorityReason || "",
      wasteType,
      status: "pending",
    });

    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId, date });

    notifyTruck(
      truckId,
      "New Collection Schedule",
      `Route: ${schedule.routeName} scheduled for ${date}${startTime ? " at " + startTime : ""}.`,
      { scheduleId: String(schedule._id), date, routeName: schedule.routeName }
    ).catch(() => {});

    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules/:id/complete
exports.completeSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    schedule.status = "completed";
    schedule.completedAt = new Date();
    if (schedule.sitioTasks && schedule.sitioTasks.length > 0) {
      schedule.sitioTasks.forEach((t) => {
        t.completed = true;
        if (!t.completedAt) t.completedAt = new Date();
      });
    }
    await schedule.save();

    await addBarangayScore(schedule.barangay, 10, null, null, `Schedule ${schedule._id} completed`);

    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });

    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules/:id/complete-task
exports.completeTask = async (req, res, next) => {
  try {
    const { sitioName, completedAt } = req.body;
    if (!sitioName) return res.status(400).json({ error: "sitioName is required" });

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    const taskCompletedAt = completedAt ? new Date(completedAt) : new Date();
    let matched = false;

    if (schedule.sitioTasks && schedule.sitioTasks.length > 0) {
      schedule.sitioTasks.forEach((t) => {
        if (t.name?.trim().toLowerCase() === sitioName.trim().toLowerCase()) {
          if (!t.completed) {
            t.completed = true;
            t.completedAt = taskCompletedAt;
          }
          matched = true;
        }
      });
    }

    if (!matched) {
      return res.status(404).json({ error: `Sitio "${sitioName}" not found in this schedule` });
    }

    const allDone = schedule.sitioTasks && schedule.sitioTasks.every((t) => t.completed);
    if (allDone && schedule.status === "accepted") {
      schedule.status = "completed";
      await addBarangayScore(schedule.barangay, 10, null, null, `Schedule ${schedule._id} auto-completed`);
    }

    await schedule.save();

    const io = getIO();
    if (io) {
      io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });
      io.emit("schedule:task:completed", {
        scheduleId: schedule._id,
        truckId: schedule.truckId,
        sitioName,
        completedAt: taskCompletedAt,
        allDone,
      });
    }

    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules/clearing-status
exports.getClearingStatus = async (req, res, next) => {
  try {
    const { truckId, driverName, barangay, sitioName, status, lat, lng } = req.body;
    if (!sitioName) return res.status(400).json({ error: "sitioName is required" });

    const clearingData = {
      truckId: truckId || "TRUCK-01",
      driverName: driverName || "Driver",
      barangay: barangay || "Apas",
      sitioName,
      status: status || "clearing",
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      timestamp: new Date().toISOString(),
    };

    const io = getIO();
    if (io) io.emit("truck:clearing:update", clearingData);
    res.json({ ok: true, clearingData });
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules/truck/:truckId/start-shift
exports.startShift = async (req, res, next) => {
  try {
    const truckId = req.params.truckId.toUpperCase();
    const today = req.body.date || getTodayYMD();

    const pending = await Schedule.find({
      truckId,
      date: today,
      status: "pending",
    });

    if (pending.length === 0) {
      const accepted = await Schedule.find({
        truckId,
        date: today,
        status: "accepted",
      });
      return res.json({
        ok: true,
        message: accepted.length > 0 ? "Schedule already accepted" : "No pending schedule found for today",
        acceptedCount: accepted.length,
      });
    }

    await Schedule.updateMany(
      { truckId, date: today, status: "pending" },
      { $set: { status: "accepted" } }
    );

    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId, date: today });
    res.json({ ok: true, acceptedCount: pending.length });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/schedules/:id/status
exports.updateScheduleStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["pending", "accepted", "completed", "missed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    schedule.status = status;
    if (status === "completed" && schedule.sitioTasks && schedule.sitioTasks.length > 0) {
      schedule.sitioTasks.forEach((t) => {
        t.completed = true;
        if (!t.completedAt) t.completedAt = new Date();
      });
    } else if (status === "pending" && schedule.sitioTasks && schedule.sitioTasks.length > 0) {
      schedule.sitioTasks.forEach((t) => {
        t.completed = false;
        t.completedAt = null;
      });
    }

    await schedule.save();
    if (status === "completed") {
      await addBarangayScore(schedule.barangay, 10, null, null, `Schedule ${schedule._id} completed`);
    }

    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });

    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/schedules/:id
exports.deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (schedule) {
      const io = getIO();
      if (io) io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/schedules/:id/add-task
exports.addTaskToSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, lat, lng } = req.body;
    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    const taskName = name || "Report Location";
    const newTask = {
      name: taskName,
      lat: Number(lat) || 10.325,
      lng: Number(lng) || 123.893,
      completed: false,
    };

    if (!Array.isArray(schedule.sitioTasks)) schedule.sitioTasks = [];
    schedule.sitioTasks.push(newTask);
    if (Array.isArray(schedule.sitios) && !schedule.sitios.includes(taskName)) {
      schedule.sitios.push(taskName);
    }
    await schedule.save();

    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });

    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// GET /api/collections
exports.getCollections = async (req, res, next) => {
  try {
    const { period, truckId, date } = req.query;
    const today = new Date().toLocaleDateString("en-CA");
    const filter = {};

    if (truckId) filter.truckId = truckId.toUpperCase();
    if (date) {
      filter.date = date;
    } else if (period === "today") {
      filter.date = today;
    } else if (period === "week") {
      const now = new Date();
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString("en-CA");
      filter.date = { $gte: fmt(mon), $lte: fmt(sun) };
    } else if (period === "month") {
      const [y, m] = today.split("-");
      filter.date = { $gte: `${y}-${m}-01`, $lte: `${y}-${m}-31` };
    }

    const logs = await CollectionLog.find(filter).sort({ completedAt: -1 });
    const enriched = await enrichCollectionLogs(logs);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

// GET /api/collections/truck/:truckId
exports.getTruckCollections = async (req, res, next) => {
  try {
    const { truckId } = req.params;
    const { period = "all" } = req.query;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const filter = { truckId: { $regex: new RegExp(`^${truckId}$`, "i") } };

    if (period === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      filter.$or = [{ date: today }, { completedAt: { $gte: startOfDay } }];
    } else if (period === "week") {
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      filter.date = { $gte: fmt(mon), $lte: fmt(sun) };
    } else if (period === "month") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      filter.date = { $gte: `${y}-${m}-01`, $lte: `${y}-${m}-31` };
    }

    let logs = await CollectionLog.find(filter).sort({ completedAt: -1 });
    const enriched = await enrichCollectionLogs(logs);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/collections/:id
exports.updateCollection = async (req, res, next) => {
  try {
    const { weight, weightUnit, disposalFacility, disposalPhoto, routeName, applyToRoute } = req.body;
    const log = await CollectionLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "Collection log not found" });

    if (weight !== undefined && weight !== null && !isNaN(Number(weight))) {
      log.weight = Number(weight);
    }
    if (weightUnit) log.weightUnit = weightUnit;
    if (disposalFacility) log.disposalFacility = disposalFacility;
    if (disposalPhoto) log.disposalPhoto = disposalPhoto;
    if (routeName) log.routeName = routeName;
    await log.save();

    if (applyToRoute) {
      const matchCriteria = log.routeId ? { routeId: log.routeId } : { truckId: log.truckId, date: log.date };
      const siblings = await CollectionLog.find(matchCriteria);
      for (const sib of siblings) {
        if (String(sib._id) !== String(log._id)) {
          if (weight !== undefined && weight !== null && !isNaN(Number(weight))) sib.weight = Number(weight);
          if (weightUnit) sib.weightUnit = weightUnit;
          if (disposalFacility) sib.disposalFacility = disposalFacility;
          if (disposalPhoto) sib.disposalPhoto = disposalPhoto;
          if (routeName) sib.routeName = routeName;
          await sib.save();
          const io = getIO();
          if (io) io.emit("collection:updated", sib);
        }
      }
      if (log.routeId) {
        const schedule = await Schedule.findById(log.routeId).catch(() => null);
        if (schedule) {
          if (weight !== undefined && weight !== null && !isNaN(Number(weight))) {
            schedule.totalWeight = Number(weight) * (siblings.length || 1);
          }
          if (weightUnit) schedule.weightUnit = weightUnit;
          if (disposalFacility) schedule.disposalFacility = disposalFacility;
          if (disposalPhoto) schedule.disposalPhoto = disposalPhoto;
          await schedule.save();
        }
      }
    }

    const io = getIO();
    if (io) io.emit("collection:updated", log);
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/collections/batch-weigh
exports.batchWeighCollections = async (req, res, next) => {
  try {
    const { truckId, date, scheduleId, totalWeight, weightUnit = "kg", disposalFacility, disposalPhoto } = req.body;
    if (!truckId) return res.status(400).json({ error: "truckId is required" });
    const targetDate = date || new Date().toLocaleDateString("en-CA");

    const query = scheduleId
      ? { $or: [{ routeId: scheduleId }, { truckId: truckId.toUpperCase(), date: targetDate }] }
      : { truckId: truckId.toUpperCase(), date: targetDate };

    const logs = await CollectionLog.find(query);
    const numLogs = logs.length;
    const totalW = Number(totalWeight) || 0;
    const perStopWeight = numLogs > 0 ? Math.round((totalW / numLogs) * 100) / 100 : totalW;

    const io = getIO();

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (totalW > 0) {
        l.weight = i === logs.length - 1 ? Math.round((totalW - perStopWeight * (numLogs - 1)) * 100) / 100 : perStopWeight;
      }
      if (weightUnit) l.weightUnit = weightUnit;
      if (disposalFacility) l.disposalFacility = disposalFacility;
      if (disposalPhoto) l.disposalPhoto = disposalPhoto;
      if (scheduleId && !l.routeId) l.routeId = scheduleId;
      await l.save();
      if (io) io.emit("collection:updated", l);
    }

    if (scheduleId) {
      const schedule = await Schedule.findById(scheduleId).catch(() => null);
      if (schedule) {
        schedule.status = "completed";
        if (totalW > 0) schedule.totalWeight = totalW;
        if (weightUnit) schedule.weightUnit = weightUnit;
        if (disposalFacility) schedule.disposalFacility = disposalFacility;
        if (disposalPhoto) schedule.disposalPhoto = disposalPhoto;
        await schedule.save();

        if (io) {
          const shiftPayload = {
            scheduleId: schedule._id,
            truckId: schedule.truckId,
            driverName: schedule.driverName,
            barangay: schedule.barangay,
            routeName: schedule.routeName,
            totalSitios: schedule.sitioTasks?.length || 1,
            totalWeight: schedule.totalWeight,
            weightUnit: schedule.weightUnit,
            disposalFacility: schedule.disposalFacility,
            disposalPhoto: schedule.disposalPhoto,
            completedAt: schedule.completedAt || new Date(),
          };
          io.emit("truck:shift-completed", shiftPayload);
          io.emit("route:completed", shiftPayload);
        }
      }
    }

    res.json({ success: true, updatedCount: logs.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/collections
exports.createCollection = async (req, res, next) => {
  try {
    const {
      truckId,
      date: rawDate,
      stopName,
      stopAddress,
      wasteType,
      weight,
      weightUnit,
      disposalFacility,
      disposalPhoto,
      bins,
      routeId,
      routeName,
      route,
      scheduleId,
      lat,
      lng,
      driverName,
      beforeImage,
      afterImage,
      status,
      durationMinutes,
      duration,
      completedAt,
    } = req.body;

    if (!truckId) return res.status(400).json({ error: "truckId is required" });

    const date = rawDate || new Date().toLocaleDateString("en-CA");
    const parsedDuration = Number(durationMinutes || duration || 30);
    const resolvedRouteId = routeId || scheduleId || "";
    let resolvedRouteName = routeName || route || "";
    let resolvedFacility = disposalFacility || "";
    let resolvedPhoto = disposalPhoto || "";
    let resolvedWeight = weight != null ? Number(weight) : 0;
    let resolvedUnit = weightUnit || "kg";

    if (!resolvedRouteName || !resolvedFacility || resolvedWeight === 0) {
      try {
        const sched = resolvedRouteId
          ? await Schedule.findById(resolvedRouteId).catch(() => null)
          : await Schedule.findOne({ truckId: truckId.toUpperCase(), date }).sort({ createdAt: -1 }).catch(() => null);
        if (sched) {
          if (!resolvedRouteName) resolvedRouteName = sched.routeName || `${sched.barangay || "Barangay"} Route`;
          if (!resolvedFacility && sched.disposalFacility) resolvedFacility = sched.disposalFacility;
          if (!resolvedPhoto && sched.disposalPhoto) resolvedPhoto = sched.disposalPhoto;
          if (resolvedWeight === 0 && sched.totalWeight > 0) {
            const stopCount = sched.sitioTasks?.length || 1;
            resolvedWeight = Math.round((sched.totalWeight / stopCount) * 100) / 100;
            resolvedUnit = sched.weightUnit || "kg";
          }
        }
      } catch (_) {}
    }

    const log = await CollectionLog.create({
      truckId,
      date,
      stopName: stopName || "",
      stopAddress: stopAddress || "",
      wasteType: wasteType || "General",
      weight: resolvedWeight,
      weightUnit: resolvedUnit,
      disposalFacility: resolvedFacility,
      disposalPhoto: resolvedPhoto,
      bins: bins != null ? bins : 1,
      routeId: resolvedRouteId,
      routeName: resolvedRouteName,
      lat: lat != null ? lat : null,
      lng: lng != null ? lng : null,
      driverName: driverName || truckId || "",
      beforeImage: beforeImage || "",
      afterImage: afterImage || "",
      status: status || "clean",
      durationMinutes: parsedDuration,
      completedAt: completedAt ? new Date(completedAt) : new Date(),
    });

    const io = getIO();
    if (io) io.emit("collection:new", log);

    if (lat != null && lng != null) {
      const latDelta = 0.003;
      const lngDelta = 0.003;
      const nearbyAreas = await GarbageArea.find({
        lat: { $gte: lat - latDelta, $lte: lat + latDelta },
        lng: { $gte: lng - lngDelta, $lte: lng + lngDelta },
      });
      for (const area of nearbyAreas) {
        if (haversineM(lat, lng, area.lat, area.lng) <= 300) {
          area.lastCollectionAt = new Date();
          area.lastCollectionBy = driverName || truckId || "Unknown";
          area.lastCollectionId = log._id;
          await area.save();
          await recalculateAndEmitZone(area._id, "collection_completed", driverName || truckId, resolvedWeight, log._id);
        }
      }
    }

    res.json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/pickup/complete
exports.completePickup = async (req, res, next) => {
  try {
    const { truckId, driverName, routeId, routeName, barangay: clientBarangay, stops, totalWeight } = req.body;
    if (!truckId) return res.status(400).json({ error: "truckId required" });

    let resolvedBarangay = clientBarangay || "";
    if (routeId && mongoose.Types.ObjectId.isValid(routeId)) {
      const routeDoc = await Schedule.findById(routeId).select("barangay").lean();
      if (routeDoc?.barangay) resolvedBarangay = routeDoc.barangay;
    }

    const run = await PickupRun.create({
      truckId,
      driverName: driverName || "",
      routeId: routeId || "",
      routeName: routeName || "",
      barangay: resolvedBarangay,
      stopsCompleted: stops || [],
      totalStops: (stops || []).length,
      totalWeight: totalWeight || 0,
    });

    if (resolvedBarangay) {
      await addBarangayScore(resolvedBarangay, 5, "collectionScore", "pickupCount");
    }

    const io = getIO();
    if (io) io.emit("pickup:completed", run);
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
};

// GET /api/pickup
exports.getPickups = async (req, res, next) => {
  try {
    const { barangay } = req.query;
    const filter = {};
    if (barangay) filter.barangay = barangay;
    const runs = await PickupRun.find(filter).sort({ completedAt: -1 }).limit(30);
    res.json(runs);
  } catch (err) {
    next(err);
  }
};

// POST /api/pickup/:id/verify
exports.verifyPickup = async (req, res, next) => {
  try {
    const { userId, confirmed } = req.body;
    if (userId === undefined || confirmed === undefined) {
      return res.status(400).json({ error: "userId and confirmed required" });
    }

    const run = await PickupRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: "Pickup run not found" });

    const alreadyVerified = run.verifications?.some((v) => v.userId?.toString() === userId.toString());
    if (alreadyVerified) return res.status(400).json({ error: "Already verified" });

    run.verifications = run.verifications || [];
    run.verifications.push({ userId, confirmed });
    await run.save();

    const io = getIO();

    if (confirmed) {
      if (run.barangay) {
        await addBarangayScore(run.barangay, 10, "collectionScore", null, "Resident confirmed pickup");
      }
    } else {
      const missed = await Report.create({
        title: "Missed Pickup",
        category: "Uncollected Waste",
        description: `Resident reported that Truck ${run.truckId} did not collect waste in their area during the ${run.routeName || "scheduled"} run.`,
        barangay: run.barangay || "",
        userId,
        reportedBy: "Resident",
        priority: "Medium",
        deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
        statusHistory: [{ status: "pending", changedBy: "Resident", changedAt: new Date() }],
      });
      if (io) io.emit("report:new", missed);
      if (run.barangay) {
        await addBarangayScore(run.barangay, -5, "collectionScore", null, "Resident disputed pickup");
      }
    }

    if (io) io.emit("pickup:verified", { pickupId: run._id, userId, confirmed });
    res.json({ ok: true, confirmed });
  } catch (err) {
    next(err);
  }
};

// POST /api/bin/prepare
exports.prepareBin = async (req, res, next) => {
  try {
    const { residentId, barangay } = req.body;
    if (!residentId || !barangay) return res.status(400).json({ error: "residentId and barangay required" });
    const date = new Date().toISOString().slice(0, 10);
    const existing = await BinStatus.findOne({ residentId, date });
    if (!existing || existing.status !== "prepared") {
      awardResidentPoints(residentId, 2, "bin_prepared", "Prepared bin for active garbage collection").catch(() => {});
    }
    await BinStatus.findOneAndUpdate(
      { residentId, date },
      { barangay, status: "prepared" },
      { upsert: true, new: true }
    );
    const counts = await getBinCounts(barangay, date);
    const io = getIO();
    if (io) io.emit("bin:status:update", { barangay, date, ...counts });
    res.json({ ok: true, pointsAwarded: !existing || existing.status !== "prepared" ? 2 : 0, ...counts });
  } catch (err) {
    next(err);
  }
};

// POST /api/bin/pickedup
exports.pickupBin = async (req, res, next) => {
  try {
    const { residentId, barangay, truckId } = req.body;
    if (!residentId || !barangay) return res.status(400).json({ error: "residentId and barangay required" });
    const date = new Date().toISOString().slice(0, 10);
    await BinStatus.findOneAndUpdate(
      { residentId, date },
      { barangay, status: "pickedup", truckId: truckId || "" },
      { upsert: true, new: true }
    );
    await addBarangayScore(barangay, 1, "collectionScore", "pickupCount", "Pickup logged");
    awardResidentPoints(residentId, 1, "bin_pickedup", "Marked trash as picked up").catch(() => {});
    const counts = await getBinCounts(barangay, date);
    const io = getIO();
    if (io) io.emit("bin:status:update", { barangay, date, ...counts });
    res.json({ ok: true, ...counts });
  } catch (err) {
    next(err);
  }
};

// GET /api/bin/status
exports.getBinStatus = async (req, res, next) => {
  try {
    const { barangay, date } = req.query;
    const today = date || new Date().toISOString().slice(0, 10);
    if (!barangay) return res.status(400).json({ error: "barangay required" });
    const counts = await getBinCounts(barangay, today);
    res.json({ barangay, date: today, ...counts });
  } catch (err) {
    next(err);
  }
};
