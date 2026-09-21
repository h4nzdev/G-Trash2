const { Truck, GarbageArea, IoTAlert } = require("../models");
const { haversineDistanceMeters } = require("../utils/geoUtils");

const CLEANUP_RADIUS_M = 80;
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// truckId → { areaId, areaName, barangay, enteredAt, timerId }
const truckProximityMap = new Map();
// socketId → truckId (for auto-offline on disconnect)
const socketTruckMap = new Map();

async function checkTruckProximity(io, truckId) {
  try {
    const truck = await Truck.findOne({ truckId }).select("lat lng").lean();
    if (!truck || truck.lat == null) return;

    const areas = await GarbageArea.find({ status: { $ne: "clean" } })
      .select("_id name barangay lat lng")
      .lean();

    let nearest = null;
    let nearestDist = Infinity;
    for (const area of areas) {
      if (area.lat == null || area.lng == null) continue;
      const d = haversineDistanceMeters(truck.lat, truck.lng, area.lat, area.lng);
      if (d <= CLEANUP_RADIUS_M && d < nearestDist) {
        nearestDist = d;
        nearest = area;
      }
    }

    const existing = truckProximityMap.get(truckId);

    if (nearest) {
      if (existing && existing.areaId.toString() === nearest._id.toString()) return;
      if (existing) clearTimeout(existing.timerId);

      const timerId = setTimeout(() => {
        truckProximityMap.delete(truckId);
        io?.to("truck:" + truckId).emit("truck:area-timeout", {
          areaId: nearest._id,
          areaName: nearest.name,
          barangay: nearest.barangay,
        });
      }, CLEANUP_TIMEOUT_MS);

      truckProximityMap.set(truckId, {
        areaId: nearest._id,
        areaName: nearest.name,
        barangay: nearest.barangay,
        enteredAt: Date.now(),
        timerId,
      });

      io?.to("truck:" + truckId).emit("truck:near-area", {
        areaId: nearest._id,
        areaName: nearest.name,
        barangay: nearest.barangay,
        distance: Math.round(nearestDist),
      });
    } else if (existing) {
      clearTimeout(existing.timerId);
      truckProximityMap.delete(truckId);
      io?.to("truck:" + truckId).emit("truck:left-area", {});
    }
  } catch (err) {
    console.error("[Proximity] Error:", err.message);
  }
}

module.exports = function registerTruckSockets(io, socket) {
  // GarbageTruck app sends live GPS position
  socket.on("truck:location", async (data, ack) => {
    const { truckId, lat, lng, heading = 0, speed = 0 } = data;
    if (!truckId || lat == null || lng == null) {
      if (typeof ack === "function") ack({ ok: false, error: "Missing fields" });
      return;
    }

    socketTruckMap.set(socket.id, truckId);
    socket.join("truck:" + truckId);

    try {
      await Truck.findOneAndUpdate(
        { truckId },
        { lat, lng, heading, speed, status: "online", updatedAt: new Date() },
        { upsert: true, new: true }
      );
      if (typeof ack === "function") ack({ ok: true, truckId, lat, lng });

      socket.broadcast.emit("truck:location:update", {
        truckId,
        lat,
        lng,
        heading,
        speed,
        timestamp: new Date().toISOString(),
      });

      checkTruckProximity(io, truckId).catch(() => {});
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  // Batch location sync handler for offline buffering
  socket.on("truck:location:batch", async ({ truckId, points }, ack) => {
    if (!truckId || !Array.isArray(points) || points.length === 0) {
      if (typeof ack === "function") ack({ ok: false, error: "Invalid payload" });
      return;
    }
    const lastPoint = points[points.length - 1];
    try {
      await Truck.findOneAndUpdate(
        { truckId },
        {
          lat: lastPoint.lat,
          lng: lastPoint.lng,
          heading: lastPoint.heading || 0,
          speed: lastPoint.speed || 0,
          status: "online",
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      if (typeof ack === "function") ack({ ok: true, count: points.length });

      socket.broadcast.emit("truck:location:update", {
        truckId,
        lat: lastPoint.lat,
        lng: lastPoint.lng,
        heading: lastPoint.heading || 0,
        speed: lastPoint.speed || 0,
        timestamp: new Date().toISOString(),
      });

      checkTruckProximity(io, truckId).catch(() => {});
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  // Truck marks itself offline
  socket.on("truck:offline", async ({ truckId }) => {
    if (!truckId) return;
    socketTruckMap.delete(socket.id);
    try {
      await Truck.findOneAndUpdate({ truckId }, { status: "offline" });
    } catch (err) {
      console.error("DB write error:", err.message);
    }
    io.emit("truck:status", { truckId, status: "offline", reason: "offline" });
  });

  // Truck reports it is off its assigned route
  socket.on("truck:off-route", (data) => {
    io.emit("truck:off-route", data);
  });

  // Driver requests help from dispatch
  socket.on("truck:contact-dispatch", (data) => {
    socket.broadcast.emit("truck:contact-dispatch", data);
  });

  // Truck completes its shift and route
  socket.on("truck:shift-completed", async (data) => {
    io.emit("truck:shift-completed", data);
    try {
      const alertMsg = `Truck ${data.truckId} (${data.driverName || "Collector"}) completed route in ${data.barangay || "assigned area"}. Transporting collected waste to ${data.disposalFacility || "waste processing"}.`;
      await IoTAlert.create({
        sensorId: data.truckId || "TRUCK",
        location: data.disposalFacility || "Waste Processing Facility",
        barangay: data.barangay || "Cebu City",
        severity: "info",
        message: alertMsg,
        acknowledged: false,
      });
    } catch (_) {}
  });

  // Auto-offline on disconnect (app closed, wifi/data disconnected)
  socket.on("disconnect", async () => {
    const truckId = socketTruckMap.get(socket.id);
    if (truckId) {
      socketTruckMap.delete(socket.id);
      try {
        await Truck.findOneAndUpdate({ truckId }, { status: "offline" });
      } catch (_) {}
      io.emit("truck:status", { truckId, status: "offline", reason: "offline" });
      console.log(`[Socket] Truck ${truckId} auto-offline on disconnect (app closed or off wifi)`);
    }
  });
};

module.exports.socketTruckMap = socketTruckMap;
module.exports.truckProximityMap = truckProximityMap;
