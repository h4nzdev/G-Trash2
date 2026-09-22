const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const officialRoutes = require("./officialRoutes");
const scheduleRoutes = require("./scheduleRoutes");
const fleetRoutes = require("./fleetRoutes");
const truckRoutes = require("./truckRoutes");
const routeRoutes = require("./routeRoutes");
const iotRoutes = require("./iotRoutes");
const reportRoutes = require("./reportRoutes");
const areaRoutes = require("./areaRoutes");
const rewardRoutes = require("./rewardRoutes");
const barangayRoutes = require("./barangayRoutes");
const announcementRoutes = require("./announcementRoutes");
const systemRoutes = require("./systemRoutes");
const communityRoutes = require("./communityRoutes");

// 1. Auth & Profiles
router.use("/auth", authRoutes);
router.use("/residents", authRoutes);
router.use("/officials", officialRoutes);

// 2. Schedules, Collections, Pickups, Bins
router.use("/schedules", scheduleRoutes);
router.use("/", scheduleRoutes);

// 3. Fleet & Telemetry
router.use("/fleet", fleetRoutes);
router.use("/trucks", truckRoutes);

// 4. Routes & Navigation
router.use("/routes", routeRoutes);

// 5. IoT & Environmental Telemetry
router.use("/iot", iotRoutes);

// 6. Reports & Issues
router.use("/reports", reportRoutes);

// 7. Areas, Heatmap, Sitios, Boundaries
router.use("/", areaRoutes);

// 8. Rewards, Points, Disposals, Waste Classification
router.use("/", rewardRoutes);

// 9. Barangays, Leaderboard, Analytics
router.use("/", barangayRoutes);

// 10. Announcements
router.use("/announcements", announcementRoutes);

// 11. System, Admin, Health, Error Logs, AI Assistant, Uploads
router.use("/", systemRoutes);

// 12. Community, Cleanups, Surveys
router.use("/", communityRoutes);

module.exports = router;
