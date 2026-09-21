const mongoose = require("mongoose");

const residentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: "" },
  barangay: { type: String, required: true },
  street: { type: String, default: "" },
  houseNo: { type: String, default: "" },
  // Deterministic hash of (barangay + street + houseNo) — enforces one account per household
  householdId: { type: String, default: null },
  profilePicture: { type: String, default: null },
  lastProfilePictureUpdate: { type: Date, default: null },
  notificationsClearedAt: { type: Date, default: null },
  rewardsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: "Reward" }],
  totalRewardsClaimed: { type: Number, default: 0 },
  // ── Resident points system ───────────────────────────────────
  totalPoints: { type: Number, default: 0 },
  monthlyPoints: { type: Number, default: 0 },
  monthlyHistory: [{ month: String, points: Number }],
  pointsHistory: [
    {
      points: Number,
      action: { type: String, default: "report_submit" },
      description: String,
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
      date: { type: Date, default: Date.now },
    },
  ],
  stats: {
    totalScans: { type: Number, default: 0 },
    correctScans: { type: Number, default: 0 },
    reportsSubmitted: { type: Number, default: 0 },
    reportsUpvoted: { type: Number, default: 0 },
    commentsMade: { type: Number, default: 0 },
    resolutionsVerified: { type: Number, default: 0 },
  },
  lastPointsAt: { type: Date, default: null },
  disposalStreak: { type: Number, default: 0 },
  lastDisposalClaimAt: { type: Date, default: null },
  lastDisposalRunAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

// sparse: true → null householdIds (incomplete address) are not indexed, so old records won't conflict
residentSchema.index({ householdId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Resident || mongoose.model("Resident", residentSchema);
