const mongoose = require("mongoose");
const { Reward, Resident, Report, Official, DisposalVerification, BarangayScore } = require("../models");
const { getIO } = require("../config/socket");
const { wasteClassificationMap, lookupWasteClassification } = require("../config/wasteClassification");

function generateClaimCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const part = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `GTR-${part(4)}-${part(4)}`;
}

// POST /api/residents/:id/award-scan-points
exports.awardScanPoints = async (req, res, next) => {
  try {
    res.json({ ok: true, pointsAwarded: 0, message: "Scanning does not award points" });
  } catch (err) {
    next(err);
  }
};

// GET /api/residents/:id/points
exports.getResidentPoints = async (req, res, next) => {
  try {
    const r = await Resident.findById(req.params.id, "totalPoints monthlyPoints stats lastPointsAt monthlyHistory");
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  } catch (err) {
    next(err);
  }
};

// GET /api/residents/:id/points/history
exports.getResidentPointsHistory = async (req, res, next) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const limit = Math.min(50, parseInt(req.query.limit) || 30);
    const r = await Resident.findById(req.params.id, "pointsHistory");
    if (!r) return res.status(404).json({ error: "Not found" });
    const history = (r.pointsHistory || []).slice(page * limit, (page + 1) * limit);
    res.json({ history, total: (r.pointsHistory || []).length, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/barangays/:barangayName/top-residents
exports.getTopResidents = async (req, res, next) => {
  try {
    const { barangayName } = req.params;
    const { period = "month" } = req.query;
    const sortField = period === "month" ? "monthlyPoints" : "totalPoints";
    const residents = await Resident.find(
      { barangay: { $regex: new RegExp(`^${barangayName.trim()}$`, "i") } },
      "firstName lastName profilePicture totalPoints monthlyPoints stats lastPointsAt"
    ).sort({ [sortField]: -1, lastPointsAt: -1 }).limit(10);

    res.json({
      barangay: barangayName,
      period,
      topResidents: residents.map((r, i) => ({
        rank: i + 1,
        residentId: r._id,
        name: `${r.firstName} ${r.lastName}`,
        totalPoints: r.totalPoints || 0,
        monthlyPoints: r.monthlyPoints || 0,
        stats: r.stats || {},
        profilePicture: r.profilePicture || null,
        lastPointsAt: r.lastPointsAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/residents/:id/rank
exports.getResidentRank = async (req, res, next) => {
  try {
    const r = await Resident.findById(req.params.id, "barangay totalPoints monthlyPoints");
    if (!r) return res.status(404).json({ error: "Not found" });
    const [aboveMonth, aboveAll, total] = await Promise.all([
      Resident.countDocuments({ barangay: r.barangay, monthlyPoints: { $gt: r.monthlyPoints || 0 } }),
      Resident.countDocuments({ barangay: r.barangay, totalPoints: { $gt: r.totalPoints || 0 } }),
      Resident.countDocuments({ barangay: r.barangay }),
    ]);
    res.json({ monthlyRank: aboveMonth + 1, allTimeRank: aboveAll + 1, total });
  } catch (err) {
    next(err);
  }
};

// GET /api/rewards/leaderboard-eligible
exports.getLeaderboardEligible = async (req, res, next) => {
  try {
    const { barangay } = req.query;
    const query = barangay && barangay !== "All" ? { barangay } : {};
    const reportAgg = await Report.aggregate([
      { $match: { ...query, status: { $in: ["resolved", "pending"] } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const residentIds = reportAgg.map((r) => r._id).filter(Boolean);
    const residents = await Resident.find(
      { _id: { $in: residentIds }, ...query },
      "firstName lastName barangay"
    );
    const eligibleMap = {};
    for (const agg of reportAgg) {
      const r = residents.find((res) => String(res._id) === String(agg._id));
      if (!r) continue;
      if (!eligibleMap[r.barangay]) eligibleMap[r.barangay] = [];
      eligibleMap[r.barangay].push({
        _id: r._id,
        name: `${r.firstName} ${r.lastName}`,
        barangay: r.barangay,
        reportCount: agg.count,
      });
    }
    res.json(eligibleMap);
  } catch (err) {
    next(err);
  }
};

// GET /api/rewards/resident/:residentId
exports.getResidentRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find({ recipientId: req.params.residentId }).sort({ createdAt: -1 });
    res.json(rewards);
  } catch (err) {
    next(err);
  }
};

// GET /api/rewards
exports.getRewards = async (req, res, next) => {
  try {
    const { barangay, status, category } = req.query;
    const filter = {};
    if (barangay && barangay !== "All") filter.barangay = barangay;
    if (status) filter.status = status;
    if (category) filter.category = category;
    const rewards = await Reward.find(filter).sort({ createdAt: -1 });
    res.json(rewards);
  } catch (err) {
    next(err);
  }
};

// GET /api/rewards/:id
exports.getRewardById = async (req, res, next) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) return res.status(404).json({ error: "Reward not found" });
    res.json(reward);
  } catch (err) {
    next(err);
  }
};

// POST /api/rewards
exports.createReward = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      barangay,
      rewardType,
      rewardValue,
      recipientId,
      recipientName,
      issuedBy,
      issuedByName,
      notes,
      claimDeadline,
      publish,
    } = req.body;

    if (!title || !category || !barangay || !rewardType || !recipientId) {
      return res.status(400).json({ error: "title, category, barangay, rewardType, recipientId are required" });
    }

    const deadline = claimDeadline
      ? new Date(claimDeadline)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const status = publish ? "published" : "draft";
    let claimCode = null;
    if (publish) {
      let attempts = 0;
      do {
        claimCode = generateClaimCode();
        attempts++;
      } while (attempts < 10 && (await Reward.findOne({ claimCode })));
    }

    let officialSignatureUrl = null;
    if (issuedBy) {
      const issuer = await Official.findById(issuedBy).select("signatureUrl");
      officialSignatureUrl = issuer?.signatureUrl || null;
    }

    const reward = await Reward.create({
      title,
      description,
      category,
      barangay,
      rewardType,
      rewardValue,
      recipientId,
      recipientName: recipientName || "",
      issuedBy: issuedBy || null,
      issuedByName: issuedByName || "",
      status,
      claimCode,
      issuedDate: publish ? new Date() : null,
      claimDeadline: deadline,
      officialSignatureUrl,
      notes: notes || "",
    });

    if (publish) {
      await Resident.findByIdAndUpdate(recipientId, {
        $addToSet: { rewardsReceived: reward._id },
      });
      const io = getIO();
      if (io) {
        io.to(`resident:${recipientId}`).emit("reward:new", {
          rewardId: reward._id,
          title: reward.title,
          rewardValue: reward.rewardValue,
          barangay: reward.barangay,
          claimDeadline: reward.claimDeadline,
        });
      }
    }

    res.status(201).json(reward);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rewards/:id
exports.updateReward = async (req, res, next) => {
  try {
    const { action, issuedByName } = req.body;
    const reward = await Reward.findById(req.params.id);
    if (!reward) return res.status(404).json({ error: "Reward not found" });

    const io = getIO();

    if (action === "publish" && reward.status === "draft") {
      let claimCode = reward.claimCode;
      if (!claimCode) {
        let attempts = 0;
        do {
          claimCode = generateClaimCode();
          attempts++;
        } while (attempts < 10 && (await Reward.findOne({ claimCode, _id: { $ne: reward._id } })));
      }
      reward.status = "published";
      reward.claimCode = claimCode;
      reward.issuedDate = new Date();
      if (issuedByName) reward.issuedByName = issuedByName;
      await reward.save();

      await Resident.findByIdAndUpdate(reward.recipientId, {
        $addToSet: { rewardsReceived: reward._id },
      });
      if (io) {
        io.to(`resident:${reward.recipientId}`).emit("reward:new", {
          rewardId: reward._id,
          title: reward.title,
          rewardValue: reward.rewardValue,
          barangay: reward.barangay,
          claimDeadline: reward.claimDeadline,
        });
      }
    } else if (action === "mark_claimed" && reward.status === "published") {
      reward.status = "claimed";
      reward.claimedDate = new Date();
      await reward.save();

      await Resident.findByIdAndUpdate(reward.recipientId, {
        $inc: { totalRewardsClaimed: 1 },
      });
      if (io) {
        io.to(`resident:${reward.recipientId}`).emit("reward:claimed", {
          rewardId: reward._id,
          title: reward.title,
        });
      }
    } else if (action === "expire") {
      reward.status = "expired";
      await reward.save();
    } else if (action === "revoke") {
      const hoursSincePublish = reward.issuedDate
        ? (Date.now() - new Date(reward.issuedDate).getTime()) / 3600000
        : 0;
      if (reward.status === "claimed") {
        return res.status(400).json({ error: "Cannot revoke a claimed reward" });
      }
      if (reward.issuedDate && hoursSincePublish > 24) {
        return res.status(400).json({ error: "Revoke window expired (24 hours after publish)" });
      }
      await Resident.findByIdAndUpdate(reward.recipientId, {
        $pull: { rewardsReceived: reward._id },
      });
      await Reward.findByIdAndDelete(reward._id);
      return res.json({ revoked: true });
    } else {
      const allowed = ["title", "description", "rewardType", "rewardValue", "notes", "claimDeadline", "officialSignatureUrl"];
      for (const field of allowed) {
        if (req.body[field] !== undefined) reward[field] = req.body[field];
      }
      await reward.save();
    }

    res.json(reward);
  } catch (err) {
    next(err);
  }
};

// POST /api/rewards/:id/claim
exports.claimReward = async (req, res, next) => {
  try {
    const { residentId } = req.body;
    const reward = await Reward.findById(req.params.id);
    if (!reward) return res.status(404).json({ error: "Reward not found" });
    if (String(reward.recipientId) !== String(residentId)) {
      return res.status(403).json({ error: "This reward does not belong to you" });
    }
    if (reward.status !== "published") {
      return res.status(400).json({ error: `Cannot claim reward with status: ${reward.status}` });
    }
    if (reward.claimDeadline && new Date() > new Date(reward.claimDeadline)) {
      reward.status = "expired";
      await reward.save();
      return res.status(400).json({ error: "Claim deadline has passed" });
    }
    reward.status = "claimed";
    reward.claimedDate = new Date();
    await reward.save();

    await Resident.findByIdAndUpdate(residentId, { $inc: { totalRewardsClaimed: 1 } });
    const io = getIO();
    if (io) {
      io.emit("reward:claimed", { rewardId: reward._id, title: reward.title, barangay: reward.barangay });
    }
    res.json({ success: true, reward });
  } catch (err) {
    next(err);
  }
};

// POST /api/disposal/submit
exports.submitDisposal = async (req, res, next) => {
  try {
    const { residentId, photoUrl, sitio, barangay, truckId, isTruckNearAndScheduled, motivation, wasteType } = req.body;
    if (!residentId || !photoUrl) {
      return res.status(400).json({ error: "residentId and photoUrl are required" });
    }

    const resident = await Resident.findById(residentId);
    if (!resident) return res.status(404).json({ error: "Resident not found" });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const alreadySubmittedToday = await DisposalVerification.findOne({
      residentId: resident._id,
      status: "active",
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    if (alreadySubmittedToday) {
      return res.status(400).json({
        error: "You can only snap once per day! Your daily garbage photo has already been submitted today and resets tomorrow.",
        alreadySubmittedToday: true,
        resetsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0),
      });
    }

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    let awardPoints = 0;
    let newStreak = (resident.disposalStreak || 0) + 1;

    if (resident.lastDisposalRunAt && (now.getTime() - new Date(resident.lastDisposalRunAt).getTime() > 7 * 24 * 60 * 60 * 1000)) {
      newStreak = 1;
    }

    const lastClaim = resident.lastDisposalClaimAt ? new Date(resident.lastDisposalClaimAt).getTime() : 0;
    const canClaimPoints = (now.getTime() - lastClaim >= THREE_DAYS_MS) && !!isTruckNearAndScheduled;

    if (canClaimPoints) {
      awardPoints = 10;
      resident.totalPoints = (resident.totalPoints || 0) + 10;
      resident.monthlyPoints = (resident.monthlyPoints || 0) + 10;
      resident.lastPointsAt = now;
      resident.lastDisposalClaimAt = now;
      resident.pointsHistory = resident.pointsHistory || [];
      resident.pointsHistory.unshift({
        points: 10,
        action: "disposal_verification",
        description: `Verified Waste Disposal (+10 pts) — Streak: ${newStreak} days`,
        date: now,
      });
    }

    resident.disposalStreak = newStreak;
    resident.lastDisposalRunAt = now;
    await resident.save();

    const record = await DisposalVerification.create({
      residentId: resident._id,
      residentName: `${resident.firstName} ${resident.lastName}`,
      barangay: barangay || resident.barangay,
      sitio: sitio || resident.sitio || "",
      photoUrl,
      streakCount: newStreak,
      pointsAwarded: awardPoints,
      truckId: truckId || "",
      wasteType: wasteType || "",
      motivation: motivation || "",
      status: "active",
    });

    const io = getIO();
    if (io) io.emit("disposal:photo:new", record);

    res.status(201).json({
      success: true,
      verification: record,
      pointsAwarded: awardPoints,
      newStreak,
      totalPoints: resident.totalPoints,
      message: awardPoints > 0 ? `🎉 Disposal Verified! +10 Points & ${newStreak}-Day Streak!` : `🎉 Disposal Verified! ${newStreak}-Day Streak! (Next points in 3 days)`,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/disposal/status/:residentId
exports.getDisposalStatus = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayRecord = await DisposalVerification.findOne({
      residentId: req.params.residentId,
      status: "active",
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    res.json({
      hasSnappedToday: !!todayRecord,
      submission: todayRecord || null,
      resetsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/disposal/photos
exports.getDisposalPhotos = async (req, res, next) => {
  try {
    const { barangay, sitio, period = "all", search } = req.query;
    const filter = { status: "active" };

    if (barangay && barangay !== "All" && barangay !== "All Barangays") {
      filter.barangay = new RegExp(`^${barangay}$`, "i");
    }
    if (sitio && sitio !== "All" && sitio !== "All Sitios") {
      filter.sitio = new RegExp(`^${sitio}$`, "i");
    }

    if (period === "today") {
      const now = new Date();
      filter.createdAt = {
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (period === "week") {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: weekAgo };
    } else if (period === "month") {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: monthAgo };
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { residentName: new RegExp(q, "i") },
        { sitio: new RegExp(q, "i") },
        { barangay: new RegExp(q, "i") },
      ];
    }

    const photos = await DisposalVerification.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(photos);
  } catch (err) {
    next(err);
  }
};

// GET /api/resident/:id
exports.getResidentProfile = async (req, res, next) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: "Resident not found" });
    res.json({
      id: resident._id,
      name: `${resident.firstName} ${resident.lastName}`,
      barangay: resident.barangay,
      disposalStreak: resident.disposalStreak || 0,
      totalPoints: resident.totalPoints || 0,
      monthlyPoints: resident.monthlyPoints || 0,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/disposal/photos/:id
exports.deleteDisposalPhoto = async (req, res, next) => {
  try {
    const verification = await DisposalVerification.findByIdAndUpdate(
      req.params.id,
      { status: "deleted" },
      { new: true }
    );
    if (!verification) return res.status(404).json({ error: "Photo not found" });

    const io = getIO();
    if (io) {
      io.to(`resident:${verification.residentId}`).emit("resident:photo:deleted", {
        photoId: verification._id,
        message: "LGU Official reviewed & cleared your disposal photo validation.",
      });
    }

    res.json({ success: true, message: "Photo dismissed from official dashboard", verification });
  } catch (err) {
    next(err);
  }
};

// GET /api/waste-classification
exports.getWasteClassification = (req, res, next) => {
  try {
    res.json(wasteClassificationMap);
  } catch (err) {
    next(err);
  }
};

// POST /api/waste-classification/lookup
exports.lookupWasteClassification = (req, res, next) => {
  try {
    const { objectName } = req.body;
    if (!objectName) return res.status(400).json({ error: "objectName is required" });
    const result = lookupWasteClassification(objectName);
    res.json({ objectName, ...result });
  } catch (err) {
    next(err);
  }
};

// POST /api/residents/:id/scan-log
exports.logScan = async (req, res, next) => {
  try {
    const { objectDetected, category, confidence, correct } = req.body;
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: "Resident not found" });

    resident.stats = resident.stats || {};
    resident.stats.totalScans = (resident.stats.totalScans || 0) + 1;
    if (correct) {
      resident.stats.correctScans = (resident.stats.correctScans || 0) + 1;
    }

    const description = `Scanned: ${objectDetected || "unknown"} (${category || "?"}) — ${correct ? "correct" : "corrected"}`;
    resident.pointsHistory = resident.pointsHistory || [];
    resident.pointsHistory.unshift({ type: "correct_scan", points: 0, description, date: new Date() });
    await resident.save();

    res.json({ ok: true, logged: true, pointsAwarded: 0 });
  } catch (err) {
    next(err);
  }
};
