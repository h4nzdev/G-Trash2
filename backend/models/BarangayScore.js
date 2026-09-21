const mongoose = require("mongoose");

const barangayScoreSchema = new mongoose.Schema({
  barangay: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 }, // grand total (sum of all categories)
  // Category breakdown scores
  reportScore: { type: Number, default: 0 }, // votes, confirmed resolutions, disputes, escalations
  iotScore: { type: Number, default: 0 }, // IoT air quality readings (good/bad)
  collectionScore: { type: Number, default: 0 }, // pickup completions + resident verifications
  responseScore: { type: Number, default: 0 }, // official response time bonus
  // Legacy count fields (kept for display/compat)
  pickupCount: { type: Number, default: 0 }, // number of confirmed pickup runs
  reportVoteCount: { type: Number, default: 0 }, // total community votes cast
  areaQualityPts: { type: Number, default: 0 }, // cumulative clean-area bonus pts
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.BarangayScore || mongoose.model("BarangayScore", barangayScoreSchema);
