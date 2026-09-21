const mongoose = require("mongoose");

const garbageAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    status: {
      type: String,
      enum: ["critical", "moderate", "clean", "inactive"],
      default: "clean",
    },
    isActive: { type: Boolean, default: true },
    rawValue: { type: Number, default: 0 },
    airQuality: { type: String, default: "Clean" },
    ammonia: { type: String, default: "0 ppm" },
    methane: { type: String, default: "0 ppm" },
    bins: { type: Number, default: 0 },
    intensity: { type: Number, default: 0.5 },
    barangay: { type: String },
    reportCount: { type: Number, default: 0 },
    lastReportAt: { type: Date, default: null },
    source: { type: String, enum: ["iot", "reports", "both"], default: "iot" },
    lastCollectionAt: { type: Date, default: null },
    lastCollectionBy: { type: String, default: null },
    lastCollectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sensorId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.GarbageArea || mongoose.model("GarbageArea", garbageAreaSchema);
