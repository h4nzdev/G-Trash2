const express = require("express");
const router = express.Router();
const barangayController = require("../controllers/barangayController");
const { optionalAuth } = require("../middleware/auth");

// Leaderboard
router.get("/leaderboard", barangayController.getLeaderboard);
router.post("/leaderboard/add-score", barangayController.addLeaderboardScore);
router.post("/leaderboard/seed", barangayController.seedLeaderboard);

// Barangays list
router.get("/barangays", barangayController.getBarangays);

// Analytics
router.get("/analytics/report-trends", optionalAuth, barangayController.getReportTrends);
router.get("/analytics/hotspots", optionalAuth, barangayController.getHotspots);
router.get("/analytics/collection-stats", optionalAuth, barangayController.getCollectionStats);
router.get("/analytics/sitios", optionalAuth, barangayController.getSitioAnalytics);

module.exports = router;
