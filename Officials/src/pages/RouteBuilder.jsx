import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  Route, Trash2, Save, MapPin, Truck, Navigation,
  CheckCircle, AlertCircle, X, RotateCcw, Undo2,
  Layers, Search
} from 'lucide-react';
import API from '../config';
import { useAuth } from '../context/AuthContext';
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=';
const CEBU_CENTER = [10.3157, 123.8854];

function isInsidePolygon(point, polygon) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Numbered marker for each waypoint
function makeWaypointIcon(n, isFirst, isLast) {
  const bg = isFirst ? '#059669' : isLast ? '#DC2626' : '#2563EB';
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: '',
  });
}

// Attaches a click listener to the map without re-mounting on every render
function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

// Map Controller for Flying to searched locations
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 18, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

async function fetchORSRoute(waypoints) {
  if (waypoints.length < 2) return null;
  try {
    const res = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      { coordinates: waypoints.map(w => [w.lng, w.lat]) },
      { headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' } },
    );
    const coords = res.data.features?.[0]?.geometry?.coordinates;
    return coords ? coords.map(c => [c[1], c[0]]) : null;
  } catch {
    return null;
  }
}

// Cebu City outline — used when Overpass is unavailable
const CEBU_CITY_OUTLINE = [
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

async function fetchCebuCityBoundary() {
  const query = `[out:json][timeout:20][bbox:10.15,123.70,10.50,124.05];
relation["name"="Cebu City"]["admin_level"~"^[67]$"];
out geom;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const relation = data.elements?.find(e => e.type === 'relation');
    if (!relation?.members) return null;
    const coords = [];
    for (const member of relation.members) {
      if (member.type === 'way' && member.role === 'outer' && member.geometry?.length) {
        for (const p of member.geometry) {
          if (p.lat != null && p.lon != null && !isNaN(p.lat) && !isNaN(p.lon)) {
            coords.push([p.lat, p.lon]);
          }
        }
      }
    }
    return coords.length >= 3 ? coords : null;
  } catch {
    return null;
  }
}

// Rough but realistic polygon fallbacks (used when Overpass has no data)
const FALLBACK_BOUNDARIES = {
  Lahug: [
    [10.3388, 123.8820], [10.3380, 123.8908], [10.3365, 123.8962],
    [10.3318, 123.8978], [10.3262, 123.8955], [10.3215, 123.8908],
    [10.3192, 123.8835], [10.3228, 123.8792], [10.3312, 123.8788],
  ],
  Apas: [
    [10.3582, 123.8972], [10.3565, 123.9152], [10.3492, 123.9178],
    [10.3418, 123.9132], [10.3388, 123.9015], [10.3398, 123.8942],
    [10.3445, 123.8908], [10.3515, 123.8922],
  ],
  Guadalupe: [
    [10.3148, 123.8732], [10.3145, 123.8858], [10.3098, 123.8878],
    [10.3048, 123.8852], [10.3012, 123.8798], [10.3018, 123.8725],
    [10.3072, 123.8698], [10.3118, 123.8710],
  ],
  Mabolo: [
    [10.3282, 123.8905], [10.3275, 123.9028], [10.3228, 123.9055],
    [10.3175, 123.9042], [10.3142, 123.8985], [10.3148, 123.8902],
    [10.3198, 123.8878], [10.3248, 123.8885],
  ],
  Talamban: [
    [10.3802, 123.8935], [10.3788, 123.9208], [10.3692, 123.9248],
    [10.3598, 123.9195], [10.3548, 123.9098], [10.3562, 123.8972],
    [10.3638, 123.8915], [10.3725, 123.8908],
  ],
  Banilad: [
    [10.3505, 123.8758], [10.3498, 123.8932], [10.3435, 123.8958],
    [10.3378, 123.8928], [10.3352, 123.8848], [10.3368, 123.8762],
    [10.3428, 123.8728], [10.3478, 123.8738],
  ],
  Mandaue: [
    [10.3528, 123.9158], [10.3512, 123.9378], [10.3408, 123.9415],
    [10.3298, 123.9388], [10.3248, 123.9295], [10.3262, 123.9155],
    [10.3368, 123.9108], [10.3458, 123.9118],
  ],
};

// Bounding box that covers all of Metro Cebu — keeps the query local
const CEBU_BBOX = '10.20,123.75,10.50,124.10'; // south,west,north,east

async function fetchBoundaryFromOverpass(barangay) {
  const query = `[out:json][timeout:15][bbox:${CEBU_BBOX}];
relation["name"="${barangay}"]["boundary"="administrative"];
out geom;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const relation = data.elements?.find(e => e.type === 'relation');
    if (!relation?.members) return null;

    const coords = [];
    for (const member of relation.members) {
      if (member.type === 'way' && member.role === 'outer' && member.geometry?.length) {
        coords.push(...member.geometry.map(p => [p.lat, p.lon]));
      }
    }
    if (coords.length < 3) return null;
    console.log(`[Boundary] Overpass loaded ${coords.length} pts for ${barangay}`);
    return coords;
  } catch (err) {
    console.error('[Boundary] Overpass failed:', err);
    return null;
  }
}

