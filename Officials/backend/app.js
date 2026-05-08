require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { io: connectTracking } = require('socket.io-client');
const mongoose   = require('mongoose');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const MONGO_URI    = process.env.MONGO_URI    || 'mongodb://localhost:27017/gtrash';
const PORT         = process.env.PORT         || 4000;
const TRACKING_URL = process.env.TRACKING_URL || 'http://localhost:5000';
const JWT_SECRET   = process.env.JWT_SECRET   || 'gtrash-officials-secret-2025';

// ── MongoDB ────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected →', MONGO_URI))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ── Schemas ────────────────────────────────────────────────

const officialSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  barangay:     { type: String, required: true }, // 'All' for superadmin
  role:         { type: String, enum: ['official', 'superadmin'], default: 'official' },
  createdAt:    { type: Date, default: Date.now },
});
const Official = mongoose.model('Official', officialSchema);

const fleetSchema = new mongoose.Schema({
  truckId:    { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  route:      { type: String, default: '' },
  createdAt:  { type: Date,   default: Date.now },
});
const Fleet = mongoose.model('Fleet', fleetSchema);

const reportSchema = new mongoose.Schema({
  title:       String,
  category:    String,
  description: String,
  location:    { type: String, default: '' },
  barangay:    { type: String, default: '' },
  lat:         Number,
  lng:         Number,
  reportedBy:  { type: String, default: 'Resident' },
  priority:    { type: String, default: 'Medium' },
  status:      { type: String, default: 'pending' },
  createdAt:   { type: Date, default: Date.now },
});
const Report = mongoose.model('Report', reportSchema);

const routeSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  truckId:     { type: String, default: null },
  driverName:  { type: String, default: '' },
  barangay:    { type: String, default: '' },
  waypoints:   [{ lat: Number, lng: Number, name: String }],
  routeCoords: { type: [[Number]], default: [] },
  totalStops:  { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});
const Route = mongoose.model('Route', routeSchema);

const truckSchema = new mongoose.Schema({
  truckId:   String,
  lat:       Number,
  lng:       Number,
  heading:   { type: Number, default: 0 },
  speed:     { type: Number, default: 0 },
  status:    { type: String, default: 'offline' },
  updatedAt: { type: Date,   default: Date.now },
});
const Truck = mongoose.model('Truck', truckSchema);

