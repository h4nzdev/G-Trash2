const express = require("express");
const router = express.Router();
const fleetController = require("../controllers/fleetController");
const { Truck } = require("../models");

// GET /api/trucks -> returns live trucks with location and status
router.get("/", fleetController.getTrucks);
router.get("/locations", fleetController.getTruckLocations);
router.get("/:truckId", fleetController.getTruckById);
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
