const { Announcement } = require("../models");
const { getIO } = require("../config/socket");

// GET /api/announcements
exports.getAnnouncements = async (req, res, next) => {
  try {
    const docs = await Announcement.find().sort({ createdAt: -1 }).limit(50);
    res.json(docs);
  } catch (err) {
    next(err);
  }
};

// POST /api/announcements
exports.createAnnouncement = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    const doc = await Announcement.create({
      ...req.body,
      createdBy: req.official.name || "Admin",
    });
    const io = getIO();
    if (io) io.emit("announcement:new", doc);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
