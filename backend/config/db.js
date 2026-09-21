const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://hanzcarillo2_db_user:w3n23R2b4i9XoRkI@trashcollection.0sq8v58.mongodb.net/smart-waste-system?retryWrites=true&w=majority";

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
