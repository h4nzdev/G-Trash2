const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, default: "" },
  barangay: { type: String, default: "" },
  sitio: { type: String, default: "" },
  lat: Number,
  lng: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
  reportedBy: { type: String, default: "Resident" },
  reportImage: { type: String, default: null },
  priority: { type: String, default: "Medium" },
  status: { type: String, default: "pending" },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resident" }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resident" }],
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
      text: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  deadline: { type: Date, default: null },
  statusHistory: [
    {
      status: String,
      changedBy: String,
      changedAt: { type: Date, default: Date.now },
    },
  ],
  escalated: { type: Boolean, default: false },
  resolutionConfirmed: {
    type: String,
    enum: ["pending", "confirmed", "disputed"],
    default: null,
  },
  resolutionImage: { type: String, default: null },
  disputeImage: { type: String, default: null },
  disputeReason: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: null },
  assignedTruck: { type: String, default: null },
  assignedDriver: { type: String, default: null },
  healthConcern: { type: Boolean, default: false },
  healthNotes: [{ text: String, addedBy: String, createdAt: { type: Date, default: Date.now } }],
  isPriorityArea: { type: Boolean, default: false },
  priorityScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule", default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Report || mongoose.model("Report", reportSchema);
