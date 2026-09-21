const axios = require("axios");

const ORS_API_KEY =
  process.env.ORS_API_KEY ||
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=";

async function getRouteDirections(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return waypoints ? waypoints.map((w) => [w.lat || w[0], w.lng || w[1]]) : [];
  }

  // 1. First attempt: OSRM (Fast, free, no quota)
  try {
    const locStr = waypoints.map((w) => `${w.lng || w[1]},${w.lat || w[0]}`).join(";");
    const osrmRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${locStr}?overview=full&geometries=geojson`,
      { timeout: 5000 }
    );
    const coords = osrmRes.data.routes?.[0]?.geometry?.coordinates;
    if (coords && coords.length > 0) {
      return coords.map((c) => [c[1], c[0]]);
    }
  } catch (osrmErr) {
    console.warn(`[Routing] OSRM failed, falling back to ORS:`, osrmErr.message);
  }

  // 2. Second attempt: OpenRouteService
  try {
    const coordinates = waypoints.map((w) => [w.lng || w[1], w.lat || w[0]]);
    const orsRes = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      { coordinates },
      {
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
    const coords = orsRes.data.features?.[0]?.geometry?.coordinates;
    if (coords && coords.length > 0) {
      return coords.map((c) => [c[1], c[0]]);
    }
  } catch (orsErr) {
    console.warn(`[Routing] ORS failed:`, orsErr.message);
  }

  // 3. Fallback: Straight-line coordinates
  return waypoints.map((w) => [w.lat || w[0], w.lng || w[1]]);
}

module.exports = {
  getRouteDirections,
};
