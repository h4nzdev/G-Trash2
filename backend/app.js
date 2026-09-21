const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(requestLogger);

// Health / root endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok", name: "G-TRASH Unified Backend", version: "2.0.0" });
});

// Mount all API routes
app.use("/api", routes);

// Central Error Handler
app.use(errorHandler);

module.exports = app;
