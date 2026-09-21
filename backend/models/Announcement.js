const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "critical", "success"],
      default: "info",
    },
    createdBy: { type: String, default: "Admin" },
    barangay: { type: String, default: "All" },
    image: { type: String, default: null },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
