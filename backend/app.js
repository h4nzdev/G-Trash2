require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gtrash";
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "gtrash-officials-secret-2025";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("OK: MongoDB connected ->", MONGO_URI);
    loadBoundaries();
    startSLAChecker();
  })
  .catch((err) => console.error("ERR: MongoDB error:", err.message));

// --- Schemas -------------------------------------------------

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
const Truck = mongoose.model("Truck", truckSchema);

const priorityMap = {
  "Hazardous Waste": "Critical",
  "Illegal Dumping": "High",
  "Overflowing Bin": "High",
  "Uncollected Waste": "Medium",
  Other: "Low",
};

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, default: "" },
  barangay: { type: String, default: "" },
  lat: Number,
  lng: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
  reportedBy: { type: String, default: "Resident" },
  reportImage: { type: String, default: null },
  priority: { type: String, default: "Medium" },
  status: { type: String, default: "pending" },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resident" }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resident" }],
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
      text: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  deadline: { type: Date, default: null },
  statusHistory: [
    {
      status: String,
      changedBy: String,
      changedAt: { type: Date, default: Date.now },
    },
  ],
  escalated: { type: Boolean, default: false },
  resolutionConfirmed: {
    type: String,
    enum: ["pending", "confirmed", "disputed"],
    default: null,
  },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: null },
  assignedTruck: { type: String, default: null },
  assignedDriver: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
const Report = mongoose.model("Report", reportSchema);

const fleetSchema = new mongoose.Schema({
  truckId: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  driverId: { type: String, default: "" },
  driverImage: { type: String, default: null },
  route: { type: String, default: "" },
  barangay: { type: String, default: "" },
  type: { type: String, enum: ["dedicated", "shared"], default: "dedicated" },
  serviceBarangays: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});
const Fleet = mongoose.model("Fleet", fleetSchema);

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
const Route = mongoose.model("Route", routeSchema);

const scheduleSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  truckId: { type: String, required: true },
  driverName: { type: String, default: "" },
  routeId: { type: String, default: "" },
  routeName: { type: String, default: "" },
  startTime: { type: String, default: "" }, // HH:MM for ordering
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});
const Schedule = mongoose.model("Schedule", scheduleSchema);

const garbageAreaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  status: {
    type: String,
    enum: ["critical", "moderate", "clean"],
    default: "moderate",
  },
  ammonia: { type: String, default: "0 ppm" },
  methane: { type: String, default: "0 ppm" },
  bins: { type: Number, default: 0 },
  intensity: { type: Number, default: 0.5 },
  barangay: { type: String },
  reportCount: { type: Number, default: 0 },
  lastReportAt: { type: Date, default: null },
  source: { type: String, enum: ["iot", "reports", "both"], default: "iot" },
  createdAt: { type: Date, default: Date.now },
});
const GarbageArea = mongoose.model("GarbageArea", garbageAreaSchema);

const collectionLogSchema = new mongoose.Schema({
  truckId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  stopName: { type: String, default: "" },
  stopAddress: { type: String, default: "" },
  wasteType: { type: String, default: "General" },
  weight: { type: Number, default: 0 },
  bins: { type: Number, default: 1 },
  routeId: { type: String, default: "" },
  routeName: { type: String, default: "" },
  completedAt: { type: Date, default: Date.now },
});
const CollectionLog = mongoose.model("CollectionLog", collectionLogSchema);

// --- IoT Sensor Readings ---
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
  airQuality: {
    type: String,
    enum: ["Good", "Moderate", "Unhealthy", "Hazardous"],
    default: "Good",
  },
  timestamp: { type: Date, default: Date.now },
});
sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });
const SensorReading = mongoose.model("SensorReading", sensorReadingSchema);

const iotAlertSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  location: { type: String, default: "" },
  barangay: { type: String, default: "" },
  severity: {
    type: String,
    enum: ["critical", "moderate", "low"],
    default: "moderate",
  },
  message: { type: String, required: true },
  gasType: { type: String, default: "" }, // which gas triggered
  value: { type: Number, default: 0 }, // the reading value
  threshold: { type: Number, default: 0 }, // the threshold exceeded
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
iotAlertSchema.index({ createdAt: -1 });
const IoTAlert = mongoose.model("IoTAlert", iotAlertSchema);

const officialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  barangay: { type: String, required: true },
  role: { type: String, enum: ["official", "superadmin"], default: "official" },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});
const Official = mongoose.model("Official", officialSchema);

const bugReportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "resolved", "closed"],
    default: "open",
  },
  platform: { type: String, default: "web" }, // 'web', 'mobile-resident', 'mobile-truck'
  deviceInfo: { type: String, default: "" },
  reportedBy: { type: String, default: "Anonymous" },
  createdAt: { type: Date, default: Date.now },
});
const BugReport = mongoose.model("BugReport", bugReportSchema);

const residentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: "" },
  barangay: { type: String, required: true },
  street: { type: String, default: "" },
  houseNo: { type: String, default: "" },
  profilePicture: { type: String, default: null },
  lastProfilePictureUpdate: { type: Date, default: null },
  notificationsClearedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
const Resident = mongoose.model("Resident", residentSchema);

const barangayBoundarySchema = new mongoose.Schema({
  barangay: { type: String, required: true, unique: true },
  boundary: [[Number]], // Array of [lat, lng]
  color: { type: String, default: "#3B82F6" },
  updatedAt: { type: Date, default: Date.now },
});
const BarangayBoundary = mongoose.model(
  "BarangayBoundary",
  barangayBoundarySchema,
);

const barangayScoreSchema = new mongoose.Schema({
  barangay: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 }, // grand total (sum of all categories)
  // Category breakdown scores
  reportScore: { type: Number, default: 0 }, // votes, confirmed resolutions, disputes, escalations
  iotScore: { type: Number, default: 0 }, // IoT air quality readings (good/bad)
  collectionScore: { type: Number, default: 0 }, // pickup completions + resident verifications
  responseScore: { type: Number, default: 0 }, // official response time bonus
  // Legacy count fields (kept for display/compat)
  pickupCount: { type: Number, default: 0 }, // number of confirmed pickup runs
  reportVoteCount: { type: Number, default: 0 }, // total community votes cast
  areaQualityPts: { type: Number, default: 0 }, // cumulative clean-area bonus pts
  updatedAt: { type: Date, default: Date.now },
});
const BarangayScore = mongoose.model("BarangayScore", barangayScoreSchema);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "critical", "success"],
      default: "info",
    },
    createdBy: { type: String, default: "Admin" },
  },
  { timestamps: true },
);
const Announcement = mongoose.model("Announcement", announcementSchema);

const pickupRunSchema = new mongoose.Schema(
  {
    truckId: { type: String, required: true },
    driverName: { type: String, default: "" },
    routeId: { type: String, default: "" },
    routeName: { type: String, default: "" },
    barangay: { type: String, default: "" },
    stopsCompleted: [{ name: String, weight: Number }],
    totalStops: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    verifications: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" },
        confirmed: Boolean,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
const PickupRun = mongoose.model("PickupRun", pickupRunSchema);

const binStatusSchema = new mongoose.Schema(
  {
    residentId: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    barangay: { type: String, required: true },
    status: { type: String, enum: ["prepared", "pickedup"], default: "prepared" },
    date: { type: String, required: true }, // YYYY-MM-DD
    truckId: { type: String, default: "" },
  },
  { timestamps: true },
);
binStatusSchema.index({ residentId: 1, date: 1 }, { unique: true });
const BinStatus = mongoose.model("BinStatus", binStatusSchema);

// --- Helpers -------------------------------------------------

async function startSLAChecker() {
  const check = async () => {
    try {
      const overdue = await Report.find({
        status: "pending",
        escalated: { $ne: true },
        deadline: { $lt: new Date() },
        reportedBy: { $not: /^IoT Sensor/ },
      });
      for (const r of overdue) {
        await Report.findByIdAndUpdate(r._id, {
          $set: { escalated: true },
          $push: {
            statusHistory: {
              status: "escalated",
              changedBy: "System",
              changedAt: new Date(),
            },
          },
        });
        if (r.barangay) await addBarangayScore(r.barangay, -10, "reportScore");
        io.emit("report:updated", { ...r.toObject(), escalated: true });
        io.emit("report:escalated", {
          reportId: r._id,
          barangay: r.barangay,
          title: r.title,
        });
      }
      if (overdue.length > 0)
        console.log(
          `[SLA] Auto-escalated ${overdue.length} reports, -10 pts each barangay`,
        );
    } catch (err) {
      console.error("[SLA] Error:", err.message);
    }
  };
  await check();
  setInterval(check, 60 * 60 * 1000);
}

async function generateUniqueTruckId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id, exists;
  do {
    const suffix = Array.from(
      { length: 3 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
    id = `GT-${suffix}`;
    exists = await Fleet.findOne({ truckId: id });
  } while (exists);
  return id;
}

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Award points to a barangay — upserts the score document.
// scoreCategory: one of reportScore | iotScore | collectionScore | responseScore
// countField: optional legacy count-only field (pickupCount, reportVoteCount, areaQualityPts) — only incremented when points > 0
async function addBarangayScore(barangay, points, scoreCategory, countField) {
  if (!barangay || points == null) return;
  const incOps = { points };
  if (scoreCategory) incOps[scoreCategory] = points;
  if (countField && points > 0) incOps[countField] = 1;
  return BarangayScore.findOneAndUpdate(
    { barangay },
    { $inc: incOps, $set: { updatedAt: new Date() } },
    { upsert: true, new: true },
  );
}

const BARANGAY_BOUNDARIES = {};

async function loadBoundaries() {
  try {
    const docs = await BarangayBoundary.find();
    docs.forEach((doc) => {
      BARANGAY_BOUNDARIES[doc.barangay] = doc.boundary;
    });
    console.log(`[Backend] Loaded ${docs.length} boundaries into memory`);
  } catch (err) {
    console.error("[Backend] Failed to load boundaries:", err.message);
  }
}

function isInsidePolygon(point, polygon) {
  const x = point[0],
    y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Auth Middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.official = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token invalid or expired" });
  }
}

// Optional Auth
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.official = jwt.verify(header.slice(7), JWT_SECRET);
    } catch (_) {
      /* invalid */
    }
  }
  next();
}

