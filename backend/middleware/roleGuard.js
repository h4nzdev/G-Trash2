exports.requireOfficial = (req, res, next) => {
  const role = req.official?.role || req.user?.role;
  if (!role) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (role !== "official" && role !== "superadmin" && role !== "admin") {
    return res.status(403).json({ error: "Official access required" });
  }
  next();
};

exports.requireSuperAdmin = (req, res, next) => {
  const role = req.official?.role || req.user?.role;
  if (!role) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  next();
};
