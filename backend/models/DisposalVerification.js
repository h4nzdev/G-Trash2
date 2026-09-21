const mongoose = require("mongoose");

const disposalVerificationSchema = new mongoose.Schema({
  residentId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
  residentName: { type: String, required: true },
  barangay: { type: String, required: true },
  sitio: { type: String, default: "" },
  photoUrl: { type: String, required: true },
  streakCount: { type: Number, default: 1 },
  pointsAwarded: { type: Number, default: 0 },
  truckId: { type: String, default: "" },
  status: { type: String, enum: ["active", "deleted"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.DisposalVerification || mongoose.model("DisposalVerification", disposalVerificationSchema);
