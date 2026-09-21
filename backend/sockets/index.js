const { Server } = require("socket.io");
const { initIO } = require("../config/socket");
const registerTruckSockets = require("./truckSocket");
const registerIoTSockets = require("./iotSocket");
const registerReportSockets = require("./reportSocket");
const registerScheduleSockets = require("./scheduleSocket");

function initializeSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    },
    transports: ["websocket", "polling"],
  });

  initIO(io);

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    registerTruckSockets(io, socket);
    registerIoTSockets(io, socket);
    registerReportSockets(io, socket);
    registerScheduleSockets(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

module.exports = initializeSockets;
