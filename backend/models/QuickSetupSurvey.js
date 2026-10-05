const mongoose = require("mongoose");

const quickSetupSurveySchema = new mongoose.Schema({
  residentId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", default: null },
  barangay: { type: String, required: true },
  purposes: { type: [String], default: [] },
  notificationsEnabled: { type: Boolean, default: false },
  termsAccepted: { type: Boolean, default: true },
  platform: { type: String, default: "mobile" },
  submittedAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.QuickSetupSurvey ||
  mongoose.model("QuickSetupSurvey", quickSetupSurveySchema);
