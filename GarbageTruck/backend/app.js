require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gtrash';
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected →', MONGO_URI);
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err.message));

// ── Truck location schema ──────────────────────────────────
const truckSchema = new mongoose.Schema({
  truckId:   { type: String, required: true, unique: true },
  lat:       { type: Number, required: true },
  lng:       { type: Number, required: true },
  heading:   { type: Number, default: 0 },
  speed:     { type: Number, default: 0 },
  status:    { type: String, default: 'online' }, // 'online' | 'offline'
  updatedAt: { type: Date,   default: Date.now },
});

const Truck = mongoose.model('Truck', truckSchema);

// ── Report schema ──────────────────────────────────────────
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
  lat:         { type: Number },
  lng:         { type: Number },
  reportedBy:  { type: String, default: 'Resident' },
  priority:    { type: String, default: 'Medium' },
  status:      { type: String, default: 'pending' }, // pending | in-progress | resolved
  createdAt:   { type: Date, default: Date.now },
});

const Report = mongoose.model('Report', reportSchema);

// ── Fleet registry schema ──────────────────────────────────
const fleetSchema = new mongoose.Schema({
  truckId:    { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  route:      { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});
const Fleet = mongoose.model('Fleet', fleetSchema);

async function generateUniqueTruckId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id, exists;
  do {
    const suffix = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    id = `GT-${suffix}`;
    exists = await Fleet.findOne({ truckId: id });
  } while (exists);
  return id;
}

// ── Collection log schema ──────────────────────────────────
const collectionLogSchema = new mongoose.Schema({
  truckId:    { type: String, required: true },
  date:       { type: String, required: true }, // YYYY-MM-DD
  stopName:   { type: String, default: '' },
  stopAddress:{ type: String, default: '' },
  wasteType:  { type: String, default: 'General' }, // General | Recyclables | Mixed
  weight:     { type: Number, default: 0 },   // kg
  bins:       { type: Number, default: 1 },
  routeId:    { type: String, default: '' },
  routeName:  { type: String, default: '' },
  completedAt:{ type: Date,   default: Date.now },
});
const CollectionLog = mongoose.model('CollectionLog', collectionLogSchema);

// ── Health / connectivity check ───────────────────────────
app.get('/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── REST: last known positions ─────────────────────────────
app.get('/api/trucks', async (req, res) => {
  try {
    const trucks = await Truck.find();
    res.json(trucks);
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

// ── REST: save location + broadcast to residents ───────────
// Called by the GarbageTruck app via fetch (more reliable than socket on startup)
app.post('/api/trucks/location', async (req, res) => {
  const { truckId, lat, lng, heading = 0, speed = 0 } = req.body;
  if (!truckId || lat == null || lng == null) {
    return res.status(400).json({ error: 'truckId, lat and lng are required' });
  }
  try {
    console.log(`[POST /api/trucks/location] truckId=${truckId} lat=${lat} lng=${lng}`);
    const truck = await Truck.findOneAndUpdate(
      { truckId },
      { lat, lng, heading, speed, status: 'online', updatedAt: new Date() },
      { upsert: true, new: true },
    );
    console.log(`✅ Saved to DB → _id:${truck._id} truckId:${truck.truckId}`);
    io.emit('truck:location:update', {
      truckId, lat, lng, heading, speed,
      timestamp: new Date().toISOString(),
    });
    console.log(`📡 Broadcast truck:location:update to ${io.engine.clientsCount} client(s)`);
    res.json(truck);
  } catch (err) {
    console.error('❌ DB write error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Reports ───────────────────────────────────────────────
app.post('/api/reports', async (req, res) => {
  const { category, description, location, barangay, lat, lng, reportedBy } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: 'category and description are required' });
  }
  try {
    const title = `${category}${location ? ' at ' + location : barangay ? ' - ' + barangay : ''}`;
    const report = await Report.create({
      title,
      category,
      description,
      location: location || '',
      barangay: barangay || '',
      lat,
      lng,
      reportedBy: reportedBy || 'Resident',
      priority: priorityMap[category] || 'Medium',
    });
    console.log(`📋 New report: ${report.title}`);
    io.emit('report:new', report);
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    io.emit('report:updated', report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route schema ──────────────────────────────────────────
const routeSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  truckId:    { type: String, default: null },
  driverName: { type: String, default: '' },
  waypoints:  [{ lat: Number, lng: Number, name: String }],
  routeCoords: { type: [[Number]], default: [] }, // [lat, lng] pairs for polyline
  totalStops: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
});
const Route = mongoose.model('Route', routeSchema);

// ── Fleet management ──────────────────────────────────────
app.post('/api/fleet', async (req, res) => {
  const { driverName, route } = req.body;
  if (!driverName) return res.status(400).json({ error: 'driverName is required' });
  try {
    const truckId = await generateUniqueTruckId();
    const entry = await Fleet.create({ truckId, driverName, route: route || '' });
    console.log(`🚛 Fleet registered: ${truckId} → ${driverName}`);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fleet', async (req, res) => {
  try {
    const fleet = await Fleet.find().sort({ createdAt: -1 });
    res.json(fleet);
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

app.delete('/api/fleet/:truckId', async (req, res) => {
  try {
    await Fleet.findOneAndDelete({ truckId: req.params.truckId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────
app.post('/api/routes', async (req, res) => {
  const { name, truckId, driverName, waypoints, routeCoords, totalStops } = req.body;
  if (!name || !waypoints || waypoints.length < 2) {
    return res.status(400).json({ error: 'name and at least 2 waypoints are required' });
  }
  try {
    const route = await Route.create({
      name,
      truckId: truckId || null,
      driverName: driverName || '',
      waypoints,
      routeCoords: routeCoords || [],
      totalStops: totalStops || waypoints.length,
    });
    console.log(`🗺️  Route created: "${route.name}" → truck:${route.truckId}`);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Must be before /:id to avoid shadowing
app.get('/api/routes/truck/:truckId', async (req, res) => {
  try {
    const route = await Route.findOne({ truckId: req.params.truckId }).sort({ createdAt: -1 });
    if (!route) return res.status(404).json({ error: 'No route assigned to this truck' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/routes/:id', async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedule schema (shared collection with Officials backend) ──
const scheduleSchema = new mongoose.Schema({
  date:       String,   // YYYY-MM-DD
  truckId:    String,
  driverName: String,
  routeId:    String,
  routeName:  String,
  notes:      String,
  createdAt:  { type: Date, default: Date.now },
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

// Public endpoint — GarbageTruck app checks if it's scheduled today
app.get('/api/schedules/truck/:truckId/today', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const schedule = await Schedule.findOne({ truckId: req.params.truckId, date: today });
    res.json({ scheduled: !!schedule, schedule: schedule || null, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: all schedules for today (residents check when trucks are coming)
app.get('/api/schedules/today', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const schedules = await Schedule.find({ date: today }).sort({ createdAt: 1 });
    res.json({ today, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: all schedules for a given month (?month=YYYY-MM) — residents check upcoming pickups
app.get('/api/schedules', async (req, res) => {
  try {
    const { month } = req.query;
    let filter = {};
    if (month) {
      const [y, m] = month.split('-');
      const pad = n => String(n).padStart(2, '0');
      filter.date = { $gte: `${y}-${pad(m)}-01`, $lte: `${y}-${pad(m)}-31` };
    }
    const schedules = await Schedule.find(filter).sort({ date: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Collection history ─────────────────────────────────────
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
      truckId,
      date,
      stopName:    stopName    || '',
      stopAddress: stopAddress || '',
      wasteType:   wasteType   || 'General',
      weight:      weight  != null ? weight  : 0,
      bins:        bins    != null ? bins    : 1,
      routeId:     routeId  || '',
      routeName:   routeName || '',
    });
    io.emit('collection:new', log);
    console.log(`📦 Collection logged: ${truckId} → ${stopName || 'unknown stop'} (${log.weight}kg)`);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Socket.io ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Truck driver emits its live GPS position
  // Third arg is an optional ack callback so the app can confirm the DB save
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
      console.log(`✅ [socket] Saved ${truckId} → lat=${lat} lng=${lng}`);

      // Confirm save back to the truck app
      if (typeof ack === 'function') ack({ ok: true, truckId, lat, lng });

      // Broadcast to all other clients (Resident backend relay)
      socket.broadcast.emit('truck:location:update', {
        truckId, lat, lng, heading, speed,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('❌ DB write error:', err.message);
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // Officials backend pushes schedule/route changes through the relay
  socket.on('schedule:changed', (data) => {
    io.emit('schedule:changed', data);
  });
  socket.on('route:assigned', (data) => {
    io.emit('route:assigned', data);
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`G-TRASH tracking server running on port ${PORT}`);
});
