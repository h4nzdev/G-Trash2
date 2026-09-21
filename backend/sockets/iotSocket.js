const { socketRoleMap } = require("../services/systemMonitor");

module.exports = function registerIoTSockets(io, socket) {
  // Clients announce their role so we can track active sessions
  socket.on("session:register", ({ role }) => {
    if (role) socketRoleMap.set(socket.id, role);
  });

  // Resident app joins its own room to receive targeted reward notifications
  socket.on("resident:join", ({ residentId }) => {
    if (residentId) socket.join(`resident:${residentId}`);
  });

  socket.on("disconnect", () => {
    socketRoleMap.delete(socket.id);
  });
};
