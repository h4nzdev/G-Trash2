const express = require("express");
const router = express.Router();
const systemController = require("../controllers/systemController");
const { authMiddleware } = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");

// Admin system stats & health
router.get("/admin/stats", authMiddleware, systemController.getAdminStats);
router.get("/stats", authMiddleware, systemController.getAdminStats);
router.get("/admin/system-health", authMiddleware, systemController.getSystemHealth);
router.get("/health", authMiddleware, systemController.getSystemHealth);
router.get("/admin/active-sessions", authMiddleware, systemController.getActiveSessions);

// Error logs
router.get("/admin/error-logs", authMiddleware, systemController.getErrorLogs);
router.patch("/admin/error-logs/:id/resolve", authMiddleware, systemController.resolveErrorLog);
router.post("/admin/error-logs/seed", authMiddleware, systemController.seedErrorLogs);

// Bug reports
router.post("/bugs", systemController.createBugReport);
router.get("/bugs", authMiddleware, systemController.getBugReports);
router.patch("/bugs/:id", authMiddleware, systemController.updateBugReport);

// AI Assistant
router.post("/ai/chat", systemController.aiChat);

// Upload
router.post("/upload", async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No image data provided" });
    const result = await cloudinary.uploader.upload(data, {
      folder: "gtrash",
      resource_type: "image",
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
