const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resident, Official } = require("../models");
const { JWT_SECRET } = require("../middleware/auth");
const { generateHouseholdId } = require("../utils/addressUtils");

const CHD_ALLOWED_PAGES = ["dashboard", "heatmap", "reports", "history"];
function getAllowedPages(role) {
  if (role === "chd") return CHD_ALLOWED_PAGES;
  return null;
}

// Register a new resident
exports.registerResident = async (req, res, next) => {
  const { firstName, lastName, email, password, phone, barangay, street, houseNo } = req.body;

  if (!firstName || !lastName || !email || !password || !barangay) {
    return res.status(400).json({
      error: "firstName, lastName, email, password, and barangay are required",
    });
  }
  if (!street || !street.trim()) {
    return res.status(400).json({ error: "Street address is required" });
  }
  if (!houseNo || !houseNo.trim()) {
    return res.status(400).json({ error: "House/unit number is required" });
  }

  try {
    const existingEmail = await Resident.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const householdId = generateHouseholdId(barangay, street, houseNo);
    const existingHousehold = await Resident.findOne({ householdId });
    if (existingHousehold) {
      return res.status(409).json({
        error: "HOUSEHOLD_EXISTS",
        message:
          "This household already has a registered account. Only one account is allowed per household to maintain data integrity.",
        messageCebuano:
          "Kini nga panimalay aduna nay rehistradong account. Usa ra ka account ang gitugot kada panimalay.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resident = await Resident.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      phone: phone || "",
      barangay,
      street: street.trim(),
      houseNo: houseNo.trim(),
      householdId,
    });

    const token = jwt.sign(
      {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        role: "resident",
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: {
        id: resident._id,
        name: `${resident.firstName} ${resident.lastName}`,
        email: resident.email,
        barangay: resident.barangay,
        street: resident.street,
        houseNo: resident.houseNo,
        address: `${resident.houseNo}, ${resident.street}, ${resident.barangay}, Cebu City`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Login user (Official / Superadmin / CHD or Resident)
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check Official / Superadmin / CHD
    const official = await Official.findOne({ email: cleanEmail });
    if (official && (await bcrypt.compare(password, official.passwordHash))) {
      const token = jwt.sign(
        {
          id: official._id,
          name: official.name,
          email: official.email,
          barangay: official.barangay,
          role: official.role,
        },
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      return res.json({
        token,
        official: {
          id: official._id,
          name: official.name,
          email: official.email,
          barangay: official.barangay,
          role: official.role,
          allowedPages: getAllowedPages(official.role),
        },
        user: {
          id: official._id,
          name: official.name,
          email: official.email,
          barangay: official.barangay,
          role: official.role,
        },
      });
    }

    // 2. Check Resident
    const resident = await Resident.findOne({ email: cleanEmail });
    if (resident && (await bcrypt.compare(password, resident.passwordHash))) {
      const token = jwt.sign(
        {
          id: resident._id,
          name: `${resident.firstName} ${resident.lastName}`,
          email: resident.email,
          barangay: resident.barangay,
          role: "resident",
        },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      return res.json({
        token,
        user: {
          id: resident._id,
          name: `${resident.firstName} ${resident.lastName}`,
          email: resident.email,
          barangay: resident.barangay,
          address: `${resident.houseNo ? resident.houseNo + ", " : ""}${resident.street ? resident.street + ", " : ""}${resident.barangay}, Cebu City`,
          notificationsClearedAt: resident.notificationsClearedAt || null,
        },
      });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
};
exports.loginResident = exports.login;

// Get current authenticated user / official session
exports.getMe = async (req, res, next) => {
  try {
    const authData = req.official || req.user;
    if (!authData) return res.status(401).json({ error: "Unauthorized" });

    if (authData.role === "resident") {
      const resident = await Resident.findById(authData.id);
      if (!resident) return res.status(404).json({ error: "Resident not found" });
      return res.json({
        user: {
          id: resident._id,
          name: `${resident.firstName} ${resident.lastName}`,
          email: resident.email,
          barangay: resident.barangay,
          address: `${resident.houseNo ? resident.houseNo + ", " : ""}${resident.street ? resident.street + ", " : ""}${resident.barangay}, Cebu City`,
          notificationsClearedAt: resident.notificationsClearedAt || null,
        },
      });
    } else {
      const official = await Official.findById(authData.id);
      const officialObj = official
        ? {
            id: official._id,
            name: official.name,
            email: official.email,
            barangay: official.barangay,
            role: official.role,
            allowedPages: getAllowedPages(official.role),
          }
        : {
            ...authData,
            allowedPages: getAllowedPages(authData.role),
          };
      return res.json({
        official: officialObj,
        user: officialObj,
      });
    }
  } catch (err) {
    next(err);
  }
};

// Get resident by ID
exports.getResidentById = async (req, res, next) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: "Resident not found" });
    res.json({
      id: resident._id,
      name: `${resident.firstName} ${resident.lastName}`,
      email: resident.email,
      barangay: resident.barangay,
      address: `${resident.houseNo ? resident.houseNo + ", " : ""}${resident.street ? resident.street + ", " : ""}${resident.barangay}, Cebu City`,
      notificationsClearedAt: resident.notificationsClearedAt || null,
    });
  } catch (err) {
    next(err);
  }
};

// Update resident profile
exports.updateResident = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, barangay, street, houseNo, profilePicture } = req.body;
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: "Resident not found" });

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (barangay) updateData.barangay = barangay;
    if (street !== undefined) updateData.street = street;
    if (houseNo !== undefined) updateData.houseNo = houseNo;

    // Profile picture cooldown (10 days)
    if (profilePicture !== undefined && profilePicture !== resident.profilePicture) {
      const now = new Date();
      if (resident.lastProfilePictureUpdate) {
        const diffTime = Math.abs(now - resident.lastProfilePictureUpdate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 10) {
          return res.status(403).json({
            error: `You can only change your profile picture once every 10 days. ${10 - diffDays} days remaining.`,
          });
        }
      }
      updateData.profilePicture = profilePicture;
      updateData.lastProfilePictureUpdate = now;
    }

    const updated = await Resident.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({
      user: {
        id: updated._id,
        name: `${updated.firstName} ${updated.lastName}`,
        email: updated.email,
        barangay: updated.barangay,
        profilePicture: updated.profilePicture,
        lastProfilePictureUpdate: updated.lastProfilePictureUpdate,
        address: `${updated.houseNo ? updated.houseNo + ", " : ""}${updated.street ? updated.street + ", " : ""}${updated.barangay}, Cebu City`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Clear resident notifications
exports.clearNotifications = async (req, res, next) => {
  try {
    const clearedAt = new Date();
    await Resident.findByIdAndUpdate(req.params.id, { notificationsClearedAt: clearedAt });
    res.json({ clearedAt });
  } catch (err) {
    next(err);
  }
};

// Search residents by name
exports.searchResidents = async (req, res, next) => {
  try {
    const { barangay, q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const words = q.trim().split(/\s+/).filter((w) => w.length > 1);
    const wordRegexes = words.map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const filter = {};
    if (barangay && barangay !== "All") {
      filter.barangay = { $regex: new RegExp(`^${barangay.trim()}$`, "i") };
    }
    filter.$or = wordRegexes.flatMap((r) => [{ firstName: r }, { lastName: r }]);

    const residents = await Resident.find(filter, "firstName lastName barangay street houseNo").limit(20);
    res.json(
      residents.map((r) => ({
        _id: r._id,
        name: `${r.firstName} ${r.lastName}`,
        barangay: r.barangay,
        address: [r.houseNo, r.street].filter(Boolean).join(" ") || "—",
      }))
    );
  } catch (err) {
    next(err);
  }
};
