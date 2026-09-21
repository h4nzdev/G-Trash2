const { GarbageArea, SensorReading, Sitio, BarangayBoundary } = require("../models");
const { getIO } = require("../config/socket");
const { barangayFilter } = require("../middleware/barangayScope");
const https = require("https");

// Determine zone color from current area data
function calculateZoneColor(area) {
  const rawVal = Number(area.rawValue) || 0;
  const reportCount = area.reportCount || 0;
  const daysSince = area.lastCollectionAt
    ? (Date.now() - new Date(area.lastCollectionAt).getTime()) / 86400000
    : Infinity;

  if (reportCount >= 3 || rawVal >= 400 || area.status === "critical" || area.airQuality === "CRITICAL" || daysSince > 5) {
    return { status: "critical", colorCode: "red", intensity: 0.8 };
  }
  if (reportCount >= 1 || rawVal >= 200 || area.status === "moderate" || area.airQuality === "MODERATE" || daysSince > 3) {
    return { status: "moderate", colorCode: "yellow", intensity: 0.5 };
  }
  return { status: "clean", colorCode: "green", intensity: 0.2 };
}

// Recalculate a zone's status, save it, and emit zone:status:update
async function recalculateAndEmitZone(areaId, reason = "recalculated", changedBy = "System", weight = null, collectionId = null) {
  const area = await GarbageArea.findById(areaId);
  if (!area) return null;
  const previousStatus = area.status;
  const { status, colorCode, intensity } = calculateZoneColor(area);
  area.status = status;
  area.intensity = intensity;
  await area.save();

  const previousColor = previousStatus === "critical" ? "red" : previousStatus === "moderate" ? "yellow" : "green";
  const io = getIO();
  if (io) {
    io.emit("zone:status:update", {
      zoneId: area._id,
      areaId: area._id,
      name: area.name,
      barangay: area.barangay,
      previousStatus,
      newStatus: status,
      previousColor,
      newColor: colorCode,
      reason,
      changedBy,
      weight: weight ? `${weight} kg` : null,
      collectionId,
      timestamp: new Date().toISOString(),
    });
    io.emit("garbage-area:updated", area);
  }
  return area;
}

