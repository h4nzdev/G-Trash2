const mongoose = require("mongoose");

const fleetSchema = new mongoose.Schema({
  truckId: { type: String, required: true, unique: true },
  driverName: { type: String, default: "Unassigned" },
  driverId: { type: String, default: "" },
  driverPhone: { type: String, default: "" },
  driverImage: { type: String, default: null },
  model: { type: String, default: "" },
  plateNumber: { type: String, default: "" },
  fuelType: { type: String, default: "Diesel" },
  capacity: { type: Number, default: 0 },
  route: { type: String, default: "" },
  barangay: { type: String, default: "" },
  type: { type: String, enum: ["dedicated", "shared"], default: "dedicated" },
  serviceBarangays: { type: [String], default: [] },
  wasteType: { type: String, enum: ["Both", "Malata", "Di-Malata"], default: "Both" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Fleet || mongoose.model("Fleet", fleetSchema);
