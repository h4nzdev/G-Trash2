const { Schedule, Report, Reward, Resident } = require("../models");
const { getIO } = require("../config/socket");
const { addBarangayScore } = require("./gamificationService");

function getTodayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function updateOverdueSchedules() {
  try {
    const now = new Date();
    const today = getTodayYMD();
    const activeSchedules = await Schedule.find({ status: { $in: ["pending", "accepted"] } });
    const io = getIO();

    for (const s of activeSchedules) {
      if (!s.date) continue;

      let isOverdue = false;

      if (s.date < today) {
        isOverdue = true;
      } else if (s.date === today) {
        if (s.endTime) {
          const [hours, minutes] = s.endTime.split(":").map(Number);
          const scheduleEndTime = new Date(`${s.date}T00:00:00`);
          scheduleEndTime.setHours(hours, minutes, 0, 0);
          if (now > scheduleEndTime) {
            isOverdue = true;
          }
        } else if (s.startTime) {
          const [hours, minutes] = s.startTime.split(":").map(Number);
          const scheduleStartTime = new Date(`${s.date}T00:00:00`);
          scheduleStartTime.setHours(hours + 2, minutes, 0, 0);
          if (now > scheduleStartTime) {
            isOverdue = true;
          }
        }
      }

      if (isOverdue) {
        await Schedule.findByIdAndUpdate(s._id, { status: "missed" });

        try {
          const timeDesc = s.startTime ? ` at ${s.startTime}` : " (Any Time)";
          const report = await Report.create({
            title: `Missed Route: ${s.routeName || "Unknown"}`,
            category: "System Alert",
            description: `Truck ${s.truckId} (${s.driverName || "Unknown Driver"}) failed to complete the scheduled route on time. Scheduled for ${s.date}${timeDesc}.`,
            priority: "High",
            status: "pending",
            assignedTruck: s.truckId,
            assignedDriver: s.driverName,
            reportedBy: "System",
          });
          if (io) io.emit("report:new", report);
        } catch (repErr) {
          console.error("[ScheduleMonitor] Report creation error:", repErr.message);
        }

        console.log(`[ScheduleMonitor] Schedule ${s._id} for ${s.date} (${s.truckId}) marked as missed.`);
        if (io) io.emit("schedule:changed", { truckId: s.truckId, date: s.date });
      }
    }
  } catch (err) {
    console.error("[ScheduleMonitor] Error updating overdue schedules:", err.message);
  }
}

async function startScheduleMonitor() {
  await updateOverdueSchedules();
  setInterval(updateOverdueSchedules, 5 * 60 * 1000);
}

async function syncOverdueSLAPenalties() {
  try {
    const now = new Date();
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Find all unresolved reports that have exceeded the 72h SLA or deadline
    const overdue = await Report.find({
      status: { $nin: ["resolved", "rejected", "closed", "completed"] },
      $or: [
        { deadline: { $lte: now } },
        { createdAt: { $lte: seventyTwoHoursAgo } },
        { escalated: true },
      ],
      slaPenalized: { $ne: true },
    });

    const io = getIO();
    for (const r of overdue) {
      const repBy = (r.reportedBy || "").toLowerCase();
      if (repBy.startsWith("iot sensor")) continue;

      const createdMs = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
      const elapsedHours = Math.floor((now.getTime() - createdMs) / (1000 * 60 * 60));
      const elapsedDays = Math.floor(elapsedHours / 24);
      const timeStr = elapsedDays > 0 ? `${elapsedDays}d` : `${elapsedHours}h`;

      // Mark report as escalated and penalized in DB
      await Report.findByIdAndUpdate(r._id, {
        $set: {
          escalated: true,
          slaPenalized: true,
          deadline: r.deadline || new Date(createdMs + 72 * 60 * 60 * 1000),
        },
        $push: {
          statusHistory: {
            status: "escalated",
            changedBy: "System SLA Monitor",
            changedAt: new Date(),
          },
        },
      });

      if (r.barangay) {
        const reportTitle = r.title || "Waste Report";
        // Check if there is already a penalty for this report in point history
        const existingPenalty = await BarangayPointHistory.findOne({
          barangay: r.barangay,
          category: "reportScore",
          points: -10,
          description: { $regex: reportTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
        });

        if (!existingPenalty) {
          await addBarangayScore(
            r.barangay,
            -10,
            "reportScore",
            null,
            `SLA Escalation Penalty: "${reportTitle}" unresolved over 72h (${timeStr} overdue)`
          );
        }
      }

      if (io) {
        const payload = {
          reportId: r._id,
          barangay: r.barangay,
          title: r.title,
          category: r.category,
          location: r.location,
          priority: r.priority || "High",
          deadline: r.deadline,
          escalatedAt: new Date(),
        };
        io.emit("report:updated", { ...r.toObject(), escalated: true });
        io.emit("report:escalated", payload);
        io.emit("report:overdue", payload);
      }
    }

    if (overdue.length > 0) {
      console.log(`[SLA] Auto-escalated and penalized ${overdue.length} overdue reports`);
    }
    return overdue.length;
  } catch (err) {
    console.error("[SLA] Error:", err.message);
    return 0;
  }
}

async function startSLAChecker() {
  await syncOverdueSLAPenalties();
  // Check every 1 minute for near real-time overdue SLA detection
  setInterval(syncOverdueSLAPenalties, 60 * 1000);
}

async function startRewardExpirer() {
  const expire = async () => {
    try {
      const expired = await Reward.find({ status: "published", claimDeadline: { $lt: new Date() } });
      const io = getIO();
      for (const r of expired) {
        await Reward.findByIdAndUpdate(r._id, { status: "expired" });
        if (io) io.to(`resident:${r.recipientId}`).emit("reward:expired", { rewardId: r._id, title: r.title });
      }
      if (expired.length > 0) console.log(`[Rewards] Auto-expired ${expired.length} rewards`);
    } catch (err) {
      console.error("[Rewards] Expirer error:", err.message);
    }
  };
  await expire();
  setInterval(expire, 60 * 60 * 1000);
}

function startMonthlyReset() {
  const msUntilTomorrow = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 2, 0, 0);
    return t - Date.now();
  };
  const run = async () => {
    if (new Date().getDate() === 1) {
      const label = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      await Resident.updateMany(
        { monthlyPoints: { $gt: 0 } },
        [
          {
            $set: {
              monthlyHistory: { $concatArrays: ["$monthlyHistory", [{ month: label, points: "$monthlyPoints" }]] },
              monthlyPoints: 0,
            },
          },
        ]
      ).catch(() => {});
      console.log("[Monthly Reset] Resident monthly points archived and reset");
    }
    setTimeout(run, msUntilTomorrow());
  };
  setTimeout(run, msUntilTomorrow());
}

module.exports = {
  updateOverdueSchedules,
  startScheduleMonitor,
  startSLAChecker,
  syncOverdueSLAPenalties,
  startRewardExpirer,
  startMonthlyReset,
};
