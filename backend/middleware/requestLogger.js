const { recordApiMetric } = require("../services/systemMonitor");

module.exports = (req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  res.on("finish", () => {
    const responseTime = Date.now() - start;
    const normPath = req.path.replace(/\/[a-f0-9]{24}/gi, "/:id").replace(/\/\d+/g, "/:id");
    recordApiMetric({
      path: normPath,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: Date.now(),
    });
  });
  next();
};
