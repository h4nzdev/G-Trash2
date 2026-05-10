require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
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

const MONGO_URI  = process.env.MONGO_URI  || 'mongodb://localhost:27017/gtrash';
const PORT       = process.env.PORT       || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'gtrash-officials-secret-2025';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('OK: MongoDB connected ->', MONGO_URI))
  .catch(err => console.error('ERR: MongoDB error:', err.message));

// --- Schemas -------------------------------------------------

const truckSchema = new mongoose.Schema({
  truckId:   { type: String, required: true, unique: true },
  lat:       { type: Number, required: true },
  lng:       { type: Number, required: true },
  heading:   { type: Number, default: 0 },
  speed:     { type: Number, default: 0 },
  status:    { type: String, default: 'online' },
  updatedAt: { type: Date,   default: Date.now },
});
const Truck = mongoose.model('Truck', truckSchema);

const priorityMap = {
  'Hazardous Waste':   'Critical',
  'Illegal Dumping':   'High',
  'Overflowing Bin':   'High',
  'Uncollected Waste': 'Medium',
  'Other':             'Low',
};

const reportSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  category:    { type: String, required: true },
  description: { type: String, required: true },
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

const fleetSchema = new mongoose.Schema({
  truckId:    { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  route:      { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});
const Fleet = mongoose.model('Fleet', fleetSchema);

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

const scheduleSchema = new mongoose.Schema({
  date:       { type: String, required: true }, // YYYY-MM-DD
  truckId:    { type: String, required: true },
  driverName: { type: String, default: '' },
  routeId:    { type: String, default: '' },
  routeName:  { type: String, default: '' },
  startTime:  { type: String, default: '' },    // HH:MM for ordering
  notes:      { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

const collectionLogSchema = new mongoose.Schema({
  truckId:     { type: String, required: true },
  date:        { type: String, required: true }, // YYYY-MM-DD
  stopName:    { type: String, default: '' },
  stopAddress: { type: String, default: '' },
  wasteType:   { type: String, default: 'General' },
  weight:      { type: Number, default: 0 },
  bins:        { type: Number, default: 1 },
  routeId:     { type: String, default: '' },
  routeName:   { type: String, default: '' },
  completedAt: { type: Date,   default: Date.now },
});
const CollectionLog = mongoose.model('CollectionLog', collectionLogSchema);

const officialSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  barangay:     { type: String, required: true },
  role:         { type: String, enum: ['official', 'superadmin'], default: 'official' },
  createdAt:    { type: Date, default: Date.now },
});
const Official = mongoose.model('Official', officialSchema);

// --- Helpers -------------------------------------------------

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

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const BARANGAY_BOUNDARIES = {
  "Lahug": [
    [10.320, 123.880],
    [10.340, 123.880],
    [10.340, 123.900],
    [10.320, 123.900]
  ],
  "Apas": [
    [10.340, 123.900],
    [10.360, 123.900],
    [10.360, 123.920],
    [10.340, 123.920]
  ],
  "Guadalupe": [
    [10.310, 123.870],
    [10.330, 123.870],
    [10.330, 123.890],
    [10.310, 123.890]
  ]
};

function isInsidePolygon(point, polygon) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Auth Middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.official = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

// Optional Auth
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try { req.official = jwt.verify(header.slice(7), JWT_SECRET); }
    catch (_) { /* invalid */ }
  }
  next();
}

// Returns a barangay filter for superadmin/All (sees everything) vs scoped official
function barangayFilter(official, field = 'barangay') {
  if (!official) return {};
  if (official.barangay === 'All' || official.role === 'superadmin') return {};
  return { [field]: official.barangay };
}

// --- Health --------------------------------------------------
app.get('/ping', (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

app.get('/debug/counts', async (req, res) => {
  try {
    const [fleet, trucks, reports, routes, officials, schedules] = await Promise.all([
      Fleet.countDocuments(), Truck.countDocuments(), Report.countDocuments(),
      Route.countDocuments(), Official.countDocuments(), Schedule.countDocuments(),
    ]);
    res.json({ fleet, trucks, reports, routes, officials, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Officials auth ------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const official = await Official.findOne({ email: email.toLowerCase() });
    if (!official) return res.status(401).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, official.passwordHash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: official._id, name: official.name, email: official.email,
        barangay: official.barangay, role: official.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, official: { id: official._id, name: official.name,
      email: official.email, barangay: official.barangay, role: official.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ official: req.official });
});

app.post('/api/auth/seed', async (req, res) => {
  const officials = [
    { name: 'Super Admin',      email: 'admin@gtrash.com',    password: 'admin123',    barangay: 'All',       role: 'superadmin' },
    { name: 'Engr. Reyes',      email: 'lahug@gtrash.com',    password: 'lahug123',    barangay: 'Lahug',     role: 'official' },
    { name: 'Engr. Santos',     email: 'mabolo@gtrash.com',   password: 'mabolo123',   barangay: 'Mabolo',    role: 'official' },
    { name: 'Engr. Cruz',       email: 'itpark@gtrash.com',   password: 'itpark123',   barangay: 'IT Park',   role: 'official' },
    { name: 'Engr. Bautista',   email: 'talamban@gtrash.com', password: 'talamban123', barangay: 'Talamban',  role: 'official' },
    { name: 'Engr. Villanueva', email: 'mandaue@gtrash.com',  password: 'mandaue123',  barangay: 'Mandaue',   role: 'official' },
    { name: 'Engr. Dela Cruz',  email: 'banilad@gtrash.com',  password: 'banilad123',  barangay: 'Banilad',   role: 'official' },
  ];
  try {
    const results = [];
    for (const o of officials) {
      const exists = await Official.findOne({ email: o.email });
      if (!exists) {
        const passwordHash = await bcrypt.hash(o.password, 10);
        await Official.create({ name: o.name, email: o.email, passwordHash, barangay: o.barangay, role: o.role });
        results.push({ email: o.email, created: true });
      } else {
        results.push({ email: o.email, created: false, note: 'already exists' });
      }
    }
    res.json({ seeded: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard stats (Officials only) ------------------------
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

// --- Trucks --------------------------------------------------
// Public GET â€” used by Resident app and GarbageTruck app
app.get('/api/trucks', async (req, res) => {
  try {
    res.json(await Truck.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trucks/:truckId', async (req, res) => {
  try {
    const truck = await Truck.findOne({ truckId: req.params.truckId });
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Called by GarbageTruck app to push GPS position
app.post('/api/trucks/location', async (req, res) => {
  const { truckId, lat, lng, heading = 0, speed = 0 } = req.body;
  if (!truckId || lat == null || lng == null) {
    return res.status(400).json({ error: 'truckId, lat and lng are required' });
  }
  try {
    const truck = await Truck.findOneAndUpdate(
      { truckId },
      { lat, lng, heading, speed, status: 'online', updatedAt: new Date() },
      { upsert: true, new: true },
    );
    io.emit('truck:location:update', { truckId, lat, lng, heading, speed,
      timestamp: new Date().toISOString() });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Reports -------------------------------------------------
// POST is public (Resident app submits reports)
app.post('/api/reports', async (req, res) => {
  const { category, description, location, barangay, lat, lng, reportedBy } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: 'category and description are required' });
  }
  try {
    const title = `${category}${location ? ' at ' + location : barangay ? ' - ' + barangay : ''}`;
    const report = await Report.create({
      title, category, description,
      location: location || '', barangay: barangay || '',
      lat, lng,
      reportedBy: reportedBy || 'Resident',
      priority: priorityMap[category] || 'Medium',
    });
    io.emit('report:new', report);
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ all reports (Resident app); auth â†’ barangay-filtered (Officials dashboard)
app.get('/api/reports', optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Report.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH/DELETE require Officials auth
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

// --- Fleet ---------------------------------------------------
// GET: public â€” Fleet has no barangay field, trucks are shared across all barangays
app.get('/api/fleet', async (req, res) => {
  try {
    res.json(await Fleet.find({}).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fleet/:truckId', async (req, res) => {
  try {
    const entry = await Fleet.findOne({ truckId: req.params.truckId });
    if (!entry) return res.status(404).json({ error: 'Truck ID not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mutations require Officials auth
app.post('/api/fleet', authMiddleware, async (req, res) => {
  const { driverName, route } = req.body;
  if (!driverName) return res.status(400).json({ error: 'driverName is required' });
  try {
    const truckId = await generateUniqueTruckId();
    const entry = await Fleet.create({ truckId, driverName, route: route || '' });
    io.emit('fleet:new', entry);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/fleet/:truckId', authMiddleware, async (req, res) => {
  try {
    const entry = await Fleet.findOneAndUpdate(
      { truckId: req.params.truckId }, req.body, { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Truck ID not found' });
    io.emit('fleet:updated', entry);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver self-update â€” no Officials auth required; driver can only update their own name
app.patch('/api/fleet/:truckId/self', async (req, res) => {
  try {
    const { driverName } = req.body;
    if (!driverName?.trim()) return res.status(400).json({ error: 'driverName required' });
    const entry = await Fleet.findOneAndUpdate(
      { truckId: req.params.truckId },
      { driverName: driverName.trim() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Truck ID not found' });
    io.emit('fleet:updated', { truckId: entry.truckId, driverName: entry.driverName });
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

// --- Routes --------------------------------------------------
// Must be before /:id to avoid param shadowing â€” public for GarbageTruck app
app.get('/api/routes/truck/:truckId', async (req, res) => {
  try {
    const route = await Route.findOne({ truckId: req.params.truckId }).sort({ createdAt: -1 });
    if (!route) return res.status(404).json({ error: 'No route assigned to this truck' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get a single route by ID (used by GarbageTruck app when switching routes)
app.get('/api/routes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Backend] Fetching route: "${id}"`);
    
    if (!id || id === 'null' || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid route ID' });
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
      console.log(`[Backend] Last 10 routes in DB:`, allRoutes.map(r => `${r._id} (${r.name})`));
      return res.status(404).json({ error: 'Route not found' });
    }

    console.log(`[Backend] Route found: "${route.name}" with ${route.waypoints?.length} waypoints`);
    res.json(route);
  } catch (err) {
    console.error(`[Backend] Error fetching route:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ all routes; auth â†’ barangay-filtered
app.get('/api/routes', optionalAuth, async (req, res) => {
  try {
    const filter = barangayFilter(req.official);
    res.json(await Route.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mutations require Officials auth
app.post('/api/routes', authMiddleware, async (req, res) => {
  const { name, truckId, driverName, waypoints, routeCoords, totalStops } = req.body;
  if (!name || !waypoints || waypoints.length < 2) {
    return res.status(400).json({ error: 'name and at least 2 waypoints are required' });
  }
  try {
    const brgy = req.official.barangay;
    
    // Check Geo-Fencing if boundary is defined for this barangay
    if (BARANGAY_BOUNDARIES[brgy]) {
      const polygon = BARANGAY_BOUNDARIES[brgy];
      const illegalWaypoints = waypoints.filter(wp => !isInsidePolygon([wp.lat, wp.lng], polygon));
      
      if (illegalWaypoints.length > 0) {
        console.warn(`[Backend] Blocked cross-border route attempt by ${brgy} official.`);
        return res.status(403).json({ 
          error: 'Jurisdiction violation!', 
          message: `Some waypoints are outside ${brgy} boundaries. You cannot create routes in other barangays.` 
        });
      }
    }

    const route = await Route.create({
      name,
      truckId:     truckId || null,
      driverName:  driverName || '',
      barangay:    brgy === 'All' ? '' : brgy,
      waypoints,
      routeCoords: routeCoords || [],
      totalStops:  totalStops || waypoints.length,
    });
    io.emit('route:new', route);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/routes/:id', authMiddleware, async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    io.emit('route:updated', route);
    // Notify GarbageTruck app of route assignment â€” direct emit, no relay needed
    if (route.truckId) io.emit('route:assigned', { truckId: route.truckId });
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

// --- Superadmin Endpoints ------------------------------------

// GET city-wide stats for Superadmin Dashboard
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  if (req.official.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  try {
    const [trucks, reports, officials] = await Promise.all([
      Fleet.countDocuments(),
      Report.countDocuments(),
      Official.countDocuments({ role: 'official' })
    ]);

    // Leaderboard: Top 5 Barangays by resolved reports
    const leaderboard = await Report.aggregate([
      { $match: { status: 'resolved' } },
      { $group: { _id: '$barangay', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      summary: { trucks, reports, officials },
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new Official account
app.post('/api/admin/officials', authMiddleware, async (req, res) => {
  if (req.official.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  try {
    const { username, password, barangay, name } = req.body;
    if (!username || !password || !barangay) {
      return res.status(400).json({ error: 'Username, password and barangay are required' });
    }

    const existing = await Official.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newOfficial = await Official.create({
      username,
      password: hashedPassword,
      barangay,
      name: name || username,
      role: 'official'
    });

    const out = newOfficial.toObject();
    delete out.password;
    res.status(201).json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Barangay Boundaries
app.put('/api/admin/barangays/:name/boundary', authMiddleware, async (req, res) => {
  if (req.official.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  const { polygon } = req.body;
  if (!polygon || !Array.isArray(polygon)) {
    return res.status(400).json({ error: 'Invalid polygon data' });
  }
  
  // In a real app, you'd save this to a Barangay model.
  // For now, we update our in-memory/global BARANGAY_BOUNDARIES
  BARANGAY_BOUNDARIES[req.params.name] = polygon;
  console.log(`[Admin] Boundary updated for ${req.params.name}`);
  res.json({ ok: true, barangay: req.params.name, boundary: polygon });
});

// --- Schedules -----------------------------------------------
// Public: today's schedules for Resident HomeScreen
app.get('/api/schedules/today', async (req, res) => {
  try {
    const today = getTodayYMD();
    const schedules = await Schedule.find({ date: today }).sort({ createdAt: 1 });
    res.json({ today, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: all of today's scheduled routes for a specific truck (GarbageTruck app)
// Accepts ?date=YYYY-MM-DD from the client so the device's local date is used,
// avoiding server-timezone mismatches (server may run in UTC, device in UTC+8).
app.get('/api/schedules/truck/:truckId/today', async (req, res) => {
  try {
    const truckId = req.params.truckId.toUpperCase();
    const today = req.query.date || getTodayYMD();
    console.log(`[Backend] Fetching schedules for Truck: ${truckId}, Date: ${today}`);
    
    const schedules = await Schedule.find({ truckId, date: today })
      .sort({ startTime: 1, createdAt: 1 });
    
    console.log(`[Backend] Found ${schedules.length} schedules for ${truckId} on ${today}`);
    if (schedules.length > 0) {
      schedules.forEach((s, i) => {
        console.log(`  ${i+1}. ID: ${s._id}, Route: ${s.routeName}, RouteId: ${s.routeId}`);
      });
    }
    
    res.json({ schedules, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: no auth â†’ by ?month=YYYY-MM (Resident calendar); auth â†’ same + supports ?date=
app.get('/api/schedules', optionalAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) {
      filter.date = req.query.date;
    } else if (req.query.month) {
      const [y, m] = req.query.month.split('-');
      const pad = n => String(n).padStart(2, '0');
      filter.date = { $gte: `${y}-${pad(m)}-01`, $lte: `${y}-${pad(m)}-31` };
    }
    // Officials with barangay scope: filter by truckIds that belong to their barangay
    // (schedules don't have a barangay field, so we scope by routeName prefix if needed)
    // For simplicity, all authenticated officials see all schedules â€” superadmin filter applies
    const schedules = await Schedule.find(filter).sort({ date: 1, createdAt: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST/DELETE require Officials auth
app.post('/api/schedules', authMiddleware, async (req, res) => {
  try {
    const { date, truckId, driverName, routeId, routeName, startTime, notes } = req.body;
    if (!date || !truckId) return res.status(400).json({ error: 'date and truckId required' });
    // Prevent exact duplicate (same truck + same route on the same day); allow different routes
    if (routeId) {
      const dup = await Schedule.findOne({ date, truckId, routeId });
      if (dup) return res.status(409).json({ error: 'This route is already scheduled for that truck on this date' });
    }
    const schedule = await Schedule.create({ date, truckId, driverName, routeId, routeName, startTime: startTime || '', notes });
    io.emit('schedule:changed', { truckId, date });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', authMiddleware, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (schedule) io.emit('schedule:changed', { truckId: schedule.truckId, date: schedule.date });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Collection logs -----------------------------------------
app.get('/api/collections/truck/:truckId', async (req, res) => {
  const { truckId } = req.params;
  const { period = 'today' } = req.query;
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const filter = { truckId };
    if (period === 'today') {
      filter.date = today;
    } else if (period === 'week') {
      const now = new Date();
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = d => d.toLocaleDateString('en-CA');
      filter.date = { $gte: fmt(mon), $lte: fmt(sun) };
    } else if (period === 'month') {
      const [y, m] = today.split('-');
      filter.date = { $gte: `${y}-${m}-01`, $lte: `${y}-${m}-31` };
    }
    const logs = await CollectionLog.find(filter).sort({ completedAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', async (req, res) => {
  const { truckId, date, stopName, stopAddress, wasteType, weight, bins, routeId, routeName } = req.body;
  if (!truckId || !date) {
    return res.status(400).json({ error: 'truckId and date are required' });
  }
  try {
    const log = await CollectionLog.create({
      truckId, date,
      stopName:    stopName    || '',
      stopAddress: stopAddress || '',
      wasteType:   wasteType   || 'General',
      weight:      weight  != null ? weight  : 0,
      bins:        bins    != null ? bins    : 1,
      routeId:     routeId  || '',
      routeName:   routeName || '',
    });
    io.emit('collection:new', log);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.io -----------------------------------------------
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // GarbageTruck app sends live GPS position
  socket.on('truck:location', async (data, ack) => {
    const { truckId, lat, lng, heading = 0, speed = 0 } = data;
    if (!truckId || lat == null || lng == null) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Missing fields' });
      return;
    }
    try {
      const truck = await Truck.findOneAndUpdate(
        { truckId },
        { lat, lng, heading, speed, status: 'online', updatedAt: new Date() },
        { upsert: true, new: true },
      );
      if (typeof ack === 'function') ack({ ok: true, truckId, lat, lng });
      // Broadcast to Resident app + Officials dashboard â€” same io instance, no relay
      socket.broadcast.emit('truck:location:update', {
        truckId, lat, lng, heading, speed,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // Truck marks itself offline
  socket.on('truck:offline', async ({ truckId }) => {
    if (!truckId) return;
    try {
      await Truck.findOneAndUpdate({ truckId }, { status: 'offline' });
    } catch (err) {
      console.error('DB write error:', err.message);
    }
    socket.broadcast.emit('truck:status', { truckId, status: 'offline' });
  });

  // Truck reports it is off its assigned route â€” relay to Officials dashboard
  socket.on('truck:off-route', (data) => {
    socket.broadcast.emit('truck:off-route', data);
  });

  // Driver requests help from dispatch â€” relay to Officials dashboard
  socket.on('truck:contact-dispatch', (data) => {
    socket.broadcast.emit('truck:contact-dispatch', data);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// --- Start ---------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`OK: G-TRASH unified server running on port ${PORT}`);
});
