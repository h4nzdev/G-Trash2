const { BarangayScore, BarangayPointHistory, Resident } = require("../models");
const { getIO } = require("../config/socket");

// Award points to a barangay — upserts the score document.
async function addBarangayScore(barangay, points, scoreCategory, countField, description = "") {
  if (!barangay || points == null) return;
  const incOps = { points };
  if (scoreCategory) incOps[scoreCategory] = points;
  if (countField && points > 0) incOps[countField] = 1;

  if (description) {
    await BarangayPointHistory.create({
      barangay,
      points,
      category: scoreCategory || "points",
      description,
    });
  }

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
  report_resolved: {},
  bin_prepared: {},
  bin_pickedup: {},
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

module.exports = {
  addBarangayScore,
  awardResidentPoints,
};
