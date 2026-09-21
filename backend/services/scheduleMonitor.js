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

async function startSLAChecker() {
  const check = async () => {
    try {
      const overdue = await Report.find({
        status: "pending",
        escalated: { $ne: true },
        deadline: { $lt: new Date() },
        reportedBy: { $not: /^IoT Sensor/ },
      });
      const io = getIO();
      for (const r of overdue) {
        await Report.findByIdAndUpdate(r._id, {
          $set: { escalated: true },
          $push: {
            statusHistory: {
              status: "escalated",
              changedBy: "System",
              changedAt: new Date(),
            },
          },
        });
        if (r.barangay) await addBarangayScore(r.barangay, -10, "reportScore", null, "SLA escalated (report unresolved over 72h)");
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
        console.log(`[SLA] Auto-escalated ${overdue.length} overdue reports, notified officials in realtime`);
      }
    } catch (err) {
      console.error("[SLA] Error:", err.message);
    }
  };
  await check();
  // Check every 1 minute for near real-time overdue SLA detection
  setInterval(check, 60 * 1000);
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
  startRewardExpirer,
  startMonthlyReset,
};
