const mongoose = require("mongoose");

const barangayBoundarySchema = new mongoose.Schema({
  barangay: { type: String, required: true, unique: true },
  boundary: [[Number]], // Array of [lat, lng]
  color: { type: String, default: "#3B82F6" },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.BarangayBoundary || mongoose.model("BarangayBoundary", barangayBoundarySchema);
