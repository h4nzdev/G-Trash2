const mongoose = require("mongoose");

const collectionLogSchema = new mongoose.Schema({
  truckId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  stopName: { type: String, default: "" },
  stopAddress: { type: String, default: "" },
  wasteType: { type: String, default: "General" },
  weight: { type: Number, default: 0 },
  weightUnit: { type: String, enum: ["kg", "tons"], default: "kg" },
  disposalFacility: { type: String, default: "" },
  disposalPhoto: { type: String, default: "" },
  bins: { type: Number, default: 1 },
  routeId: { type: String, default: "" },
  routeName: { type: String, default: "" },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  driverName: { type: String, default: "" },
  beforeImage: { type: String, default: "" },
  afterImage: { type: String, default: "" },
  status: { type: String, default: "clean" }, // clean, moderate, critical
  durationMinutes: { type: Number, default: 30 },
  completedAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.CollectionLog ||
  mongoose.model("CollectionLog", collectionLogSchema);
