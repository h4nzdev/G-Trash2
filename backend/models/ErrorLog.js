const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  severity: { type: String, enum: ["error", "warning", "info"], default: "error" },
  source: { type: String, default: "Server" },
  message: { type: String, required: true },
  stack: { type: String, default: "" },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: String, default: null },
  resolvedAt: { type: Date, default: null },
});
errorLogSchema.index({ timestamp: -1 });

module.exports = mongoose.models.ErrorLog || mongoose.model("ErrorLog", errorLogSchema);
