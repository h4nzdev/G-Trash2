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
  },
  { timestamps: true }
);

module.exports = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
