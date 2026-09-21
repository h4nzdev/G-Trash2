const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  truckId: { type: String, default: null },
  driverName: { type: String, default: "" },
  barangay: { type: String, default: "" },
  waypoints: [{ lat: Number, lng: Number, name: String }],
  routeCoords: { type: [[Number]], default: [] },
  totalStops: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Route || mongoose.model("Route", routeSchema);
