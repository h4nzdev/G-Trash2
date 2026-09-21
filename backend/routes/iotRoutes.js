const express = require("express");
const router = express.Router();
const iotController = require("../controllers/iotController");
const { optionalAuth } = require("../middleware/auth");

// Sensor data ingestion
router.post("/sensor-data", iotController.ingestSensorData);

// Readings
router.get("/readings/latest", optionalAuth, iotController.getLatestReadings);
router.get("/readings", optionalAuth, iotController.getReadings);
router.get("/trends", optionalAuth, iotController.getTrends);

// Alerts
router.get("/alerts", optionalAuth, iotController.getAlerts);
router.patch("/alerts/:id/acknowledge", iotController.acknowledgeAlert);
router.delete("/alerts/:id", optionalAuth, iotController.deleteAlert);
router.delete("/alerts", optionalAuth, iotController.clearAlerts);

// Summaries
router.get("/health-summary", iotController.getHealthSummary);
router.get("/summary", optionalAuth, iotController.getSummary);

module.exports = router;
