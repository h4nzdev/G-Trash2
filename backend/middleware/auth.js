const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "gtrash-officials-secret-2025";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.official = decoded;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token invalid or expired" });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      req.official = decoded;
      req.user = decoded;
    } catch (_) {
      /* invalid token */
    }
  }
  next();
}

module.exports = {
  authMiddleware,
  authenticate: authMiddleware,
  optionalAuth,
  JWT_SECRET,
};