export default function RouteBuilder() {
  const { official } = useAuth();
  const [waypoints, setWaypoints] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [assignedTruck, setAssignedTruck] = useState('');
  const [fleet, setFleet] = useState([]);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [searchMarker, setSearchMarker] = useState(null);
  const [cebuCityBoundary, setCebuCityBoundary] = useState(null);
  const [showCityBoundary, setShowCityBoundary] = useState(true);

  // Stable refs so callbacks never go stale
  const waypointsRef = useRef(waypoints);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  const boundaryRef = useRef(boundary);
  useEffect(() => { boundaryRef.current = boundary; }, [boundary]);

  // Fetch real barangay boundary: backend → Overpass API → hardcoded fallback
  useEffect(() => {
    if (!official?.barangay) return;
    const brgy = official.barangay;
    setBoundaryLoading(true);
    (async () => {
      // 1. Backend (admin may have saved a real boundary)
      try {
        const { data } = await axios.get(`${API}/api/barangays/${brgy}/boundary`);
        if (data.boundary?.length > 4) {
          setBoundary(data.boundary);
          setBoundaryLoading(false);
          return;
        }
      } catch { /* fall through */ }

      // 2. Overpass API — real OSM relation geometry
      const overpassCoords = await fetchBoundaryFromOverpass(brgy);
      if (overpassCoords) {
        setBoundary(overpassCoords);
        setBoundaryLoading(false);
        return;
      }

      // 3. Hardcoded approximate polygons as last resort
      const fallback = FALLBACK_BOUNDARIES[brgy] || null;
      if (fallback) console.log(`[Boundary] Using fallback polygon for ${brgy}`);
      else console.warn(`[Boundary] No boundary available for "${brgy}"`);
      setBoundary(fallback);
      setBoundaryLoading(false);
    })();
  }, [official?.barangay]);

  // Fetch Cebu City outline once on mount
  useEffect(() => {
    fetchCebuCityBoundary().then(coords => {
      setCebuCityBoundary(coords ?? CEBU_CITY_OUTLINE);
    });
  }, []);

  useEffect(() => {
    axios.get(`${API}/api/fleet`).then(r => setFleet(r.data)).catch(() => {});
    loadSavedRoutes();

    // Keyboard shortcut for Undo (Ctrl+Z)
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const { data } = await axios.get(`${API}/api/routes`);
      setSavedRoutes(data);
    } catch { /* silent */ }
  };

  // Re-calculate ORS driving route whenever waypoints change
  useEffect(() => {
    if (waypoints.length < 2) { setRouteCoords([]); return; }
    let cancelled = false;
    setRouteLoading(true);
    fetchORSRoute(waypoints).then(coords => {
      if (cancelled) return;
      setRouteCoords(coords || []);
      setRouteLoading(false);
    });
    return () => { cancelled = true; };
  }, [waypoints]);

  const handleUndo = useCallback(() => {
    setWaypoints(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
  }, []);

  const handleMapClick = useCallback(async (latlng) => {
    setSearchMarker(null); // Clear search marker on map click
    const brgy = official?.barangay;
    const currentBoundary = boundaryRef.current;
    if (brgy && currentBoundary?.length > 0) {
      if (!isInsidePolygon([latlng.lat, latlng.lng], currentBoundary)) {
        setToast({ msg: `Outside ${brgy} jurisdiction!`, type: 'error' });
        return;
      }
    }
    
    const n = waypointsRef.current.length + 1;
    let address = 'Fetching address...';
    
    // Add temporary waypoint with loading state
    const tempWp = { lat: latlng.lat, lng: latlng.lng, name: `Stop ${n}`, address };
    setWaypoints(prev => [...prev, tempWp]);

    try {
      const { data } = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`);
      address = data.display_name || 'Unknown Address';
      // Update the specific waypoint with the real address
      setWaypoints(prev => prev.map((wp, i) => i === prev.length - 1 ? { ...wp, address } : wp));
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      setWaypoints(prev => prev.map((wp, i) => i === prev.length - 1 ? { ...wp, address: 'Address unavailable' } : wp));
    }
  }, [official]);

  const removeWaypoint = (idx) => {
    setWaypoints(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Rename remaining stops to keep numbers sequential
      return next.map((w, i) => ({ ...w, name: `Stop ${i + 1}` }));
    });
  };

  const renameWaypoint = (idx, name) => {
    setWaypoints(prev => prev.map((w, i) => i === idx ? { ...w, name } : w));
  };

  const clearAll = () => {
    setWaypoints([]);
    setRouteCoords([]);
  };

  const handleSave = async () => {
    if (!routeName.trim()) { showToast('Enter a route name.', 'error'); return; }
    if (waypoints.length < 2) { showToast('Add at least 2 waypoints.', 'error'); return; }
    setSaving(true);
    try {
      const truckEntry = fleet.find(f => f.truckId === assignedTruck);
      await axios.post(`${API}/api/routes`, {
        name: routeName.trim(),
        truckId: assignedTruck || null,
        driverName: truckEntry?.driverName || '',
        waypoints,
        routeCoords,
        totalStops: waypoints.length,
      });
      showToast('Route saved successfully!', 'success');
      setRouteName('');
      setAssignedTruck('');
      clearAll();
      loadSavedRoutes();
    } catch {
      showToast('Failed to save route. Check connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async (id) => {
    try {
      await axios.delete(`${API}/api/routes/${id}`);
      setSavedRoutes(prev => prev.filter(r => r._id !== id));
    } catch { /* silent */ }
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=ph`);
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectSearchResult = (res) => {
    const latlng = { lat: parseFloat(res.lat), lng: parseFloat(res.lon) };
    setMapCenter([latlng.lat, latlng.lng]);
    setSearchMarker([latlng.lat, latlng.lng]);
    setSearchResults([]);
    setSearchQuery(res.display_name);
  };

  const n = waypoints.length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

      {/* ── Map area ─────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Status badges */}
        {boundaryLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-white border border-slate-200 shadow-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-600 font-medium">
            <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            Loading {official?.barangay} boundary…
          </div>
        )}
        {!boundaryLoading && !boundary && official?.barangay && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-amber-50 border border-amber-200 shadow-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-amber-700 font-medium">
            No boundary data found for {official.barangay} — jurisdiction check disabled
          </div>
        )}
        {!boundaryLoading && routeLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-white border border-emerald-200 shadow-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            Calculating driving route…
          </div>
        )}

        <MapContainer
          center={CEBU_CENTER}
          zoom={14}
          className="w-full h-full"
          zoomControl={true}
        >
          <MapController center={mapCenter} />
          {isSatellite ? (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            />
          ) : (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          )}
          
          {/* Cebu City outline */}
          {showCityBoundary && cebuCityBoundary && (
            <Polyline
              positions={cebuCityBoundary}
              pathOptions={{
                color: '#2563EB',
                weight: 2,
                opacity: 0.55,
                dashArray: '10, 7',
              }}
            />
          )}

          {/* Barangay jurisdiction boundary */}
          {boundary && boundary.length > 0 && (
            <Polygon
              key={boundary.length}
              positions={boundary}
              pathOptions={{
                color: '#DC2626',
                fillColor: '#DC2626',
                fillOpacity: 0.05,
                weight: 2.5,
                dashArray: '8, 6',
              }}
            />
          )}

          <MapClickHandler onClick={handleMapClick} />

           {/* Waypoint markers */}
          {waypoints.map((wp, i) => (
            <Marker
              key={i}
              position={[wp.lat, wp.lng]}
              icon={makeWaypointIcon(i + 1, i === 0, i === n - 1)}
            />
          ))}

          {/* Search Result Marker */}
          {searchMarker && (
            <Marker 
              position={searchMarker} 
              icon={L.divIcon({
                html: `
                  <div style="position: relative; width: 24px; height: 24px;">
                    <div style="position: absolute; width: 100%; height: 100%; background: #10B981; border-radius: 50%; opacity: 0.4; transform: scale(1.5); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="position: relative; width: 24px; height: 24px; background: #10B981; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; items-center; justify-content: center;">
                      <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
                    </div>
                  </div>
                  <style>
                    @keyframes ping {
                      75%, 100% { transform: scale(2.5); opacity: 0; }
                    }
                  </style>
                `,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })} 
            />
          )}

          {/* ORS driving route polyline */}
          {routeCoords.length > 0 && (
            <Polyline
              positions={routeCoords}
              color="#059669"
              weight={5}
              opacity={0.82}
            />
          )}
        </MapContainer>

        {/* Map legend */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 pointer-events-none">
          {waypoints.length === 0 && (
            <div className="bg-slate-900/80 backdrop-blur-sm text-white text-sm rounded-xl px-5 py-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              Click anywhere on the map to place stops
            </div>
          )}
          <div className="bg-white/90 backdrop-blur-sm border border-slate-200 shadow-md rounded-xl px-4 py-2.5 flex items-center gap-4 text-xs font-semibold text-slate-600">
            {showCityBoundary && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-dashed border-blue-500" />
                Cebu City
              </span>
            )}
            {boundary && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-dashed border-red-500" />
                {official?.barangay || 'Jurisdiction'}
              </span>
            )}
            {routeCoords.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-emerald-600" style={{ borderWidth: 3 }} />
                Route
              </span>
            )}
          </div>
        </div>

        {/* Map Style Toggle + City Boundary Toggle */}
        <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
          <button
            onClick={() => setIsSatellite(!isSatellite)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-md ${
              isSatellite
                ? 'bg-emerald-600 text-white border border-emerald-500'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            {isSatellite ? 'Satellite' : 'Standard'}
          </button>

          <button
            onClick={() => setShowCityBoundary(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-md ${
              showCityBoundary
                ? 'bg-blue-600 text-white border border-blue-500'
                : 'bg-white/90 text-slate-500 border border-slate-200 hover:bg-white'
            }`}
          >
            <Route className="w-4 h-4" />
            City Outline
          </button>
        </div>

        {/* Address Search Bar */}
        <div className="absolute top-4 left-[60px] z-[500] w-80">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              {searchLoading ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <input
              type="text"
              className="w-full bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              placeholder="Search address or landmark..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => selectSearchResult(res)}
                    className="w-full px-5 py-3.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-start gap-3"
                  >
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Control panel ────────────────────────── */}
      <div className="w-[320px] bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-sm">

        {/* Panel header */}
        <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Route className="w-4 h-4 text-emerald-700" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Route Builder</h2>
          </div>
          <p className="text-xs text-slate-500 ml-10">Click the map to place collection stops</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Route name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Route Name
            </label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="e.g. Lahug North – Morning Run"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
            />
          </div>

          {/* Assign to truck */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Assign to Truck
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition"
              value={assignedTruck}
              onChange={e => setAssignedTruck(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {fleet.map(f => (
                <option key={f.truckId} value={f.truckId}>
                  {f.truckId} · {f.driverName}
                </option>
              ))}
            </select>
          </div>

          {/* Waypoints list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Waypoints ({n})
              </span>
              {n > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear all
                  </button>
                </div>
              )}
            </div>

            {n === 0 ? (
              <div className="flex flex-col items-center py-7 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <Navigation className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-sm">No stops added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                    {/* Number badge */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: i === 0 ? '#059669' : i === n - 1 ? '#DC2626' : '#2563EB' }}
                    >
                      {i + 1}
                    </div>
                    {/* Editable name & address */}
                    <div className="flex-1 min-w-0">
                      <input
                        className="w-full text-sm font-bold text-slate-700 bg-transparent border-none outline-none truncate"
                        value={wp.name}
                        onChange={e => renameWaypoint(i, e.target.value)}
                      />
                      <p className="text-[10px] text-slate-400 truncate italic">
                        {wp.address || 'Locating...'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeWaypoint(i)}
                      className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || n < 2 || !routeName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {saving ? 'Saving…' : 'Save Route'}
          </button>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Saved routes */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Saved Routes ({savedRoutes.length})
            </h3>
            {savedRoutes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-5">No routes saved yet</p>
            ) : (
              <div className="space-y-2">
                {savedRoutes.map(r => (
                  <div key={r._id} className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3.5 transition-colors group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{r.name}</p>
                      <button
                        onClick={() => handleDeleteRoute(r._id)}
                        className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {r.totalStops} stops
                      </span>
                      {r.truckId ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Truck className="w-3 h-3" />
                          {r.truckId}
                          {r.driverName ? ` · ${r.driverName}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`mx-4 mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium flex-shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
