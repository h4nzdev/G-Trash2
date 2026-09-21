const mongoose = require("mongoose");

const bugReportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "resolved", "closed"],
    default: "open",
  },
  platform: { type: String, default: "web" }, // 'web', 'mobile-resident', 'mobile-truck'
  deviceInfo: { type: String, default: "" },
  reportedBy: { type: String, default: "Anonymous" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.BugReport || mongoose.model("BugReport", bugReportSchema);
