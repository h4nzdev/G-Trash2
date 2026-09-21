const { ErrorLog } = require("../models");
const { getIO } = require("../config/socket");

async function logError(message, { severity = "error", source = "Server", stack = "" } = {}) {
  try {
    const doc = await ErrorLog.create({ message, severity, source, stack });
    const io = getIO();
    if (io) io.emit("system:error:new", doc);
    return doc;
  } catch (_) {}
}

module.exports = { logError };
