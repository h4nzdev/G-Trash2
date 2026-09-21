const express = require("express");
const router = express.Router();
const areaController = require("../controllers/areaController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

// Garbage Areas & Heatmap Nodes
router.put("/garbage-areas/:id/toggle-active", areaController.toggleGarbageAreaActive);
router.delete("/garbage-areas/:id", areaController.deleteGarbageArea);
router.get("/garbage-areas", optionalAuth, areaController.getGarbageAreas);
router.post("/garbage-areas", areaController.createGarbageArea);

// Sitios
router.get("/sitios", areaController.getSitios);
router.post("/sitios", authMiddleware, areaController.createSitio);

// Zones
router.post("/zones/:zoneId/recalculate", areaController.recalculateZone);
router.patch("/zones/:zoneId/status", areaController.updateZoneStatus);
router.get("/zones/:zoneId", areaController.getZoneById);
router.get("/zones", areaController.getZones);

// Sensor Zones
router.get("/sensor-zones", areaController.getSensorZones);
router.post("/sensor-zones", optionalAuth, areaController.registerSensorZone);

// Barangay Boundaries
router.get("/barangays/boundaries", areaController.getBarangayBoundaries);
router.get("/barangays/:barangay/boundary", areaController.getBarangayBoundary);
router.post("/barangays/boundary", authMiddleware, areaController.updateBarangayBoundary);
router.post("/admin/generate-boundary", authMiddleware, areaController.generateBarangayBoundary);

module.exports = router;
