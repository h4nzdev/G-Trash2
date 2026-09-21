const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("OK: Connected to MongoDB (smart-waste-system)");
  } catch (err) {
    console.error("FAIL: MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB, MONGO_URI };
