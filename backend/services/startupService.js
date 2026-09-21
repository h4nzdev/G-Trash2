const { Sitio, Fleet, CollectionLog, PickupRun, BarangayBoundary } = require("../models");

const BARANGAY_BOUNDARIES = {};

async function loadBoundaries() {
  try {
    const docs = await BarangayBoundary.find();
    docs.forEach((doc) => {
      BARANGAY_BOUNDARIES[doc.barangay] = doc.boundary;
    });
    console.log(`[Backend] Loaded ${docs.length} boundaries into memory`);
  } catch (err) {
    console.error("[Backend] Failed to load boundaries:", err.message);
  }
}

async function seedSitios() {
  try {
    const count = await Sitio.countDocuments();
    if (count > 0) return;
    const defaultSitios = [
      // Lahug
      { name: "La Guardia", barangay: "Lahug", lat: 10.3292, lng: 123.9015 },
      { name: "Sodlon", barangay: "Lahug", lat: 10.3345, lng: 123.8962 },
      { name: "Peace Valley", barangay: "Lahug", lat: 10.3235, lng: 123.892 },
      { name: "Beverly Hills", barangay: "Lahug", lat: 10.3298, lng: 123.886 },
      { name: "Plaza Housing", barangay: "Lahug", lat: 10.3421, lng: 123.8995 },
      { name: "JY Square", barangay: "Lahug", lat: 10.3276, lng: 123.8986 },
      // Guadalupe
      { name: "Banawa", barangay: "Guadalupe", lat: 10.3188, lng: 123.8833 },
      { name: "Kalunasan", barangay: "Guadalupe", lat: 10.3312, lng: 123.8755 },
      { name: "Sandayong", barangay: "Guadalupe", lat: 10.3222, lng: 123.8872 },
      // Mabolo
      { name: "Kasambagan", barangay: "Mabolo", lat: 10.3283, lng: 123.9142 },
      { name: "Panagdait", barangay: "Mabolo", lat: 10.3248, lng: 123.9189 },
    ];
    await Sitio.insertMany(defaultSitios);
    console.log(`[Backend] Seeded ${defaultSitios.length} default verified sitios`);
  } catch (err) {
    console.error("[Backend] Failed to seed sitios:", err.message);
  }
}

async function seedDriverAnalytics() {
  try {
    // 1. Ensure Fleet record for GT-QSO exists
    let qsoFleet = await Fleet.findOne({ truckId: /GT-QSO/i });
    if (!qsoFleet) {
      qsoFleet = await Fleet.create({
        truckId: "GT-QSO",
        driverName: "Xherdone James",
        driverId: "DRV-1298",
        driverPhone: "09927870100",
        driverImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
        barangay: "Apas",
        type: "shared",
        serviceBarangays: ["Apas", "Lahug"],
        route: "Apas — 5th Street ➔ 6th Street ➔ 7th Street",
        createdAt: new Date("2026-09-01"),
      });
      console.log("[Backend] Created Fleet entry for GT-QSO.");
    }
  } catch (err) {
    console.error("[Backend] Failed to seed driver analytics:", err.message);
  }
}

async function runStartupTasks() {
  await loadBoundaries();
  await seedSitios();
  await seedDriverAnalytics();
}

module.exports = {
  BARANGAY_BOUNDARIES,
  loadBoundaries,
  seedSitios,
  seedDriverAnalytics,
  runStartupTasks,
};
