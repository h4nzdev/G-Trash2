const mongoose = require("mongoose");

const surveyResponseSchema = new mongoose.Schema({
  residentId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
  barangay: { type: String, default: "" },
  questionId: { type: String, default: "gamification_motivation" },
  question: { type: String, default: "" },
  answer: { type: String, required: true },
  context: { type: String, default: "" }, // after_scan | after_report | viewing_leaderboard
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.SurveyResponse || mongoose.model("SurveyResponse", surveyResponseSchema);
