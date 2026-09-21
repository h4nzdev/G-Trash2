const { logError } = require("../utils/logger");

module.exports = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message);
  logError(err.message, { severity: "error", source: req.url, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
};
