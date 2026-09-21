const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

// Schedule queries
router.get("/today", scheduleController.getTodaySchedules);
router.get("/calendar", optionalAuth, scheduleController.getCalendarSchedules);
router.get("/truck/:truckId/today", scheduleController.getTruckTodaySchedule);
router.get("/truck/:truckId/priority-stops", scheduleController.getPriorityStops);
router.get("/", optionalAuth, scheduleController.getSchedules);

// Schedule actions
router.post("/", authMiddleware, scheduleController.createSchedule);
router.delete("/:id", authMiddleware, scheduleController.deleteSchedule);
router.post("/:id/complete", scheduleController.completeSchedule);
router.post("/:id/complete-task", scheduleController.completeTask);
router.post("/clearing-status", scheduleController.getClearingStatus);
router.post("/truck/:truckId/start-shift", scheduleController.startShift);
router.patch("/:id/status", authMiddleware, scheduleController.updateScheduleStatus);

// Collections
router.get("/collections", optionalAuth, scheduleController.getCollections);
router.get("/collections/truck/:truckId", scheduleController.getTruckCollections);
router.patch("/collections/:id", scheduleController.updateCollection);
router.post("/collections/batch-weigh", scheduleController.batchWeighCollections);
router.post("/collections", scheduleController.createCollection);

// Pickup runs
router.post("/pickup/complete", scheduleController.completePickup);
router.get("/pickup", scheduleController.getPickups);
router.post("/pickup/:id/verify", scheduleController.verifyPickup);

// Bin status
router.post("/bin/prepare", scheduleController.prepareBin);
router.post("/bin/pickedup", scheduleController.pickupBin);
router.get("/bin/status", scheduleController.getBinStatus);

module.exports = router;
