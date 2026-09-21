const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["best_segregation", "most_trash_collected", "most_reports", "most_active"],
      required: true,
    },
    barangay: { type: String, required: true },
    rewardType: {
      type: String,
      enum: ["physical_prize", "certificate", "cash", "discount", "recognition"],
      required: true,
    },
    rewardValue: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "published", "claimed", "expired"],
      default: "draft",
    },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    recipientName: { type: String, default: "" },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Official" },
    issuedByName: { type: String, default: "" },
    issuedDate: { type: Date, default: null },
    claimDeadline: { type: Date, default: null },
    claimedDate: { type: Date, default: null },
    claimCode: { type: String, default: null, unique: true, sparse: true },
    officialSignatureUrl: { type: String, default: null },
    notes: { type: String, default: "" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Reward || mongoose.model("Reward", rewardSchema);