// Returns a barangay filter for superadmin/All (sees everything) vs scoped official
function barangayFilter(official, field = "barangay") {
  if (!official) return {};
  if (official.barangay === "All" || official.role === "superadmin") return {};
  return { [field]: official.barangay };
}

// --- Cloudinary Upload ----------------------------------------
app.post("/api/upload", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No image data provided" });
    const result = await cloudinary.uploader.upload(data, {
      folder: "gtrash",
      resource_type: "image",
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Resident Auth -------------------------------------------
app.post("/api/residents/register", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    barangay,
    street,
    houseNo,
  } = req.body;
  if (!firstName || !lastName || !email || !password || !barangay) {
    return res.status(400).json({
      error: "firstName, lastName, email, password, and barangay are required",
    });
  }
  try {
    const existing = await Resident.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const resident = await Resident.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      phone: phone || "",
      barangay,
      street: street || "",
      houseNo: houseNo || "",
    });
    const token = jwt.sign(
      {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        role: "resident",
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    res.status(201).json({
      token,
      user: {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        address: `${resident.houseNo ? resident.houseNo + ", " : ""}${resident.street ? resident.street + ", " : ""}${resident.barangay}, Cebu City`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/residents/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const resident = await Resident.findOne({ email: email.toLowerCase() });
    if (!resident)
      return res.status(401).json({ error: "Invalid credentials" });
    if (!(await bcrypt.compare(password, resident.passwordHash)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        role: "resident",
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    res.json({
      token,
      user: {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        address: `${resident.houseNo ? resident.houseNo + ", " : ""}${resident.street ? resident.street + ", " : ""}${resident.barangay}, Cebu City`,
        notificationsClearedAt: resident.notificationsClearedAt || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/residents/:id", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      barangay,
      street,
      houseNo,
      profilePicture,
    } = req.body;
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: "Resident not found" });

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (barangay) updateData.barangay = barangay;
    if (street !== undefined) updateData.street = street;
    if (houseNo !== undefined) updateData.houseNo = houseNo;

    // Profile Picture Cooldown Logic (10 days)
    if (
      profilePicture !== undefined &&
      profilePicture !== resident.profilePicture
    ) {
      const now = new Date();
      if (resident.lastProfilePictureUpdate) {
        const diffTime = Math.abs(now - resident.lastProfilePictureUpdate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 10) {
          return res.status(403).json({
            error: `You can only change your profile picture once every 10 days. ${10 - diffDays} days remaining.`,
          });
        }
      }
      updateData.profilePicture = profilePicture;
      updateData.lastProfilePictureUpdate = now;
    }

    const updatedResident = await Resident.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    );

    res.json({
      user: {
        id: updatedResident._id,
        name: `${updatedResident.firstName} ${updatedResident.lastName}`,
        email: updatedResident.email,
        barangay: updatedResident.barangay,
        profilePicture: updatedResident.profilePicture,
        lastProfilePictureUpdate: updatedResident.lastProfilePictureUpdate,
        address: `${updatedResident.houseNo ? updatedResident.houseNo + ", " : ""}${updatedResident.street ? updatedResident.street + ", " : ""}${updatedResident.barangay}, Cebu City`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/residents/:id/notifications", async (req, res) => {
  try {
    const clearedAt = new Date();
    await Resident.findByIdAndUpdate(req.params.id, {
      notificationsClearedAt: clearedAt,
    });
    res.json({ clearedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Community Feed & Voting ---------------------------------
app.get("/api/reports", async (req, res) => {
  try {
    const { barangay, userId } = req.query;
    const filter = {};
    if (barangay) filter.barangay = barangay;
    if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        filter.userId = new mongoose.Types.ObjectId(userId);
      } else {
        filter.userId = userId; // fallback
      }
    }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "firstName lastName profilePicture")
      .populate("comments.userId", "firstName lastName profilePicture");
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const { userId, lat, lng, barangay, force } = req.body;

    // --- Rate limit: max 3 reports per user per hour ---
    if (userId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await Report.countDocuments({
        userId,
        createdAt: { $gte: oneHourAgo },
      });
      if (recentCount >= 3) {
        return res.status(429).json({
          error: "rate_limit",
          message:
            "You have submitted 3 reports in the past hour. Please wait before submitting more.",
        });
      }
    }

    // --- Duplicate proximity: warn if open report exists within 100 m ---
    // Skipped when the resident explicitly confirms via "Submit Anyway"
    if (!force && lat != null && lng != null) {
      const openReports = await Report.find({
        status: { $in: ["pending", "in-progress"] },
        lat: { $ne: null },
        lng: { $ne: null },
        barangay: barangay || { $exists: true },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).select("lat lng _id title");

      const DUPLICATE_RADIUS_M = 100;
      const nearby = openReports.find(
        (r) => haversineM(lat, lng, r.lat, r.lng) <= DUPLICATE_RADIUS_M
      );
      if (nearby) {
        return res.status(409).json({
          error: "duplicate_nearby",
          message:
            "An open report already exists within 100 m of this location. Are you sure this is a different issue?",
          existingReportId: nearby._id,
        });
      }
    }

    const report = await Report.create({
      ...req.body,
      title: req.body.title || req.body.category,
      deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      statusHistory: [
        {
          status: "pending",
          changedBy: req.body.reportedBy || "Resident",
          changedAt: new Date(),
        },
      ],
    });
    io.emit("report:new", report);

    // --- Composite Heatmap: Link report to nearest garbage area ---
    const reportLat = report.lat;
    const reportLng = report.lng;
    if (reportLat != null && reportLng != null) {
      // Haversine helper (returns meters)
      function haversine(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const PROXIMITY_RADIUS = 500; // meters
      const areas = await GarbageArea.find();
      let nearest = null;
      let nearestDist = Infinity;
      for (const area of areas) {
        const dist = haversine(reportLat, reportLng, area.lat, area.lng);
        if (dist < PROXIMITY_RADIUS && dist < nearestDist) {
          nearest = area;
          nearestDist = dist;
        }
      }

      if (nearest) {
        // Update existing area with report data
        const newCount = (nearest.reportCount || 0) + 1;
        const newSource = nearest.source === "iot" ? "both" : nearest.source;
        // Escalate status based on combined score
        let newStatus = nearest.status;
        let newIntensity = nearest.intensity;
        if (newCount >= 5) {
          newStatus = "critical";
          newIntensity = Math.max(newIntensity, 0.9);
        } else if (newCount >= 2) {
          newStatus = "moderate";
          newIntensity = Math.max(newIntensity, 0.6);
        }

        const updated = await GarbageArea.findByIdAndUpdate(
          nearest._id,
          {
            reportCount: newCount,
            lastReportAt: new Date(),
            source: newSource,
            status: newStatus,
            intensity: newIntensity,
          },
          { new: true },
        );
        io.emit("garbage-area:updated", updated);
        console.log(
          `[Heatmap] Report linked to area "${nearest.name}" (${newCount} reports, ${nearestDist.toFixed(0)}m away)`,
        );
      } else {
        // Create new garbage area from this report
        const newArea = await GarbageArea.create({
          name: report.location || report.title || `Report Zone`,
          lat: reportLat,
          lng: reportLng,
          status: "moderate",
          intensity: 0.5,
          barangay: report.barangay || "",
          reportCount: 1,
          lastReportAt: new Date(),
          source: "reports",
        });
        io.emit("garbage-area:updated", newArea);
        console.log(
          `[Heatmap] New area created from report: "${newArea.name}"`,
        );
      }
    }

    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/reports/:id/vote", async (req, res) => {
  const { userId, type } = req.body; // type: 'up' or 'down'
  if (!userId || !["up", "down"].includes(type)) {
    return res
      .status(400)
      .json({ error: "userId and type (up/down) required" });
  }

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    // Remove user from both arrays first to prevent double voting/switching
    report.upvotes = report.upvotes.filter((id) => id.toString() !== userId);
    report.downvotes = report.downvotes.filter(
      (id) => id.toString() !== userId,
    );

    if (type === "up") {
      report.upvotes.push(userId);
    } else {
      report.downvotes.push(userId);
    }

    await report.save();
    // +1 pt to barangay for every vote cast (community engagement)
    if (report.barangay) {
      addBarangayScore(
        report.barangay,
        1,
        "reportScore",
        "reportVoteCount",
      ).catch(() => {});
    }
    res.json({
      upvotes: report.upvotes.length,
      downvotes: report.downvotes.length,
      userVote: type,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports/:id/comments", async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text)
    return res.status(400).json({ error: "userId and text required" });

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    report.comments.push({ userId, text });
    await report.save();

    const updatedReport = await Report.findById(req.params.id).populate(
      "comments.userId",
      "firstName lastName profilePicture",
    );

    res.json(updatedReport.comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/reports/:id", async (req, res) => {
  console.log(`[DELETE] Request to delete report: ${req.params.id}`);
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) {
      console.log(`[DELETE] Report NOT FOUND: ${req.params.id}`);
      return res.status(404).json({ error: "Report not found" });
    }
    console.log(`[DELETE] Successfully deleted report: ${req.params.id}`);
    res.json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error(`[DELETE] Error deleting report: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// --- Health --------------------------------------------------
app.get("/ping", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);

app.get("/debug/counts", async (req, res) => {
  try {
    const [fleet, trucks, reports, routes, officials, schedules] =
      await Promise.all([
        Fleet.countDocuments(),
        Truck.countDocuments(),
        Report.countDocuments(),
        Route.countDocuments(),
        Official.countDocuments(),
        Schedule.countDocuments(),
      ]);
    res.json({ fleet, trucks, reports, routes, officials, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Officials auth ------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const official = await Official.findOne({ email: email.toLowerCase() });
    if (!official)
      return res.status(401).json({ error: "Invalid credentials" });
    if (!(await bcrypt.compare(password, official.passwordHash)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      {
        id: official._id,
        name: official.name,
        email: official.email,
        barangay: official.barangay,
        role: official.role,
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );
    res.json({
      token,
      official: {
        id: official._id,
        name: official.name,
        email: official.email,
        barangay: official.barangay,
        role: official.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ official: req.official });
});

app.post("/api/auth/seed", async (req, res) => {
  const officials = [
    {
      name: "Super Admin",
      email: "admin@gtrash.com",
      password: "admin123",
      barangay: "All",
      role: "superadmin",
    },
    {
      name: "Engr. Reyes",
      email: "lahug@gtrash.com",
      password: "lahug123",
      barangay: "Lahug",
      role: "official",
    },
    {
      name: "Engr. Santos",
      email: "mabolo@gtrash.com",
      password: "mabolo123",
      barangay: "Mabolo",
      role: "official",
    },
    {
      name: "Engr. Cruz",
      email: "itpark@gtrash.com",
      password: "itpark123",
      barangay: "IT Park",
      role: "official",
    },
    {
      name: "Engr. Bautista",
      email: "talamban@gtrash.com",
      password: "talamban123",
      barangay: "Talamban",
      role: "official",
    },
    {
      name: "Engr. Villanueva",
      email: "mandaue@gtrash.com",
      password: "mandaue123",
      barangay: "Mandaue",
      role: "official",
    },
    {
      name: "Engr. Dela Cruz",
      email: "banilad@gtrash.com",
      password: "banilad123",
      barangay: "Banilad",
      role: "official",
    },
  ];
  try {
    const results = [];
    for (const o of officials) {
      const exists = await Official.findOne({ email: o.email });
      if (!exists) {
        const passwordHash = await bcrypt.hash(o.password, 10);
        await Official.create({
          name: o.name,
          email: o.email,
          passwordHash,
          barangay: o.barangay,
          role: o.role,
        });
        results.push({ email: o.email, created: true });
      } else {
        results.push({
          email: o.email,
          created: false,
          note: "already exists",
        });
      }
    }
    res.json({ seeded: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard stats (Officials only) ------------------------
app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    const reportFilter = barangayFilter(req.official);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [
      totalFleet,
      activeTrucks,
      totalReports,
      pendingReports,
      totalRoutes,
    ] = await Promise.all([
      Fleet.countDocuments(),
      Truck.countDocuments({
        status: "online",
        updatedAt: { $gte: fiveMinAgo },
      }),
      Report.countDocuments(reportFilter),
      Report.countDocuments({ ...reportFilter, status: { $ne: "resolved" } }),
      Route.countDocuments(barangayFilter(req.official)),
    ]);
    res.json({
      totalFleet,
      activeTrucks,
      totalReports,
      pendingReports,
      totalRoutes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Trucks --------------------------------------------------
// Public GET â€” used by Resident app and GarbageTruck app
app.get("/api/trucks", async (req, res) => {
  try {
    res.json(await Truck.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/trucks/:truckId", async (req, res) => {
  try {
    const truck = await Truck.findOne({ truckId: req.params.truckId });
    if (!truck) return res.status(404).json({ error: "Truck not found" });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Expo push token for a truck (called on app launch)
app.put("/api/trucks/:truckId/push-token", async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ error: "pushToken required" });
  try {
    await Truck.findOneAndUpdate(
      { truckId: req.params.truckId.toUpperCase() },
      { pushToken },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper — send Expo push notification to a truck
async function notifyTruck(truckId, title, body, data = {}) {
  try {
    const truck = await Truck.findOne({ truckId: truckId.toUpperCase() });
    if (!truck?.pushToken || !truck.pushToken.startsWith("ExponentPushToken")) return;
    const payload = JSON.stringify({
      to: truck.pushToken,
      sound: "default",
      title,
      body,
      data,
    });
    const opts = {
      hostname: "exp.host",
      path: "/--/api/v2/push/send",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req2 = https.request(opts);
    req2.on("error", () => {});
    req2.write(payload);
    req2.end();
  } catch {}
}

// Called by GarbageTruck app to push GPS position
app.post("/api/trucks/location", async (req, res) => {
  const { truckId, lat, lng, heading = 0, speed = 0 } = req.body;
  if (!truckId || lat == null || lng == null) {
    return res.status(400).json({ error: "truckId, lat and lng are required" });
  }
  try {
    const truck = await Truck.findOneAndUpdate(
      { truckId },
      { lat, lng, heading, speed, status: "online", updatedAt: new Date() },
      { upsert: true, new: true },
    );
    io.emit("truck:location:update", {
      truckId,
      lat,
      lng,
      heading,
      speed,
      timestamp: new Date().toISOString(),
    });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Reports -------------------------------------------------
// POST is public (Resident app submits reports)
app.post("/api/reports", async (req, res) => {
  const { category, description, location, barangay, lat, lng, reportedBy } =
    req.body;
  if (!category || !description) {
    return res
      .status(400)
      .json({ error: "category and description are required" });
  }
  try {
    const title = `${category}${location ? " at " + location : barangay ? " - " + barangay : ""}`;
    const report = await Report.create({
      title,
      category,
      description,
      location: location || "",
      barangay: barangay || "",
      lat,
      lng,
      reportedBy: reportedBy || "Resident",
      priority: priorityMap[category] || "Medium",
    });
    io.emit("report:new", report);
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ all reports (Resident app); auth â†’ barangay-filtered (Officials dashboard)
app.get("/api/reports", optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Report.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH/DELETE require Officials auth
app.patch("/api/reports/:id", authMiddleware, async (req, res) => {
  try {
    const { status, ...rest } = req.body;
    const setOps = { ...rest };
    const pushOps = {};

    if (status) {
      setOps.status = status;
      pushOps.statusHistory = {
        status,
        changedBy: req.official.name || req.official.email,
        changedAt: new Date(),
      };
      if (status === "resolved") {
        setOps.resolvedAt = new Date();
        setOps.resolvedBy = req.official.name || req.official.email;
        setOps.resolutionConfirmed = "pending";
      }
      // Response time bonus: award responseScore when an official picks up a report
      if (status === "in-progress") {
        const existing = await Report.findById(req.params.id)
          .select("createdAt barangay")
          .lean();
        if (existing?.barangay && existing.createdAt) {
          const hoursElapsed =
            (Date.now() - new Date(existing.createdAt).getTime()) / 3_600_000;
          const responsePts =
            hoursElapsed < 6
              ? 15
              : hoursElapsed < 24
                ? 10
                : hoursElapsed < 48
                  ? 5
                  : 0;
          if (responsePts > 0) {
            addBarangayScore(
              existing.barangay,
              responsePts,
              "responseScore",
            ).catch(() => {});
          }
        }
      }
    }

    const updateOp = { $set: setOps };
    if (Object.keys(pushOps).length) updateOp.$push = pushOps;

    const report = await Report.findByIdAndUpdate(req.params.id, updateOp, {
      new: true,
    });
    if (!report) return res.status(404).json({ error: "Report not found" });
    io.emit("report:updated", report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/:id/suggestions", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: "Report not found" });

    const urgencyScore = (report.upvotes?.length || 0) - (report.downvotes?.length || 0);
    const suggestions = [];

    // Parallel fetch of routes + trucks
    const [routes, trucks, fleet] = await Promise.all([
      Route.find({}).lean(),
      Truck.find({}).lean(),
      Fleet.find({}).lean(),
    ]);

    // 1. Nearest route suggestion
    if (report.lat != null && report.lng != null) {
      let nearestRoute = null;
      let nearestDist = Infinity;

      for (const route of routes) {
        for (const wp of route.waypoints || []) {
          if (wp.lat == null || wp.lng == null) continue;
          const d = haversineM(report.lat, report.lng, wp.lat, wp.lng);
          if (d < nearestDist) { nearestDist = d; nearestRoute = route; }
        }
      }

      if (nearestRoute && nearestDist < 5000) {
        suggestions.push({
          type: "route",
          title: `Add stop to "${nearestRoute.name}"`,
          description: `The nearest route passes ${Math.round(nearestDist)}m from this location. Adding it as a pickup stop will ensure the area is covered.`,
          action: {
            routeId: nearestRoute._id,
            routeName: nearestRoute.name,
            lat: report.lat,
            lng: report.lng,
            stopName: report.location || report.barangay || "Reported Location",
          },
        });
      }

      // 2. Nearest online truck
      let nearestTruck = null;
      let nearestTruckDist = Infinity;
      for (const truck of trucks) {
        if (truck.status !== "online" || truck.lat == null || truck.lng == null) continue;
        const d = haversineM(report.lat, report.lng, truck.lat, truck.lng);
        if (d < nearestTruckDist) { nearestTruckDist = d; nearestTruck = truck; }
      }

      if (nearestTruck) {
        const fleetEntry = fleet.find((f) => f.truckId === nearestTruck.truckId);
        suggestions.push({
          type: "truck",
          title: `Assign ${nearestTruck.truckId}`,
          description: `${fleetEntry?.driverName ? fleetEntry.driverName + " · " : ""}Nearest online truck, ${Math.round(nearestTruckDist)}m away.`,
          action: {
            truckId: nearestTruck.truckId,
            driverName: fleetEntry?.driverName || "",
          },
        });
      }
    }

    // 3. Priority escalation if community urgency is high
    if (urgencyScore >= 5 && report.priority !== "Critical") {
      suggestions.push({
        type: "priority",
        title: "Escalate to Critical",
        description: `Community urgency score is +${urgencyScore}. High resident concern suggests this needs immediate attention.`,
        action: { priority: "Critical" },
      });
    }

    // 4. Groq AI insight (fire async, with 8s timeout)
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (GROQ_API_KEY) {
      const routeContext = suggestions.find((s) => s.type === "route");
      const systemMsg = `You are a smart assistant for G-TRASH, a waste management system in Cebu City, Philippines. Give a 1-2 sentence practical action recommendation for the barangay official. Be concise and specific.`;
      const userMsg = `Garbage report details:
- Category: ${report.category}
- Location: ${report.location || "Unknown"}, Barangay ${report.barangay}
- Description: ${report.description}
- Status: ${report.status}
- Community Urgency Score: +${urgencyScore}
${routeContext ? `- Nearest route: ${routeContext.action.routeName} (${Math.round(haversineM(report.lat, report.lng, 0, 0))} m — use the route context above)` : ""}

What should the official do first?`;

      const aiText = await new Promise((resolve) => {
        const body = JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          max_tokens: 120,
          temperature: 0.4,
        });
        const options = {
          hostname: "api.groq.com",
          path: "/openai/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Length": Buffer.byteLength(body),
          },
        };
        const groqReq = https.request(options, (r) => {
          let raw = "";
          r.on("data", (c) => (raw += c));
          r.on("end", () => {
            try { resolve(JSON.parse(raw).choices?.[0]?.message?.content?.trim() || null); }
            catch { resolve(null); }
          });
        });
        groqReq.on("error", () => resolve(null));
        groqReq.setTimeout(8000, () => { groqReq.destroy(); resolve(null); });
        groqReq.write(body);
        groqReq.end();
      });

      if (aiText) {
        suggestions.push({ type: "ai", title: "AI Recommendation", description: aiText, action: null });
      }
    }

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports/:id/verify", async (req, res) => {
  const { confirmed, userId } = req.body;
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Not found" });
    if (report.resolutionConfirmed !== "pending")
      return res.status(400).json({ error: "Not awaiting verification" });

    const outcome = confirmed ? "confirmed" : "disputed";
    const setOps = { resolutionConfirmed: outcome };
    const pushEntry = {
      status: outcome,
      changedBy: "Resident",
      changedAt: new Date(),
    };

    if (!confirmed) {
      // Resident says it's still an issue — reopen and penalise barangay
      setOps.status = "pending";
      setOps.resolvedAt = null;
      setOps.escalated = true;
      pushEntry.status = "reopened";
      if (report.barangay)
        await addBarangayScore(report.barangay, -15, "reportScore");
    } else {
      // Confirmed fixed — award points to barangay
      if (report.barangay)
        await addBarangayScore(report.barangay, 20, "reportScore");
    }

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: setOps, $push: { statusHistory: pushEntry } },
      { new: true },
    );
    io.emit("report:updated", updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/reports/:id", authMiddleware, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fleet ---------------------------------------------------
app.get("/api/fleet", optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Fleet.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/fleet/:truckId", async (req, res) => {
  try {
    const entry = await Fleet.findOne({ truckId: req.params.truckId });
    if (!entry) return res.status(404).json({ error: "Truck ID not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mutations require Officials auth
app.post("/api/fleet", authMiddleware, async (req, res) => {
  const { driverName, driverId, driverImage, route, type, serviceBarangays } =
    req.body;
  if (!driverName)
    return res.status(400).json({ error: "driverName is required" });
  try {
    const truckId = await generateUniqueTruckId();
    const brgy = req.official?.barangay;
    const entry = await Fleet.create({
      truckId,
      driverName,
      driverId: driverId || "",
      driverImage: driverImage || null,
      route: route || "",
      barangay: brgy === "All" ? "" : brgy || "",
      type: type || "dedicated",
      serviceBarangays: Array.isArray(serviceBarangays) ? serviceBarangays : [],
    });
    io.emit("fleet:new", entry);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/fleet/:truckId", authMiddleware, async (req, res) => {
  try {
    const entry = await Fleet.findOneAndUpdate(
      { truckId: req.params.truckId },
      req.body,
      { new: true },
    );
    if (!entry) return res.status(404).json({ error: "Truck ID not found" });
    io.emit("fleet:updated", entry);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver self-update â€” no Officials auth required; driver can only update their own name
app.patch("/api/fleet/:truckId/self", async (req, res) => {
  try {
    const { driverName } = req.body;
    if (!driverName?.trim())
      return res.status(400).json({ error: "driverName required" });
    const entry = await Fleet.findOneAndUpdate(
      { truckId: req.params.truckId },
      { driverName: driverName.trim() },
      { new: true },
    );
    if (!entry) return res.status(404).json({ error: "Truck ID not found" });
    io.emit("fleet:updated", {
      truckId: entry.truckId,
      driverName: entry.driverName,
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/fleet/:truckId", authMiddleware, async (req, res) => {
  try {
    await Fleet.findOneAndDelete({ truckId: req.params.truckId });
    io.emit("fleet:deleted", { truckId: req.params.truckId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Routes --------------------------------------------------
// Must be before /:id to avoid param shadowing â€” public for GarbageTruck app
app.get("/api/routes/truck/:truckId", async (req, res) => {
  try {
    const route = await Route.findOne({ truckId: req.params.truckId }).sort({
      createdAt: -1,
    });
    if (!route)
      return res.status(404).json({ error: "No route assigned to this truck" });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get a single route by ID (used by GarbageTruck app when switching routes)
app.get("/api/routes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Backend] Fetching route: "${id}"`);

    if (!id || id === "null" || id === "undefined") {
      return res.status(400).json({ error: "Invalid route ID" });
    }

    // 1. Try findById (Mongoose casts string to ObjectId)
    let route = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      route = await Route.findById(id);
    }

    // 2. Try findOne by _id as string (some DB setups might store it differently)
    if (!route) {
      route = await Route.findOne({ _id: id });
    }

    // 3. Try findOne by name (as a fallback if ID is somehow the name)
    if (!route) {
      route = await Route.findOne({ name: id });
    }

    if (!route) {
      console.log(`[Backend] Route NOT found for ID/Name: "${id}"`);
      const allRoutes = await Route.find({}, { _id: 1, name: 1 }).limit(10);
      console.log(
        `[Backend] Last 10 routes in DB:`,
        allRoutes.map((r) => `${r._id} (${r.name})`),
      );
      return res.status(404).json({ error: "Route not found" });
    }

    console.log(
      `[Backend] Route found: "${route.name}" with ${route.waypoints?.length} waypoints`,
    );
    res.json(route);
  } catch (err) {
    console.error(`[Backend] Error fetching route:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ all routes; auth â†’ barangay-filtered
app.get("/api/routes", optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Route.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mutations require Officials auth
app.post("/api/routes", authMiddleware, async (req, res) => {
  const { name, truckId, driverName, waypoints, routeCoords, totalStops } =
    req.body;
  if (!name || !waypoints || waypoints.length < 2) {
    return res
      .status(400)
      .json({ error: "name and at least 2 waypoints are required" });
  }
  try {
    const brgy = req.official.barangay;

    // Check Geo-Fencing if boundary is defined for this barangay
    if (BARANGAY_BOUNDARIES[brgy]) {
      const polygon = BARANGAY_BOUNDARIES[brgy];
      const illegalWaypoints = waypoints.filter(
        (wp) => !isInsidePolygon([wp.lat, wp.lng], polygon),
      );

      if (illegalWaypoints.length > 0) {
        console.warn(
          `[Backend] Blocked cross-border route attempt by ${brgy} official.`,
        );
        return res.status(403).json({
          error: "Jurisdiction violation!",
          message: `Some waypoints are outside ${brgy} boundaries. You cannot create routes in other barangays.`,
        });
      }
    }

    const route = await Route.create({
      name,
      truckId: truckId || null,
      driverName: driverName || "",
      barangay: brgy === "All" ? "" : brgy,
      waypoints,
      routeCoords: routeCoords || [],
      totalStops: totalStops || waypoints.length,
    });
    io.emit("route:new", route);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/routes/:id", authMiddleware, async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!route) return res.status(404).json({ error: "Route not found" });
    io.emit("route:updated", route);
    // Notify GarbageTruck app of route assignment â€” direct emit, no relay needed
    if (route.truckId) io.emit("route:assigned", { truckId: route.truckId });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/routes/:id", authMiddleware, async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Superadmin Endpoints ------------------------------------

// GET city-wide stats for Superadmin Dashboard
app.get("/api/admin/stats", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const [trucks, reports, officials, residents] = await Promise.all([
      Fleet.countDocuments(),
      Report.countDocuments(),
      Official.countDocuments({ role: "official" }),
      Resident.countDocuments(),
    ]);

    // Leaderboard: Top 5 Barangays by total score (same source as /api/leaderboard)
    const leaderboardRaw = await BarangayScore.find()
      .sort({ points: -1 })
      .limit(5)
      .lean();
    const leaderboard = leaderboardRaw.map((b) => ({
      _id: b.barangay,
      count: b.points,
    }));

    // Waste Composition: Reports by category
    const composition = await Report.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Growth Trends: Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trends = await Report.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Resolution Rate
    const resolvedCount = await Report.countDocuments({ status: "resolved" });
    const resolutionRate =
      reports > 0 ? Math.round((resolvedCount / reports) * 100) : 0;

    res.json({
      summary: { trucks, reports, officials, residents, resolutionRate },
      leaderboard,
      composition,
      trends,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Leaderboard (public) -----------------------------------

// GET ranked barangays by total points
app.get("/api/leaderboard", async (req, res) => {
  try {
    const scores = await BarangayScore.find().sort({ points: -1 }).lean();
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST award points to a barangay (called by resident app — no auth needed)
app.post("/api/leaderboard/add-score", async (req, res) => {
  const { barangay, reason } = req.body;
  if (!barangay || !reason) {
    return res.status(400).json({ error: "barangay and reason required" });
  }

  const CONFIG = {
    pickup: {
      points: 5,
      scoreCategory: "collectionScore",
      countField: "pickupCount",
    },
    vote: {
      points: 1,
      scoreCategory: "reportScore",
      countField: "reportVoteCount",
    },
    area_clean: {
      points: 3,
      scoreCategory: "iotScore",
      countField: "areaQualityPts",
    },
    area_moderate: {
      points: 1,
      scoreCategory: "iotScore",
      countField: "areaQualityPts",
    },
  };
  const cfg = CONFIG[reason];
  if (!cfg) return res.status(400).json({ error: "unknown reason" });

  try {
    const score = await addBarangayScore(
      barangay,
      cfg.points,
      cfg.scoreCategory,
      cfg.countField,
    );
    res.json({ ok: true, points: cfg.points, total: score.points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST seed leaderboard with demo data (dev only — idempotent)
app.post("/api/leaderboard/seed", async (req, res) => {
  const seedData = [
    {
      barangay: "IT Park",
      points: 142,
      reportScore: 52,
      iotScore: 32,
      collectionScore: 58,
      responseScore: 0,
      pickupCount: 10,
      reportVoteCount: 52,
      areaQualityPts: 32,
    },
    {
      barangay: "Lahug",
      points: 119,
      reportScore: 45,
      iotScore: 27,
      collectionScore: 47,
      responseScore: 0,
      pickupCount: 8,
      reportVoteCount: 45,
      areaQualityPts: 27,
    },
    {
      barangay: "Banilad",
      points: 98,
      reportScore: 38,
      iotScore: 21,
      collectionScore: 39,
      responseScore: 0,
      pickupCount: 7,
      reportVoteCount: 38,
      areaQualityPts: 21,
    },
    {
      barangay: "Talamban",
      points: 85,
      reportScore: 33,
      iotScore: 18,
      collectionScore: 34,
      responseScore: 0,
      pickupCount: 6,
      reportVoteCount: 33,
      areaQualityPts: 18,
    },
    {
      barangay: "Mabolo",
      points: 74,
      reportScore: 27,
      iotScore: 18,
      collectionScore: 29,
      responseScore: 0,
      pickupCount: 5,
      reportVoteCount: 27,
      areaQualityPts: 18,
    },
    {
      barangay: "Ayala",
      points: 63,
      reportScore: 24,
      iotScore: 14,
      collectionScore: 25,
      responseScore: 0,
      pickupCount: 4,
      reportVoteCount: 24,
      areaQualityPts: 14,
    },
    {
      barangay: "Carbon Market",
      points: 51,
      reportScore: 19,
      iotScore: 12,
      collectionScore: 20,
      responseScore: 0,
      pickupCount: 4,
      reportVoteCount: 19,
      areaQualityPts: 12,
    },
    {
      barangay: "Ermita",
      points: 44,
      reportScore: 16,
      iotScore: 11,
      collectionScore: 17,
      responseScore: 0,
      pickupCount: 3,
      reportVoteCount: 16,
      areaQualityPts: 11,
    },
    {
      barangay: "Sto. Niño",
      points: 37,
      reportScore: 14,
      iotScore: 9,
      collectionScore: 14,
      responseScore: 0,
      pickupCount: 2,
      reportVoteCount: 14,
      areaQualityPts: 9,
    },
    {
      barangay: "Mandaue",
      points: 28,
      reportScore: 10,
      iotScore: 7,
      collectionScore: 11,
      responseScore: 0,
      pickupCount: 2,
      reportVoteCount: 10,
      areaQualityPts: 7,
    },
  ];
  try {
    const results = await Promise.all(
      seedData.map(
        ({
          barangay,
          points,
          reportScore,
          iotScore,
          collectionScore,
          responseScore,
          pickupCount,
          reportVoteCount,
          areaQualityPts,
        }) =>
          BarangayScore.findOneAndUpdate(
            { barangay },
            {
              $set: {
                points,
                reportScore,
                iotScore,
                collectionScore,
                responseScore,
                pickupCount,
                reportVoteCount,
                areaQualityPts,
                updatedAt: new Date(),
              },
            },
            { upsert: true, new: true },
          ),
      ),
    );
    res.json({ ok: true, seeded: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Bug Reports --------------------------------------------
app.post("/api/bugs", async (req, res) => {
  try {
    const bug = await BugReport.create(req.body);
    res.status(201).json(bug);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/bugs", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const bugs = await BugReport.find().sort({ createdAt: -1 });
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/bugs/:id", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const bug = await BugReport.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Announcements ------------------------------------------
app.get("/api/announcements", async (req, res) => {
  try {
    const docs = await Announcement.find().sort({ createdAt: -1 }).limit(50);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/announcements", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const doc = await Announcement.create({
      ...req.body,
      createdBy: req.official.name || "Admin",
    });
    io.emit("announcement:new", doc);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/announcements/:id", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Pickup Runs (Route Completion) --------------------------
app.post("/api/pickup/complete", async (req, res) => {
  try {
    const {
      truckId,
      driverName,
      routeId,
      routeName,
      barangay: clientBarangay,
      stops,
      totalWeight,
    } = req.body;
    if (!truckId) return res.status(400).json({ error: "truckId required" });

    // Resolve the authoritative barangay from the Route document.
    // This is the key fix for shared trucks: the route knows which barangay
    // is being served regardless of which truck is running it.
    let resolvedBarangay = clientBarangay || "";
    if (routeId && mongoose.Types.ObjectId.isValid(routeId)) {
      const routeDoc = await Route.findById(routeId).select("barangay").lean();
      if (routeDoc?.barangay) resolvedBarangay = routeDoc.barangay;
    }

    const run = await PickupRun.create({
      truckId,
      driverName: driverName || "",
      routeId: routeId || "",
      routeName: routeName || "",
      barangay: resolvedBarangay,
      stopsCompleted: stops || [],
      totalStops: (stops || []).length,
      totalWeight: totalWeight || 0,
    });
    if (resolvedBarangay)
      await addBarangayScore(
        resolvedBarangay,
        5,
        "collectionScore",
        "pickupCount",
      );
    io.emit("pickup:completed", run);
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pickup", async (req, res) => {
  try {
    const { barangay } = req.query;
    const filter = {};
    if (barangay) filter.barangay = barangay;
    const runs = await PickupRun.find(filter)
      .sort({ completedAt: -1 })
      .limit(30);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/pickup/:id/verify", async (req, res) => {
  const { userId, confirmed } = req.body;
  if (userId === undefined || confirmed === undefined) {
    return res.status(400).json({ error: "userId and confirmed required" });
  }
  try {
    const run = await PickupRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: "Pickup run not found" });

    const alreadyVerified = run.verifications.some(
      (v) => v.userId?.toString() === userId.toString(),
    );
    if (alreadyVerified)
      return res.status(400).json({ error: "Already verified" });

    run.verifications.push({ userId, confirmed });
    await run.save();

    if (confirmed) {
      if (run.barangay)
        await addBarangayScore(run.barangay, 10, "collectionScore");
    } else {
      const missed = await Report.create({
        title: "Missed Pickup",
        category: "Uncollected Waste",
        description: `Resident reported that Truck ${run.truckId} did not collect waste in their area during the ${run.routeName || "scheduled"} run.`,
        barangay: run.barangay || "",
        userId,
        reportedBy: "Resident",
        priority: "Medium",
        deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
        statusHistory: [
          { status: "pending", changedBy: "Resident", changedAt: new Date() },
        ],
      });
      io.emit("report:new", missed);
      if (run.barangay)
        await addBarangayScore(run.barangay, -5, "collectionScore");
    }
    io.emit("pickup:verified", { pickupId: run._id, userId, confirmed });
    res.json({ ok: true, confirmed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Bin Status (resident prepare / picked-up) ---------------
async function getBinCounts(barangay, date) {
  const base = { barangay, date };
  const [preparedCount, pickedUpCount] = await Promise.all([
    BinStatus.countDocuments({ ...base, status: { $in: ["prepared", "pickedup"] } }),
    BinStatus.countDocuments({ ...base, status: "pickedup" }),
  ]);
  return { preparedCount, pickedUpCount };
}

app.post("/api/bin/prepare", async (req, res) => {
  try {
    const { residentId, barangay } = req.body;
    if (!residentId || !barangay) return res.status(400).json({ error: "residentId and barangay required" });
    const date = new Date().toISOString().slice(0, 10);
    await BinStatus.findOneAndUpdate(
      { residentId, date },
      { barangay, status: "prepared" },
      { upsert: true, new: true },
    );
    const counts = await getBinCounts(barangay, date);
    io.emit("bin:status:update", { barangay, date, ...counts });
    res.json({ ok: true, ...counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bin/pickedup", async (req, res) => {
  try {
    const { residentId, barangay, truckId } = req.body;
    if (!residentId || !barangay) return res.status(400).json({ error: "residentId and barangay required" });
    const date = new Date().toISOString().slice(0, 10);
    await BinStatus.findOneAndUpdate(
      { residentId, date },
      { barangay, status: "pickedup", truckId: truckId || "" },
      { upsert: true, new: true },
    );
    await addBarangayScore(barangay, 1, "collectionScore", "pickupCount");
    const counts = await getBinCounts(barangay, date);
    io.emit("bin:status:update", { barangay, date, ...counts });
    res.json({ ok: true, ...counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bin/status", async (req, res) => {
  try {
    const { barangay, date } = req.query;
    const today = date || new Date().toISOString().slice(0, 10);
    if (!barangay) return res.status(400).json({ error: "barangay required" });
    const counts = await getBinCounts(barangay, today);
    res.json({ barangay, date: today, ...counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Barangay Boundaries ------------------------------------
app.get("/api/barangays/:barangay/boundary", async (req, res) => {
  try {
    const doc = await BarangayBoundary.findOne({
      barangay: req.params.barangay,
    });
    if (!doc) return res.json({ boundary: [] });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/barangays/boundaries", async (req, res) => {
  try {
    const docs = await BarangayBoundary.find();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/barangays/boundary", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  const { barangay, boundary, color } = req.body;
  try {
    const doc = await BarangayBoundary.findOneAndUpdate(
      { barangay },
      { boundary, color, updatedAt: Date.now() },
      { upsert: true, new: true },
    );
    // Keep in-memory object in sync for route validation
    BARANGAY_BOUNDARIES[barangay] = boundary;
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/generate-boundary", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  const { barangay } = req.body;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return res
      .status(500)
      .json({ error: "Gemini API key not configured in backend .env" });
  }

  const prompt = `Return a JSON array of latitude/longitude coordinates (at least 8 points) that define the administrative boundary of Barangay ${barangay} in Cebu City, Philippines. 
  The format MUST be exactly: [[lat, lng], [lat, lng], ...]. 
  Return ONLY the JSON array, no markdown, no explanation. 
  Example: [[10.33, 123.88], [10.34, 123.89], ...]`;

  try {
    console.log(`[AI] Generating boundary for: ${barangay}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const apiRequest = new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, data: JSON.parse(body) }),
        );
      });
      req.on("error", (e) => reject(e));
      req.write(data);
      req.end();
    });

    const response = await apiRequest;

    if (response.status !== 200) {
      throw new Error(
        response.data?.error?.message ||
          `API returned status ${response.status}`,
      );
    }

    const text = response.data.candidates[0].content.parts[0].text;
    console.log(`[AI] Response received:`, text.substring(0, 50) + "...");

    // Clean potential markdown or whitespace
    const cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let boundary;
    try {
      boundary = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("[AI] JSON Parse Error. Raw text:", text);
      return res
        .status(500)
        .json({ error: "AI returned invalid data format. Please try again." });
    }

    if (!Array.isArray(boundary) || boundary.length < 3) {
      throw new Error("Invalid boundary array format");
    }

    res.json({ boundary });
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    res.status(500).json({ error: `AI generation failed: ${err.message}` });
  }
});

// GET: All officials (Superadmin only)
app.get("/api/admin/officials", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const officials = await Official.find({ role: "official" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(officials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new Official account
app.post("/api/admin/officials", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const { email, password, barangay, name } = req.body;
    if (!email || !password || !barangay) {
      return res
        .status(400)
        .json({ error: "Email, password and barangay are required" });
    }

    const existing = await Official.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newOfficial = await Official.create({
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      barangay,
      name: name || email,
      role: "official",
      status: "active",
    });

    const out = newOfficial.toObject();
    delete out.passwordHash;
    res.status(201).json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Update Official status (Revoke/Activate access)
app.patch(
  "/api/admin/officials/:id/status",
  authMiddleware,
  async (req, res) => {
    if (req.official.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    try {
      const { status } = req.body;
      if (!["active", "revoked"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const official = await Official.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true },
      ).select("-passwordHash");
      if (!official)
        return res.status(404).json({ error: "Official not found" });
      res.json(official);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PUT: Update Official details
app.put("/api/admin/officials/:id", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const { name, barangay, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (barangay) update.barangay = barangay;
    if (password) {
      update.passwordHash = await bcrypt.hash(password, 10);
    }
    const official = await Official.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).select("-passwordHash");
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json(official);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove an official
app.delete("/api/admin/officials/:id", authMiddleware, async (req, res) => {
  if (req.official.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const official = await Official.findByIdAndDelete(req.params.id);
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Barangay Boundaries
app.put(
  "/api/admin/barangays/:name/boundary",
  authMiddleware,
  async (req, res) => {
    if (req.official.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    const { polygon } = req.body;
    if (!polygon || !Array.isArray(polygon)) {
      return res.status(400).json({ error: "Invalid polygon data" });
    }

    // In a real app, you'd save this to a Barangay model.
    // For now, we update our in-memory/global BARANGAY_BOUNDARIES
    BARANGAY_BOUNDARIES[req.params.name] = polygon;
    console.log(`[Admin] Boundary updated for ${req.params.name}`);
    res.json({ ok: true, barangay: req.params.name, boundary: polygon });
  },
);

// Get Barangay Boundary
app.get("/api/barangays/:name/boundary", async (req, res) => {
  const boundary = BARANGAY_BOUNDARIES[req.params.name] || [];
  res.json({ barangay: req.params.name, boundary });
});

// --- Garbage Areas / Heatmap Nodes --------------------------
app.get("/api/garbage-areas", optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    // Unauthenticated residents can pass ?barangay= to filter to their own barangay
    if (!req.official && req.query.barangay) {
      filter.barangay = req.query.barangay;
    }
    const areas = await GarbageArea.find(filter).sort({ createdAt: -1 });
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/garbage-areas", async (req, res) => {
  try {
    const area = new GarbageArea(req.body);
    await area.save();
    console.log(`[Heatmap] New area added: ${area.name}`);
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/garbage-areas/:id", async (req, res) => {
  try {
    await GarbageArea.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Schedules -----------------------------------------------
// Public: today's schedules for Resident HomeScreen
app.get("/api/schedules/today", async (req, res) => {
  try {
    const today = getTodayYMD();
    const schedules = await Schedule.find({ date: today }).sort({
      createdAt: 1,
    });
    res.json({ today, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: all of today's scheduled routes for a specific truck (GarbageTruck app)
// Accepts ?date=YYYY-MM-DD from the client so the device's local date is used,
// avoiding server-timezone mismatches (server may run in UTC, device in UTC+8).
app.get("/api/schedules/truck/:truckId/today", async (req, res) => {
  try {
    const truckId = req.params.truckId.toUpperCase();
    const today = req.query.date || getTodayYMD();
    console.log(
      `[Backend] Fetching schedules for Truck: ${truckId}, Date: ${today}`,
    );

    const schedules = await Schedule.find({ truckId, date: today }).sort({
      startTime: 1,
      createdAt: 1,
    });

    console.log(
      `[Backend] Found ${schedules.length} schedules for ${truckId} on ${today}`,
    );
    if (schedules.length > 0) {
      schedules.forEach((s, i) => {
        console.log(
          `  ${i + 1}. ID: ${s._id}, Route: ${s.routeName}, RouteId: ${s.routeId}`,
        );
      });
    }

    res.json({ schedules, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ by ?month=YYYY-MM (Resident calendar); auth â†’ same + supports ?date=
app.get("/api/schedules", optionalAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) {
      filter.date = req.query.date;
    } else if (req.query.month) {
      const [y, m] = req.query.month.split("-");
      const pad = (n) => String(n).padStart(2, "0");
      filter.date = { $gte: `${y}-${pad(m)}-01`, $lte: `${y}-${pad(m)}-31` };
    }
    // Officials with barangay scope: filter by truckIds that belong to their barangay
    // (schedules don't have a barangay field, so we scope by routeName prefix if needed)
    // For simplicity, all authenticated officials see all schedules â€” superadmin filter applies
    const schedules = await Schedule.find(filter).sort({
      date: 1,
      createdAt: 1,
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST/DELETE require Officials auth
app.post("/api/schedules", authMiddleware, async (req, res) => {
  try {
    const { date, truckId, driverName, routeId, routeName, startTime, notes } =
      req.body;
    if (!date || !truckId)
      return res.status(400).json({ error: "date and truckId required" });
    // Prevent exact duplicate (same truck + same route on the same day); allow different routes
    if (routeId) {
      const dup = await Schedule.findOne({ date, truckId, routeId });
      if (dup)
        return res.status(409).json({
          error: "This route is already scheduled for that truck on this date",
        });
    }
    const schedule = await Schedule.create({
      date,
      truckId,
      driverName,
      routeId,
      routeName,
      startTime: startTime || "",
      notes,
    });
    io.emit("schedule:changed", { truckId, date });

    // Push notification to the assigned truck
    const timeLabel = startTime ? ` at ${startTime}` : "";
    notifyTruck(
      truckId,
      "New Schedule Assigned",
      `You have been scheduled for "${routeName || "a route"}" on ${date}${timeLabel}.`,
      { type: "schedule", scheduleId: schedule._id.toString(), date, routeName },
    );

    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/schedules/:id", authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (schedule)
      io.emit("schedule:changed", {
        truckId: schedule.truckId,
        date: schedule.date,
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Collection logs -----------------------------------------
// GET: All collection logs — supports ?period=today|week|month, ?truckId, ?date
app.get("/api/collections", optionalAuth, async (req, res) => {
  const { period, truckId, date } = req.query;
  try {
    const today = new Date().toLocaleDateString("en-CA");
    const filter = {};

    if (truckId) filter.truckId = truckId.toUpperCase();

    if (date) {
      filter.date = date;
    } else if (period === "today") {
      filter.date = today;
    } else if (period === "week") {
      const now = new Date();
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString("en-CA");
      filter.date = { $gte: fmt(mon), $lte: fmt(sun) };
    } else if (period === "month") {
      const [y, m] = today.split("-");
      filter.date = { $gte: `${y}-${m}-01`, $lte: `${y}-${m}-31` };
    }

    const logs = await CollectionLog.find(filter).sort({ completedAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/collections/truck/:truckId", async (req, res) => {
  const { truckId } = req.params;
  const { period = "today" } = req.query;
  try {
    const today = new Date().toLocaleDateString("en-CA");
    const filter = { truckId };
    if (period === "today") {
      filter.date = today;
    } else if (period === "week") {
      const now = new Date();
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString("en-CA");
      filter.date = { $gte: fmt(mon), $lte: fmt(sun) };
    } else if (period === "month") {
      const [y, m] = today.split("-");
      filter.date = { $gte: `${y}-${m}-01`, $lte: `${y}-${m}-31` };
    }
    const logs = await CollectionLog.find(filter).sort({ completedAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/collections", async (req, res) => {
  const {
    truckId,
    date,
    stopName,
    stopAddress,
    wasteType,
    weight,
    bins,
    routeId,
    routeName,
  } = req.body;
  if (!truckId || !date) {
    return res.status(400).json({ error: "truckId and date are required" });
  }
  try {
    const log = await CollectionLog.create({
      truckId,
      date,
      stopName: stopName || "",
      stopAddress: stopAddress || "",
      wasteType: wasteType || "General",
      weight: weight != null ? weight : 0,
      bins: bins != null ? bins : 1,
      routeId: routeId || "",
      routeName: routeName || "",
    });
    io.emit("collection:new", log);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- IoT Sensor API ------------------------------------------

// Thresholds (rule-based AI)
const IOT_THRESHOLDS = {
  ammonia: { moderate: 25, critical: 45 }, // ppm
  methane: { moderate: 1.5, critical: 2.5 }, // % LEL
  hydrogen: { moderate: 30, critical: 50 }, // ppm
  co2: { moderate: 800, critical: 1500 }, // ppm
  binLevel: { moderate: 70, critical: 90 }, // %
};

function classifyAirQuality(ammonia, methane) {
  if (ammonia >= 45 || methane >= 2.5) return "Hazardous";
  if (ammonia >= 25 || methane >= 1.5) return "Unhealthy";
  if (ammonia >= 15 || methane >= 0.8) return "Moderate";
  return "Good";
}

function generateIoTAlerts(reading) {
  const alerts = [];
  const checks = [
    { field: "ammonia", label: "Ammonia", unit: "ppm" },
    { field: "methane", label: "Methane", unit: "% LEL" },
    { field: "hydrogen", label: "Hydrogen", unit: "ppm" },
    { field: "co2", label: "CO₂", unit: "ppm" },
    { field: "binLevel", label: "Bin Level", unit: "%" },
  ];
  for (const { field, label, unit } of checks) {
    const val = reading[field] || 0;
    const thresh = IOT_THRESHOLDS[field];
    if (!thresh) continue;
    if (val >= thresh.critical) {
      alerts.push({
        sensorId: reading.sensorId,
        location: reading.location || "",
        barangay: reading.barangay || "",
        severity: "critical",
        gasType: field,
        value: val,
        threshold: thresh.critical,
        message: `CRITICAL: ${label} level at ${val} ${unit} — exceeds safe limit of ${thresh.critical} ${unit}`,
      });
    } else if (val >= thresh.moderate) {
      alerts.push({
        sensorId: reading.sensorId,
        location: reading.location || "",
        barangay: reading.barangay || "",
        severity: "moderate",
        gasType: field,
        value: val,
        threshold: thresh.moderate,
        message: `WARNING: ${label} level at ${val} ${unit} — approaching unsafe threshold of ${thresh.critical} ${unit}`,
      });
    }
  }
  return alerts;
}

// POST: Receive sensor data (from ESP32 or Postman/ThunderClient)
app.post("/api/iot/sensor-data", async (req, res) => {
  const {
    sensorId,
    deviceType,
    location,
    barangay,
    lat,
    lng,
    ammonia = 0,
    methane = 0,
    hydrogen = 0,
    co2 = 0,
    temperature = 0,
    humidity = 0,
    binLevel = 0,
    rawValue = 0,
  } = req.body;

  if (!sensorId) {
    return res.status(400).json({ error: "sensorId is required" });
  }

  try {
    const airQuality = classifyAirQuality(ammonia, methane);

    // 1. Save reading
    const reading = await SensorReading.create({
      sensorId,
      deviceType: deviceType || "ESP32",
      location: location || "",
      barangay: barangay || "",
      lat,
      lng,
      ammonia,
      methane,
      hydrogen,
      co2,
      temperature,
      humidity,
      binLevel,
      rawValue,
      airQuality,
    });

    // 2. AI analysis — generate alerts if thresholds exceeded
    const alertDefs = generateIoTAlerts(reading);
    const savedAlerts = [];
    for (const a of alertDefs) {
      const alert = await IoTAlert.create(a);
      savedAlerts.push(alert);
      io.emit("iot:alert", alert); // real-time push
    }

    // 3. Auto-create a report when air quality is Unhealthy or Hazardous
    let autoReport = null;
    if (airQuality === "Unhealthy" || airQuality === "Hazardous") {
      const severity = airQuality === "Hazardous" ? "Critical" : "High";
      autoReport = await Report.create({
        title: `IoT Alert: ${airQuality} Air Quality at ${location || sensorId}`,
        category:
          airQuality === "Hazardous" ? "Hazardous Waste" : "Overflowing Bin",
        description: `Automated IoT detection — Ammonia: ${ammonia} ppm, Methane: ${methane}%, Bin Level: ${binLevel}%. Sensor: ${sensorId}`,
        location: location || "",
        barangay: barangay || "",
        lat,
        lng,
        reportedBy: `IoT Sensor ${sensorId}`,
        priority: severity,
      });
      io.emit("report:new", autoReport);
    }

    // 4. Update garbage-area heatmap node if it exists for this sensor
    const areaStatus =
      airQuality === "Hazardous"
        ? "critical"
        : airQuality === "Unhealthy"
          ? "critical"
          : airQuality === "Moderate"
            ? "moderate"
            : "clean";
    const areaIntensity =
      airQuality === "Hazardous"
        ? 1.0
        : airQuality === "Unhealthy"
          ? 0.8
          : airQuality === "Moderate"
            ? 0.5
            : 0.2;
    if (lat != null && lng != null) {
      const updatedArea = await GarbageArea.findOneAndUpdate(
        { name: location || sensorId },
        {
          lat,
          lng,
          status: areaStatus,
          ammonia: `${ammonia} ppm`,
          methane: `${methane}%`,
          intensity: areaIntensity,
          barangay: barangay || "",
        },
        { upsert: true, new: true },
      );
      io.emit("garbage-area:updated", updatedArea);
      // IoT quality scoring: positive for clean/moderate, negative for unhealthy/hazardous
      if (updatedArea.barangay) {
        const qualityPts =
          airQuality === "Good"
            ? 3
            : airQuality === "Moderate"
              ? 1
              : airQuality === "Unhealthy"
                ? -2
                : airQuality === "Hazardous"
                  ? -5
                  : 0;
        if (qualityPts !== 0) {
          // Only increment legacy areaQualityPts counter for positive readings
          const countField = qualityPts > 0 ? "areaQualityPts" : undefined;
          addBarangayScore(
            updatedArea.barangay,
            qualityPts,
            "iotScore",
            countField,
          ).catch(() => {});
        }
      }
    }

    // 5. Emit real-time sensor update to all dashboard clients
    io.emit("iot:reading", reading);

    console.log(
      `[IoT] Sensor ${sensorId}: NH₃=${ammonia}ppm CH₄=${methane}% AQ=${airQuality} Alerts=${savedAlerts.length}`,
    );

    res.status(201).json({
      reading,
      airQuality,
      alerts: savedAlerts,
      autoReport: autoReport || null,
      thresholds: IOT_THRESHOLDS,
    });
  } catch (err) {
    console.error("[IoT] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET: All readings for a sensor (with optional limit/time range)
app.get("/api/iot/readings", optionalAuth, async (req, res) => {
  try {
    const { sensorId, limit = 100, hours } = req.query;
    const filter = barangayFilter(req.official);
    if (sensorId) filter.sensorId = sensorId;
    if (hours) {
      filter.timestamp = {
        $gte: new Date(Date.now() - Number(hours) * 3600 * 1000),
      };
    }
    const readings = await SensorReading.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Latest reading per sensor
app.get("/api/iot/readings/latest", optionalAuth, async (req, res) => {
  try {
    const brgyFilter = barangayFilter(req.official);
    const matchStage = Object.keys(brgyFilter).length
      ? { $match: brgyFilter }
      : null;
    const pipeline = [
      ...(matchStage ? [matchStage] : []),
      { $sort: { timestamp: -1 } },
      { $group: { _id: "$sensorId", reading: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$reading" } },
      { $sort: { sensorId: 1 } },
    ];
    const latest = await SensorReading.aggregate(pipeline);
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Pollution trends — aggregated by hour for the last N hours
app.get("/api/iot/trends", optionalAuth, async (req, res) => {
  try {
    const { sensorId, hours = 168 } = req.query; // default = 7 days
    const since = new Date(Date.now() - Number(hours) * 3600 * 1000);
    const match = {
      timestamp: { $gte: since },
      ...barangayFilter(req.official),
    };
    if (sensorId) match.sensorId = sensorId;

    const trends = await SensorReading.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" },
          },
          avgAmmonia: { $avg: "$ammonia" },
          avgMethane: { $avg: "$methane" },
          avgTemperature: { $avg: "$temperature" },
          avgHumidity: { $avg: "$humidity" },
          avgBinLevel: { $avg: "$binLevel" },
          maxAmmonia: { $max: "$ammonia" },
          maxMethane: { $max: "$methane" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } },
    ]);

    // Format for chart consumption
    const formatted = trends.map((t) => {
      const { year, month, day, hour } = t._id;
      const dateStr = `${month}/${day} ${String(hour).padStart(2, "0")}:00`;
      return {
        date: dateStr,
        ammonia: Math.round(t.avgAmmonia * 10) / 10,
        methane: Math.round(t.avgMethane * 100) / 100,
        temperature: Math.round(t.avgTemperature * 10) / 10,
        humidity: Math.round(t.avgHumidity * 10) / 10,
        binLevel: Math.round(t.avgBinLevel),
        maxAmmonia: t.maxAmmonia,
        maxMethane: t.maxMethane,
        samples: t.count,
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: IoT alerts
app.get("/api/iot/alerts", optionalAuth, async (req, res) => {
  try {
    const { limit = 50, severity, acknowledged } = req.query;
    const filter = barangayFilter(req.official);
    if (severity) filter.severity = severity;
    if (acknowledged !== undefined)
      filter.acknowledged = acknowledged === "true";
    const alerts = await IoTAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Acknowledge an alert
app.patch("/api/iot/alerts/:id/acknowledge", async (req, res) => {
  try {
    const alert = await IoTAlert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true },
    );
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    io.emit("iot:alert:acknowledged", alert);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: IoT dashboard summary
app.get("/api/iot/summary", optionalAuth, async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const brgyFilter = barangayFilter(req.official);
    const [totalSensors, recentReadings, activeAlerts, criticalAlerts] =
      await Promise.all([
        SensorReading.distinct("sensorId", brgyFilter),
        SensorReading.countDocuments({
          timestamp: { $gte: oneHourAgo },
          ...brgyFilter,
        }),
        IoTAlert.countDocuments({ acknowledged: false, ...brgyFilter }),
        IoTAlert.countDocuments({
          acknowledged: false,
          severity: "critical",
          ...brgyFilter,
        }),
      ]);
    res.json({
      totalSensors: totalSensors.length,
      recentReadings,
      activeAlerts,
      criticalAlerts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.io -----------------------------------------------
const socketTruckMap = new Map(); // socketId → truckId (for auto-offline on disconnect)

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // GarbageTruck app sends live GPS position
  socket.on("truck:location", async (data, ack) => {
    const { truckId, lat, lng, heading = 0, speed = 0 } = data;
    socketTruckMap.set(socket.id, truckId);
    if (!truckId || lat == null || lng == null) {
      if (typeof ack === "function")
        ack({ ok: false, error: "Missing fields" });
      return;
    }
    try {
      const truck = await Truck.findOneAndUpdate(
        { truckId },
        { lat, lng, heading, speed, status: "online", updatedAt: new Date() },
        { upsert: true, new: true },
      );
      if (typeof ack === "function") ack({ ok: true, truckId, lat, lng });
      // Broadcast to Resident app + Officials dashboard â€” same io instance, no relay
      socket.broadcast.emit("truck:location:update", {
        truckId,
        lat,
        lng,
        heading,
        speed,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  // Truck marks itself offline — broadcast to ALL clients including sender
  socket.on("truck:offline", async ({ truckId }) => {
    if (!truckId) return;
    socketTruckMap.delete(socket.id);
    try {
      await Truck.findOneAndUpdate({ truckId }, { status: "offline" });
    } catch (err) {
      console.error("DB write error:", err.message);
    }
    io.emit("truck:status", { truckId, status: "offline" });
  });

  // Truck reports it is off its assigned route â€” relay to Officials dashboard
  socket.on("truck:off-route", (data) => {
    socket.broadcast.emit("truck:off-route", data);
  });

  // Driver requests help from dispatch â€” relay to Officials dashboard
  socket.on("truck:contact-dispatch", (data) => {
    socket.broadcast.emit("truck:contact-dispatch", data);
  });

  socket.on("disconnect", async () => {
    const truckId = socketTruckMap.get(socket.id);
    if (truckId) {
      socketTruckMap.delete(socket.id);
      try {
        await Truck.findOneAndUpdate({ truckId }, { status: "offline" });
      } catch (_) {}
      io.emit("truck:status", { truckId, status: "offline" });
      console.log(`[Socket] Truck ${truckId} auto-offline on disconnect`);
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// --- EcoAssist AI (Groq) -------------------------------------
app.post("/api/ai/chat", (req, res) => {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY || GROQ_API_KEY === "your_groq_key_here") {
    return res.status(500).json({ error: "GROQ_API_KEY not configured in .env" });
  }
  const { messages = [], context = {} } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });

  const systemPrompt = `You are EcoAssist AI, a helpful assistant for garbage truck collectors in Cebu, Philippines working on the G-TRASH smart waste monitoring system. You help drivers with route tips, waste collection guidance, area-specific advice, and answering questions about their day.

Current session context:
- Driver: ${context.driverName || "Collector"}
- Truck ID: ${context.truckId || "Unknown"}
- Route: ${context.routeName || "Unassigned"}
- Current stop: ${context.currentStop || "None"}
- Progress: ${context.completed ?? 0} of ${context.total ?? 0} stops completed
- Total weight collected today: ${context.totalWeight ?? 0}kg

Keep responses short and practical — drivers read on a phone while working. Use plain language.`;

  const body = JSON.stringify({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 256,
    temperature: 0.7,
  });

  const options = {
    hostname: "api.groq.com",
    path: "/openai/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const request = https.request(options, (groqRes) => {
    let raw = "";
    groqRes.on("data", (chunk) => { raw += chunk; });
    groqRes.on("end", () => {
      try {
        const data = JSON.parse(raw);
        if (groqRes.statusCode >= 400) {
          return res.status(groqRes.statusCode).json({ error: data.error?.message || "Groq API error" });
        }
        res.json({ reply: data.choices[0].message.content });
      } catch {
        res.status(500).json({ error: "Failed to parse Groq response" });
      }
    });
  });

  request.on("error", (err) => res.status(500).json({ error: err.message }));
  request.write(body);
  request.end();
});

// --- Start ---------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`OK: G-TRASH unified server running on port ${PORT}`);
});
