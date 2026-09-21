const mongoose = require("mongoose");

const pickupRunSchema = new mongoose.Schema(
  {
    truckId: { type: String, required: true },
    driverName: { type: String, default: "" },
    routeId: { type: String, default: "" },
    routeName: { type: String, default: "" },
    barangay: { type: String, default: "" },
    stopsCompleted: [{ name: String, weight: Number }],
    totalStops: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    verifications: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
        confirmed: Boolean,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.PickupRun || mongoose.model("PickupRun", pickupRunSchema);
