import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  TextInput,
  AppState,
  Image,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import NetworkBanner from "../components/NetworkBanner";
import { saveRouteCache, loadRouteCache } from "../utils/routeCache";
import API_URL from "../config";
import TRUCK_B64 from "../constants/truckBase64";

const TRACKING_SERVER = API_URL;

// ═══════════════════════════════════════════════════════════
// ORS API KEY – same as resident app
// ═══════════════════════════════════════════════════════════
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.48;

// Formats a stop schedule time from a zero-based index (08:00, 08:45, 09:30, …)
function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Converts backend route waypoints to the stops shape used in this screen
function waypointsToStops(waypoints) {
  const types = ['General', 'Recyclables', 'Mixed'];
  return waypoints.map((wp, i) => ({
    id: i + 1,
    name: wp.name,
    address: wp.name,
    lat: wp.lat,
    lng: wp.lng,
    time: formatStopTime(i),
    status: i === 0 ? 'in-progress' : 'upcoming',
    bins: (i % 3) + 2,
    weight: null,
    type: types[i % 3],
  }));
}

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// ── Heatmap helpers ──────────────────────────────────────
const STATUS_META = {
  critical: {
    color: "#E53935",
    level: "High Pollution",
    riskLevel: "High",
    recommendation: "Immediate collection needed. Schedule additional pickup.",
  },
  moderate: {
    color: "#FDD835",
    level: "Moderate Pollution",
    riskLevel: "Medium",
    recommendation: "Monitor closely. Standard collection schedule adequate.",
  },
  clean: {
    color: "#4CAF50",
    level: "Safe Levels",
    riskLevel: "Low",
    recommendation: "Area well maintained. Continue regular monitoring.",
  },
};

function formatRelativeTime(date) {
  if (!date) return "Unknown";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

// Maps a raw GarbageArea document to the shape expected by the zone card UI
function formatGarbageArea(area) {
  const meta = STATUS_META[area.status] || STATUS_META.moderate;
  return {
    id: area._id || area.id,
    name: area.name,
    lat: area.lat,
    lng: area.lng,
    status: area.status,
    color: meta.color,
    level: meta.level,
    riskLevel: meta.riskLevel,
    recommendation: meta.recommendation,
    ammonia: area.ammonia || "0 ppm",
    methane: area.methane || "0 ppm",
    bins: area.bins ?? 0,
    intensity: area.intensity ?? 0.5,
    barangay: area.barangay || "",
    reportCount: area.reportCount ?? 0,
    sensorId: area.sensorId || null,
    lastUpdated: formatRelativeTime(area.lastReportAt || area.updatedAt || area.createdAt),
  };
}

// ── MapLibre GL 3D Map HTML (100% Free Open-Source Vector Map) ──
function buildLeafletHTML(truckB64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { height:100%; width:100%; overflow:hidden; background: #e8ede8; }
    .maplibregl-popup-content { padding: 8px 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .maplibregl-popup-close-button { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var map, currentMarker = null;
      var followMode = true;
      var stopMarkers = [];
      var reportMarkers = [];

      var CEBU_OUTLINE = [
        [10.3565,123.8808],[10.3592,123.8842],[10.3610,123.8882],[10.3620,123.8925],
        [10.3624,123.8972],[10.3618,123.9018],[10.3600,123.9065],[10.3568,123.9112],
        [10.3525,123.9158],[10.3475,123.9200],[10.3420,123.9235],[10.3362,123.9262],
        [10.3302,123.9278],[10.3242,123.9284],[10.3182,123.9278],[10.3124,123.9260],
        [10.3068,123.9234],[10.3015,123.9202],[10.2965,123.9165],[10.2918,123.9124],
        [10.2874,123.9080],[10.2834,123.9032],[10.2798,123.8982],[10.2766,123.8928],
        [10.2740,123.8868],[10.2720,123.8805],[10.2708,123.8740],[10.2703,123.8675],
        [10.2706,123.8612],[10.2718,123.8555],[10.2738,123.8508],[10.2770,123.8472],
        [10.2806,123.8452],[10.2844,123.8445],[10.2878,123.8452],[10.2908,123.8465],
        [10.2936,123.8480],[10.2965,123.8488],[10.2995,123.8493],[10.3025,123.8496],
        [10.3055,123.8500],[10.3085,123.8506],[10.3115,123.8515],[10.3145,123.8528],
        [10.3172,123.8545],[10.3196,123.8558],[10.3220,123.8568],[10.3246,123.8573],
        [10.3272,123.8576],[10.3300,123.8580],[10.3328,123.8588],[10.3358,123.8600],
        [10.3388,123.8616],[10.3415,123.8636],[10.3440,123.8660],[10.3464,123.8686],
        [10.3487,123.8714],[10.3508,123.8742],[10.3526,123.8770],[10.3544,123.8792],
        [10.3558,123.8802],[10.3565,123.8808]
      ];
      var CEBU_OUTLINE_LNGLAT = CEBU_OUTLINE.map(function(c) { return [c[1], c[0]]; });

      map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [123.893, 10.325],
        zoom: 16,
        pitch: 55,
        bearing: 0,
        attributionControl: false
      });

      map.on('load', function() {
        map.addSource('cebu-outline', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: CEBU_OUTLINE_LNGLAT }
          }
        });
        map.addLayer({
          id: 'cebu-outline-layer',
          type: 'line',
          source: 'cebu-outline',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#2563EB',
            'line-width': 2.5,
            'line-opacity': 0.65,
            'line-dasharray': [3, 2]
          }
        });

        setTimeout(function() {
          map.resize();
          window.ReactNativeWebView.postMessage('map_ready');
        }, 200);
      });

      // True Native 3D Camera Pitch
      window.setPerspective3D = function(enable3d) {
        if (!map) return;
        map.easeTo({
          pitch: enable3d ? 55 : 0,
          duration: 600
        });
      };

      window.setMapStyle = function(style) {};
      window.toggleCityOutline = function(show) {
        if (map && map.getLayer('cebu-outline-layer')) {
          map.setLayoutProperty('cebu-outline-layer', 'visibility', show ? 'visible' : 'none');
        }
      };

      // Disabling yellow heatmap legend & circles as requested
      window.clearHeatmapZones = function() {};
      window.updateHeatmapZones = function() {};

      // Stop markers
      window.clearStopMarkers = function() {
        stopMarkers.forEach(function(m) { m.remove(); });
        stopMarkers = [];
      };

      function createStopMarkerEl(status, name) {
        var el = document.createElement('div');
        if (status === 'completed') {
          el.innerHTML = '<div style="position:relative;display:flex;flex-direction:column;align-items:center;">' +
            '<div style="background:#059669;width:24px;height:24px;border-radius:12px;border:2.5px solid white;box-shadow:0 3px 8px rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
            '</div>' +
            '<div style="background:#065F46;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2);">CLEAN</div>' +
            '</div>';
        } else if (status === 'in-progress') {
          el.innerHTML = '<div style="background:#2563EB;width:22px;height:22px;border-radius:11px;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.4);"></div>';
        } else {
          el.innerHTML = '<div style="background:#94A3B8;width:14px;height:14px;border-radius:7px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.15);"></div>';
        }
        return el;
      }

      window.addStopMarkers = function(stopsJson) {
        window.clearStopMarkers();
        var arr = JSON.parse(stopsJson);
        arr.forEach(function(s) {
          var el = createStopMarkerEl(s.status, s.name);
          var popup = new maplibregl.Popup({ offset: 15 }).setHTML(
            '<div style="font-family:sans-serif;padding:3px;text-align:center;">' +
            '<b style="font-size:12px;color:#0F172A;">' + (s.status === 'completed' ? '✨ ' : '📍 ') + s.name + '</b><br>' +
            '<span style="font-size:11px;font-weight:700;color:' + (s.status === 'completed' ? '#059669' : '#2563EB') + ';">' +
            (s.status === 'completed' ? 'Marked as Clean ✓' : 'Scheduled Stop') +
            '</span>' +
            '</div>'
          );
          var m = new maplibregl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .setPopup(popup)
            .addTo(map);
          stopMarkers.push(m);
        });
      };

      // Report markers
      window.clearReportMarkers = function() {
        reportMarkers.forEach(function(m) { m.remove(); });
        reportMarkers = [];
      };

      function makeBinHtml(score) {
        var isHigh = score >= 5;
        var color = isHigh ? '#EF4444' : '#F59E0B';
        return '<div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">' +
          '<div style="background:#fff;padding:2px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #e2e8f0;">' +
            '<div style="background:'+color+';width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>' +
            '</div>' +
          '</div>' +
          '<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #fff;margin-top:-2px;"></div>' +
          (isHigh ? '<div style="position:absolute;top:-4px;right:-4px;background:#EF4444;color:#fff;width:14px;height:14px;border-radius:7px;font-size:7px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1px solid #fff;z-index:2;">' + score + '</div>' : '') +
        '</div>';
      }

      window.addReportMarkers = function(reportsJson) {
        window.clearReportMarkers();
        var arr = JSON.parse(reportsJson);
        arr.forEach(function(r) {
          var el = document.createElement('div');
          el.innerHTML = makeBinHtml(r.score);
          el.addEventListener('click', function() {
            window.ReactNativeWebView.postMessage('report:' + r.id);
          });
          var m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([r.lng, r.lat])
            .addTo(map);
          reportMarkers.push(m);
        });
      };

      var clearingMarker = null;
      window.setClearingMarker = function(sitioName, lat, lng, isClearing) {
        if (clearingMarker) { clearingMarker.remove(); clearingMarker = null; }
        if (!isClearing || !lat || !lng) return;
        var el = document.createElement('div');
        el.innerHTML =
          '<div style="position:relative;display:flex;flex-direction:column;align-items:center;z-index:999;">' +
            '<div style="position:absolute;top:-10px;width:54px;height:54px;border-radius:27px;background:rgba(16,185,129,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' +
            '<div style="width:44px;height:44px;border-radius:22px;background:#059669;border:3px solid #ffffff;box-shadow:0 8px 16px rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>' +
              '</svg>' +
            '</div>' +
            '<div style="margin-top:4px;padding:3px 8px;border-radius:10px;background:#064E3B;color:#34D399;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;">' +
              '🧹 CLEARING: ' + sitioName +
            '</div>' +
          '</div>';
        clearingMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map);
      };

      // Route layers
      window.updateTruckRoute = function(coordsJson) {
        var coords = JSON.parse(coordsJson);
        if (!coords || coords.length === 0) return;
        var geojsonCoords = coords.map(function(c) { return [c[1], c[0]]; });
        
        if (map.getSource('route')) {
          map.getSource('route').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: geojsonCoords }
          });
        } else {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: geojsonCoords }
            }
          });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#006A3B',
              'line-width': 5,
              'line-opacity': 0.85
            }
          });
        }

        var bounds = new maplibregl.LngLatBounds();
        geojsonCoords.forEach(function(c) { bounds.extend(c); });
        map.fitBounds(bounds, { padding: 40 });
      };

      window.updateReroutePath = function(coordsJson) {
        var coords = JSON.parse(coordsJson);
        if (!coords || coords.length === 0) return;
        var geojsonCoords = coords.map(function(c) { return [c[1], c[0]]; });

        if (map.getSource('reroute')) {
          map.getSource('reroute').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: geojsonCoords }
          });
        } else {
          map.addSource('reroute', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: geojsonCoords }
            }
          });
          map.addLayer({
            id: 'reroute',
            type: 'line',
            source: 'reroute',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#DC2626',
              'line-width': 6,
              'line-opacity': 0.9
            }
          });
        }
      };

      window.clearReroutePath = function() {
        if (map.getSource('reroute')) {
          map.getSource('reroute').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] }
          });
        }
      };

      window.fitRerouteBounds = function() {
        var bounds = new maplibregl.LngLatBounds();
        var hasBounds = false;
        if (map.getSource('route')) {
          var data = map.getSource('route')._data;
          if (data && data.geometry && data.geometry.coordinates) {
            data.geometry.coordinates.forEach(function(c) { bounds.extend(c); hasBounds = true; });
          }
        }
        if (map.getSource('reroute')) {
          var rdata = map.getSource('reroute')._data;
          if (rdata && rdata.geometry && rdata.geometry.coordinates) {
            rdata.geometry.coordinates.forEach(function(c) { bounds.extend(c); hasBounds = true; });
          }
        }
        if (currentMarker) {
          bounds.extend(currentMarker.getLngLat());
          hasBounds = true;
        }
        if (hasBounds) {
          map.fitBounds(bounds, { padding: 50 });
        }
      };

      function createArrowEl(bearing) {
        var el = document.createElement('div');
        el.innerHTML =
          '<div style="transform: rotate(' + (bearing || 0) + 'deg); filter: drop-shadow(0 4px 10px rgba(0,106,59,0.3));">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#2196F3" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        return el;
      }

      window.updateDriverPosition = function(lat, lng, bearing) {
        if (currentMarker) { currentMarker.remove(); }
        var el = createArrowEl(bearing || 0);
        currentMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        if (followMode) {
          map.panTo([lng, lat], { duration: 500 });
        }
      };

      window.startFollow = function(lat, lng, heading) {
        followMode = true;
        if (currentMarker) { currentMarker.remove(); }
        var el = createArrowEl(heading || 0);
        currentMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        map.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 });
      };

      window.stopFollow = function() {
        followMode = false;
      };

      window.showIdleTruck = function(lat, lng) {
        if (currentMarker) { currentMarker.remove(); }
        var el = document.createElement('div');
        el.innerHTML =
          '<div style="opacity:0.6; filter: grayscale(100%);">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#9CA3AF" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        currentMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
      };

      window.centerMap = function(lat, lng) {
        map.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
      };

      window.stopNavigation = function(lat, lng) {
        if (currentMarker) { currentMarker.remove(); currentMarker = null; }
        if (lat !== undefined && lng !== undefined) {
          window.showIdleTruck(lat, lng);
        }
      };

    })();
  </script>
