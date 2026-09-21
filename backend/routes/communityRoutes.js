const express = require("express");
const router = express.Router();
const communityController = require("../controllers/communityController");
const { optionalAuth } = require("../middleware/auth");

// Cleanup posts
router.get("/cleanup", communityController.getCleanupPosts);
router.post("/cleanup", communityController.createCleanupPost);

// Surveys
router.post("/survey/response", communityController.submitSurveyResponse);
router.get("/survey/results", optionalAuth, communityController.getSurveyResults);

module.exports = router;
