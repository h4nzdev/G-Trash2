const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  truckId: { type: String, required: true },
  driverName: { type: String, default: "" },
  driverPhone: { type: String, default: "" },
  routeId: { type: String, default: "" },
  routeName: { type: String, default: "" },
  barangay: { type: String, default: "" },
  sitio: { type: String, default: "" },
  sitioTasks: [
    {
      name: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date },
      proofImage: { type: String, default: "" },
      afterImage: { type: String, default: "" },
    },
  ],
  routeCoords: { type: [[Number]], default: [] },
  startTime: { type: String, default: "" }, // HH:MM for ordering
  endTime: { type: String, default: "" }, // Optional HH:MM
  status: { type: String, enum: ["pending", "accepted", "completed", "missed"], default: "pending" },
  notes: { type: String, default: "" },
  wasteType: { type: String, enum: ["Malata", "Di-Malata", "General"], default: "Malata" },
  isPriority: { type: Boolean, default: false },
  priorityLevel: { type: String, enum: ["Normal", "High", "Critical"], default: "Normal" },
  priorityReason: { type: String, default: "" },
  totalWeight: { type: Number, default: 0 }, // net weight in tons or kg
  weightUnit: { type: String, enum: ["tons", "kg"], default: "tons" },
  disposalFacility: { type: String, default: "" }, // e.g. Binaliw Landfill, Inayawan Transfer Station, Barangay MRF
  disposalPhoto: { type: String, default: "" }, // scale slip / weighbridge ticket / proof photo
  runNumber: { type: Number, default: 1 },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);
