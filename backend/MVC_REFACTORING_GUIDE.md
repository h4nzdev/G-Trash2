# Backend MVC Architecture Refactoring Guide
> **G-TRASH Unified Backend** — Step-by-Step Developer Guide

This guide walks you through refactoring the monolithic `app.js` (~7,300+ lines) into a modular, industry-standard **Model-View-Controller (MVC) + Service Layer** architecture.

---

## 📁 1. Target Directory Structure

Create the following folder structure inside the `backend/` directory:

```text
backend/
├── config/
│   ├── db.js                     # MongoDB connection & lifecycle events
│   ├── cloudinary.js             # Cloudinary SDK & Multer configuration
│   ├── socket.js                 # Global Socket.IO instance provider
│   └── wasteClassification.js    # AI waste classification presets
├── models/
│   ├── index.js                  # Central model export hub
│   ├── User.js                   # Base User & Resident models
│   ├── Official.js               # Barangay officials & roles
│   ├── Truck.js                  # Truck GPS location & telemetry
│   ├── Fleet.js                  # Fleet tracking & truck profiles
│   ├── Route.js                  # Pre-configured & active routes
│   ├── Schedule.js               # Schedules & Sitio checklist tasks
│   ├── Sitio.js                  # Sitio coordinates & verified boundaries
│   ├── GarbageArea.js            # Waste nodes / heatmap zones
│   ├── CollectionLog.js          # Shift completion & collection logs
│   ├── SensorReading.js          # IoT ESP32 raw & calibrated telemetry
│   ├── IoTAlert.js               # IoT & threshold alert records
│   ├── Report.js                 # Citizen & system issue reports
│   ├── DisposalVerification.js   # Resident disposal photo verifications
│   ├── Reward.js                 # Citizen rewards & voucher redemption
│   ├── BarangayScore.js          # Gamification scores & rankings
│   ├── BarangayPointHistory.js   # Audit trail for barangay points
│   ├── BarangayBoundary.js       # GeoJSON boundary coordinates
│   ├── Announcement.js           # Public & official bulletins
│   ├── PickupRun.js              # Live route runs & resident confirmations
│   ├── BinStatus.js              # Aggregated bin status per barangay
│   ├── BugReport.js              # In-app bug feedback
│   ├── ErrorLog.js               # System runtime error logs
│   ├── CleanupPost.js            # Community cleanup drives & events
│   └── SurveyResponse.js         # Resident satisfaction surveys
├── controllers/
│   ├── authController.js         # Login, Register, JWT, Profile updates
│   ├── officialController.js     # Officials CRUD & permissions
│   ├── scheduleController.js     # Schedules, Task completion, Shift completion
│   ├── fleetController.js        # Fleet status, maintenance, real-time GPS
│   ├── routeController.js        # Route creation, waypoints, ORS/OSRM routing
│   ├── iotController.js          # Telemetry ingestion, IoT alerts, Sensor queries
│   ├── reportController.js       # Reports management, escalation, photo upload
│   ├── areaController.js         # Heatmap zones, garbage areas, barangay boundaries
│   ├── rewardController.js       # Point redemption, verifications, vouchers
│   ├── barangayController.js     # Scoreboard, rankings, performance stats
│   ├── announcementController.js # Announcements & broadcasts
│   ├── systemController.js       # Health metrics, CPU/memory monitor, error logs
│   └── communityController.js    # Cleanup drives, community surveys
├── routes/
│   ├── index.js                  # Express Master Router (mounts all sub-routes)
│   ├── authRoutes.js             # /api/auth
│   ├── officialRoutes.js         # /api/officials
│   ├── scheduleRoutes.js         # /api/schedules
│   ├── fleetRoutes.js            # /api/fleet & /api/trucks
│   ├── routeRoutes.js            # /api/routes
│   ├── iotRoutes.js              # /api/iot
│   ├── reportRoutes.js           # /api/reports
│   ├── areaRoutes.js             # /api/garbage-areas, /api/zones, /api/sitios
│   ├── rewardRoutes.js           # /api/rewards & /api/disposal
│   ├── barangayRoutes.js         # /api/barangays & /api/barangay-scores
│   ├── announcementRoutes.js     # /api/announcements
│   ├── systemRoutes.js           # /api/system, /api/logs, /api/health
│   └── communityRoutes.js        # /api/cleanup-posts & /api/surveys
├── middleware/
│   ├── auth.js                   # JWT verification (authenticate, optionalAuth)
│   ├── roleGuard.js              # Superadmin & official role guards
│   ├── barangayScope.js          # Jurisdiction query & mutation filter
│   ├── upload.js                 # Cloudinary / Multer image upload helper
│   ├── errorHandler.js           # Centralized Express error handler
│   └── requestLogger.js          # API request logger & performance timer
├── services/
│   ├── routingService.js         # ORS routing with OSRM fallback
│   ├── iotService.js             # Air quality classification & alert cooldowns
│   ├── scheduleMonitor.js        # Overdue schedule background checker
│   ├── gamificationService.js    # Barangay score calculation & point ledger
│   └── systemMonitor.js          # CPU, Memory, & API metrics aggregation
├── sockets/
│   ├── index.js                  # Main Socket.IO connection dispatcher
│   ├── truckSocket.js            # GPS streaming, off-route, shift completion
│   ├── iotSocket.js              # IoT telemetry & air quality push
│   ├── reportSocket.js           # Report status updates & verifications
│   └── scheduleSocket.js         # Task completions & route updates
├── utils/
│   ├── geoUtils.js               # GeoJSON polygon check, distance calculations
│   └── logger.js                 # Structured console & persistent error logger
├── app.js                        # Express Application initialization (middleware & routes)
└── server.js                     # HTTP server startup, DB connection, & Socket.IO listener
```

