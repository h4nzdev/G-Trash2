require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { io: connectToTracking } = require('socket.io-client');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6000;

// URL of the GarbageTruck tracking server.
// For ngrok: set TRACKING_SERVER=https://<your-ngrok-id>.ngrok-free.app
const TRACKING_SERVER = process.env.TRACKING_SERVER || 'http://localhost:5000';

// ── Connect to tracking server as a relay client ──────────
const trackingSocket = connectToTracking(TRACKING_SERVER, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionDelay: 2000,
});

trackingSocket.on('connect', () => {
  console.log(`Relay connected to tracking server at ${TRACKING_SERVER}`);
});

trackingSocket.on('disconnect', () => {
  console.log('Relay disconnected from tracking server — retrying...');
});

// In-memory cache: truckId → latest location payload
const truckCache = new Map();

// Cache every update, then relay to all resident clients
trackingSocket.on('truck:location:update', (data) => {
  truckCache.set(data.truckId, data);
  io.emit('truck:location:update', data);
});

trackingSocket.on('truck:status', (data) => {
  io.emit('truck:status', data);
});

// ── REST ──────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', relay: trackingSocket.connected ? 'connected' : 'disconnected' }),
);

// ── Resident clients connect here ─────────────────────────
io.on('connection', (socket) => {
  console.log(`Resident connected: ${socket.id}`);

  // Immediately push all known truck positions so the map isn't empty on load
  truckCache.forEach((data) => {
    socket.emit('truck:location:update', data);
  });

  socket.on('disconnect', () => {
    console.log(`Resident disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Resident backend running on port ${PORT}`);
  console.log(`Relaying from tracking server: ${TRACKING_SERVER}`);
});
