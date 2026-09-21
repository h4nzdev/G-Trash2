const mongoose = require("mongoose");

const iotAlertSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  location: { type: String, default: "" },
  barangay: { type: String, default: "" },
  severity: {
    type: String,
    enum: ["critical", "moderate", "low", "info", "warning", "clean"],
    default: "moderate",
  },
  message: { type: String, required: true },
  gasType: { type: String, default: "" }, // which gas triggered
  value: { type: Number, default: 0 }, // the reading value
  threshold: { type: Number, default: 0 }, // the threshold exceeded
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
iotAlertSchema.index({ createdAt: -1 });

module.exports = mongoose.models.IoTAlert || mongoose.model("IoTAlert", iotAlertSchema);
