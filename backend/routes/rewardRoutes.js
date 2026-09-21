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

// Rewards
router.get("/rewards/leaderboard-eligible", rewardController.getLeaderboardEligible);
router.get("/rewards/resident/:residentId", rewardController.getResidentRewards);
router.post("/rewards/:id/claim", rewardController.claimReward);
router.patch("/rewards/:id", rewardController.updateReward);
router.get("/rewards/:id", rewardController.getRewardById);
router.get("/rewards", rewardController.getRewards);
router.post("/rewards", rewardController.createReward);

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
