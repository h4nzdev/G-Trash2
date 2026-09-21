const mongoose = require("mongoose");

const barangayPointHistorySchema = new mongoose.Schema({
  barangay: { type: String, required: true, index: true },
  points: { type: Number, required: true },
  category: { type: String, default: "points" },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.BarangayPointHistory || mongoose.model("BarangayPointHistory", barangayPointHistorySchema);
