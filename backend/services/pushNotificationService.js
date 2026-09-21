const https = require("https");
const { Truck, Resident } = require("../models");

async function notifyTruck(truckId, title, body, data = {}) {
  try {
    const truck = await Truck.findOne({ truckId: truckId.toUpperCase() });
    if (!truck?.pushToken || !truck.pushToken.startsWith("ExponentPushToken")) return;
    const payload = JSON.stringify({
      to: truck.pushToken,
      sound: "default",
      title,
      body,
      data,
    });
    const opts = {
      hostname: "exp.host",
      path: "/--/api/v2/push/send",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req2 = https.request(opts);
    req2.on("error", () => {});
    req2.write(payload);
    req2.end();
  } catch {}
}

async function notifyBarangayResidents(barangay, title, body, data = {}) {
  try {
    const residents = await Resident.find({
      barangay,
      pushToken: { $regex: /^ExponentPushToken/ },
    });
    if (residents.length === 0) return;

    const chunks = [];
    let currentChunk = [];

    for (const r of residents) {
      currentChunk.push({
        to: r.pushToken,
        sound: "default",
        title,
        body,
        data,
      });
      if (currentChunk.length === 100) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const payload = JSON.stringify(chunk);
      const opts = {
        hostname: "exp.host",
        path: "/--/api/v2/push/send",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };
      const req2 = https.request(opts);
      req2.on("error", () => {});
      req2.write(payload);
      req2.end();
    }
  } catch {}
}

module.exports = {
  notifyTruck,
  notifyBarangayResidents,
};
