const mongoose = require("mongoose");

const adminContactRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    barangay: { type: String, default: "All" },
    requestType: {
      type: String,
      default: "Request Official Account",
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "contacted", "resolved", "dismissed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

adminContactRequestSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.AdminContactRequest ||
  mongoose.model("AdminContactRequest", adminContactRequestSchema);