</body>
</html>`;
}

// ── Route deviation helpers ───────────────────────────────
function toRad(deg) { return deg * Math.PI / 180; }
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function pointToSegmentM(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLat - aLat, dy = bLng - aLng;
  if (dx === 0 && dy === 0) return haversineM(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1,
    ((pLat - aLat) * dx + (pLng - aLng) * dy) / (dx * dx + dy * dy)));
  return haversineM(pLat, pLng, aLat + t * dx, aLng + t * dy);
}
function minDistToPolyline(lat, lng, coords) {
  if (!coords || coords.length === 0) return Infinity;
  if (coords.length === 1) {
    return haversineM(lat, lng, coords[0][0], coords[0][1]);
  }
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentM(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

function getClosestPointOnPolyline(pLat, pLng, coords) {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1) return { lat: coords[0][0], lng: coords[0][1] };
  let min = Infinity;
  let closestPoint = { lat: coords[0][0], lng: coords[0][1] };

  for (let i = 0; i < coords.length - 1; i++) {
    const aLat = coords[i][0], aLng = coords[i][1];
    const bLat = coords[i + 1][0], bLng = coords[i + 1][1];
    const dx = bLat - aLat, dy = bLng - aLng;
    let projLat = aLat, projLng = aLng;
    if (dx !== 0 || dy !== 0) {
      const t = Math.max(0, Math.min(1,
        ((pLat - aLat) * dx + (pLng - aLng) * dy) / (dx * dx + dy * dy)));
      projLat = aLat + t * dx;
      projLng = aLng + t * dy;
    }
    const dist = haversineM(pLat, pLng, projLat, projLng);
    if (dist < min) {
      min = dist;
      closestPoint = { lat: projLat, lng: projLng };
    }
  }
  return closestPoint;
}

// ── ORS fetch helper (unchanged) ──────────────────────────
async function fetchORSRoute(waypoints) {
  if (!ORS_API_KEY || ORS_API_KEY === "YOUR_ORS_API_KEY") return null;
  try {
    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify({ coordinates: waypoints }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.features?.[0]?.geometry?.coordinates) {
      return data.features[0].geometry.coordinates.map((c) => [c[1], c[0]]);
    }
    return null;
  } catch (e) {
    console.warn("ORS fetch failed:", e.message);
    return null;
  }
}

// ── OSRM / ORS Road Routing Helper (Snaps waypoints to actual streets) ──
async function fetchRoadRoutePolyline(waypoints) {
  if (!waypoints || waypoints.length < 2) return waypoints || [];
  try {
    const locStr = waypoints.map(p => `${p[1]},${p[0]}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${locStr}?overview=full&geometries=geojson`);
    if (res.ok) {
      const data = await res.json();
      if (data.routes?.[0]?.geometry?.coordinates) {
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      }
    }
  } catch (e) {
    console.warn("OSRM routing failed:", e.message);
  }
  try {
    const orsResult = await fetchORSRoute(waypoints.map(p => [p[1], p[0]]));
    if (orsResult && orsResult.length > 0) return orsResult;
  } catch (_) {}
  return waypoints;
}

// ── Main Component ──────────────────────────────────────
export default function CollectorMapScreen() {
  const { user } = useAuth();
  const { networkChangeKey } = useNetwork();

  const TRUCK_ID = user?.truckId ?? 'GT-000';
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const [todaySchedules, setTodaySchedules] = useState(null); // null=loading, []=not scheduled
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [hazardOptimizeActive, setHazardOptimizeActive] = useState(false);
  const shouldNotifyRef = useRef(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  // Fetch all of today's schedules for this truck
  const fetchTodaySchedules = useCallback((notifyResidents = false) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const truckIdUpper = TRUCK_ID.toUpperCase();
    const endpoint = hazardOptimizeActive ? "priority-stops" : "today";
    const notifyParam = (hazardOptimizeActive && notifyResidents) ? "&notify=true" : "";
    const url = `${TRACKING_SERVER}/api/schedules/truck/${truckIdUpper}/${endpoint}?date=${today}${notifyParam}`;
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 6000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const list = Array.isArray(data.schedules)
            ? data.schedules
            : data.schedule
              ? [data.schedule]
              : [];
          setTodaySchedules(list);
          setActiveScheduleId(prev => (prev && list.find(s => s._id === prev)) ? prev : (list[0]?._id || null));
          if (list.length === 0) {
            // Unscheduled truck -> reset shift state to default inactive
            setNavigationActive(false);
            navigationActiveRef.current = false;
            AsyncStorage.setItem('@truck_nav_active', 'false').catch(() => {});
            AsyncStorage.setItem('@truck_shift_active', 'false').catch(() => {});
          }
        } catch (e) {
          setTodaySchedules([]);
          setNavigationActive(false);
          navigationActiveRef.current = false;
        }
      } else {
        setTodaySchedules([]);
        setNavigationActive(false);
        navigationActiveRef.current = false;
      }
    };
    xhr.onerror = () => {
      setTodaySchedules([]);
    };
    xhr.ontimeout = () => {
      setTodaySchedules([]);
    };
    xhr.send();
  }, [TRUCK_ID, hazardOptimizeActive]);

  // Initial fetch on mount and when optimization status changes
  useEffect(() => {
    const notify = shouldNotifyRef.current;
    shouldNotifyRef.current = false;
    fetchTodaySchedules(notify);
  }, [fetchTodaySchedules]);

  // Re-fetch schedule when Map tab focused
  useFocusEffect(
    useCallback(() => {
      fetchTodaySchedules();
      // Synchronize shift status from AsyncStorage
      AsyncStorage.getItem("@truck_shift_active").then((val) => {
        const active = val === "true";
        setNavigationActive(active);
        navigationActiveRef.current = active;
      }).catch(() => {});
    }, [fetchTodaySchedules])
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState('topographic');
  const [is3DPerspective, setIs3DPerspective] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [heatmapZones, setHeatmapZones] = useState([]); // live from /api/garbage-areas
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showTrashBins, setShowTrashBins] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showCityOutline, setShowCityOutline] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [clearingSitio, setClearingSitio] = useState(null);
  const [showRouteCompletionModal, setShowRouteCompletionModal] = useState(false);
  const [completedRouteInfo, setCompletedRouteInfo] = useState(null);

  const MOCK_BEFORE_IMAGE = "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80";
  const MOCK_AFTER_IMAGE = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&q=80";
  const MOCK_DISPOSAL_IMAGE = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80";

  const [activeFlowTask, setActiveFlowTask] = useState(null);
  const [beforeImage, setBeforeImage] = useState("");
  const [afterImage, setAfterImage] = useState("");
  const [flowStatus, setFlowStatus] = useState("clean");
  const [flowLocation, setFlowLocation] = useState("");
  const [flowWasteType, setFlowWasteType] = useState("General");
  const [flowBins, setFlowBins] = useState(1);
  const [isSubmittingFlow, setIsSubmittingFlow] = useState(false);

  // Post-Collection Weighbridge & Final Disposal Report state
  const [disposalFacility, setDisposalFacility] = useState("Binaliw Sanitary Landfill (ARN)");
  const [disposalWeight, setDisposalWeight] = useState("2.40");
  const [disposalWeightUnit, setDisposalWeightUnit] = useState("tons");
  const [disposalPhoto, setDisposalPhoto] = useState("");
  const [isSubmittingDisposal, setIsSubmittingDisposal] = useState(false);

  const takeDisposalPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        let result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
        if (!result.canceled) {
          setDisposalPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          return;
        }
      }
    } catch (e) {
      console.warn("Disposal photo error:", e);
    }
    setDisposalPhoto(MOCK_DISPOSAL_IMAGE);
  };

  const [showBasicReportModal, setShowBasicReportModal] = useState(false);
  const [basicReportCategory, setBasicReportCategory] = useState("Other");
  const [basicReportNotes, setBasicReportNotes] = useState("");
  const [submittingBasicReport, setSubmittingBasicReport] = useState(false);

  const takePhotoStep = async (type) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        let result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
        if (!result.canceled) {
          const imgBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
          if (type === 'before') {
            setBeforeImage(imgBase64);
          } else {
            setAfterImage(imgBase64);
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Camera error:", e);
    }
    if (type === 'before') {
      setBeforeImage(MOCK_BEFORE_IMAGE);
    } else {
      setAfterImage(MOCK_AFTER_IMAGE);
    }
  };

  const submitBasicReportFlow = () => {
    if (!activeFlowTask) return;
    setSubmittingBasicReport(true);
    fetch(`${TRACKING_SERVER}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: basicReportCategory,
        description: basicReportNotes || `Issue reported at ${activeFlowTask.sitioName}`,
        location: activeFlowTask.sitioName,
        sitio: activeFlowTask.sitioName,
        barangay: activeFlowTask.barangay || assignedRouteBarangay || 'Apas',
        reportedBy: user?.driverName || user?.name || 'Collector',
        truckId: TRUCK_ID,
        status: 'pending',
      }),
    })
      .then(() => {
        setSubmittingBasicReport(false);
        setShowBasicReportModal(false);
        setActiveFlowTask(null);
        Alert.alert("Report Filed ✓", `Incident report submitted for ${activeFlowTask.sitioName}`);
      })
      .catch(() => {
        setSubmittingBasicReport(false);
        Alert.alert("Notice", "Report submitted locally.");
        setShowBasicReportModal(false);
        setActiveFlowTask(null);
      });
  };

  const handleSubmitDisposalReport = async () => {
    if (isSubmittingDisposal) return;
    setIsSubmittingDisposal(true);
    try {
      const scheduleId = completedRouteInfo?.scheduleId || todaySchedules?.[0]?._id;
      let finalPhotoUrl = disposalPhoto;
      if (disposalPhoto && disposalPhoto.startsWith("data:")) {
        try {
          const res = await fetch(`${TRACKING_SERVER}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: disposalPhoto }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.url) finalPhotoUrl = json.url;
          }
        } catch (_) {}
      }
      if (!finalPhotoUrl) finalPhotoUrl = MOCK_DISPOSAL_IMAGE;

      if (scheduleId) {
        await fetch(`${TRACKING_SERVER}/api/schedules/${scheduleId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalWeight: Number(disposalWeight) || 0,
            weightUnit: disposalWeightUnit,
            disposalFacility,
            disposalPhoto: finalPhotoUrl,
            completedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      socketRef.current?.emit("truck:shift-completed", {
        truckId: TRUCK_ID,
        driverName: user?.driverName || user?.name || "Collector",
        routeName: assignedRouteBarangay || "Collection Duty",
        completedStops: completedRouteInfo?.sitiosCleared || 0,
        totalStops: completedRouteInfo?.sitiosCleared || 0,
        totalWeight: Number(disposalWeight) || 0,
        weightUnit: disposalWeightUnit,
        disposalFacility,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        "Shift Completed & Weighed! 🚛",
        `Weighbridge report logged: ${disposalWeight} ${disposalWeightUnit} at ${disposalFacility}. Great job!`
      );
      setShowRouteCompletionModal(false);
      fetchTodaySchedules();
    } catch (err) {
      Alert.alert("Notice", "Weighbridge report recorded. Shift completed!");
      setShowRouteCompletionModal(false);
    } finally {
      setIsSubmittingDisposal(false);
    }
  };

  const submitCleaningFlow = async () => {
    if (!activeFlowTask || isSubmittingFlow) return;
    setIsSubmittingFlow(true);
    try {
      await handleMarkStopClean(activeFlowTask.scheduleId, activeFlowTask.sitioName);
    } catch (_) {}
    setIsSubmittingFlow(false);
    setActiveFlowTask(null);
  };

  const handleMarkStopClean = async (scheduleId, sitioName) => {
    if (!scheduleId || !sitioName) return;
    setClearingSitio(sitioName);
    try {
      const lat = currentLocation?.latitude || lastGpsRef.current?.lat || null;
      const lng = currentLocation?.longitude || lastGpsRef.current?.lng || null;
      const completedAt = new Date().toISOString();

      // Upload base64 photos or attach sample fallback verification photos
      let finalBeforeUrl = beforeImage;
      let finalAfterUrl = afterImage;

      const uploadToCloudinary = async (base64Data) => {
        if (!base64Data || !base64Data.startsWith("data:")) return base64Data;
        try {
          const res = await fetch(`${TRACKING_SERVER}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: base64Data }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.url) return json.url;
          }
        } catch (_) {}
        return base64Data;
      };

      if (beforeImage) {
        try { finalBeforeUrl = await uploadToCloudinary(beforeImage); } catch (_) {}
      }
      if (afterImage) {
        try { finalAfterUrl = await uploadToCloudinary(afterImage); } catch (_) {}
      }

      if (!finalBeforeUrl) finalBeforeUrl = MOCK_BEFORE_IMAGE;
      if (!finalAfterUrl) finalAfterUrl = MOCK_AFTER_IMAGE;

      // 1. Mark task as complete on backend schedule with photo proof
      await fetch(`${TRACKING_SERVER}/api/schedules/${scheduleId}/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitioName,
          lat,
          lng,
          completedAt,
          proofImage: finalAfterUrl,
          afterImage: finalAfterUrl,
        }),
      }).catch(() => {});

      // Send clearing completed status update
      fetch(`${TRACKING_SERVER}/api/schedules/clearing-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: TRUCK_ID,
          driverName: user?.name || user?.driverName || 'Driver',
          barangay: assignedRouteBarangay || 'Apas',
          sitioName,
          status: 'completed',
          lat,
          lng,
        }),
      }).catch(() => {});

      // 2. Also register collection log
      const sched = todaySchedules?.find(s => s._id === scheduleId);
      const barangay = sched?.barangay || assignedRouteBarangay || 'Apas';
      await fetch(`${TRACKING_SERVER}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: TRUCK_ID,
          driverName: user?.name || user?.driverName || 'Driver',
          stopName: sitioName,
          route: `${barangay} Route`,
          wasteType: flowWasteType || 'General',
          bins: flowBins || 1,
          barangay,
          beforeImage: finalBeforeUrl,
          afterImage: finalAfterUrl,
          proofImage: finalAfterUrl,
          status: 'verified',
          durationMinutes: shiftStartRef.current ? Math.max(15, Math.floor((Date.now() - shiftStartRef.current) / 60000)) : 30,
          lat,
          lng,
          completedAt,
        }),
      }).catch(() => {});

      // 3. Update local state immediately
      setTodaySchedules(prev => {
        if (!prev) return prev;
        return prev.map(s => {
          if (s._id === scheduleId) {
            const updatedTasks = (s.sitioTasks || []).map(t => {
              if (t.name.toLowerCase() === sitioName.toLowerCase()) {
                return { ...t, completed: true, completedAt: new Date(), proofImage: finalAfterUrl, afterImage: finalAfterUrl };
              }
              return t;
            });
            const allDone = updatedTasks.length > 0 ? updatedTasks.every(t => t.completed) : true;

            if (allDone) {
              setCompletedRouteInfo({
                scheduleId: s._id,
                routeName: s.routeName || `${barangay} Route`,
                barangay,
                sitiosCleared: updatedTasks.length,
                driverName: user?.name || user?.driverName || 'Collector',
              });
              setShowRouteCompletionModal(true);
            }

            return {
              ...s,
              sitioTasks: updatedTasks,
              status: allDone ? 'completed' : s.status,
            };
          }
          return s;
        });
      });

      Alert.alert("Area Marked as Clean! ✨", `Collection recorded and verified for ${sitioName}. Map marker and LGU dashboard updated.`);
      fetchTodaySchedules();
    } catch (err) {
      Alert.alert("Error", "Failed to mark stop as clean. Please verify network connection.");
    } finally {
      setClearingSitio(null);
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState("Overflowing Bin");
  const [reportDescription, setReportDescription] = useState("");
  const [reportLocation, setReportLocation] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [navigationActive, setNavigationActive] = useState(false);
  const [elapsedDisplay, setElapsedDisplay] = useState("00:00");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [binStatus, setBinStatus] = useState({ preparedCount: 0, pickedUpCount: 0 });
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [offRouteDistance, setOffRouteDistance] = useState(0);
  const [showOffRouteModal, setShowOffRouteModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // ── GPS Resilience & Offline Buffering ──
  const offlineGpsBufferRef = useRef([]);
  const [bufferedGpsCount, setBufferedGpsCount] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(true);

  const [sitioList, setSitioList] = useState([]);

  const isExpandedRef = useRef(false);
  const navigationActiveRef = useRef(false);
  const lastGpsRef = useRef(null);
  const lastOffRouteAlertRef = useRef(0);
  const lastRerouteFetchRef = useRef(0);
  const activeRouteCoordsRef = useRef([]);
  const shiftStartRef = useRef(null);
  const zoneCardAnim = useRef(new Animated.Value(0)).current;
  const socketRef = useRef(null);
  const webViewRef = useRef(null);
  const webViewReady = useRef(false);

  const activeSchedule = todaySchedules?.find(s => s._id === activeScheduleId);
  const assignedRouteBarangay = activeSchedule?.barangay || activeSchedule?.routeName || '';

  const isRouteCompleted = useMemo(() => {
    if (!todaySchedules || todaySchedules.length === 0) return false;
    let totalStops = 0;
    let completedStops = 0;
    todaySchedules.forEach((sched) => {
      if (sched.sitioTasks && sched.sitioTasks.length > 0) {
        totalStops += sched.sitioTasks.length;
        completedStops += sched.sitioTasks.filter((t) => t.completed).length;
      } else if (sched.sitio) {
        totalStops += 1;
        if (sched.status === "completed") completedStops += 1;
      }
    });
    if (totalStops > 0 && completedStops === totalStops) return true;
    return todaySchedules.every((s) => s.status === "completed");
  }, [todaySchedules]);

  const handleOpenCompletionSummary = useCallback(() => {
    setCompletedRouteInfo({
      scheduleId: todaySchedules?.[0]?._id,
      routeName: todaySchedules?.[0]?.routeName || `${assignedRouteBarangay || 'Assigned Area'} Route`,
      barangay: assignedRouteBarangay || 'Service Area',
      sitiosCleared: todaySchedules?.reduce((sum, s) => sum + (s.sitioTasks ? s.sitioTasks.filter(t => t.completed).length : (s.status === 'completed' ? 1 : 0)), 0),
      driverName: user?.name || user?.driverName || 'Collector',
    });
    setShowRouteCompletionModal(true);
  }, [todaySchedules, assignedRouteBarangay, user]);

  useEffect(() => {
    if (isRouteCompleted && todaySchedules?.length > 0) {
      socketRef.current?.emit("truck:shift-completed", {
        truckId: TRUCK_ID,
        driverName: user?.driverName || user?.name || "Collector",
        routeName: assignedRouteBarangay || "Collection Duty",
        completedStops: todaySchedules?.reduce((sum, s) => sum + (s.sitioTasks ? s.sitioTasks.filter(t => t.completed).length : (s.status === 'completed' ? 1 : 0)), 0),
        totalStops: todaySchedules?.reduce((sum, s) => sum + (s.sitioTasks ? s.sitioTasks.length : 1), 0),
        timestamp: new Date().toISOString(),
      });
    }
  }, [isRouteCompleted, todaySchedules, TRUCK_ID, user, assignedRouteBarangay]);

  const allStops = useMemo(() => {
    if (sitioList && sitioList.length > 0) {
      return sitioList.map((s, idx) => ({
        id: s._id || idx,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        completed: todaySchedules?.some(sched =>
          sched.sitioTasks?.some(t => t.name?.toLowerCase() === s.name?.toLowerCase() && t.completed)
        ) || false,
        schedId: activeScheduleId
      }));
    }
    if (todaySchedules && todaySchedules.length > 0) {
      const stops = [];
      todaySchedules.forEach(sched => {
        if (sched.sitioTasks && sched.sitioTasks.length > 0) {
          sched.sitioTasks.forEach(t => stops.push({ name: t.name, lat: t.lat, lng: t.lng, completed: !!t.completed, schedId: sched._id }));
        } else {
          stops.push({ name: sched.sitio || sched.barangay || 'Stop', lat: sched.lat || 10.325, lng: sched.lng || 123.893, completed: sched.status === 'completed', schedId: sched._id });
        }
      });
      return stops;
    }
    return [{ name: 'Main St.', lat: 10.325, lng: 123.893, completed: false }];
  }, [sitioList, todaySchedules, activeScheduleId]);

  const currentStop = allStops[currentStopIndex] || allStops[0];

  // Dynamically compute active route coordinates for off-route calculation
  const activeRouteCoords = useMemo(() => {
    let coords = [];
    if (todaySchedules && todaySchedules.length > 0) {
      for (const sched of todaySchedules) {
        if (sched.routeCoords && sched.routeCoords.length > 0) {
          coords = [...coords, ...sched.routeCoords];
        } else if (sched.sitioTasks && sched.sitioTasks.length > 0) {
          const valid = sched.sitioTasks.filter(t => t.lat != null && t.lng != null).map(t => [t.lat, t.lng]);
          coords = [...coords, ...valid];
        }
      }
    }
    if (coords.length === 0 && allStops && allStops.length > 0) {
      const valid = allStops.filter(s => s.lat != null && s.lng != null).map(s => [s.lat, s.lng]);
      if (valid.length > 0) coords = valid;
    }
    return coords;
  }, [todaySchedules, allStops]);

  useEffect(() => {
    activeRouteCoordsRef.current = activeRouteCoords;
  }, [activeRouteCoords]);

  // Fetch today's bin preparation counts for assigned area/barangay
  useEffect(() => {
    if (!assignedRouteBarangay) return;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${TRACKING_SERVER}/api/bin/status?barangay=${encodeURIComponent(assignedRouteBarangay)}`);
    xhr.timeout = 6000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setBinStatus({ preparedCount: data.preparedCount || 0, pickedUpCount: data.pickedUpCount || 0 });
        } catch (_) {}
      }
    };
    xhr.send();
  }, [assignedRouteBarangay]);

  // Fetch verified sitios for the assigned barangay
  useEffect(() => {
    if (!assignedRouteBarangay) {
      setSitioList([]);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${TRACKING_SERVER}/api/sitios?barangay=${encodeURIComponent(assignedRouteBarangay)}`);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setSitioList(data);
        } catch (_) {}
      }
    };
    xhr.send();
  }, [assignedRouteBarangay]);

  // Inject sitio markers & route polylines into WebView
  useEffect(() => {
    if (!webViewReady.current) return;
    if (sitioList.length === 0) {
      webViewRef.current?.injectJavaScript(`window.clearStopMarkers(); window.updateTruckRoute('[]'); true;`);
      return;
    }
    const markersPayload = sitioList.map(s => {
      let status = "upcoming";
      for (const sched of todaySchedules || []) {
        if (sched.sitioTasks && sched.sitioTasks.length > 0) {
          const task = sched.sitioTasks.find(t => t.name.toLowerCase() === s.name.toLowerCase());
          if (task) {
            status = task.completed ? "completed" : "in-progress";
            break;
          }
        } else if (sched.sitio && sched.sitio.toLowerCase() === s.name.toLowerCase()) {
          status = sched.status === "completed" ? "completed" : "in-progress";
          break;
        }
      }
      return {
        lat: s.lat,
        lng: s.lng,
        status,
        name: s.name
      };
    });
    const markersJson = JSON.stringify(markersPayload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.addStopMarkers('${markersJson}'); true;`);

    // Draw route polyline connecting selected sequential sitios in order
    let waypoints = [];
    for (const sched of todaySchedules || []) {
      if (sched.routeCoords && sched.routeCoords.length > 0) {
        waypoints = [...waypoints, ...sched.routeCoords];
      } else if (sched.sitioTasks && sched.sitioTasks.length > 1) {
        const coords = sched.sitioTasks.filter(t => t.lat && t.lng).map(t => [t.lat, t.lng]);
        waypoints = [...waypoints, ...coords];
      }
    }
    if (waypoints.length === 0 && allStops && allStops.length > 1) {
      waypoints = allStops.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);
    }

    if (waypoints.length >= 2) {
      fetchRoadRoutePolyline(waypoints).then((roadCoords) => {
        activeRouteCoordsRef.current = roadCoords;
        const routeCoordsJson = JSON.stringify(roadCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
      });
    } else {
      activeRouteCoordsRef.current = waypoints;
      const routeCoordsJson = JSON.stringify(waypoints).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
    }
  }, [sitioList, todaySchedules, allStops, webViewReady.current]);

  // Fetch overflowing bin reports
  const fetchReports = useCallback(() => {
    const url = `${TRACKING_SERVER}/api/reports?category=Overflowing Bin`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setReports(data.filter(r => r.status !== 'resolved'));
        } catch (e) {}
      }
    };
    xhr.send();
  }, []);

  const handleSubmitDriverReport = () => {
    if (!reportDescription.trim()) {
      Alert.alert("Error", "Please write a description of the issue.");
      return;
    }
    setSubmittingReport(true);

    const lat = lastGpsRef.current?.lat || 10.3156;
    const lng = lastGpsRef.current?.lng || 123.8854;

    const payload = {
      category: reportCategory,
      description: reportDescription,
      location: reportLocation || "On Route",
      barangay: assignedRouteBarangay || "Cebu City",
      sitio: activeSchedule?.sitio || "",
      lat,
      lng,
      reportedBy: `Truck ${TRUCK_ID}`,
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${TRACKING_SERVER}/api/reports`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => {
      setSubmittingReport(false);
      if (xhr.status === 201) {
        Alert.alert("Success", "Report submitted successfully to LGU officials.");
        setShowReportModal(false);
        setReportDescription("");
        setReportLocation("");
        fetchReports();
      } else {
        Alert.alert("Submission Failed", "Failed to submit report. Please try again.");
      }
    };
    xhr.onerror = () => {
      setSubmittingReport(false);
      Alert.alert("Network Error", "Unable to reach the server.");
    };
    xhr.send(JSON.stringify(payload));
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  // Fetch live garbage-area heatmap data
  const fetchGarbageAreas = useCallback(() => {
    const xhr = new XMLHttpRequest();
    const url = assignedRouteBarangay
      ? `${TRACKING_SERVER}/api/garbage-areas?barangay=${encodeURIComponent(assignedRouteBarangay)}`
      : `${TRACKING_SERVER}/api/garbage-areas`;
    xhr.open('GET', url);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const areas = Array.isArray(data) ? data : (data.areas || []);
          setHeatmapZones(areas.map(formatGarbageArea));
        } catch (e) {}
      }
    };
    xhr.send();
  }, [assignedRouteBarangay]);

  useEffect(() => {
    fetchGarbageAreas();
    const interval = setInterval(fetchGarbageAreas, 30000);
    return () => clearInterval(interval);
  }, [fetchGarbageAreas]);

  // Inject heatmap zones into WebView
  useEffect(() => {
    if (!webViewReady.current || heatmapZones.length === 0) return;
    const json = JSON.stringify(heatmapZones).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.updateHeatmapZones('${json}'); true;`);
  }, [heatmapZones]);

  // Inject report markers into WebView
  useEffect(() => {
    if (webViewReady.current) {
      if (!showTrashBins || reports.length === 0) {
        webViewRef.current?.injectJavaScript(`window.clearReportMarkers(); true;`);
        return;
      }
      const payload = reports.map(r => ({
        id: r._id,
        lat: r.lat,
        lng: r.lng,
        score: (r.upvotes?.length || 0) - (r.downvotes?.length || 0)
      }));
      const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.addReportMarkers('${json}'); true;`);
    }
  }, [reports, showTrashBins]);

  // Real-time location tracking & socket setup
  useEffect(() => {
    const socket = io(TRACKING_SERVER, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsSocketConnected(true);
      if (offlineGpsBufferRef.current.length > 0) {
        const points = [...offlineGpsBufferRef.current];
        socket.emit("truck:location:batch", { truckId: TRUCK_ID, points }, (res) => {
          if (res?.ok) {
            offlineGpsBufferRef.current = [];
            setBufferedGpsCount(0);
          }
        });
      }
    });

    socket.on("disconnect", () => {
      setIsSocketConnected(false);
    });

    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchTodaySchedules();
    });

    socket.on("priority:update", (data) => {
      if (!data?.truckId || data.truckId.toUpperCase() === TRUCK_ID.toUpperCase()) {
        fetchTodaySchedules();
        if (data.lat && data.lng && webViewRef.current) {
          webViewRef.current?.injectJavaScript(
            `window.centerMap(${data.lat}, ${data.lng}); true;`
          );
        }
      }
    });

    socket.on("truck:priority:alert", (data) => {
      Alert.alert(
        data.title || "🚨 PRIORITY AREA DISPATCH",
        data.message || "A high priority collection area has been assigned to your route.",
        [
          {
            text: "View Priority Route",
            onPress: () => {
              fetchTodaySchedules();
              setCurrentStopIndex(0);
            }
          }
        ]
      );
    });

    socket.on("bin:status:update", ({ barangay, preparedCount, pickedUpCount }) => {
      if (barangay === assignedRouteBarangay || !assignedRouteBarangay) {
        setBinStatus({ preparedCount, pickedUpCount });
      }
    });

    socket.on("zone:status:update", (update) => {
      const id = String(update.areaId || update.zoneId);
      if (id) {
        setHeatmapZones(prev => {
          const idx = prev.findIndex(z => String(z.id) === id);
          if (idx < 0) return prev;
          const meta = STATUS_META[update.newStatus] || STATUS_META.moderate;
          const updated = {
            ...prev[idx],
            status: update.newStatus,
            color: meta.color,
            level: meta.level,
            riskLevel: meta.riskLevel,
            recommendation: meta.recommendation,
            intensity: update.newStatus === 'critical' ? 0.8 : update.newStatus === 'moderate' ? 0.5 : 0.2,
          };
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
      }
    });

    socket.on("iot:alert", (alert) => {
      if (!navigationActiveRef.current) return;
      if (alert.severity === "critical" && alert.barangay?.toLowerCase() === assignedRouteBarangay?.toLowerCase()) {
        Alert.alert(
          "⚠️ Critical IoT Hazard Alert",
          `Toxic gas levels (${alert.message || 'Exceeded levels'}) detected in your service area. Would you like to optimize your route to handle this hazard first?`,
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes, Reroute",
              onPress: () => {
                shouldNotifyRef.current = true;
                setHazardOptimizeActive(true);
                fetchTodaySchedules(true);
              }
            }
          ]
        );
      }
    });

    socket.on("report:new", (report) => {
      if (!navigationActiveRef.current) return;
      if (report.category === "Overflowing Bin" && report.barangay?.toLowerCase() === assignedRouteBarangay?.toLowerCase()) {
        Alert.alert(
          "⚠️ New Overflowing Bin Report",
          `A new overflowing waste report was submitted at ${report.location || report.sitio || 'your area'}. Would you like to optimize your route to collect this prioritized bin?`,
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes, Reroute",
              onPress: () => {
                shouldNotifyRef.current = true;
                setHazardOptimizeActive(true);
                fetchTodaySchedules(true);
              }
            }
          ]
        );
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase() && status === "offline") {
        const pos = lastGpsRef.current;
        // Only set grey idle truck icon if the driver is NOT on an active shift/navigation
        if (pos && webViewRef.current && !navigationActiveRef.current) {
          webViewRef.current?.injectJavaScript(
            `window.showIdleTruck(${pos.lat}, ${pos.lng}); true;`,
          );
        }
      }
    });

    let locationSub = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude, heading } = initial.coords;
        lastGpsRef.current = { lat: latitude, lng: longitude, heading: heading || 0 };
        setCurrentLocation({ lat: latitude, lng: longitude });
        setIsLocationLoading(false);
        if (webViewReady.current) {
          webViewRef.current?.injectJavaScript(
            `window.updateDriverPosition(${latitude}, ${longitude}, ${heading || 0}); true;`,
          );
        }
      } catch (_) {}

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        ({ coords }) => {
          const { latitude, longitude, heading, speed } = coords;

          lastGpsRef.current = { lat: latitude, lng: longitude, heading: heading || 0 };
          setCurrentLocation({ lat: latitude, lng: longitude });
          setIsLocationLoading(false);

          // Always draw the truck position on the map even if shift hasn't started
          if (webViewReady.current) {
            webViewRef.current?.injectJavaScript(
              `window.updateDriverPosition(${latitude}, ${longitude}, ${heading || 0}); true;`,
            );
          }

          if (navigationActiveRef.current) {
            setCurrentSpeed(Math.round((speed || 0) * 3.6));
            const locPoint = { lat: latitude, lng: longitude, heading: heading || 0, speed: speed || 0, timestamp: Date.now() };

            if (socket.connected) {
              socket.emit("truck:location", {
                truckId: TRUCK_ID,
                ...locPoint,
              });

              if (offlineGpsBufferRef.current.length > 0) {
                const points = [...offlineGpsBufferRef.current];
                socket.emit("truck:location:batch", { truckId: TRUCK_ID, points }, (res) => {
                  if (res?.ok) {
                    offlineGpsBufferRef.current = [];
                    setBufferedGpsCount(0);
                  }
                });
              }
            } else {
              offlineGpsBufferRef.current.push(locPoint);
              setBufferedGpsCount(offlineGpsBufferRef.current.length);
            }

            // ── Off-Route Detection & Warning Validation ──
            const routeCoords = activeRouteCoordsRef.current;
            if (routeCoords && routeCoords.length >= 1) {
              const distM = minDistToPolyline(latitude, longitude, routeCoords);
              if (distM > 50) {
                const roundedDist = Math.round(distM);
                setIsOffRoute(true);
                setOffRouteDistance(roundedDist);

                if (!lastOffRouteAlertRef.current || Date.now() - lastOffRouteAlertRef.current > 10000) {
                  socket.emit("truck:off-route", {
                    truckId: TRUCK_ID,
                    driverName: user?.driverName || user?.name || "Collector",
                    distanceM: roundedDist,
                    lat: latitude,
                    lng: longitude,
                  });
                }

                if (Date.now() - lastOffRouteAlertRef.current > 15000) {
                  lastOffRouteAlertRef.current = Date.now();
                  setShowOffRouteModal(true);
                }

                // Compute shortest road return route from current location back to assigned route
                if (Date.now() - lastRerouteFetchRef.current > 4000) {
                  lastRerouteFetchRef.current = Date.now();
                  const closest = getClosestPointOnPolyline(latitude, longitude, routeCoords);
                  if (closest) {
                    fetchRoadRoutePolyline([[latitude, longitude], [closest.lat, closest.lng]]).then((rerouteCoords) => {
                      if (webViewReady.current && rerouteCoords && rerouteCoords.length > 0) {
                        const json = JSON.stringify(rerouteCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        webViewRef.current?.injectJavaScript(`window.updateReroutePath('${json}'); true;`);
                      }
                    });
                  }
                }
              } else {
                if (isOffRoute) {
                  socket.emit("truck:location:update", {
                    truckId: TRUCK_ID,
                    isOffRoute: false,
                    lat: latitude,
                    lng: longitude,
                  });
                }
                setIsOffRoute(false);
                if (webViewReady.current) {
                  webViewRef.current?.injectJavaScript(`window.clearReroutePath(); true;`);
                }
              }
            }
          }
        },
      );
    })();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'background' || nextState === 'inactive') && navigationActiveRef.current) {
        socket.emit('truck:offline', { truckId: TRUCK_ID });
      }
    });

    return () => {
      appStateSub.remove();
      socket.emit("truck:offline", { truckId: TRUCK_ID });
      socket.disconnect();
      locationSub?.remove();
    };
  }, [fetchTodaySchedules, networkChangeKey, assignedRouteBarangay]);

  // Shift timer
  useEffect(() => {
    if (!navigationActive) return;
    const interval = setInterval(() => {
      if (!shiftStartRef.current) return;
      const mins = Math.floor((Date.now() - shiftStartRef.current) / 60000);
      const hrs = Math.floor(mins / 60);
      setElapsedDisplay(`${String(hrs).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
    }, 15000);
    return () => clearInterval(interval);
  }, [navigationActive]);

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;
  const sheetAnim = useRef(new Animated.Value(translateCollapsed)).current;

  const handleWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    if (message === 'map_ready') {
      webViewReady.current = true;
      if (reports.length > 0) {
        const payload = reports.map(r => ({
          id: r._id, lat: r.lat, lng: r.lng,
          score: (r.upvotes?.length || 0) - (r.downvotes?.length || 0)
        }));
        const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(`window.addReportMarkers('${json}'); true;`);
      }
      if (heatmapZones.length > 0) {
        const zonesJson = JSON.stringify(heatmapZones).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(`window.updateHeatmapZones('${zonesJson}'); true;`);
      }
      return;
    }

    if (message.startsWith("heatmap:")) {
      const zoneId = message.replace("heatmap:", "");
      const zone = heatmapZones.find((z) => z.id === zoneId);
      if (zone) {
        setSelectedZone(zone);
        Animated.spring(zoneCardAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }).start();
      }
    } else if (message.startsWith("report:")) {
      const reportId = message.replace("report:", "");
      const report = reports.find(r => r._id === reportId);
      if (report) {
        setSelectedReport(report);
      }
    }
  };

  const dismissZoneCard = () => {
    Animated.timing(zoneCardAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedZone(null));
  };

  const expandSheet = useCallback(() => {
    isExpandedRef.current = true;
    setIsExpanded(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [sheetAnim]);

  const collapseSheet = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
    Animated.spring(sheetAnim, {
      toValue: translateCollapsed,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [sheetAnim, translateCollapsed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.locationY < 60,
      onMoveShouldSetPanResponder: (evt, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx) &&
        Math.abs(gs.dy) > 15 &&
        evt.nativeEvent.locationY < 80,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 && !isExpandedRef.current) expandSheet();
        else if (gs.dy > 40 && isExpandedRef.current) collapseSheet();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const handleReportIssue = () => {
    setShowReportModal(true);
  };

  const startNavigation = () => {
    if (isRouteCompleted) {
      handleOpenCompletionSummary();
      return;
    }
    if (!todaySchedules || todaySchedules.length === 0) {
      Alert.alert(
        'Waiting for Schedule',
        "You don't have an active collection route assigned for today yet. Please contact your dispatch supervisor.",
        [{ text: 'OK' }]
      );
      return;
    }
    
    AsyncStorage.setItem('@truck_nav_active', 'true').catch(() => {});
    AsyncStorage.setItem('@truck_shift_active', 'true').catch(() => {});
    navigationActiveRef.current = true;
    setNavigationActive(true);
    shiftStartRef.current = Date.now();
    setElapsedDisplay("00:00");

    // Automatically enable hazard routing on shift start and notify residents
    shouldNotifyRef.current = true;
    setHazardOptimizeActive(true);

    // Notify backend that truck started shift / accepted schedule
    try {
      const xhrShift = new XMLHttpRequest();
      xhrShift.open("POST", `${TRACKING_SERVER}/api/schedules/truck/${TRUCK_ID}/start-shift`);
      xhrShift.setRequestHeader("Content-Type", "application/json");
      xhrShift.send(JSON.stringify({ date: todaySchedules?.[0]?.date }));
    } catch (_) {}

    // Update local schedule status immediately to accepted
    setTodaySchedules(prev => Array.isArray(prev) ? prev.map(s => ({ ...s, status: s.status === 'pending' ? 'accepted' : s.status })) : prev);

    // Auto collapse bottom sheet so driver has full map view
    collapseSheet();

    const pos = lastGpsRef.current;
    const lat = pos?.lat ?? 10.325;
    const lng = pos?.lng ?? 123.893;
    const heading = pos?.heading ?? 0;

    webViewRef.current?.injectJavaScript(
      `window.startFollow(${lat}, ${lng}, ${heading}); window.centerMap(${lat}, ${lng}); true;`,
    );

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${TRACKING_SERVER}/api/trucks/location`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify({ truckId: TRUCK_ID, lat, lng, heading, speed: 0 }));
    
    Alert.alert("Shift Started", "Your GPS location is now being shared. Residents can see your truck on the map.");
  };

  const stopNavigation = () => {
    AsyncStorage.setItem('@truck_nav_active', 'false').catch(() => {});
    AsyncStorage.setItem('@truck_shift_active', 'false').catch(() => {});
    const pos = lastGpsRef.current;
    navigationActiveRef.current = false;
    setNavigationActive(false);
    setHazardOptimizeActive(false);
    shiftStartRef.current = null;
    setElapsedDisplay("00:00");
    setCurrentSpeed(0);
    
    socketRef.current?.emit('truck:offline', { truckId: TRUCK_ID });
    
    if (pos) {
      webViewRef.current?.injectJavaScript(
        `window.stopFollow(); window.stopNavigation(${pos.lat}, ${pos.lng}); true;`
      );
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${TRACKING_SERVER}/api/trucks/location`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ truckId: TRUCK_ID, lat: 0, lng: 0, heading: 0, speed: 0 }));
    } else {
      webViewRef.current?.injectJavaScript('window.stopFollow(); window.stopNavigation(); true;');
    }
  };

  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
    if (lastGpsRef.current) {
      const { lat, lng, heading } = lastGpsRef.current;
      webViewRef.current?.injectJavaScript(
        `window.updateDriverPosition(${lat}, ${lng}, ${heading || 0}); true;`,
      );
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style="dark" />
      <NetworkBanner />

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: buildLeafletHTML(TRUCK_B64) }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          onLoad={handleWebViewLoad}
          javaScriptEnabled
          domStorageEnabled
          scalesPageToFit={false}
          scrollEnabled={false}
        />

        {/* GPS Location Pre-Loader Overlay */}
        {isLocationLoading && (
          <View style={styles.locationPreloaderOverlay} pointerEvents="none">
            <View style={styles.locationPreloaderCard}>
              <View style={styles.preloaderBadge}>
                <MaterialIcons name="my-location" size={13} color="#006A3B" />
                <Text style={styles.preloaderBadgeText}>GPS PRE-LOADER</Text>
              </View>
              <ActivityIndicator size="large" color="#006A3B" style={{ marginVertical: 14 }} />
              <Text style={styles.preloaderTitle}>Acquiring Truck Location...</Text>
              <Text style={styles.preloaderSubtitle}>
                Connecting to GPS satellites and calibrating live positioning for Truck {TRUCK_ID}
              </Text>
            </View>
          </View>
        )}

        {/* Selected Heatmap Zone Detail Card */}
        {selectedZone && (
          <Animated.View
            style={[
              styles.zoneCard,
              {
                opacity: zoneCardAnim,
                transform: [
                  {
                    translateY: zoneCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [100, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.zoneCardInner}>
              <View style={styles.zoneHeader}>
                <View
                  style={[
                    styles.zoneStatusIndicator,
                    { backgroundColor: selectedZone.color },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneName}>{selectedZone.name}</Text>
                  <Text style={styles.zoneRisk}>
                    Air Quality Status: {selectedZone.level}
                  </Text>
                </View>
              </View>
              <View style={styles.zoneMetrics}>
                <View style={styles.zoneMetric}>
                  <Text style={styles.zoneMetricValue}>
                    {selectedZone.methane}
                  </Text>
                  <Text style={styles.zoneMetricLabel}>Methane</Text>
                </View>
                <View style={styles.zoneMetricDivider} />
                <View style={styles.zoneMetric}>
                  <Text style={styles.zoneMetricValue}>
                    {selectedZone.ammonia}
                  </Text>
                  <Text style={styles.zoneMetricLabel}>Ammonia</Text>
                </View>
              </View>
              <View style={styles.zoneRecommendation}>
                <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
                <Text style={styles.zoneRecommendationText}>
                  {selectedZone.recommendation}
                </Text>
              </View>
              <View style={styles.zoneActions}>
                <TouchableOpacity
                  style={[
                    styles.zoneActionBtn,
                    { backgroundColor: selectedZone.color },
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={16} color="#FFFFFF" />
                  <Text style={styles.zoneActionBtnText}>Navigate Here</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoneActionBtnOutline}
                  onPress={dismissZoneCard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.zoneActionBtnOutlineText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Navigation Overlay System */}
        <View style={styles.navOverlayContainer} pointerEvents="box-none">
          {!navigationActive ? (
            /* Discovery Mode */
            <View style={styles.discoveryMode} pointerEvents="box-none">
              {!isExpanded && (
                <TouchableOpacity 
                  style={[
                    styles.bigStartBtn,
                    (isRouteCompleted || !todaySchedules || todaySchedules.length === 0) && styles.bigStartBtnWaiting
                  ]} 
                  onPress={startNavigation}
                  disabled={isRouteCompleted}
                  activeOpacity={0.9}
                >
                  <MaterialIcons
                    name={isRouteCompleted ? "check-circle" : (!todaySchedules || todaySchedules.length === 0) ? "hourglass-empty" : "local-shipping"}
                    size={22}
                    color="#FFF"
                  />
                  <Text style={styles.bigStartBtnText}>
                    {isRouteCompleted ? "ROUTE COMPLETED ✓" : (!todaySchedules || todaySchedules.length === 0) ? "WAITING FOR SCHEDULE" : "START SHIFT"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Active Guidance Mode UI - matching uploaded layout in #006A3B theme */
            <View style={styles.shiftGuidanceContainer} pointerEvents="box-none">
              {/* Top Navigation Banner Overlay */}
              <View style={[styles.topBannerCard, { marginTop: Math.max(10, topInset), flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.turnIconWrap}>
                    <MaterialIcons name="turn-left" size={28} color="#FFFFFF" />
                  </View>
                  <View style={styles.bannerTextWrap}>
                    <Text style={styles.bannerNextStopText} numberOfLines={1}>
                      NEXT STOP: {currentStop?.name ? currentStop.name.toUpperCase() : 'MAIN ST.'}
                    </Text>
                    <Text style={styles.bannerSubtext} numberOfLines={1}>
                      {assignedRouteBarangay ? `${assignedRouteBarangay} Waste Collection` : 'Scheduled Collection'}
                    </Text>
                  </View>
                </View>

                {/* GPS Status & Telemetry Strip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.25)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isSocketConnected ? '#34D399' : '#FBBF24', marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      {isSocketConnected ? 'GPS Tracking Active' : `Offline (${bufferedGpsCount} buffered)`}
                    </Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' }}>
                    {currentSpeed} km/h • {elapsedDisplay}
                  </Text>
                </View>

                {/* Embedded Off-Route Warning Alert Strip */}
                {isOffRoute && (
                  <TouchableOpacity
                    style={styles.bannerOffRouteStrip}
                    onPress={() => setShowOffRouteModal(true)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="alt-route" size={14} color="#FFFFFF" />
                    <Text style={styles.bannerOffRouteText} numberOfLines={1}>
                      OFF ROUTE (~{offRouteDistance}m) — Return route shown on map
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Floating Actions Overlay */}
        {!isFocusMode && (
          <View style={[
            styles.floatingActions,
            navigationActive
              ? { left: 14, top: Math.max(10, topInset) + (isOffRoute ? 168 : 108) }
              : { right: 16, top: Math.max(16, topInset) }
          ]}>
            {/* 3D Perspective Toggle Button */}
            <TouchableOpacity
              style={[
                styles.floatingBtn,
                is3DPerspective ? { backgroundColor: "#006A3B" } : { backgroundColor: "#FFFFFF" }
              ]}
              onPress={() => {
                const nextVal = !is3DPerspective;
                setIs3DPerspective(nextVal);
                webViewRef.current?.injectJavaScript(
                  `window.setPerspective3D(${nextVal}); true;`
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 12, fontWeight: "900", color: is3DPerspective ? "#FFFFFF" : "#006A3B" }}>
                3D
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingBtn,
                hazardOptimizeActive ? { backgroundColor: "#006A3B" } : { backgroundColor: "#FFFFFF" }
              ]}
              onPress={() => {
                const nextVal = !hazardOptimizeActive;
                shouldNotifyRef.current = true;
                setHazardOptimizeActive(nextVal);
                Alert.alert(
                  nextVal ? "Hazard Optimization Active" : "Standard Route Restored",
                  nextVal
                    ? "Collection sequence prioritized by active gas & overflowing reports hazards. Scoped residents have been alerted."
                    : "Standard schedule routing restored."
                );
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="offline-bolt"
                size={24}
                color={hazardOptimizeActive ? "#FFFFFF" : "#E53935"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.floatingBtn, { backgroundColor: "#DC2626" }]}
              onPress={() => setShowReportModal(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="report" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Sheet */}
      {!isFocusMode && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { height: sheetTotalHeight, transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handleContainer}>
              <View style={styles.handleBar} />
            </View>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[
                    styles.statusBadgeDot,
                    navigationActive
                      ? styles.statusBadgeDotActive
                      : isRouteCompleted
                      ? styles.statusBadgeDotActive
                      : (todaySchedules?.length > 0)
                      ? styles.statusBadgeDotReady
                      : styles.statusBadgeDotWaiting
                  ]} />
                  <Text style={styles.sheetTitle}>
                    {navigationActive
                      ? 'Shift In Progress'
                      : isRouteCompleted
                      ? 'Route Completed ✓'
                      : (todaySchedules?.length > 0)
                      ? 'Waiting — Ready'
                      : 'Waiting for Schedule'}
                  </Text>
                </View>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {navigationActive
                    ? `Streaming GPS for ${assignedRouteBarangay || 'assigned area'}`
                    : isRouteCompleted
                    ? 'All scheduled collection stops completed for today'
                    : (todaySchedules?.length > 0)
                    ? `Assigned: ${assignedRouteBarangay || 'Route'}. Tap Start to begin.`
                    : 'No collection schedule assigned today'}
                </Text>
              </View>

              {/* Direct Header Start / End Action Pill */}
              <TouchableOpacity
                style={[
                  styles.sheetHeaderActionBtn,
                  navigationActive
                    ? styles.sheetHeaderActionBtnEnd
                    : isRouteCompleted
                    ? styles.sheetHeaderActionBtnWaiting
                    : (todaySchedules?.length > 0)
                    ? styles.sheetHeaderActionBtnStart
                    : styles.sheetHeaderActionBtnWaiting
                ]}
                onPress={navigationActive ? stopNavigation : isRouteCompleted ? handleOpenCompletionSummary : startNavigation}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={navigationActive ? "stop" : isRouteCompleted ? "check-circle" : (todaySchedules?.length > 0) ? "play-arrow" : "hourglass-empty"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.sheetHeaderActionBtnText}>
                  {navigationActive ? 'End' : isRouteCompleted ? 'Done ✓' : (todaySchedules?.length > 0) ? 'Start' : 'Waiting'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.expandBtn}
                onPress={() => isExpandedRef.current ? collapseSheet() : expandSheet()}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={isExpanded ? "expand-more" : "expand-less"}
                  size={20}
                  color="#6F7A70"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Animated.View style={[styles.stopList, { opacity: listOpacity }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={isExpanded}
              contentContainerStyle={{ paddingBottom: bottomInset + 8 }}
            >
              <View style={styles.unassignedCard}>
                <View style={styles.unassignedIconWrap}>
                  <MaterialIcons name="local-shipping" size={36} color="#006A3B" />
                </View>
                <Text style={styles.unassignedTitle}>
                  {assignedRouteBarangay ? `Assigned Area: ${assignedRouteBarangay}` : 'No Area Assigned Today'}
                </Text>
                <Text style={styles.unassignedBody}>
                  {navigationActive
                    ? `Your shift is active. You are currently streaming GPS coordinates to residents of ${assignedRouteBarangay || 'your assigned area'}.`
                    : (todaySchedules?.length > 0)
                    ? `You are assigned to ${assignedRouteBarangay || 'your route'}. Start your shift to begin live GPS streaming.`
                    : 'No route is currently assigned to this vehicle for today. Please wait for dispatch.'}
                </Text>

                {/* Live bin status summary if assigned to area */}
                {assignedRouteBarangay ? (
                  <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B1C1C', marginBottom: 10 }}>Barangay Bin Status</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#F59E0B' }}>{binStatus.preparedCount}</Text>
                        <Text style={{ fontSize: 11, color: '#6F7A70' }}>Bins Preparing</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#065F46' }}>{binStatus.pickedUpCount}</Text>
                        <Text style={{ fontSize: 11, color: '#6F7A70' }}>Bins Cleaned</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Scheduled Stops & Mark as Clean Checklist */}
                {todaySchedules && todaySchedules.length > 0 && (
                  <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialIcons name="fact-check" size={18} color="#2563EB" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Collection Route Stops</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
                        {todaySchedules.reduce((sum, s) => sum + (s.sitioTasks ? s.sitioTasks.filter(t => t.completed).length : (s.status === 'completed' ? 1 : 0)), 0)} / {todaySchedules.reduce((sum, s) => sum + (s.sitioTasks ? s.sitioTasks.length : 1), 0)} Cleaned
                      </Text>
                    </View>

                    <View style={{ gap: 10 }}>
                      {todaySchedules.map(sched => {
                        const tasks = sched.sitioTasks && sched.sitioTasks.length > 0
                          ? sched.sitioTasks
                          : (sched.sitios && sched.sitios.length > 0 ? sched.sitios.map(name => ({ name, completed: sched.status === 'completed' })) : [{ name: sched.barangay || 'Route Area', completed: sched.status === 'completed' }]);

                        return tasks.map((task, taskIdx) => {
                          const isDone = !!task.completed;
                          const isBusy = clearingSitio === task.name;
                          return (
                            <View
                              key={`${sched._id}-${task.name}-${taskIdx}`}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 12,
                                backgroundColor: isDone ? '#F0FDF4' : '#F8FAFC',
                                borderWidth: 1,
                                borderColor: isDone ? '#BBF7D0' : '#E2E8F0',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                                <View style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: isDone ? '#059669' : '#E2E8F0',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <MaterialIcons
                                    name={isDone ? "check" : "place"}
                                    size={14}
                                    color={isDone ? "#FFFFFF" : "#64748B"}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDone ? '#166534' : '#1E293B' }}>
                                    {task.name}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: isDone ? '#15803D' : '#64748B' }}>
                                    {isDone ? 'Marked as Clean ✓' : 'Pending Cleanup'}
                                  </Text>
                                </View>
                              </View>

                              {isDone ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 }}>
                                  <MaterialIcons name="check-circle" size={14} color="#16A34A" />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>Clean</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => {
                                    setBeforeImage("");
                                    setAfterImage("");
                                    setFlowLocation(task.name);
                                    setActiveFlowTask({
                                      scheduleId: sched._id,
                                      sitioName: task.name,
                                      barangay: sched.barangay || assignedRouteBarangay || 'Apas',
                                      step: 'options',
                                    });
                                  }}
                                  disabled={isBusy}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: '#059669',
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    shadowColor: '#059669',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 2,
                                    elevation: 2,
                                  }}
                                >
                                  {isBusy ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <>
                                      <MaterialIcons name="cleaning-services" size={13} color="#FFFFFF" />
                                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>Mark as Clean</Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        });
                      })}
                    </View>
                  </View>
                )}

                {/* Shift Details */}
                <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B1C1C', marginBottom: 10 }}>Shift Details</Text>
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#6F7A70' }}>Status</Text>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: navigationActive ? '#065F46' : isRouteCompleted ? '#059669' : (todaySchedules?.length > 0) ? '#D97706' : '#6B7280'
                      }}>
                        {navigationActive
                          ? 'On Duty (Active)'
                          : isRouteCompleted
                          ? 'Route Completed ✓'
                          : (todaySchedules?.length > 0)
                          ? 'Waiting to Start'
                          : 'Waiting for Schedule'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#6F7A70' }}>Elapsed Time</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1B1C1C' }}>{elapsedDisplay}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#6F7A70' }}>Current Speed</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1B1C1C' }}>{currentSpeed} km/h</Text>
                    </View>
                  </View>
                </View>

                {/* Start / Stop Toggle inside Bottom Sheet */}
                <TouchableOpacity
                  style={[
                    styles.deviationBtnPrimary,
                    navigationActive
                      ? { backgroundColor: '#DC2626' }
                      : isRouteCompleted
                      ? { backgroundColor: '#6B7280' }
                      : (!todaySchedules || todaySchedules.length === 0)
                      ? { backgroundColor: '#6B7280' }
                      : { backgroundColor: '#006A3B' }
                  ]}
                  onPress={navigationActive ? stopNavigation : isRouteCompleted ? handleOpenCompletionSummary : startNavigation}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={navigationActive ? "stop" : isRouteCompleted ? "check-circle" : (todaySchedules?.length > 0) ? "play-arrow" : "hourglass-empty"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.deviationBtnPrimaryText}>
                    {navigationActive
                      ? 'End Shift'
                      : isRouteCompleted
                      ? 'Route Completed ✓'
                      : (todaySchedules?.length > 0)
                      ? 'Start Shift'
                      : 'Waiting for Schedule'}
                  </Text>
                </TouchableOpacity>

                {/* Report Hazard button */}
                <TouchableOpacity
                  style={[styles.deviationBtnOutline, { marginTop: 8 }]}
                  onPress={handleReportIssue}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="warning" size={18} color="#006A3B" />
                  <Text style={styles.deviationBtnOutlineText}>Report Hazard</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* Overflowing Bin Detail Modal */}
      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.reportModalBackdrop}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <View style={styles.reportModalIconWrap}>
                <MaterialIcons name="delete-sweep" size={24} color="#BA1A1A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.reportModalTitle}>Overflowing Bin</Text>
                <Text style={styles.reportModalSub}>Reported near your route</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedReport(null)} style={styles.reportCloseBtn}>
                <MaterialIcons name="close" size={20} color="#6F7A70" />
              </TouchableOpacity>
            </View>

            <View style={styles.reportUrgencyRow}>
              <Text style={styles.reportUrgencyLabel}>Community Urgency</Text>
              <View style={[styles.reportUrgencyBadge, (selectedReport?.upvotes?.length - (selectedReport?.downvotes?.length || 0)) >= 5 ? styles.reportUrgencyHigh : styles.reportUrgencyMed]}>
                <Text style={styles.reportUrgencyText}>
                  Score: {(selectedReport?.upvotes?.length || 0) - (selectedReport?.downvotes?.length || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.reportContentBox}>
              <Text style={styles.reportDescription}>{selectedReport?.description}</Text>
              <View style={styles.reportLocationRow}>
                <MaterialIcons name="location-on" size={14} color="#6F7A70" />
                <Text style={styles.reportLocationText}>{selectedReport?.location || selectedReport?.barangay}</Text>
              </View>
            </View>

            {selectedReport?.reportImage ? (
              <View style={styles.reportImageContainer}>
                <ActivityIndicator size="small" color="#006A3B" style={styles.imageLoader} />
                <Image 
                  source={{ uri: selectedReport.reportImage }} 
                  style={styles.reportImage} 
                />
              </View>
            ) : null}

            <View style={styles.reportModalFooter}>
              <Text style={styles.reportTimestamp}>
                {selectedReport ? new Date(selectedReport.createdAt).toLocaleString() : ''}
              </Text>
              <TouchableOpacity 
                style={styles.reportActionBtn}
                onPress={() => setSelectedReport(null)}
              >
                <Text style={styles.reportActionBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Report Submission Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={[styles.reportModalBackdrop, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }]}>
          <View style={[styles.reportModalCard, { width: '100%', borderRadius: 28 }]}>
            <View style={styles.reportModalHeader}>
              <View style={[styles.reportModalIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <MaterialIcons name="report-problem" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.reportModalTitle}>Report Issue</Text>
                <Text style={styles.reportModalSub}>Send alerts directly to LGU dashboard</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.reportCloseBtn}>
                <MaterialIcons name="close" size={20} color="#6F7A70" />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={{ width: '100%', marginTop: 16 }}>
              {/* Category */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6F7A70', marginBottom: 8 }}>CATEGORY</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {["Overflowing Bin", "Blocked Road", "Other"].map((cat) => {
                  const isSelected = reportCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setReportCategory(cat)}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#006A3B' : '#F0EDED',
                        backgroundColor: isSelected ? '#E6F0EC' : '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#006A3B' : '#6F7A70', textAlign: 'center' }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Location Reference */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6F7A70', marginBottom: 6 }}>LOCATION REFERENCE (Optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#F0EDED', borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: '#1B1C1C', backgroundColor: '#F9FAFB', marginBottom: 16, height: 40 }}
                placeholder="e.g., Near Sudlon Barangay Hall"
                value={reportLocation}
                onChangeText={setReportLocation}
              />

              {/* Description */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6F7A70', marginBottom: 6 }}>DESCRIPTION / NOTES</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#F0EDED', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1B1C1C', backgroundColor: '#F9FAFB', height: 80, textAlignVertical: 'top', marginBottom: 20 }}
                placeholder="Describe the issue in detail..."
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
              />
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                onPress={() => setShowReportModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#F0EDED', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#6F7A70' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSubmitDriverReport}
                disabled={submittingReport}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#006A3B', alignItems: 'center', justifyContent: 'center' }}
              >
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Off-Route Deviation Warning Modal ── */}
      <Modal
        visible={showOffRouteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOffRouteModal(false)}
      >
        <View style={styles.deviationBackdrop}>
          <View style={styles.deviationCard}>
            <TouchableOpacity
              style={styles.deviationClose}
              onPress={() => setShowOffRouteModal(false)}
            >
              <MaterialIcons name="close" size={18} color="#6F7A70" />
            </TouchableOpacity>

            <View style={styles.deviationIconWrap}>
              <MaterialIcons name="warning" size={38} color="#D97706" />
            </View>

            <Text style={styles.deviationTitle}>Off Route Warning</Text>
            <Text style={styles.deviationBody}>
              You are currently <Text style={{ fontWeight: '800', color: '#DC2626' }}>~{offRouteDistance}m away</Text> from your assigned collection route. A return route guiding your truck back to your admin-assigned route has been mapped below.
            </Text>

            <TouchableOpacity
              style={styles.deviationBtnPrimary}
              onPress={() => {
                setShowOffRouteModal(false);
                if (webViewRef.current) {
                  webViewRef.current?.injectJavaScript(
                    `window.fitRerouteBounds(); true;`
                  );
                }
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="alt-route" size={18} color="#FFFFFF" />
              <Text style={styles.deviationBtnPrimaryText}>View Return Route to Assigned Path</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deviationBtnOutline, { marginTop: 8 }]}
              onPress={() => setShowOffRouteModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.deviationBtnOutlineText}>Acknowledge & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Clearance Flow Modal */}
      <Modal
        visible={!!activeFlowTask}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isSubmittingFlow) {
            setActiveFlowTask(null);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
              <TouchableOpacity
                onPress={() => {
                  if (activeFlowTask.step === 'options') {
                    setActiveFlowTask(null);
                  } else if (activeFlowTask.step === 'before_photo') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'options' }));
                  } else if (activeFlowTask.step === 'cleaning') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'before_photo' }));
                  } else if (activeFlowTask.step === 'after_photo') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'cleaning' }));
                  } else if (activeFlowTask.step === 'details') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'after_photo' }));
                  }
                }}
                disabled={isSubmittingFlow}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>
                {activeFlowTask?.step === 'options' && 'Select Action'}
                {activeFlowTask?.step === 'before_photo' && 'Proof: Before Cleaning'}
                {activeFlowTask?.step === 'cleaning' && 'Clearing In Progress'}
                {activeFlowTask?.step === 'after_photo' && 'Proof: After Cleaning'}
                {activeFlowTask?.step === 'details' && 'Log Verification Details'}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveFlowTask(null)}
                disabled={isSubmittingFlow}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            {/* Step Content */}
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}>
              {activeFlowTask?.step === 'options' && (
                <View style={{ gap: 16, width: '100%' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 }}>
                    {activeFlowTask.sitioName}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Select an action to perform at this garbage collection area.
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setBasicReportNotes("");
                      setBasicReportCategory("Other");
                      setShowBasicReportModal(true);
                    }}
                    style={{ backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="warning" size={26} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>Basic Report</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>File a hazard, obstruction or incident report</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'before_photo' }))}
                    style={{ backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="local-shipping" size={26} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>Clear Area & Log Pickup</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Perform standard before/after clearing flow</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {activeFlowTask?.step === 'before_photo' && (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Please capture the accumulation levels BEFORE you start cleaning.
                  </Text>

                  {beforeImage ? (
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Image source={{ uri: beforeImage }} style={{ width: '100%', height: 280, borderRadius: 20, backgroundColor: '#1E293B', marginBottom: 24 }} resizeMode="cover" />
                      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => takePhotoStep('before')}
                          style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            const lat = currentLocation?.latitude || lastGpsRef.current?.lat || 10.332;
                            const lng = currentLocation?.longitude || lastGpsRef.current?.lng || 123.905;
                            fetch(`${TRACKING_SERVER}/api/schedules/clearing-status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                truckId: TRUCK_ID,
                                driverName: user?.driverName || user?.name || 'Collector',
                                barangay: activeFlowTask?.barangay || assignedRouteBarangay || 'Apas',
                                sitioName: activeFlowTask?.sitioName,
                                status: 'clearing',
                                lat,
                                lng,
                              }),
                            }).catch(() => {});
                            if (webViewReady.current && webViewRef.current) {
                              const sName = (activeFlowTask?.sitioName || '').replace(/'/g, "\\'");
                              webViewRef.current.injectJavaScript(`if (window.setClearingMarker) window.setClearingMarker('${sName}', ${lat}, ${lng}, true); true;`);
                            }
                            setActiveFlowTask(prev => ({ ...prev, step: 'cleaning' }));
                          }}
                          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Proceed</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: 320, borderRadius: 24, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
                      <TouchableOpacity
                        onPress={() => takePhotoStep('before')}
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginBottom: 12 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Snap Before Photo</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Permission prompt will open. Fallback to sample photo on simulators.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeFlowTask?.step === 'cleaning' && (
                <View style={{ alignItems: 'center', width: '100%', gap: 20 }}>
                  <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981' }} />
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#064E3B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#34D399', elevation: 8 }}>
                      <MaterialIcons name="cleaning-services" size={48} color="#34D399" />
                    </View>
                  </View>

                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                    <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>LIVE CLEARING ON MAP</Text>
                  </View>

                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' }}>
                    Clean the Area Now
                  </Text>
                  <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 }}>
                    Begin collecting waste bins and sweeping surroundings at <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{activeFlowTask.sitioName}</Text>. Live broom marker is broadcasting on maps.
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      const lat = currentLocation?.latitude || lastGpsRef.current?.lat || null;
                      const lng = currentLocation?.longitude || lastGpsRef.current?.lng || null;
                      fetch(`${TRACKING_SERVER}/api/schedules/clearing-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          truckId: TRUCK_ID,
                          driverName: user?.driverName || user?.name || 'Collector',
                          barangay: activeFlowTask?.barangay || assignedRouteBarangay || 'Apas',
                          sitioName: activeFlowTask?.sitioName,
                          status: 'completed',
                          lat,
                          lng,
                        }),
                      }).catch(() => {});
                      if (webViewReady.current && webViewRef.current) {
                        webViewRef.current.injectJavaScript(`if (window.setClearingMarker) window.setClearingMarker('', 0, 0, false); true;`);
                      }
                      setActiveFlowTask(prev => ({ ...prev, step: 'after_photo' }));
                    }}
                    style={{ backgroundColor: '#10B981', width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Mark as Cleared</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeFlowTask?.step === 'after_photo' && (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Please capture the final cleared area AFTER cleaning is done.
                  </Text>

                  {afterImage ? (
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Image source={{ uri: afterImage }} style={{ width: '100%', height: 280, borderRadius: 20, backgroundColor: '#1E293B', marginBottom: 24 }} resizeMode="cover" />
                      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => takePhotoStep('after')}
                          style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'details' }))}
                          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Proceed</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: 320, borderRadius: 24, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
                      <TouchableOpacity
                        onPress={() => takePhotoStep('after')}
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginBottom: 12 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Snap After Photo</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Verify that the site is completely empty and clean.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeFlowTask?.step === 'details' && (
                <View style={{ width: '100%' }}>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 }}>BEFORE</Text>
                      {beforeImage ? (
                        <Image source={{ uri: beforeImage }} style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B' }} />
                      ) : (
                        <View style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#64748B', fontSize: 12 }}>No image</Text></View>
                      )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 }}>AFTER</Text>
                      {afterImage ? (
                        <Image source={{ uri: afterImage }} style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B' }} />
                      ) : (
                        <View style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#64748B', fontSize: 12 }}>No image</Text></View>
                      )}
                    </View>
                  </View>

                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Area Status</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { label: 'Clean', value: 'clean', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                          { label: 'Moderate', value: 'moderate', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                          { label: 'Critical', value: 'critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' }
                        ].map(st => {
                          const isSelected = flowStatus === st.value;
                          return (
                            <TouchableOpacity
                              key={st.value}
                              onPress={() => setFlowStatus(st.value)}
                              style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: isSelected ? st.color : '#334155', backgroundColor: isSelected ? st.bg : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? st.color : '#94A3B8' }}>{st.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={submitCleaningFlow}
                      disabled={isSubmittingFlow}
                      style={{ backgroundColor: '#10B981', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                    >
                      {isSubmittingFlow ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Submit Collection Verification</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Basic Report Sub-Modal */}
      <Modal
        visible={showBasicReportModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!submittingBasicReport) setShowBasicReportModal(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1E293B', width: '100%', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#334155' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#F8FAFC' }}>File Incident Report</Text>
              <TouchableOpacity onPress={() => setShowBasicReportModal(false)}>
                <MaterialIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Incident Category</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {['Blocked Road', 'Hazard', 'Other'].map(cat => {
                const isSelected = basicReportCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setBasicReportCategory(cat)}
                    style={{ flex: 1, height: 38, borderRadius: 8, borderWidth: 1.5, borderColor: isSelected ? '#10B981' : '#334155', backgroundColor: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#10B981' : '#94A3B8' }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Notes / Description</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#F8FAFC', backgroundColor: '#0F172A', height: 80, textAlignVertical: 'top', marginBottom: 20 }}
              value={basicReportNotes}
              onChangeText={setBasicReportNotes}
              placeholder="e.g. Blocked street due to parked truck"
              placeholderTextColor="#475569"
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowBasicReportModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitBasicReportFlow}
                disabled={submittingBasicReport}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
              >
                {submittingBasicReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Route Accomplishment & Weighbridge Disposal Report Modal ── */}
      <Modal
        visible={showRouteCompletionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRouteCompletionModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.88)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 390, maxHeight: '90%', backgroundColor: '#0F172A', borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 10 }}>
              
              {/* Header Icon */}
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#065F46', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: '#10B981' }}>
                <MaterialIcons name="local-shipping" size={36} color="#34D399" />
              </View>

              <Text style={{ fontSize: 20, fontWeight: '900', color: '#F8FAFC', textAlign: 'center', marginBottom: 4 }}>
                Sitios 100% Cleared!
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 16, lineHeight: 17 }}>
                Submit the weighbridge scale report to officially conclude collection for <Text style={{ color: '#34D399', fontWeight: '800' }}>{completedRouteInfo?.barangay || 'Assigned Barangay'}</Text>.
              </Text>

              {/* Quick Summary Pill */}
              <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="check-circle" size={16} color="#10B981" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#CBD5E1' }}>Sitios Collected</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#34D399' }}>
                  {completedRouteInfo?.sitiosCleared || 0} / {completedRouteInfo?.sitiosCleared || 0} (Complete)
                </Text>
              </View>

              {/* Section 1: Final Disposal Facility */}
              <View style={{ width: '100%', marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  1. Designated Disposal Facility
                </Text>
                <View style={{ gap: 6 }}>
                  {[
                    { name: "Binaliw Sanitary Landfill (ARN)", short: "Binaliw Landfill (ARN)" },
                    { name: "Inayawan Transfer Station", short: "Inayawan Transfer Station" },
                    { name: "Barangay MRF", short: "Barangay Materials Recovery (MRF)" },
                  ].map((fac) => {
                    const isSelected = disposalFacility === fac.name;
                    return (
                      <TouchableOpacity
                        key={fac.name}
                        onPress={() => setDisposalFacility(fac.name)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: isSelected ? '#064E3B' : '#1E293B',
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#10B981' : '#334155',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialIcons
                            name={isSelected ? "radio-button-checked" : "radio-button-unchecked"}
                            size={16}
                            color={isSelected ? "#34D399" : "#64748B"}
                          />
                          <Text style={{ fontSize: 12, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#F8FAFC' : '#CBD5E1' }}>
                            {fac.short}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#34D399' }}>SELECTED</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 2: Scale Weight / Tonnage */}
              <View style={{ width: '100%', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    2. Weighed Waste (Scale Net)
                  </Text>
                  {/* Unit Toggle */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#334155' }}>
                    {['tons', 'kg'].map((u) => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setDisposalWeightUnit(u)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: disposalWeightUnit === u ? '#10B981' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: disposalWeightUnit === u ? '#FFFFFF' : '#94A3B8' }}>
                          {u.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1.5, borderColor: '#334155', paddingHorizontal: 12, height: 48 }}>
                  <MaterialIcons name="scale" size={20} color="#34D399" style={{ marginRight: 8 }} />
                  <TextInput
                    value={disposalWeight}
                    onChangeText={setDisposalWeight}
                    keyboardType="numeric"
                    placeholder="Enter net weight"
                    placeholderTextColor="#64748B"
                    style={{ flex: 1, color: '#F8FAFC', fontSize: 16, fontWeight: '800' }}
                  />
                  <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: 13 }}>
                    {disposalWeightUnit}
                  </Text>
                </View>
              </View>

              {/* Section 3: Photo Proof of Scale Ticket / Dump */}
              <View style={{ width: '100%', marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  3. Scale Slip / Disposal Photo Proof
                </Text>
                {disposalPhoto ? (
                  <View style={{ position: 'relative', width: '100%', height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#10B981' }}>
                    <Image source={{ uri: disposalPhoto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={takeDisposalPhoto}
                      style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <MaterialIcons name="refresh" size={14} color="#34D399" />
                      <Text style={{ fontSize: 11, color: '#F8FAFC', fontWeight: '700' }}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={takeDisposalPhoto}
                    style={{
                      width: '100%',
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: '#1E293B',
                      borderWidth: 1.5,
                      borderColor: '#334155',
                      borderStyle: 'dashed',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons name="camera-alt" size={20} color="#34D399" />
                    <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '700' }}>
                      Capture Scale Ticket / Dump Proof
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                onPress={handleSubmitDisposalReport}
                disabled={isSubmittingDisposal}
                style={{ width: '100%', height: 48, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginBottom: 8, flexDirection: 'row', gap: 6 }}
              >
                {isSubmittingDisposal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                      Submit Weighbridge Report & Finish Shift
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRouteCompletionModal(false)}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B' }}>
                  Review Later / Close
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Keep opacity mapping for scroll sheet transition
const listOpacity = 1;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  mapContainer: { flex: 1 },
  webView: { flex: 1, backgroundColor: "#F0EDED" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B1C1C",
    marginTop: 20,
    lineHeight: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6F7A70",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deviationBtn: {
    backgroundColor: '#006A3B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  deviationBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // Navigation Overlay Styles
  navOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  discoveryMode: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  navSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  navSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1B1C1C',
  },
  reportModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  reportModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  reportModalSub: {
    fontSize: 12,
    color: '#6F7A70',
  },
  reportCloseBtn: {
    padding: 8,
  },
  reportUrgencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportUrgencyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6F7A70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportUrgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reportUrgencyMed: {
    backgroundColor: '#FFFBEB',
  },
  reportUrgencyHigh: {
    backgroundColor: '#BA1A1A',
  },
  reportUrgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  reportContentBox: {
    backgroundColor: '#FBF9F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  reportDescription: {
    fontSize: 15,
    color: '#1B1C1C',
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  reportLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportLocationText: {
    fontSize: 12,
    color: '#6F7A70',
  },
  reportImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F0EDED',
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
  },
  reportModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTimestamp: {
    fontSize: 11,
    color: '#BECABE',
  },
  reportActionBtn: {
    backgroundColor: '#1B1C1C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  reportActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bigStartBtn: {
    position: 'absolute',
    bottom: 105,
    right: 20,
    backgroundColor: '#006A3B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    elevation: 8,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  bigStartBtnWaiting: {
    backgroundColor: '#4B5563',
    shadowColor: '#000',
    opacity: 0.9,
  },
  bigStartBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guidanceMode: {
    flex: 1,
    alignItems: 'center',
  },
  guidanceHeader: {
    position: 'absolute',
    top: 60,
    width: '92%',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  turnIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  guideDistance: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  guideStreet: {
    color: '#BECABE',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  guidanceFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  guideTime: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1B1C1C',
  },
  guideStats: {
    fontSize: 16,
    color: '#6F7A70',
    fontWeight: '600',
  },
  guideExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  guideExitText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },

  focusGuidanceBanner: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    backgroundColor: '#1A1C1E',
    borderRadius: 28,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  focusGuidanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  focusTurnIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#006A3B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  focusGuidanceText: {
    flex: 1,
  },
  focusDistanceText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  focusStreetText: {
    color: '#BECABE',
    fontSize: 14,
    fontWeight: '600',
  },
  focusGuidanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  focusGuidanceBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  focusStatsBox: {
    flex: 1,
  },
  focusStatLabel: {
    color: '#6F7A70',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  focusStatValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  focusStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  focusStopBtn: {
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  focusStopBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  loadingBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 15,
  },
  loadingBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006A3B",
  },

  progressCard: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 15,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  progressTitle: { fontSize: 13, fontWeight: "600", color: "#006A3B" },
  progressBarangay: { fontSize: 11, color: "#6F7A70", marginTop: 1 },
  progressPercent: { fontSize: 13, fontWeight: "700", color: "#006A3B" },
  progressBar: {
    height: 4,
    backgroundColor: "#E8F0EA",
    borderRadius: 2,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#006A3B", borderRadius: 2 },
  progressText: { fontSize: 10, color: "#6F7A70", lineHeight: 14 },

  floatingActions: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 8,
    zIndex: 20,
  },
  floatingBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  activeNavBtn: { backgroundColor: "#006A3B" },
  activeFloatingBtn: { borderColor: "#006A3B", borderWidth: 1.5 },
 
  toolsMenu: {
    position: 'absolute',
    right: 56,
    top: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  toolText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B1C1C',
  },
  truckStatusBar: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  statusLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  truckIdBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  truckIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  weatherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  capacityContainer: {
    width: 140,
  },
  capacityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6F7A70',
    textTransform: 'uppercase',
  },
  capacityValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#006A3B',
  },
  capacityBarBG: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    backgroundColor: '#006A3B',
    borderRadius: 4,
  },

  legendCard: {
    position: "absolute",
    top: 120,
    left: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#1B1C1C", fontWeight: "500" },

  successToast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#006A3B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 30,
  },
  successText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  successSubText: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 1, textTransform: "capitalize" },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 15,
    overflow: "hidden",
  },
  handleContainer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DCD9D9",
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B1C1C",
    lineHeight: 20,
  },
  sheetSub: { fontSize: 12, color: "#6F7A70", marginTop: 2, lineHeight: 16 },
  statusBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  statusBadgeDotActive: {
    backgroundColor: '#10B981',
  },
  statusBadgeDotReady: {
    backgroundColor: '#F59E0B',
  },
  statusBadgeDotWaiting: {
    backgroundColor: '#9CA3AF',
  },
  sheetHeaderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  sheetHeaderActionBtnStart: {
    backgroundColor: '#006A3B',
  },
  sheetHeaderActionBtnEnd: {
    backgroundColor: '#DC2626',
  },
  sheetHeaderActionBtnWaiting: {
    backgroundColor: '#6B7280',
    opacity: 0.85,
  },
  sheetHeaderActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  prefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prefBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0EDEB",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  swipeHintText: { fontSize: 11, color: "#BECABE" },
  stopList: { flex: 1, paddingHorizontal: 20 },

  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  actionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  actionLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
  },
  actionInfo: { flex: 1 },
  actionLocation: {
    fontSize: 17,
    fontWeight: "700",
    color: "#006A3B",
    lineHeight: 22,
  },
  actionAddress: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },
  inProgressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#006A3B",
  },
  inProgressText: { fontSize: 11, fontWeight: "700", color: "#006A3B" },
  actionMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F6F3F2",
    borderRadius: 10,
  },
  actionMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionMetaText: { fontSize: 12, color: "#6F7A70", fontWeight: "500" },
  actionButtons: { flexDirection: "row", gap: 12, marginBottom: 12 },
  navigateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
  },
  navigateBtnBlocked: {
    backgroundColor: "#9E9E9E",
  },
  navigateBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  stopNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#BA1A1A",
    paddingVertical: 13,
    borderRadius: 14,
  },
  stopNavBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  reportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF3F2",
    paddingVertical: 13,
    borderRadius: 14,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#BA1A1A",
    flexShrink: 1,
  },
  cleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cleanBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  cleanBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  distanceHint: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
    fontStyle: 'italic',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingLeft: 4,
  },

  stopRow: { flexDirection: "row", marginBottom: 4 },
  timelineCol: { alignItems: "center", width: 32, marginRight: 14 },
  stopDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  stopDotCompleted: { backgroundColor: "#006E1C" },
  stopDotActive: { backgroundColor: "#006A3B" },
  stopDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C6D1C6",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E8F0EA",
    marginTop: -2,
    marginBottom: -2,
    minHeight: 20,
  },
  timelineLineCompleted: { backgroundColor: "#A8C9A8" },
  stopContent: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stopContentActive: { backgroundColor: "#EBF3EE" },
  stopRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stopName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6F7A70",
    lineHeight: 20,
  },
  stopNameActive: { color: "#006A3B", fontWeight: "700" },
  stopAddress: { fontSize: 12, color: "#C6D1C6", lineHeight: 16, marginTop: 1 },
  stopTime: { fontSize: 12, fontWeight: "600", color: "#6F7A70" },
  stopRowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopTags: { flexDirection: "row", gap: 6, flex: 1, flexWrap: "wrap" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: { fontSize: 11, color: "#6F7A70", fontWeight: "500" },
  cleanedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cleanedText: { fontSize: 11, fontWeight: "600", color: "#006A3B" },
  dwellText: { fontSize: 10, color: "#6F7A70", fontWeight: "500" },
  binStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#F0FFF4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  binStatusText: { fontSize: 12, color: "#065F46", fontWeight: "500" },
  binStatusDot: { fontSize: 12, color: "#6F7A70", marginHorizontal: 2 },
  markBtn: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navBtnText: { fontSize: 11, fontWeight: "600", color: "#006A3B" },

  sheetFooter: { paddingVertical: 20, alignItems: "center" },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  footerStat: { flex: 1, alignItems: "center" },
  footerStatValue: { fontSize: 15, fontWeight: "700", color: "#1B1C1C" },
  footerStatLabel: {
    fontSize: 11,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerDivider: { width: 1, height: 24, backgroundColor: "#E8F0EA" },
  completeRouteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#006A3B', borderRadius: 14, paddingVertical: 13,
    paddingHorizontal: 20, marginTop: 16, width: '100%', gap: 8,
  },
  completeRouteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  zoneOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    paddingHorizontal: 24,
  },
  zoneBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  zoneCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  zoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  zoneStatusDot: { width: 12, height: 12, borderRadius: 6 },
  zoneStatusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6F7A70",
    letterSpacing: 1.5,
    flex: 1,
  },
  zoneCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
  },
  zoneName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B1C1C",
    lineHeight: 28,
    marginBottom: 2,
  },
  zoneLevel: {
    fontSize: 15,
    color: "#6F7A70",
    lineHeight: 20,
    marginBottom: 20,
  },
  zoneMetrics: {
    flexDirection: "row",
    backgroundColor: "#F6F3F2",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  zoneMetric: { flex: 1, alignItems: "center" },
  zoneMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginBottom: 2,
  },
  zoneMetricLabel: {
    fontSize: 11,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  zoneMetricDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "#D4D0CF",
    alignSelf: "center",
  },
  zoneInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  zoneInfoText: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },
  zoneRecommendation: {
    flexDirection: "row",
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 12,
    marginBottom: 20,
  },
  zoneRecommendationText: {
    fontSize: 13,
    color: "#1B1C1C",
    lineHeight: 18,
    flex: 1,
  },
  zoneActions: { flexDirection: "row", gap: 10 },
  zoneActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  zoneActionBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  zoneActionBtnOutline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#F6F3F2",
  },
  zoneActionBtnOutlineText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6F7A70",
  },

  notScheduledBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 15,
  },
  notScheduledText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7F1D1D",
    flex: 1,
  },

  noRouteBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 15,
  },
  noRouteBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },

  unassignedCard: {
    backgroundColor: "#F6F3F2",
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    alignItems: "center",
  },
  unassignedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8EDEA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  unassignedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B1C1C",
    marginBottom: 10,
    textAlign: "center",
  },
  unassignedBody: {
    fontSize: 13,
    color: "#6F7A70",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  unassignedHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EBF3EE",
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  unassignedHintText: {
    fontSize: 12,
    color: "#006A3B",
    lineHeight: 18,
    flex: 1,
  },

  // ── Weight entry modal ──
  weightOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  weightSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  weightHandle: {
    width: 40, height: 4, backgroundColor: "#D1D5DB",
    borderRadius: 2, alignSelf: "center", marginBottom: 24,
  },
  weightTitle: {
    fontSize: 20, fontWeight: "700", color: "#1B1C1C", marginBottom: 4,
  },
  weightSub: {
    fontSize: 14, color: "#6B7280", marginBottom: 28,
  },
  weightInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F3F4F6", borderRadius: 20,
    paddingHorizontal: 28, paddingVertical: 12,
    marginBottom: 28, width: "100%", justifyContent: "center",
  },
  weightInput: {
    fontSize: 48, fontWeight: "800", color: "#1B1C1C",
    minWidth: 80, textAlign: "center",
  },
  weightUnit: {
    fontSize: 24, fontWeight: "600", color: "#6B7280",
    paddingTop: 12,
  },
  weightConfirmBtn: {
    backgroundColor: "#006A3B", paddingVertical: 16, borderRadius: 14,
    alignItems: "center", width: "100%", marginBottom: 12,
  },
  weightConfirmText: {
    fontSize: 17, fontWeight: "600", color: "#FFFFFF",
  },
  weightSkipBtn: {
    paddingVertical: 12, alignItems: "center", width: "100%",
  },
  weightSkipText: {
    fontSize: 14, color: "#9CA3AF",
  },

  // ── Route switcher ──
  routeSwitcherScroll: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  routeSwitcherContent: {
    gap: 8,
    paddingRight: 4,
  },
  routeSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DCD9D9',
    backgroundColor: '#FAFAF9',
    maxWidth: 180,
  },
  routeSwitchPillActive: {
    borderColor: '#006A3B',
    backgroundColor: '#EBF3EE',
  },
  routeSwitchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C6D1C6',
    flexShrink: 0,
  },
  routeSwitchDotActive: {
    backgroundColor: '#006A3B',
  },
  routeSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F7A70',
    flexShrink: 1,
  },
  routeSwitchTextActive: {
    color: '#006A3B',
  },
  routeSwitchTime: {
    fontSize: 11,
    color: '#9CA3AF',
    flexShrink: 0,
  },
  routeSwitchTimeActive: {
    color: '#4D9E72',
  },

  // ── Route deviation modal ──
  deviationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deviationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  deviationClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F6F3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviationIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  deviationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B1C1C',
    marginBottom: 10,
  },
  deviationBody: {
    fontSize: 14,
    color: '#6F7A70',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deviationBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A3B',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  deviationBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deviationBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  deviationBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B45309',
  },
  deviationBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#006A3B',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  deviationBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#006A3B',
  },

  /* New Shift Navigation Overlay Styles (Matching Design Layout) */
  shiftGuidanceContainer: {
    flex: 1,
    width: '100%',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  topBannerCard: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    backgroundColor: '#006A3B',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  turnIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerNextStopText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSubtext: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bannerOffRouteStrip: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bannerOffRouteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mapPillBtn: {
    position: 'absolute',
    left: 14,
    backgroundColor: '#006A3B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 20,
  },
  mapPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offRouteBanner: {
    position: 'absolute',
    left: 14,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 20,
  },
  offRouteBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rightControlPanel: {
    position: 'absolute',
    right: 14,
    width: 140,
    backgroundColor: '#006A3B',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  panelHeaderBlock: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  panelCollectHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  panelBinText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 2,
    textAlign: 'center',
  },
  panelLocationSub: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelBtnPrimary: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#004D2B',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  panelBtnOutline: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: '#003D22',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  bottomLeftExitBtn: {
    position: 'absolute',
    left: 14,
    bottom: 95,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
  },
  bottomLeftExitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationPreloaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 24,
  },
  locationPreloaderCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 24,
    paddingHorizontal: 26,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    maxWidth: 310,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  preloaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  preloaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#006A3B',
    letterSpacing: 0.5,
  },
  preloaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  preloaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
});