// GET /api/garbage-areas
exports.getGarbageAreas = async (req, res, next) => {
  try {
    const filter = barangayFilter(req.official || req);
    if (!req.official && req.query.barangay) {
      filter.barangay = req.query.barangay;
    }
    const areas = await GarbageArea.find(filter).sort({ createdAt: -1 }).lean();

    const sensorAreas = areas.filter((a) => a.sensorId);
    if (sensorAreas.length > 0) {
      const sensorIds = sensorAreas.map((a) => a.sensorId);
      const latestReadings = await SensorReading.aggregate([
        { $match: { sensorId: { $in: sensorIds } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$sensorId", doc: { $first: "$$ROOT" } } },
      ]);
      const readingMap = new Map(latestReadings.map((r) => [r._id, r.doc]));

      for (const area of areas) {
        if (area.sensorId && readingMap.has(area.sensorId)) {
          const lr = readingMap.get(area.sensorId);
          area.rawValue = lr.rawValue || 0;
          area.airQuality = lr.airQuality || "CLEAN";
          if (area.isActive !== false) {
            const isCrit =
              lr.airQuality === "CRITICAL" ||
              lr.airQuality === "Critical" ||
              (lr.rawValue || 0) >= (lr.criticalThreshold || 400);
            const isMod =
              lr.airQuality === "MODERATE" ||
              lr.airQuality === "Moderate" ||
              ((lr.rawValue || 0) >= (lr.cleanThreshold || 200) && (lr.rawValue || 0) < (lr.criticalThreshold || 400));

            area.status = isCrit ? "critical" : isMod ? "moderate" : "clean";
            area.intensity = isCrit ? 0.9 : isMod ? 0.5 : 0.2;
          }
        }
      }
    }

    res.json(areas);
  } catch (err) {
    next(err);
  }
};

// POST /api/garbage-areas
exports.createGarbageArea = async (req, res, next) => {
  try {
    const area = new GarbageArea(req.body);
    await area.save();
    console.log(`[Heatmap] New area added: ${area.name}`);
    res.json(area);
  } catch (err) {
    next(err);
  }
};

// PUT /api/garbage-areas/:id/toggle-active
exports.toggleGarbageAreaActive = async (req, res, next) => {
  try {
    const zone = await GarbageArea.findById(req.params.id);
    if (!zone) return res.status(404).json({ error: "Not found" });

    zone.isActive = req.body.isActive !== false;

    if (zone.isActive) {
      if (zone.sensorId) {
        const latestReading = await SensorReading.findOne({ sensorId: zone.sensorId }).sort({ timestamp: -1 });
        if (latestReading) {
          zone.rawValue = latestReading.rawValue || 0;
          zone.airQuality = latestReading.airQuality || "Clean";
          zone.ammonia = `${latestReading.ammonia || 0} ppm`;
          zone.methane = `${latestReading.methane || 0}%`;

          const isCrit =
            zone.airQuality === "Critical" ||
            zone.airQuality === "Hazardous" ||
            zone.airQuality === "Unhealthy" ||
            (zone.rawValue || 0) >= 500;
          const isMod =
            zone.airQuality === "Moderate" ||
            ((zone.rawValue || 0) >= 150 && (zone.rawValue || 0) < 500);

          zone.status = isCrit ? "critical" : isMod ? "moderate" : "clean";
          zone.intensity = isCrit ? 0.9 : isMod ? 0.5 : 0.2;
        } else {
          zone.status = "clean";
          zone.intensity = 0.2;
        }
      } else {
        if (zone.status === "inactive") zone.status = "clean";
        if (zone.intensity === 0.1) zone.intensity = 0.5;
      }
    } else {
      zone.status = "inactive";
      zone.intensity = 0.1;
      zone.ammonia = "0 ppm";
      zone.methane = "0 ppm";
    }

    await zone.save();

    const io = getIO();
    if (io) {
      io.emit("garbage-area:updated", zone);
      io.emit("zone:status:update", {
        zoneId: zone._id,
        areaId: zone._id,
        name: zone.name,
        barangay: zone.barangay,
        previousStatus: null,
        newStatus: zone.status,
        rawValue: zone.rawValue,
        airQuality: zone.airQuality,
        isActive: zone.isActive,
        changedBy: "Official Toggle",
        timestamp: new Date().toISOString(),
      });
    }

    res.json(zone);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/garbage-areas/:id
exports.deleteGarbageArea = async (req, res, next) => {
  try {
    await GarbageArea.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/sitios
exports.getSitios = async (req, res, next) => {
  try {
    const { barangay } = req.query;
    const filter = {};
    if (barangay) filter.barangay = barangay;
    const sitios = await Sitio.find(filter).sort({ name: 1 });
    res.json(sitios);
  } catch (err) {
    next(err);
  }
};

// POST /api/sitios
exports.createSitio = async (req, res, next) => {
  try {
    const { name, barangay, lat, lng } = req.body;
    if (!name || !barangay || lat == null || lng == null) {
      return res.status(400).json({ error: "name, barangay, lat and lng are required" });
    }
    const exists = await Sitio.findOne({ name, barangay });
    if (exists) {
      return res.status(400).json({ error: "This sitio is already registered under this barangay" });
    }
    const newSitio = await Sitio.create({ name, barangay, lat: Number(lat), lng: Number(lng), verified: true });
    res.status(201).json(newSitio);
  } catch (err) {
    next(err);
  }
};

// GET /api/zones
exports.getZones = async (req, res, next) => {
  try {
    const areas = await GarbageArea.find().sort({ createdAt: -1 });
    res.json(areas);
  } catch (err) {
    next(err);
  }
};

// GET /api/zones/:zoneId
exports.getZoneById = async (req, res, next) => {
  try {
    const area = await GarbageArea.findById(req.params.zoneId);
    if (!area) return res.status(404).json({ error: "Zone not found" });
    res.json(area);
  } catch (err) {
    next(err);
  }
};

// POST /api/zones/:zoneId/recalculate
exports.recalculateZone = async (req, res, next) => {
  try {
    const area = await recalculateAndEmitZone(req.params.zoneId, "manual_recalculate", req.body.triggeredBy || "Admin");
    if (!area) return res.status(404).json({ error: "Zone not found" });
    res.json({ ok: true, zone: area });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/zones/:zoneId/status
exports.updateZoneStatus = async (req, res, next) => {
  try {
    const { status, changedBy } = req.body;
    if (!["critical", "moderate", "clean"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use: critical, moderate, clean" });
    }
    const intensityMap = { critical: 0.8, moderate: 0.5, clean: 0.2 };
    const area = await GarbageArea.findByIdAndUpdate(
      req.params.zoneId,
      { status, intensity: intensityMap[status] },
      { new: true }
    );
    if (!area) return res.status(404).json({ error: "Zone not found" });

    const colorMap = { critical: "red", moderate: "yellow", clean: "green" };
    const io = getIO();
    if (io) {
      io.emit("zone:status:update", {
        zoneId: area._id,
        areaId: area._id,
        name: area.name,
        barangay: area.barangay,
        previousStatus: null,
        newStatus: status,
        newColor: colorMap[status],
        reason: "admin_override",
        changedBy: changedBy || "Admin",
        timestamp: new Date().toISOString(),
      });
      io.emit("garbage-area:updated", area);
    }
    res.json({ ok: true, zone: area });
  } catch (err) {
    next(err);
  }
};

// GET /api/sensor-zones
exports.getSensorZones = async (req, res, next) => {
  try {
    const zones = await GarbageArea.find({ sensorId: { $ne: null } }).sort({ createdAt: -1 }).lean();
    if (zones.length > 0) {
      const sensorIds = zones.map((z) => z.sensorId);
      const latestReadings = await SensorReading.aggregate([
        { $match: { sensorId: { $in: sensorIds } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$sensorId", doc: { $first: "$$ROOT" } } },
      ]);
      const readingMap = new Map(latestReadings.map((r) => [r._id, r.doc]));

      for (const zone of zones) {
        if (readingMap.has(zone.sensorId)) {
          const lr = readingMap.get(zone.sensorId);
          zone.rawValue = lr.rawValue || 0;
          zone.airQuality = lr.airQuality || "Clean";
          if (zone.isActive !== false) {
            const isCrit =
              lr.airQuality === "Critical" ||
              lr.airQuality === "Hazardous" ||
              lr.airQuality === "Unhealthy" ||
              (lr.rawValue || 0) >= 500;
            const isMod =
              lr.airQuality === "Moderate" ||
              ((lr.rawValue || 0) >= 150 && (lr.rawValue || 0) < 500);

            zone.status = isCrit ? "critical" : isMod ? "moderate" : "clean";
            zone.intensity = isCrit ? 0.9 : isMod ? 0.5 : 0.2;
            zone.ammonia = `${lr.ammonia || 0} ppm`;
            zone.methane = `${lr.methane || 0}%`;
          }
        }
      }
    }
    res.json(zones);
  } catch (err) {
    next(err);
  }
};

// POST /api/sensor-zones
exports.registerSensorZone = async (req, res, next) => {
  try {
    const { sensorId, location, lat, lng } = req.body;
    let barangay = req.body.barangay;

    if (req.official && req.official.barangay && req.official.barangay !== "All") {
      barangay = req.official.barangay;
    }

    if (!sensorId || lat == null || lng == null) {
      return res.status(400).json({ error: "sensorId, lat, and lng are required" });
    }

    const zone = await GarbageArea.findOneAndUpdate(
      { sensorId },
      {
        $set: {
          sensorId,
          name: location || sensorId,
          barangay: barangay || "",
          lat,
          lng,
          source: "iot",
          isActive: true,
        },
        $setOnInsert: { status: "clean", reportCount: 0, intensity: 0.2 },
      },
      { upsert: true, new: true }
    );

    const latestReading = await SensorReading.findOne({ sensorId }).sort({ timestamp: -1 });
    if (latestReading) {
      zone.rawValue = latestReading.rawValue || 0;
      zone.airQuality = latestReading.airQuality || "Clean";
      zone.ammonia = `${latestReading.ammonia || 0} ppm`;
      zone.methane = `${latestReading.methane || 0}%`;
      const isCrit =
        zone.airQuality === "Critical" ||
        zone.airQuality === "Hazardous" ||
        zone.airQuality === "Unhealthy" ||
        (zone.rawValue || 0) >= 500;
      const isMod =
        zone.airQuality === "Moderate" ||
        ((zone.rawValue || 0) >= 150 && (zone.rawValue || 0) < 500);
      zone.status = isCrit ? "critical" : isMod ? "moderate" : "clean";
      zone.intensity = isCrit ? 0.9 : isMod ? 0.5 : 0.2;
      await zone.save();
    }

    const io = getIO();
    if (io) io.emit("garbage-area:updated", zone);
    console.log(`[IoT] Sensor zone registered: ${sensorId} at (${lat}, ${lng})`);
    res.json(zone);
  } catch (err) {
    next(err);
  }
};

// GET /api/barangays/:barangay/boundary
exports.getBarangayBoundary = async (req, res, next) => {
  try {
    const barangayName = req.params.barangay || req.params.name;
    const doc = await BarangayBoundary.findOne({ barangay: barangayName });
    if (!doc) return res.json({ boundary: [] });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

// GET /api/barangays/boundaries
exports.getBarangayBoundaries = async (req, res, next) => {
  try {
    const docs = await BarangayBoundary.find();
    res.json(docs);
  } catch (err) {
    next(err);
  }
};

// POST /api/barangays/boundary
exports.updateBarangayBoundary = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    const { barangay, boundary, color } = req.body;
    const doc = await BarangayBoundary.findOneAndUpdate(
      { barangay },
      { boundary, color, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/generate-boundary
exports.generateBarangayBoundary = async (req, res, next) => {
  try {
    if (req.official?.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }

    const { barangay } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured in backend .env" });
    }

    const prompt = `Return a JSON array of latitude/longitude coordinates (at least 8 points) that define the administrative boundary of Barangay ${barangay} in Cebu City, Philippines. 
The format MUST be exactly: [[lat, lng], [lat, lng], ...]. 
Return ONLY the JSON array, no markdown, no explanation. 
Example: [[10.33, 123.88], [10.34, 123.89], ...]`;

    console.log(`[AI] Generating boundary for: ${barangay}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const apiRequest = new Promise((resolve, reject) => {
      const apiReq = https.request(url, options, (apiRes) => {
        let body = "";
        apiRes.on("data", (chunk) => (body += chunk));
        apiRes.on("end", () => resolve({ status: apiRes.statusCode, data: JSON.parse(body) }));
      });
      apiReq.on("error", (e) => reject(e));
      apiReq.write(data);
      apiReq.end();
    });

    const response = await apiRequest;

    if (response.status !== 200) {
      throw new Error(response.data?.error?.message || `API returned status ${response.status}`);
    }

    const text = response.data.candidates[0].content.parts[0].text;
    console.log(`[AI] Response received:`, text.substring(0, 50) + "...");

    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let boundary;
    try {
      boundary = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("[AI] JSON Parse Error. Raw text:", text);
      return res.status(500).json({ error: "AI returned invalid data format. Please try again." });
    }

    if (!Array.isArray(boundary) || boundary.length < 3) {
      throw new Error("Invalid boundary array format");
    }

    res.json({ boundary });
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    next(err);
  }
};
