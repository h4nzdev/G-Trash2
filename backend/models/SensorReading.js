const mongoose = require("mongoose");

const sensorReadingSchema = new mongoose.Schema({
  sensorId: { type: String, required: true }, // e.g. "SENSOR-001"
  deviceType: { type: String, default: "ESP32" }, // ESP32, Arduino, etc.
  location: { type: String, default: "" }, // human-readable location
  barangay: { type: String, default: "" },
  lat: { type: Number },
  lng: { type: Number },
  ammonia: { type: Number, default: 0 }, // ppm from MQ-135
  methane: { type: Number, default: 0 }, // % LEL
  hydrogen: { type: Number, default: 0 }, // ppm (optional)
  co2: { type: Number, default: 0 }, // ppm (optional)
  temperature: { type: Number, default: 0 }, // °C from DHT11
  humidity: { type: Number, default: 0 }, // % from DHT11
  binLevel: { type: Number, default: 0 }, // % from Ultrasonic
  rawValue: { type: Number, default: 0 }, // raw analog value
  cleanThreshold: { type: Number, default: 200 },
  criticalThreshold: { type: Number, default: 400 },
  measurementType: { type: String, default: "MQ-135 garbage-area air-quality classification" },
  isOfficialAQI: { type: Boolean, default: false },
  airQuality: {
    type: String,
    enum: ["CLEAN", "MODERATE", "CRITICAL", "Clean", "Moderate", "Critical", "Good", "Unhealthy", "Hazardous"],
    default: "CLEAN",
  },
  timestamp: { type: Date, default: Date.now },
});
sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });

module.exports = mongoose.models.SensorReading || mongoose.model("SensorReading", sensorReadingSchema);
