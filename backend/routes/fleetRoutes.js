const express = require("express");
const router = express.Router();
const fleetController = require("../controllers/fleetController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { Truck } = require("../models");

// Fleet queries & management
router.get("/active", fleetController.getActiveFleet);
router.get("/locations", fleetController.getTruckLocations);
router.get("/:truckId", fleetController.getFleetById);
router.get("/", optionalAuth, fleetController.getFleet);

router.post("/", authMiddleware, fleetController.createFleet);
router.patch("/:truckId/self", fleetController.updateDriverSelf);
router.patch("/:truckId", authMiddleware, fleetController.updateFleet);
router.delete("/:truckId", authMiddleware, fleetController.deleteFleet);

// GPS telemetry location
router.post("/location", fleetController.updateTruckLocation);

// Push token registration
router.put("/:truckId/push-token", async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: "pushToken required" });
    await Truck.findOneAndUpdate(
      { truckId: req.params.truckId.toUpperCase() },
      { pushToken },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