---

## 🚀 2. Step-by-Step Implementation Flow

Follow these phases in sequence to refactor safely without breaking existing endpoints:

### Phase 1: Configuration & Socket Provider (`config/`)

1. **`config/db.js`**:
   ```javascript
   const mongoose = require("mongoose");
   const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gtrash";

   async function connectDB() {
     try {
       await mongoose.connect(MONGO_URI);
       console.log("OK: Connected to MongoDB");
     } catch (err) {
       console.error("FAIL: MongoDB connection error:", err.message);
       process.exit(1);
     }
   }

   module.exports = { connectDB, MONGO_URI };
   ```

2. **`config/socket.js`**:
   Controllers and services need to emit Socket.IO events without circular dependencies:
   ```javascript
   let io = null;

   module.exports = {
     initIO: (socketServer) => {
       io = socketServer;
       global._io = socketServer;
       return io;
     },
     getIO: () => {
       if (!io && global._io) return global._io;
       return io;
     },
   };
   ```

3. **`config/cloudinary.js`**:
   ```javascript
   const cloudinary = require("cloudinary").v2;

   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dffukbubx",
     api_key: process.env.CLOUDINARY_API_KEY || "891461973685955",
     api_secret: process.env.CLOUDINARY_API_SECRET || "F51-d9yOa9dM0qj1d9Bvd49h5q8",
   });

   module.exports = cloudinary;
   ```

---

### Phase 2: Extract Mongoose Models (`models/`)

Move each schema from `app.js` into its own file inside `models/`.

#### Example: `models/Truck.js`
```javascript
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

module.exports = mongoose.model("Truck", truckSchema);
```

#### Central Export: `models/index.js`
Export all models in one place so you can import them cleanly anywhere:
```javascript
module.exports = {
  Truck: require("./Truck"),
  Report: require("./Report"),
  Fleet: require("./Fleet"),
  Route: require("./Route"),
  Schedule: require("./Schedule"),
  Sitio: require("./Sitio"),
  GarbageArea: require("./GarbageArea"),
  CollectionLog: require("./CollectionLog"),
  SensorReading: require("./SensorReading"),
  IoTAlert: require("./IoTAlert"),
  Official: require("./Official"),
  ErrorLog: require("./ErrorLog"),
  BugReport: require("./BugReport"),
  Resident: require("./Resident"),
  DisposalVerification: require("./DisposalVerification"),
  Reward: require("./Reward"),
  BarangayBoundary: require("./BarangayBoundary"),
  BarangayScore: require("./BarangayScore"),
  BarangayPointHistory: require("./BarangayPointHistory"),
  Announcement: require("./Announcement"),
  PickupRun: require("./PickupRun"),
  BinStatus: require("./BinStatus"),
  CleanupPost: require("./CleanupPost"),
  SurveyResponse: require("./SurveyResponse"),
};
```

---

### Phase 3: Middleware Layer (`middleware/`)

Extract common authentication, role checking, and scoping functions:

1. **`middleware/auth.js`**:
   - `authenticate`: Validates JWT from `Authorization: Bearer <token>`
   - `optionalAuth`: Attaches `req.user` if token exists, continues without error if absent
2. **`middleware/roleGuard.js`**:
   - `requireOfficial`: Allows `official` and `superadmin` roles
   - `requireSuperAdmin`: Restricts route strictly to `superadmin`
3. **`middleware/barangayScope.js`**:
   - `barangayFilter(req)`: Returns `{ barangay: req.user.barangay }` for scoped officials, or `{}` for superadmins.
4. **`middleware/errorHandler.js`**:
   ```javascript
   const { logError } = require("../utils/logger");

   module.exports = (err, req, res, next) => {
     console.error(`[Error] ${req.method} ${req.url}:`, err.message);
     logError(err.message, { severity: "error", source: req.url, stack: err.stack });
     res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
   };
   ```

---

### Phase 4: Services Layer (`services/`)

Extract complex business logic out of controllers into reusable services:

1. **`services/routingService.js`**:
   - `getRouteDirections(waypoints)`: Calls OpenRouteService with automatic OSRM fallback.
2. **`services/iotService.js`**:
   - `classifyAirQuality(rawValue, ammonia)`
   - `generateIoTAlerts(reading)`
   - Per-sensor alert cooldown and report deduplication.
3. **`services/gamificationService.js`**:
   - `addBarangayScore(barangay, pts, category, countField, description)`
