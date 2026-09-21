const mongoose = require("mongoose");

const binStatusSchema = new mongoose.Schema(
  {
    residentId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    barangay: { type: String, required: true },
    status: { type: String, enum: ["prepared", "pickedup"], default: "prepared" },
    date: { type: String, required: true }, // YYYY-MM-DD
    truckId: { type: String, default: "" },
  },
  { timestamps: true }
);
binStatusSchema.index({ residentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.BinStatus || mongoose.model("BinStatus", binStatusSchema);
