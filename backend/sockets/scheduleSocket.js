module.exports = function registerScheduleSockets(io, socket) {
  // Join schedule/truck specific rooms
  socket.on("schedule:join", ({ scheduleId }) => {
    if (scheduleId) socket.join(`schedule:${scheduleId}`);
  });
};
