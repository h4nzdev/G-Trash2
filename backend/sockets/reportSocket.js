module.exports = function registerReportSockets(io, socket) {
  // Join report-specific or barangay-specific rooms if needed
  socket.on("report:join", ({ reportId }) => {
    if (reportId) socket.join(`report:${reportId}`);
  });
};