4. **`services/scheduleMonitor.js`**:
   - `updateOverdueSchedules()` & `startScheduleMonitor()` cron runner.
5. **`services/systemMonitor.js`**:
   - `buildSystemHealth()`: CPU, memory, API metrics aggregation.

---

### Phase 5: Controllers & Routes (`controllers/` & `routes/`)

Each domain gets a controller containing async handler functions and a router that maps HTTP paths.

#### Controller Pattern: `controllers/scheduleController.js`
```javascript
const { Schedule, Truck } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");

exports.getSchedules = async (req, res, next) => {
  try {
    const { date, truckId, status } = req.query;
    const filter = barangayFilter(req);
    if (date) filter.date = date;
    if (truckId) filter.truckId = truckId;
    if (status) filter.status = status;

    const schedules = await Schedule.find(filter).sort({ date: -1, startTime: 1 });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
};

exports.createSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.create(req.body);
    const io = getIO();
    if (io) io.emit("schedule:changed", { truckId: schedule.truckId, date: schedule.date });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
};
```

#### Route Pattern: `routes/scheduleRoutes.js`
```javascript
const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, scheduleController.getSchedules);
router.post("/", authenticate, scheduleController.createSchedule);
router.patch("/:id/complete", authenticate, scheduleController.completeSchedule);
router.post("/:id/complete-task", authenticate, scheduleController.completeTask);

module.exports = router;
```

#### Master Router: `routes/index.js`
```javascript
const express = require("express");
const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/officials", require("./officialRoutes"));
router.use("/schedules", require("./scheduleRoutes"));
router.use("/fleet", require("./fleetRoutes"));
router.use("/routes", require("./routeRoutes"));
router.use("/iot", require("./iotRoutes"));
router.use("/reports", require("./reportRoutes"));
router.use("/garbage-areas", require("./areaRoutes"));
router.use("/rewards", require("./rewardRoutes"));
router.use("/barangays", require("./barangayRoutes"));
router.use("/announcements", require("./announcementRoutes"));
router.use("/system", require("./systemRoutes"));
router.use("/cleanup", require("./communityRoutes"));

module.exports = router;
```

---

### Phase 6: Socket.IO Modularization (`sockets/`)

Organize real-time socket events cleanly in `sockets/`:

1. **`sockets/truckSocket.js`**: Handles `truck:location:update`, `truck:off-route`, `truck:shift-completed`, `truck:status`.
2. **`sockets/iotSocket.js`**: Handles `iot:reading`, `iot:alert`, `garbage-area:updated`.
3. **`sockets/index.js`**:
   ```javascript
   const { initIO } = require("../config/socket");
   const registerTruckSockets = require("./truckSocket");
   const registerIoTSockets = require("./iotSocket");

   module.exports = function initializeSockets(server) {
     const io = require("socket.io")(server, {
       cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
       transports: ["websocket", "polling"],
     });

     initIO(io);

     io.on("connection", (socket) => {
       registerTruckSockets(io, socket);
       registerIoTSockets(io, socket);
     });

     return io;
   };
   ```

---

### Phase 7: App & Server Entrypoints (`app.js` & `server.js`)

Split Express application setup from server network listening:

#### `app.js` (Express App Definition)
```javascript
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Mount all API routes
app.use("/api", routes);

// Central error handler
app.use(errorHandler);

module.exports = app;
```

#### `server.js` (Server Startup & Lifecycle)
```javascript
require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const initializeSockets = require("./sockets");
const { startScheduleMonitor } = require("./services/scheduleMonitor");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Sockets
initializeSockets(server);

// Connect DB and Start
connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`OK: G-TRASH server running on port ${PORT}`);
    startScheduleMonitor();
  });
});
```

---

## ⚠️ 3. Crucial Pitfalls & Tips to Avoid

| Pitfall | Solution |
| :--- | :--- |
| **Circular Dependency with `io`** | Never `require("../server")` inside controllers. Instead, use `const { getIO } = require("../config/socket")` or `req.app.get("io")`. |
| **Mongoose OverwriteModelError** | Always define models with `mongoose.models.Truck \|\| mongoose.model("Truck", truckSchema)`. |
| **Uncaught Async Errors** | Always wrap async controller logic with `try / catch (err) { next(err); }`. |
| **Barangay Scoping Leakage** | Always pass `req` to `barangayFilter(req)` in controllers so Lahug and Apas officials only see their own records. |
| **Duplicate Alert Spam** | Keep `sensorAlertCooldowns` in `services/iotService.js` to throttle IoT alerts. |

---

## ✅ 4. Verification Checklist

When you finish refactoring, test using this checklist:

- [ ] `node server.js` starts with zero syntax or require errors.
- [ ] `POST /api/auth/login` and `POST /api/officials/login` return valid JWT tokens.
- [ ] `GET /api/schedules` correctly filters by barangay.
- [ ] `POST /api/routes/route-directions` returns route coordinates (ORS / OSRM fallback).
- [ ] `POST /api/iot/sensor-data` ingests telemetry and triggers cooldown-protected alerts.
- [ ] Real-time Socket.IO broadcasts (`truck:location:update`, `truck:shift-completed`) are received by the frontend portals.
