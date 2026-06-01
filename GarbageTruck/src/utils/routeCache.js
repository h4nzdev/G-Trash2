import AsyncStorage from '@react-native-async-storage/async-storage';

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const key = (truckId) => `@route_cache_${truckId}`;

export async function saveRouteCache(truckId, route) {
  try {
    await AsyncStorage.setItem(key(truckId), JSON.stringify({ route, date: todayYMD() }));
  } catch (_) {}
}

// Returns the cached route object if it was saved today, otherwise null.
export async function loadRouteCache(truckId) {
  try {
    const raw = await AsyncStorage.getItem(key(truckId));
    if (!raw) return null;
    const { route, date } = JSON.parse(raw);
    return date === todayYMD() ? route : null;
  } catch (_) {
    return null;
  }
}
