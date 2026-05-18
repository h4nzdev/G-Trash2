import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { haversineM } from '../utils/haversine';

const THRESHOLDS = { NEAR: 50, MEDIUM: 200, FAR: 500 };
const STALE_MS = 3 * 60 * 1000; // remove truck after 3 min of no update

export default function useTruckProximity(socket) {
  const [proximityLayer, setProximityLayer] = useState(null); // null | 'FAR' | 'MEDIUM' | 'NEAR'
  const [nearestTruck, setNearestTruck] = useState(null);

  const userLocRef = useRef(null);
  const trucksRef = useRef({});   // { [truckId]: { lat, lng, truckId, lastSeen } }
  const layerRef = useRef(null);  // avoids stale closure inside socket handler
  const locationSubRef = useRef(null);

  const recalculate = useCallback(() => {
    if (!userLocRef.current) return;
    const { lat: uLat, lng: uLng } = userLocRef.current;

    // Evict stale trucks
    const now = Date.now();
    Object.keys(trucksRef.current).forEach((id) => {
      if (now - trucksRef.current[id].lastSeen > STALE_MS) {
        delete trucksRef.current[id];
      }
    });

    const trucks = Object.values(trucksRef.current);

    if (trucks.length === 0) {
      if (layerRef.current !== null) {
        layerRef.current = null;
        setProximityLayer(null);
        setNearestTruck(null);
      }
      return;
    }

    // Pick nearest truck
    let minDist = Infinity;
    let nearest = null;
    for (const t of trucks) {
      const dist = haversineM(uLat, uLng, t.lat, t.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = { ...t, distance: Math.round(dist) };
      }
    }
    setNearestTruck(nearest);

    const newLayer =
      minDist <= THRESHOLDS.NEAR   ? 'NEAR'   :
      minDist <= THRESHOLDS.MEDIUM ? 'MEDIUM' :
      minDist <= THRESHOLDS.FAR    ? 'FAR'    : null;

    if (newLayer !== layerRef.current) {
      layerRef.current = newLayer;
      setProximityLayer(newLayer);
    }
  }, []);

  // Watch resident's location
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (loc) => {
          userLocRef.current = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
          recalculate();
        }
      );
    })();

    return () => {
      active = false;
      locationSubRef.current?.remove();
    };
  }, [recalculate]);

  // Subscribe to truck socket events
  useEffect(() => {
    if (!socket) return;

    const onLocation = ({ lat, lng, truckId }) => {
      if (lat == null || lng == null) return;
      trucksRef.current[truckId] = { lat, lng, truckId, lastSeen: Date.now() };
      recalculate();
    };

    const onStatus = ({ truckId, status }) => {
      if (status === 'offline' || status === 'idle') {
        delete trucksRef.current[truckId];
        recalculate();
      }
    };

    socket.on('truck:location:update', onLocation);
    socket.on('truck:status', onStatus);

    return () => {
      socket.off('truck:location:update', onLocation);
      socket.off('truck:status', onStatus);
    };
  }, [socket, recalculate]);

  return { proximityLayer, nearestTruck };
}
