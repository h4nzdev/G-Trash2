const express = require("express");
const router = express.Router();
const rewardController = require("../controllers/rewardController");

// Resident points & stats
router.post("/residents/:id/award-scan-points", rewardController.awardScanPoints);
router.get("/residents/:id/points/history", rewardController.getResidentPointsHistory);
router.get("/residents/:id/points", rewardController.getResidentPoints);
router.get("/residents/:id/rank", rewardController.getResidentRank);
router.post("/residents/:id/scan-log", rewardController.logScan);
router.get("/barangays/:barangayName/top-residents", rewardController.getTopResidents);

// Rewards (Direct Awards)
router.get("/rewards/leaderboard-eligible", rewardController.getLeaderboardEligible);
router.get("/rewards/resident/:residentId", rewardController.getResidentRewards);
router.post("/rewards/:id/claim", rewardController.claimReward);
router.patch("/rewards/:id", rewardController.updateReward);
router.get("/rewards/:id", rewardController.getRewardById);
router.get("/rewards", rewardController.getRewards);
router.post("/rewards", rewardController.createReward);

// Reward Goals (Points Catalog & Target Goals)
router.get("/reward-goals", rewardController.getRewardGoals);
router.get("/reward-goals/:id", rewardController.getRewardGoalById);
router.post("/reward-goals", rewardController.createRewardGoal);
router.post("/reward-goals/:id/claim", rewardController.claimRewardGoal);
router.patch("/reward-goals/:id", rewardController.updateRewardGoal);
router.delete("/reward-goals/:id", rewardController.deleteRewardGoal);

// Disposal verifications
router.post("/disposal/submit", rewardController.submitDisposal);
router.get("/disposal/status/:residentId", rewardController.getDisposalStatus);
router.get("/disposal/photos", rewardController.getDisposalPhotos);
router.delete("/disposal/photos/:id", rewardController.deleteDisposalPhoto);
router.get("/resident/:id", rewardController.getResidentProfile);

// Waste classification
router.get("/waste-classification", rewardController.getWasteClassification);
router.post("/waste-classification/lookup", rewardController.lookupWasteClassification);

module.exports = router;
