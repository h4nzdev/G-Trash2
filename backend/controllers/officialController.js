const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Official, SuperadminBootstrap } = require("../models");
const { JWT_SECRET } = require("../middleware/auth");

const SUPERADMIN_BOOTSTRAP_ID = "initial-superadmin";

const CHD_ALLOWED_PAGES = ["dashboard", "heatmap", "reports", "history"];
function getAllowedPages(role) {
  if (role === "chd") return CHD_ALLOWED_PAGES;
  return null; // official and superadmin have full access
}

// Officials Login
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const official = await Official.findOne({ email: email.toLowerCase() });
    if (!official || !(await bcrypt.compare(password, official.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      {
        id: official._id,
        name: official.name,
        email: official.email,
        barangay: official.barangay,
        role: official.role,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({
      token,
      official: {
        id: official._id,
        name: official.name,
        email: official.email,
        barangay: official.barangay,
        role: official.role,
        allowedPages: getAllowedPages(official.role),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.bootstrapSuperadmin = async (req, res, next) => {
  const configuredSecret = process.env.SUPERADMIN_BOOTSTRAP_SECRET;
  if (!configuredSecret) {
    return res.status(503).json({ error: "Superadmin bootstrap is disabled" });
  }

  const suppliedSecret = req.get("x-bootstrap-secret");
  if (
    typeof suppliedSecret !== "string" ||
    !crypto.timingSafeEqual(
      crypto.createHash("sha256").update(suppliedSecret).digest(),
      crypto.createHash("sha256").update(configuredSecret).digest()
    )
  ) {
    return res.status(401).json({ error: "Invalid bootstrap secret" });
  }

  const { name, email, password, barangay, role } = req.body;
  if (
    [name, email, password, barangay].some(
      (value) => typeof value !== "string" || !value.trim()
    )
  ) {
    return res
      .status(400)
      .json({ error: "name, email, password, and barangay are required" });
  }
  if (role !== "superadmin") {
    return res.status(400).json({ error: "role must be superadmin" });
  }

  try {
    if (await Official.exists({ role: "superadmin" })) {
      return res.status(409).json({ error: "A superadmin already exists" });
    }

    await SuperadminBootstrap.create({ _id: SUPERADMIN_BOOTSTRAP_ID });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Superadmin bootstrap has already been used" });
    }
    return next(err);
  }

  try {
    if (await Official.exists({ role: "superadmin" })) {
      await SuperadminBootstrap.deleteOne({ _id: SUPERADMIN_BOOTSTRAP_ID });
      return res.status(409).json({ error: "A superadmin already exists" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await Official.exists({ email: normalizedEmail })) {
      await SuperadminBootstrap.deleteOne({ _id: SUPERADMIN_BOOTSTRAP_ID });
      return res.status(409).json({ error: "Email already in use" });
    }

    const official = await Official.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      barangay: barangay.trim(),
      role: "superadmin",
      status: "active",
    });
    const out = official.toObject();
    delete out.passwordHash;
    return res.status(201).json(out);
  } catch (err) {
    try {
      await SuperadminBootstrap.deleteOne({ _id: SUPERADMIN_BOOTSTRAP_ID });
    } catch (cleanupError) {
      console.error("Failed to release the superadmin bootstrap claim:", cleanupError);
      return next(cleanupError);
    }
    return next(err);
  }
};

// Get current official
exports.getMe = async (req, res, next) => {
  try {
    res.json({
      official: {
        ...req.official,
        allowedPages: getAllowedPages(req.official?.role),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET: All officials (Superadmin only)
exports.getOfficials = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const officials = await Official.find({ role: "official" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(officials);
  } catch (err) {
    next(err);
  }
};

// Create a new official (superadmin only)
exports.createOfficial = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  const { name, email, password, barangay, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }
  try {
    const exists = await Official.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    const official = await Official.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      barangay: barangay || "All",
      role: ["official", "superadmin", "chd"].includes(role) ? role : "official",
      status: "active",
    });
    const out = official.toObject();
    delete out.passwordHash;
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
};

// Update official details
exports.updateOfficial = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const { name, barangay, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (barangay) update.barangay = barangay;
    if (password) {
      update.passwordHash = await bcrypt.hash(password, 10);
    }
    const official = await Official.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).select("-passwordHash");
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json(official);
  } catch (err) {
    next(err);
  }
};

// Update official role (superadmin only)
exports.updateRole = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  const { role } = req.body;
  if (!["official", "superadmin", "chd"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    const official = await Official.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: "-passwordHash" }
    );
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json(official);
  } catch (err) {
    next(err);
  }
};

// Update official status (active / revoked)
exports.updateStatus = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const { status } = req.body;
    if (!["active", "revoked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const official = await Official.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("-passwordHash");
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json(official);
  } catch (err) {
    next(err);
  }
};

// Delete official
exports.deleteOfficial = async (req, res, next) => {
  if (req.official?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  try {
    const official = await Official.findByIdAndDelete(req.params.id);
    if (!official) return res.status(404).json({ error: "Official not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Save official e-signature URL
exports.updateSignature = async (req, res, next) => {
  try {
    const { signatureUrl } = req.body;
    if (!signatureUrl) return res.status(400).json({ error: "signatureUrl required" });
    const official = await Official.findByIdAndUpdate(
      req.official?.id || req.params.id,
      { signatureUrl },
      { new: true, select: "-passwordHash" }
    );
    res.json({ signatureUrl: official?.signatureUrl });
  } catch (err) {
    next(err);
  }
};
