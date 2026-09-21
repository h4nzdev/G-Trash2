const mongoose = require("mongoose");

const truckSchema = new mongoose.Schema({
  truckId: { type: String, required: true, unique: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  heading: { type: Number, default: 0 },
  speed: { type: Number, default: 0 },
  status: { type: String, default: "online" },
  pushToken: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Truck || mongoose.model("Truck", truckSchema);
