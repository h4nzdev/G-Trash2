const { BarangayScore, BarangayPointHistory, Resident } = require("../models");
const { getIO } = require("../config/socket");

// Award points to a barangay — upserts the score document.
async function addBarangayScore(barangay, points, scoreCategory, countField, description = "") {
  if (!barangay || points == null) return;
  const incOps = { points };
  if (scoreCategory) incOps[scoreCategory] = points;
  if (countField && points > 0) incOps[countField] = 1;

  const desc = description || (
    scoreCategory === "collectionScore"
      ? (points >= 0 ? "Waste collection completed" : "Collection disputed / penalized")
      : scoreCategory === "reportScore"
      ? (points >= 0 ? "Incident resolution verified" : "Report disputed / SLA penalty")
      : scoreCategory === "iotScore"
      ? "Clean air quality award"
      : points >= 0 ? "Barangay activity bonus" : "Barangay score deduction"
  );

  await BarangayPointHistory.create({
    barangay,
    points,
    category: scoreCategory || "points",
    description: desc,
  }).catch(() => {});

  const updated = await BarangayScore.findOneAndUpdate(
    { barangay },
    { $inc: incOps, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  const io = getIO();
  if (io) {
    io.emit("barangay:score:update", {
      barangay,
      points,
      scoreCategory,
      totalPoints: updated?.points,
    });
  }

  return updated;
}

const STAT_MAP = {
  correct_scan: { inc: "stats.correctScans", scan: true },
  report_submit: { inc: "stats.reportsSubmitted" },
  report_upvote: { inc: "stats.reportsUpvoted" },
  report_comment: { inc: "stats.commentsMade" },
  verify_resolution: { inc: "stats.resolutionsVerified" },
  pickup_verified: {},
  report_resolved: {},
  bin_prepared: {},
  bin_pickedup: {},
  disposal_verification: {},
};

async function awardResidentPoints(residentId, points, action, description, reportId = null) {
  if (!residentId || points == null) return;
  try {
    const inc = { totalPoints: points, monthlyPoints: points };
    const stat = STAT_MAP[action];
    if (stat) {
      if (stat.inc && points !== 0) inc[stat.inc] = points > 0 ? 1 : 0;
      if (stat.scan) inc["stats.totalScans"] = 1;
    }
    const entry = { points, action, description, date: new Date() };
    if (reportId) entry.reportId = reportId;

    const resident = await Resident.findByIdAndUpdate(
      residentId,
      {
        $inc: inc,
        $push: { pointsHistory: { $each: [entry], $position: 0 } },
        $set: { lastPointsAt: new Date() },
      },
      { new: true, select: "totalPoints monthlyPoints" }
    );

    if (resident) {
      const io = getIO();
      if (io) {
        io.to(`resident:${residentId}`).emit("resident:points:update", {
          residentId,
          newTotal: resident.totalPoints,
          monthlyPoints: resident.monthlyPoints,
          pointsEarned: points,
          action,
          description,
        });
      }
    }
    return resident;
  } catch (err) {
    console.error("[Points] Award failed:", err.message);
  }
}

// Maximum 3 rewarded reports per day per resident
async function canAwardDailyReport(residentId) {
  if (!residentId) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const resident = await Resident.findById(residentId);
  if (!resident) return false;

  const current = resident.dailyReportRewards;
  if (current && current.date === todayStr) {
    if (current.count >= 3) {
      return false;
    }
    resident.dailyReportRewards.count += 1;
  } else {
    resident.dailyReportRewards = { date: todayStr, count: 1 };
  }
  await resident.save();
  return true;
}

// Clean air (+3) and Moderate air (+1) awarded once per day per barangay
async function canAwardDailyAirQuality(barangay, airQuality) {
  if (!barangay) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isClean = /^(clean|good)$/i.test(airQuality);
  const isModerate = /^moderate$/i.test(airQuality);

  if (!isClean && !isModerate) return false;

  const field = isClean ? "lastCleanAirAwardDate" : "lastModerateAirAwardDate";
  const doc = await BarangayScore.findOne({ barangay });

  if (doc && doc[field] === todayStr) {
    return false;
  }

  await BarangayScore.findOneAndUpdate(
    { barangay },
    { $set: { [field]: todayStr, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  return true;
}

module.exports = {
  addBarangayScore,
  awardResidentPoints,
  canAwardDailyReport,
  canAwardDailyAirQuality,
};
