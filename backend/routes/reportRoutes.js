const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

// Bulk deletes
router.delete("/iot-bulk", authMiddleware, reportController.deleteIoTBulk);
router.delete("/batch", authMiddleware, reportController.batchDelete);

// Suggestions
router.get("/:id/suggestions", reportController.getSuggestions);

// Individual report actions
router.post("/:id/verify", reportController.verifyReport);
router.patch("/:id/health-flag", authMiddleware, reportController.updateHealthFlag);
router.patch("/:id/health-note", authMiddleware, reportController.updateHealthNote);
router.post("/:id/assign-priority", authMiddleware, reportController.assignPriority);
router.post("/:id/vote", reportController.voteReport);
router.post("/:id/comment", reportController.addComment);

// Main CRUD
router.get("/:id", optionalAuth, reportController.getReportById);
router.patch("/:id", authMiddleware, reportController.updateReport);
router.delete("/:id", authMiddleware, reportController.deleteReport);
router.get("/", optionalAuth, reportController.getReports);
router.post("/", reportController.createReport);

module.exports = router;
