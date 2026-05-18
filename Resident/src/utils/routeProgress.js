import { haversineM } from './haversine';

const AT_STOP_RADIUS_M = 80; // truck within this distance = "at" the stop

/**
 * Returns waypoints enriched with a `status` field:
 *   'completed' | 'current' | 'upcoming'
 *
 * Logic: find the waypoint nearest to the truck.
 *   - Everything before it = completed
 *   - The nearest = 'current' (or 'completed' if truck is within AT_STOP_RADIUS_M)
 *   - Everything after = upcoming
 */
export function computeStopStatuses(waypoints, truckLat, truckLng) {
  if (!waypoints?.length) return [];

  if (truckLat == null || truckLng == null) {
    return waypoints.map((wp, i) => ({ ...wp, index: i, status: 'upcoming', distFromTruck: null }));
  }

  // Find the nearest waypoint index
  let minDist = Infinity;
  let nearestIdx = 0;
  waypoints.forEach((wp, i) => {
    if (wp.lat == null || wp.lng == null) return;
    const d = haversineM(truckLat, truckLng, wp.lat, wp.lng);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  const atStop = minDist <= AT_STOP_RADIUS_M;

  return waypoints.map((wp, i) => {
    let status;
    if (i < nearestIdx) {
      status = 'completed';
    } else if (i === nearestIdx) {
      status = atStop ? 'completed' : 'current';
    } else {
      status = 'upcoming';
    }
    return {
      ...wp,
      index: i,
      status,
      distFromTruck: i === nearestIdx ? Math.round(minDist) : null,
    };
  });
}

export function getProgressSummary(enrichedStops) {
  const completed = enrichedStops.filter((s) => s.status === 'completed').length;
  return { completed, total: enrichedStops.length };
}
