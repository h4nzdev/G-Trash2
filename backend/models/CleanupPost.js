const mongoose = require("mongoose");

const cleanupPostSchema = new mongoose.Schema({
  truckId: { type: String, required: true },
  driverName: { type: String, default: "" },
  areaId: { type: mongoose.Schema.Types.ObjectId, ref: "GarbageArea", default: null },
  areaName: { type: String, default: "" },
  barangay: { type: String, default: "" },
  photo: { type: String, required: true },
  note: { type: String, default: "" },
  autoDetected: { type: Boolean, default: true },
  pointsAwarded: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.CleanupPost || mongoose.model("CleanupPost", cleanupPostSchema);
