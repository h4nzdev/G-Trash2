const mongoose = require("mongoose");

const officialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  barangay: { type: String, required: true },
  role: { type: String, enum: ["official", "superadmin", "chd"], default: "official" },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  signatureUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Official || mongoose.model("Official", officialSchema);
