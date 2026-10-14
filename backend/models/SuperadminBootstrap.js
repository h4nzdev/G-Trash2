const mongoose = require("mongoose");

const superadminBootstrapSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports =
  mongoose.models.SuperadminBootstrap ||
  mongoose.model("SuperadminBootstrap", superadminBootstrapSchema);
