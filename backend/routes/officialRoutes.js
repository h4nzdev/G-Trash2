const express = require("express");
const router = express.Router();
const officialController = require("../controllers/officialController");
const { authMiddleware } = require("../middleware/auth");

// Officials auth & profile
router.post("/login", officialController.login);
router.get("/me", authMiddleware, officialController.getMe);
router.patch("/signature", authMiddleware, officialController.updateSignature);
router.put("/signature", authMiddleware, officialController.updateSignature);
router.put("/:id/signature", authMiddleware, officialController.updateSignature);
router.patch("/password", authMiddleware, officialController.changePassword);
router.patch("/change-password", authMiddleware, officialController.changePassword);
router.post("/change-password", authMiddleware, officialController.changePassword);

// Superadmin Officials management
router.get("/admin/officials", authMiddleware, officialController.getOfficials);
router.post("/admin/officials", authMiddleware, officialController.createOfficial);
router.put("/admin/officials/:id", authMiddleware, officialController.updateOfficial);
router.delete("/admin/officials/:id", authMiddleware, officialController.deleteOfficial);
router.patch("/admin/officials/:id/role", authMiddleware, officialController.updateRole);
router.patch("/admin/officials/:id/status", authMiddleware, officialController.updateStatus);

// Direct CRUD routes
router.get("/", authMiddleware, officialController.getOfficials);
router.post("/", authMiddleware, officialController.createOfficial);
router.put("/:id", authMiddleware, officialController.updateOfficial);
router.delete("/:id", authMiddleware, officialController.deleteOfficial);
router.patch("/:id/role", authMiddleware, officialController.updateRole);
router.patch("/:id/status", authMiddleware, officialController.updateStatus);

module.exports = router;
