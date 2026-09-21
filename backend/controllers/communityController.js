const { CleanupPost, GarbageArea, SurveyResponse } = require("../models");
const cloudinary = require("../config/cloudinary");
const { getIO } = require("../config/socket");
const { addBarangayScore } = require("../services/gamificationService");

// GET /api/cleanup
exports.getCleanupPosts = async (req, res, next) => {
  try {
    const { barangay, limit = 30 } = req.query;
    const filter = barangay ? { barangay } : {};
    const posts = await CleanupPost.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json(posts);
  } catch (err) {
    next(err);
  }
};

// POST /api/cleanup
exports.createCleanupPost = async (req, res, next) => {
  try {
    const { truckId, driverName, areaId, areaName, barangay, photo, note, lat, lng, autoDetected } = req.body;
    if (!truckId || !photo) return res.status(400).json({ error: "truckId and photo are required" });

    let photoUrl = photo;
    if (photo.startsWith("data:") || photo.startsWith("file:") || !photo.startsWith("http")) {
      const uploadRes = await cloudinary.uploader.upload(photo, {
        folder: "gtrash/cleanups",
        quality: "auto",
        fetch_format: "auto",
      });
      photoUrl = uploadRes.secure_url;
    }

    const post = await CleanupPost.create({
      truckId,
      driverName: driverName || "",
      areaId: areaId || null,
      areaName: areaName || "",
      barangay: barangay || "",
      photo: photoUrl,
      note: note || "",
      autoDetected: autoDetected !== false,
      lat: lat || null,
      lng: lng || null,
    });

    if (areaId) {
      await GarbageArea.findByIdAndUpdate(areaId, {
        status: "clean",
        lastCollectionAt: new Date(),
        lastCollectionBy: truckId,
        lastCollectionId: post._id,
      });
    }

    if (barangay) {
      await addBarangayScore(barangay, 5, "collectionScore", "pickupCount", "Pickup logged from device").catch(() => {});
    }

    const io = getIO();
    if (io) {
      io.emit("cleanup:new", post);
      io.emit("area:status:update", { areaId, status: "clean" });
    }

    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
};

// POST /api/survey/response
exports.submitSurveyResponse = async (req, res, next) => {
  try {
    const { residentId, barangay, questionId, question, answer, context } = req.body;
    if (!answer) return res.status(400).json({ error: "answer is required" });
    await SurveyResponse.create({ residentId, barangay, questionId, question, answer, context });
    res.json({ success: true, message: "Thank you for your feedback!" });
  } catch (err) {
    next(err);
  }
};

// GET /api/survey/results
exports.getSurveyResults = async (req, res, next) => {
  try {
    const { period, context } = req.query;
    const dateFilter = {};
    if (period === "week") dateFilter.submittedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    else if (period === "month") dateFilter.submittedAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };

    const baseFilter = { ...dateFilter };
    if (context && context !== "all") baseFilter.context = context;

    const total = await SurveyResponse.countDocuments(baseFilter);

    const byAnswer = await SurveyResponse.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$answer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const results = byAnswer.map((r) => ({
      answer: r._id,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }));

    const contexts = ["after_scan", "after_report", "viewing_leaderboard"];
    const byContext = {};
    for (const ctx of contexts) {
      const ctxFilter = { ...dateFilter, context: ctx };
      const ctxTotal = await SurveyResponse.countDocuments(ctxFilter);
      const ctxRows = await SurveyResponse.aggregate([
        { $match: ctxFilter },
        { $group: { _id: "$answer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      byContext[ctx] = {
        total: ctxTotal,
        results: ctxRows.map((r) => ({
          answer: r._id,
          count: r.count,
          percentage: ctxTotal > 0 ? Math.round((r.count / ctxTotal) * 100) : 0,
        })),
      };
    }

    res.json({ totalResponses: total, results, byContext });
  } catch (err) {
    next(err);
  }
};
