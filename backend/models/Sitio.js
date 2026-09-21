const mongoose = require("mongoose");

const sitioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  barangay: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  verified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Sitio || mongoose.model("Sitio", sitioSchema);
