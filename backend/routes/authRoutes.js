const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { Resident } = require("../models");

// Resident registration & login
router.post("/register", authController.registerResident);
router.post("/resident/register", authController.registerResident);
router.post("/login", authController.loginResident);
router.post("/resident/login", authController.loginResident);

// Residents lookup
router.get("/residents/search", authMiddleware, authController.searchResidents);
router.get("/search", authMiddleware, authController.searchResidents);

// Resident profile
router.get("/resident/:id", optionalAuth, authController.getResidentById);
router.get("/:id", optionalAuth, authController.getResidentById);
router.patch("/resident/:id", authMiddleware, authController.updateResident);
router.patch("/:id", authMiddleware, authController.updateResident);

// Notifications clearing
router.post("/resident/:id/clear-notifications", authMiddleware, authController.clearNotifications);
router.delete("/:id/notifications", authMiddleware, authController.clearNotifications);

// Push token registration
router.put("/:id/push-token", async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: "pushToken required" });
    await Resident.findByIdAndUpdate(req.params.id, { pushToken }, { new: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
