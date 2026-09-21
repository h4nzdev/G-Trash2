const { Fleet, Truck, CollectionLog, PickupRun, Schedule, BarangayBoundary } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const { isInsidePolygon, haversineDistanceMeters } = require("../utils/geoUtils");

async function generateUniqueTruckId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id, exists;
  do {
    const suffix = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    id = `GT-${suffix}`;
    exists = await Fleet.findOne({ truckId: id });
  } while (exists);
  return id;
}

// GET /api/fleet
exports.getFleet = async (req, res, next) => {
  try {
    const filter = barangayFilter(req.official || req);
    const fleet = await Fleet.find(filter).sort({ createdAt: -1 });
    res.json(fleet);
  } catch (err) {
    next(err);
  }
};

// GET /api/fleet/:truckId
exports.getFleetById = async (req, res, next) => {
  try {
    const truck = await Fleet.findOne({ truckId: req.params.truckId.toUpperCase() });
    if (!truck) {
      const liveTruck = await Truck.findOne({ truckId: req.params.truckId.toUpperCase() });
      if (!liveTruck) return res.status(404).json({ error: "Truck not found" });
      return res.json(liveTruck);
    }
    res.json(truck);
  } catch (err) {
    next(err);
  }
};

// GET /api/fleet/active
exports.getActiveFleet = async (req, res, next) => {
  try {
    const filter = barangayFilter(req.official || req);
    const fleet = await Fleet.find(filter);
    const trucks = await Truck.find();
    const truckMap = new Map(trucks.map((t) => [t.truckId, t]));

    const result = fleet.map((f) => {
      const live = truckMap.get(f.truckId);
      return {
        ...f.toObject(),
        liveStatus: live ? live.status : "offline",
        lat: live ? live.lat : null,
        lng: live ? live.lng : null,
        speed: live ? live.speed : 0,
        heading: live ? live.heading : 0,
        lastSeen: live ? live.updatedAt : null,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/fleet
exports.createFleet = async (req, res, next) => {
  const {
    registrationType,
    assignedTruck,
    driverName,
    driverId,
    driverPhone,
    driverImage,
    truckModel,
    model,
    plateNumber,
    fuelType,
    capacity,
    route,
    type,
    serviceBarangays,
    wasteType,
  } = req.body;

  try {
    const brgy = req.official?.barangay;

    if (registrationType === "driver") {
      if (!driverName?.trim()) {
        return res.status(400).json({ error: "driverName is required" });
      }

      if (assignedTruck) {
        const updatePayload = {
          driverName: driverName.trim(),
          driverId: driverId?.trim() || "",
          driverImage: driverImage || null,
        };
        if (driverPhone !== undefined) updatePayload.driverPhone = driverPhone.trim();

        const updatedTruck = await Fleet.findOneAndUpdate({ truckId: assignedTruck }, updatePayload, { new: true });
        if (updatedTruck) {
          const io = getIO();
          if (io) io.emit("fleet:updated", updatedTruck);
          return res.status(200).json(updatedTruck);
        }
      }

      const truckId = await generateUniqueTruckId();
      const entry = await Fleet.create({
        truckId,
        driverName: driverName.trim(),
        driverId: driverId?.trim() || "",
        driverPhone: driverPhone?.trim() || "",
        driverImage: driverImage || null,
        route: route || "",
        barangay: brgy === "All" ? "" : brgy || "",
        type: type || "dedicated",
        serviceBarangays: Array.isArray(serviceBarangays) ? serviceBarangays : [],
      });
      const io = getIO();
      if (io) io.emit("fleet:new", entry);
      return res.status(201).json(entry);
    }

    const homeBrgy = brgy === "All" ? "" : brgy || "";
    let finalServiceBarangays = [];
    if (type === "shared") {
      finalServiceBarangays = Array.isArray(serviceBarangays) ? [...serviceBarangays] : [];
      if (homeBrgy && !finalServiceBarangays.map((b) => b.toLowerCase()).includes(homeBrgy.toLowerCase())) {
        finalServiceBarangays.unshift(homeBrgy);
      }
    }

    const truckId = await generateUniqueTruckId();
    const entry = await Fleet.create({
      truckId,
      model: (truckModel || model || "").trim(),
      plateNumber: (plateNumber || "").trim().toUpperCase(),
      fuelType: fuelType || "Diesel",
      capacity: capacity ? Number(capacity) : 0,
      driverName: driverName?.trim() || "Unassigned",
      driverId: driverId?.trim() || "",
      driverPhone: driverPhone?.trim() || "",
      driverImage: driverImage || null,
      route: route || "",
      barangay: homeBrgy,
      type: type || "dedicated",
      serviceBarangays: finalServiceBarangays,
      wasteType: wasteType || "Both",
    });

    const io = getIO();
    if (io) io.emit("fleet:new", entry);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/fleet/:truckId
exports.updateFleet = async (req, res, next) => {
  try {
    const entry = await Fleet.findOneAndUpdate({ truckId: req.params.truckId }, req.body, { new: true });
    if (!entry) return res.status(404).json({ error: "Truck ID not found" });
    const io = getIO();
    if (io) io.emit("fleet:updated", entry);
    res.json(entry);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/fleet/:truckId/self (Driver self-update)
exports.updateDriverSelf = async (req, res, next) => {
  try {
    const { driverName, driverPhone } = req.body;
    const update = {};
    if (driverName?.trim()) update.driverName = driverName.trim();
    if (driverPhone !== undefined) update.driverPhone = driverPhone.trim();
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "driverName or driverPhone required" });
    }

    const entry = await Fleet.findOneAndUpdate({ truckId: req.params.truckId }, update, { new: true });
    if (!entry) return res.status(404).json({ error: "Truck ID not found" });
    const io = getIO();
    if (io) io.emit("fleet:updated", entry);
    res.json(entry);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/fleet/:truckId
exports.deleteFleet = async (req, res, next) => {
  try {
    await Fleet.findOneAndDelete({ truckId: req.params.truckId });
    const io = getIO();
    if (io) io.emit("fleet:deleted", { truckId: req.params.truckId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/trucks/location
exports.updateTruckLocation = async (req, res, next) => {
  try {
    const { truckId, lat, lng, heading = 0, speed = 0 } = req.body;
    if (!truckId || lat == null || lng == null) {
      return res.status(400).json({ error: "truckId, lat and lng are required" });
    }

    const truck = await Truck.findOneAndUpdate(
      { truckId: truckId.toUpperCase() },
      { lat, lng, heading, speed, status: "online", updatedAt: new Date() },
      { upsert: true, new: true }
    );

    const io = getIO();
    if (io) {
      io.emit("truck:location:update", {
        truckId: truck.truckId,
        lat,
        lng,
        heading,
        speed,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ ok: true, truck });
  } catch (err) {
    next(err);
  }
};

// GET /api/trucks/locations
exports.getTruckLocations = async (req, res, next) => {
  try {
    const trucks = await Truck.find();
    res.json(trucks);
  } catch (err) {
    next(err);
  }
};
