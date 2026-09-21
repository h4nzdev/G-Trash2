const express = require("express");
const router = express.Router();
const routeController = require("../controllers/routeController");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

router.post("/route-directions", routeController.getRouteDirections);
router.get("/truck/:truckId", routeController.getRouteByTruckId);
router.get("/:id", routeController.getRouteById);
router.get("/", optionalAuth, routeController.getRoutes);
router.post("/", authMiddleware, routeController.createRoute);
router.patch("/:id", authMiddleware, routeController.updateRoute);
router.delete("/:id", authMiddleware, routeController.deleteRoute);

module.exports = router;
