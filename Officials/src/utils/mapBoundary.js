export const CEBU_CENTER = [10.3157, 123.8854];

export const WORLD_BOUNDS = [
  [-90, -360],
  [90, -360],
  [90, 360],
  [-90, 360],
];

export const CEBU_BOUNDS = [
  [10.22, 123.80],
  [10.42, 123.95]
];

// Cebu City outline — used as fallback or static mask
export const CEBU_CITY_OUTLINE = [
  // North border with Consolacion, west coast start
  [10.3565, 123.8808], [10.3592, 123.8842], [10.3610, 123.8882], [10.3620, 123.8925],
  [10.3624, 123.8972], [10.3618, 123.9018], [10.3600, 123.9065], [10.3568, 123.9112],
  // NE — eastern mountain ridge
  [10.3525, 123.9158], [10.3475, 123.9200], [10.3420, 123.9235], [10.3362, 123.9262],
  [10.3302, 123.9278], [10.3242, 123.9284], [10.3182, 123.9278], [10.3124, 123.9260],
  [10.3068, 123.9234], [10.3015, 123.9202], [10.2965, 123.9165], [10.2918, 123.9124],
  [10.2874, 123.9080], [10.2834, 123.9032], [10.2798, 123.8982], [10.2766, 123.8928],
  // SE — southern boundary with Talisay
  [10.2740, 123.8868], [10.2720, 123.8805], [10.2708, 123.8740], [10.2703, 123.8675],
  [10.2706, 123.8612], [10.2718, 123.8555],
  // SW corner
  [10.2738, 123.8508], [10.2770, 123.8472], [10.2806, 123.8452], [10.2844, 123.8445],
  [10.2878, 123.8452], [10.2908, 123.8465], [10.2936, 123.8480],
  // West coast — reclamation area near-straight run
  [10.2965, 123.8488], [10.2995, 123.8493], [10.3025, 123.8496], [10.3055, 123.8500],
  [10.3085, 123.8506], [10.3115, 123.8515], [10.3145, 123.8528], [10.3172, 123.8545],
  // North Reclamation Area / port zone
  [10.3196, 123.8558], [10.3220, 123.8568], [10.3246, 123.8573], [10.3272, 123.8576],
  [10.3300, 123.8580], [10.3328, 123.8588], [10.3358, 123.8600], [10.3388, 123.8616],
  [10.3415, 123.8636], [10.3440, 123.8660], [10.3464, 123.8686], [10.3487, 123.8714],
  [10.3508, 123.8742], [10.3526, 123.8770], [10.3544, 123.8792], [10.3558, 123.8802],
  [10.3565, 123.8808],
];

let cachedBoundary = null;
export async function fetchCebuCityBoundary() {
  if (cachedBoundary) return cachedBoundary;
  const query = `[out:json][timeout:20][bbox:10.15,123.70,10.50,124.05];
relation["name"="Cebu City"]["admin_level"~"^[67]$"];
out geom;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return CEBU_CITY_OUTLINE;
    const data = await res.json();
    const relation = data.elements?.find(e => e.type === 'relation');
    if (!relation?.members) return CEBU_CITY_OUTLINE;
    const coords = [];
    for (const member of relation.members) {
      if (member.type === 'way' && member.geometry) {
        for (const node of member.geometry) {
          coords.push([node.lat, node.lon]);
        }
      }
    }
    cachedBoundary = coords.length > 0 ? coords : CEBU_CITY_OUTLINE;
    return cachedBoundary;
  } catch {
    return CEBU_CITY_OUTLINE;
  }
}
