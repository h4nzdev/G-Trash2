const mongoose = require("mongoose");
const { Route, BarangayBoundary } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const { isInsidePolygon } = require("../utils/geoUtils");
const { getRouteDirections } = require("../services/routingService");

// GET /api/routes
exports.getRoutes = async (req, res, next) => {
  try {
    const filter = barangayFilter(req.official || req);
    const routes = await Route.find(filter).sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    next(err);
  }
};

// GET /api/routes/truck/:truckId
exports.getRouteByTruckId = async (req, res, next) => {
  try {
    const route = await Route.findOne({ truckId: req.params.truckId }).sort({ createdAt: -1 });
    if (!route) return res.status(404).json({ error: "No route assigned to this truck" });
    res.json(route);
  } catch (err) {
    next(err);
  }
};

// GET /api/routes/:id
exports.getRouteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      return res.status(400).json({ error: "Invalid route ID" });
    }

    let route = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      route = await Route.findById(id);
    }
    if (!route) {
      route = await Route.findOne({ _id: id });
    }
    if (!route) {
      route = await Route.findOne({ name: id });
    }

    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
};

// POST /api/routes
exports.createRoute = async (req, res, next) => {
  const { name, truckId, driverName, waypoints, routeCoords, totalStops } = req.body;
  if (!name || !waypoints || waypoints.length < 2) {
    return res.status(400).json({ error: "name and at least 2 waypoints are required" });
  }
  try {
    const brgy = req.official?.barangay;

    // Check Geo-Fencing if boundary is defined
    if (brgy && brgy !== "All") {
      const boundaryDoc = await BarangayBoundary.findOne({ barangay: brgy });
      if (boundaryDoc?.boundary) {
        const polygon = boundaryDoc.boundary;
        const illegalWaypoints = waypoints.filter((wp) => !isInsidePolygon([wp.lat, wp.lng], polygon));
        if (illegalWaypoints.length > 0) {
          return res.status(403).json({
            error: "Jurisdiction violation!",
            message: `Some waypoints are outside ${brgy} boundaries. You cannot create routes in other barangays.`,
          });
        }
      }
    }

    const calculatedCoords = routeCoords && routeCoords.length > 0 ? routeCoords : await getRouteDirections(waypoints);

    const route = await Route.create({
      name,
      truckId: truckId || null,
      driverName: driverName || "",
      barangay: brgy === "All" ? "" : brgy,
      waypoints,
      routeCoords: calculatedCoords || [],
      totalStops: totalStops || waypoints.length,
    });

    const io = getIO();
    if (io) io.emit("route:new", route);
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/routes/:id
exports.updateRoute = async (req, res, next) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ error: "Route not found" });

    const io = getIO();
    if (io) {
      io.emit("route:updated", route);
      if (route.truckId) io.emit("route:assigned", { truckId: route.truckId });
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/routes/:id
exports.deleteRoute = async (req, res, next) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/routes/route-directions
exports.getRouteDirections = async (req, res, next) => {
  try {
    const { waypoints } = req.body;
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: "At least 2 waypoints required" });
    }
    const coords = await getRouteDirections(waypoints);
    res.json({ routeCoords: coords });
  } catch (err) {
    next(err);
  }
};