const scheduleSchema = new mongoose.Schema({
  date:       { type: String, required: true },  // YYYY-MM-DD
  truckId:    { type: String, required: true },
  driverName: { type: String, default: '' },
  routeId:    { type: String, default: '' },
  routeName:  { type: String, default: '' },
  notes:      { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

// ── Helpers ────────────────────────────────────────────────
async function generateUniqueTruckId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id, exists;
  do {
    const suffix = Array.from({ length: 3 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    id = `GT-${suffix}`;
    exists = await Fleet.findOne({ truckId: id });
  } while (exists);
  return id;
}

// ── Auth middleware ────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.official = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

// Barangay filter: superadmin / 'All' sees everything
function barangayFilter(official, field = 'barangay') {
  if (official.barangay === 'All' || official.role === 'superadmin') return {};
  return { [field]: official.barangay };
}

// ── Health ─────────────────────────────────────────────────
app.get('/ping', (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

// Debug: check raw DB counts without auth
app.get('/debug/counts', async (req, res) => {
  try {
    const [fleetCount, truckCount, reportCount, routeCount, officialCount] = await Promise.all([
      Fleet.countDocuments(),
      Truck.countDocuments(),
      Report.countDocuments(),
      Route.countDocuments(),
      Official.countDocuments(),
    ]);
    res.json({ fleets: fleetCount, trucks: truckCount, reports: reportCount, routes: routeCount, officials: officialCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auth endpoints ─────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const official = await Official.findOne({ email: email.toLowerCase() });
    if (!official) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, official.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: official._id, name: official.name, email: official.email, barangay: official.barangay, role: official.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      official: { id: official._id, name: official.name, email: official.email, barangay: official.barangay, role: official.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ official: req.official });
});

// Dev-only: seed initial officials (one per barangay + superadmin)
app.post('/api/auth/seed', async (req, res) => {
  const officials = [
    { name: 'Super Admin',       email: 'admin@gtrash.com',   password: 'admin123',   barangay: 'All',           role: 'superadmin' },
    { name: 'Engr. Reyes',       email: 'lahug@gtrash.com',   password: 'lahug123',   barangay: 'Lahug',         role: 'official' },
    { name: 'Engr. Santos',      email: 'mabolo@gtrash.com',  password: 'mabolo123',  barangay: 'Mabolo',        role: 'official' },
    { name: 'Engr. Cruz',        email: 'itpark@gtrash.com',  password: 'itpark123',  barangay: 'IT Park',       role: 'official' },
    { name: 'Engr. Bautista',    email: 'talamban@gtrash.com',password: 'talamban123',barangay: 'Talamban',      role: 'official' },
    { name: 'Engr. Villanueva',  email: 'mandaue@gtrash.com', password: 'mandaue123', barangay: 'Mandaue',       role: 'official' },
    { name: 'Engr. Dela Cruz',   email: 'banilad@gtrash.com', password: 'banilad123', barangay: 'Banilad',       role: 'official' },
  ];
  try {
    const results = [];
    for (const o of officials) {
      const exists = await Official.findOne({ email: o.email });
      if (!exists) {
        const passwordHash = await bcrypt.hash(o.password, 10);
        const created = await Official.create({ name: o.name, email: o.email, passwordHash, barangay: o.barangay, role: o.role });
        results.push({ email: o.email, created: true });
        console.log(`✅ Seeded official: ${o.email} (${o.barangay})`);
      } else {
        results.push({ email: o.email, created: false, note: 'already exists' });
      }
    }
    res.json({ seeded: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard stats ────────────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const reportFilter = barangayFilter(req.official);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [totalFleet, activeTrucks, totalReports, pendingReports, totalRoutes] =
      await Promise.all([
        Fleet.countDocuments(),
        Truck.countDocuments({ status: 'online', updatedAt: { $gte: fiveMinAgo } }),
        Report.countDocuments(reportFilter),
        Report.countDocuments({ ...reportFilter, status: { $ne: 'resolved' } }),
        Route.countDocuments(barangayFilter(req.official)),
      ]);
    res.json({ totalFleet, activeTrucks, totalReports, pendingReports, totalRoutes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trucks (read-only for monitoring) ─────────────────────
app.get('/api/trucks', authMiddleware, async (req, res) => {
  try {
    res.json(await Truck.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trucks/:truckId', authMiddleware, async (req, res) => {
  try {
    const truck = await Truck.findOne({ truckId: req.params.truckId });
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fleet management ───────────────────────────────────────
app.post('/api/fleet', authMiddleware, async (req, res) => {
  const { driverName, route } = req.body;
  if (!driverName) return res.status(400).json({ error: 'driverName is required' });
  try {
    const truckId = await generateUniqueTruckId();
    const entry = await Fleet.create({ truckId, driverName, route: route || '' });
    console.log(`🚛 Fleet registered: ${truckId} → ${driverName}`);
    io.emit('fleet:new', entry);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fleet', authMiddleware, async (req, res) => {
  try {
    res.json(await Fleet.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fleet/:truckId', authMiddleware, async (req, res) => {
  try {
    const entry = await Fleet.findOne({ truckId: req.params.truckId });
    if (!entry) return res.status(404).json({ error: 'Truck ID not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/fleet/:truckId', authMiddleware, async (req, res) => {
  try {
    const entry = await Fleet.findOneAndUpdate(
      { truckId: req.params.truckId },
      req.body,
      { new: true },
    );
    if (!entry) return res.status(404).json({ error: 'Truck ID not found' });
    io.emit('fleet:updated', entry);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fleet/:truckId', authMiddleware, async (req, res) => {
  try {
    await Fleet.findOneAndDelete({ truckId: req.params.truckId });
    io.emit('fleet:deleted', { truckId: req.params.truckId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reports ────────────────────────────────────────────────
app.get('/api/reports', authMiddleware, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Report.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reports/:id', authMiddleware, async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    io.emit('report:updated', report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reports/:id', authMiddleware, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Collection routes ──────────────────────────────────────
app.post('/api/routes', authMiddleware, async (req, res) => {
  const { name, truckId, driverName, waypoints, routeCoords, totalStops } = req.body;
  if (!name || !waypoints || waypoints.length < 2) {
    return res.status(400).json({ error: 'name and at least 2 waypoints are required' });
  }
  try {
    const route = await Route.create({
      name,
      truckId:     truckId || null,
      driverName:  driverName || '',
      barangay:    req.official.barangay === 'All' ? '' : req.official.barangay,
      waypoints,
      routeCoords: routeCoords || [],
      totalStops:  totalStops || waypoints.length,
    });
    console.log(`🗺️  Route created: "${route.name}" → truck:${route.truckId}`);
    io.emit('route:new', route);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/routes', authMiddleware, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Route.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Must precede /:id to avoid param shadowing
app.get('/api/routes/truck/:truckId', async (req, res) => {
  try {
    const route = await Route.findOne({ truckId: req.params.truckId }).sort({ createdAt: -1 });
    if (!route) return res.status(404).json({ error: 'No route assigned to this truck' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/routes/:id', authMiddleware, async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    io.emit('route:updated', route);
    // Push route assignment change to the GarbageTruck app via relay
    if (route.truckId) trackingRelay?.emit('route:assigned', { truckId: route.truckId });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/routes/:id', authMiddleware, async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedule endpoints ─────────────────────────────────────
// GET /api/schedules?month=YYYY-MM or ?date=YYYY-MM-DD
app.get('/api/schedules', authMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) {
      filter.date = req.query.date;
    } else if (req.query.month) {
      // Match any date string that starts with YYYY-MM (handles YYYY-MM-DD format)
      const [y, m] = req.query.month.split('-').map(Number);
      const pad = n => String(n).padStart(2, '0');
      const start = `${y}-${pad(m)}-01`;
      const end   = `${y}-${pad(m)}-31`;
      filter.date = { $gte: start, $lte: end };
    }
    const schedules = await Schedule.find(filter).sort({ date: 1, createdAt: 1 });
    res.json(schedules);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/schedules', authMiddleware, async (req, res) => {
  try {
    const { date, truckId, driverName, routeId, routeName, notes } = req.body;
    if (!date || !truckId) return res.status(400).json({ error: 'date and truckId required' });
    const exists = await Schedule.findOne({ date, truckId });
    if (exists) return res.status(409).json({ error: 'Truck already scheduled for this date' });
    const schedule = await Schedule.create({ date, truckId, driverName, routeId, routeName, notes });
    // Notify the GarbageTruck app in real-time
    trackingRelay?.emit('schedule:changed', { truckId, date });
    res.status(201).json(schedule);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/schedules/:id', authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (schedule) trackingRelay?.emit('schedule:changed', { truckId: schedule.truckId, date: schedule.date });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Socket.io (Officials frontend clients) ─────────────────
io.on('connection', socket => {
  console.log(`[Officials WS] client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Officials WS] client disconnected: ${socket.id}`);
  });
});

// ── Relay: forward live truck positions from GarbageTruck backend ──
// Module-level so route/schedule handlers can push events back through it
let trackingRelay = null;

function connectTrackingRelay() {
  trackingRelay = connectTracking(TRACKING_URL, {
    transports: ['websocket', 'polling'],
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  trackingRelay.on('connect', () =>
    console.log(`🔗 Relay connected to tracking server (${TRACKING_URL})`)
  );
  trackingRelay.on('disconnect', reason =>
    console.log(`🔗 Relay disconnected: ${reason}`)
  );
  trackingRelay.on('connect_error', err =>
    console.log(`🔗 Relay connect error: ${err.message}`)
  );

  trackingRelay.on('truck:location:update', data => io.emit('truck:location:update', data));
  trackingRelay.on('truck:status', data => io.emit('truck:status', data));
  trackingRelay.on('report:new', data => io.emit('report:new', data));
  trackingRelay.on('report:updated', data => io.emit('report:updated', data));
}

connectTrackingRelay();

// ── Start ──────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`G-TRASH Officials server running on port ${PORT}`);
});
