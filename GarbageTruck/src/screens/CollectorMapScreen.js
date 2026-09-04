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
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
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

// ── Leaflet HTML ───────────────────────────────────────────
function buildLeafletHTML(truckB64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { height:100%; width:100%; overflow:hidden; }
    #map-perspective {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #e8ede8;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
    }
  </style>
</head>
<body>
  <div id="map-perspective">
    <div id="map"></div>
  </div>
  <script>
    (function() {
      var map, routeLayer, currentMarker;

      var southWest = new L.LatLng(10.275, 123.845);
      var northEast = new L.LatLng(10.355, 123.925);
      var cebuBounds = new L.LatLngBounds(southWest, northEast);

      map = new L.Map('map', {
        zoomControl: false, attributionControl: false, dragging: true,
        scrollWheelZoom: false, doubleClickZoom: true, touchZoom: true,
        minZoom: 10, maxZoom: 18,
        inertia: true, inertiaDeceleration: 3000,
      });
      map.setView([10.325, 123.893], 14);

      var tileLayer, hillshadeLayer, labelsLayer;
      function setTileLayer(style) {
        if (tileLayer) map.removeLayer(tileLayer);
        if (hillshadeLayer) map.removeLayer(hillshadeLayer);
        if (labelsLayer) map.removeLayer(labelsLayer);

        if (style === 'satellite') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 18, minZoom: 10, attribution: '' }
          );
        } else if (style === 'topographic') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 18, minZoom: 10, attribution: '' }
          );
          hillshadeLayer = L.tileLayer(
            'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
            { opacity: 0.25, maxZoom: 18 }
          ).addTo(map);
          labelsLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { opacity: 0.7, maxZoom: 18 }
          ).addTo(map);
        } else {
          tileLayer = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { opacity: 0.9, maxZoom: 17, minZoom: 13 }
          );
        }
        tileLayer.addTo(map);
      }
      setTileLayer('topographic');
      window.setMapStyle = setTileLayer;

      // Cebu City boundary — traced clockwise from the north-west coast
      var CEBU_OUTLINE = [
        // North border (shared with Consolacion), west coast start
        [10.3565,123.8808],[10.3592,123.8842],[10.3610,123.8882],[10.3620,123.8925],
        [10.3624,123.8972],[10.3618,123.9018],[10.3600,123.9065],[10.3568,123.9112],
        // NE — descending eastern mountain ridge
        [10.3525,123.9158],[10.3475,123.9200],[10.3420,123.9235],[10.3362,123.9262],
        [10.3302,123.9278],[10.3242,123.9284],[10.3182,123.9278],[10.3124,123.9260],
        [10.3068,123.9234],[10.3015,123.9202],[10.2965,123.9165],[10.2918,123.9124],
        [10.2874,123.9080],[10.2834,123.9032],[10.2798,123.8982],[10.2766,123.8928],
        // SE — southern boundary (with Talisay)
        [10.2740,123.8868],[10.2720,123.8805],[10.2708,123.8740],[10.2703,123.8675],
        [10.2706,123.8612],[10.2718,123.8555],
        // SW corner
        [10.2738,123.8508],[10.2770,123.8472],[10.2806,123.8452],[10.2844,123.8445],
        [10.2878,123.8452],[10.2908,123.8465],[10.2936,123.8480],
        // West coast going north — reclamation area creates a near-straight run
        [10.2965,123.8488],[10.2995,123.8493],[10.3025,123.8496],[10.3055,123.8500],
        [10.3085,123.8506],[10.3115,123.8515],[10.3145,123.8528],[10.3172,123.8545],
        // North Reclamation Area / port zone
        [10.3196,123.8558],[10.3220,123.8568],[10.3246,123.8573],[10.3272,123.8576],
        [10.3300,123.8580],[10.3328,123.8588],[10.3358,123.8600],[10.3388,123.8616],
        [10.3415,123.8636],[10.3440,123.8660],[10.3464,123.8686],[10.3487,123.8714],
        [10.3508,123.8742],[10.3526,123.8770],[10.3544,123.8792],[10.3558,123.8802],
        [10.3565,123.8808]
      ];
      var cityOutlineLayer = null;
      window.toggleCityOutline = function(show) {
        if (show && !cityOutlineLayer) {
          cityOutlineLayer = L.polyline(CEBU_OUTLINE, { color: '#2563EB', weight: 2.5, opacity: 0.65, dashArray: '12, 6', lineJoin: 'round', interactive: false }).addTo(map);
        } else if (!show && cityOutlineLayer) {
          map.removeLayer(cityOutlineLayer);
          cityOutlineLayer = null;
        }
      };
      window.toggleCityOutline(true);

      // Report marker icons
      function makeBinHtml(score) {
        var isHigh = score >= 5;
        var color = isHigh ? '#EF4444' : '#F59E0B';
        return '<div style="position:relative;display:flex;flex-direction:column;align-items:center;">' +
          '<div style="background:#fff;padding:2px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #e2e8f0;'+(isHigh ? 'animation:pulse-red 2s infinite;' : '')+'">' +
            '<div style="background:'+color+';width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -1px 0 rgba(0,0,0,0.15);">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>' +
            '</div>' +
          '</div>' +
          '<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #fff;margin-top:-2px;"></div>' +
          (isHigh ? '<div style="position:absolute;top:-4px;right:-4px;background:#EF4444;color:#fff;width:14px;height:14px;border-radius:7px;font-size:7px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:2;">' + score + '</div>' : '') +
        '</div>';
      }
 
      var reportMarkers = [];
      window.clearReportMarkers = function() {
        reportMarkers.forEach(function(m) { map.removeLayer(m); });
        reportMarkers = [];
      };
      window.addReportMarkers = function(reportsJson) {
        window.clearReportMarkers();
        var arr = JSON.parse(reportsJson);
        arr.forEach(function(r) {
          var icon = L.divIcon({ html: makeBinHtml(r.score), iconSize:[20,26], iconAnchor:[10,26], className:'' });
          var m = L.marker([r.lat, r.lng], { icon: icon });
          m.on('click', function() { window.ReactNativeWebView.postMessage('report:' + r.id); });
          m.addTo(map);
          reportMarkers.push(m);
        });
      };

      // ── Dynamic heatmap zones (injected from React Native) ──
      var heatmapLayers = [];

      window.clearHeatmapZones = function() {
        heatmapLayers.forEach(function(l) { map.removeLayer(l); });
        heatmapLayers = [];
      };

      var sensorIcon = L.divIcon({
        html: '<div style="display:flex;align-items:center;justify-content:center;background:#0F172A;width:24px;height:24px;border-radius:50%;border:2px solid #38BDF8;box-shadow:0 2px 6px rgba(0,0,0,0.4);">' +
              '<span style="font-size:11px;line-height:24px;">📡</span>' +
              '</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: ''
      });

      window.updateHeatmapZones = function(zonesJson) {
        window.clearHeatmapZones();
        var zones;
        try { zones = JSON.parse(zonesJson); } catch(e) { return; }
        zones.forEach(function(zone) {
          if (zone.lat == null || zone.lng == null) return;
          var color = zone.status === 'critical' ? '#E53935'
                    : zone.status === 'moderate'  ? '#FDD835'
                    : '#4CAF50';
          var fillOpacity = zone.status === 'critical' ? 0.38
                          : zone.status === 'moderate'  ? 0.28
                          : 0.2;
          var radius = Math.max(80, Math.min(450, (zone.intensity || 0.5) * 450));
          var circle = L.circle([zone.lat, zone.lng], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: 2,
            opacity: 0.9,
            interactive: true,
          });
          circle.on('click', function() {
            window.ReactNativeWebView.postMessage('heatmap:' + zone.id);
          });
          circle.addTo(map);
          heatmapLayers.push(circle);

          // Add a marker showing the physical location where the IoT sensor is integrated
          if (zone.sensorId) {
            var sensorMarker = L.marker([zone.lat, zone.lng], { icon: sensorIcon });
            sensorMarker.bindPopup(
              '<div style="font-family:sans-serif;min-width:130px;padding:2px;">' +
              '<b style="font-size:12px;color:#0F172A;">📡 IoT Waste Sensor</b><br>' +
              '<span style="font-size:10px;color:#64748B;">Zone: ' + (zone.name || zone.id) + '</span><br>' +
              '<span style="font-size:11px;color:#1E293B;font-weight:600;display:inline-block;margin-top:4px;">Status: ' + 
              (zone.status === 'critical' ? '🔴 Critical' : zone.status === 'moderate' ? '🟡 Moderate' : '🟢 Clean') + '</span>' +
              '</div>'
            );
            sensorMarker.addTo(map);
            heatmapLayers.push(sensorMarker);
          }
        });
      };

      // Stop marker icons
      var completedIcon = L.divIcon({
        html:'<div style="position:relative;display:flex;flex-direction:column;align-items:center;">' +
             '<div style="background:#059669;width:24px;height:24px;border-radius:12px;border:2.5px solid white;box-shadow:0 3px 8px rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;">' +
               '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
             '</div>' +
             '<div style="background:#065F46;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2);">CLEAN</div>' +
             '</div>',
        iconSize:[40,40],
        iconAnchor:[20,12],
        className:''
      });
      var activeIcon = L.divIcon({
        html:'<div style="background:#2563EB;width:22px;height:22px;border-radius:11px;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.4);"></div>',
        iconSize:[22,22],
        iconAnchor:[11,11],
        className:''
      });
      var upcomingIcon = L.divIcon({
        html:'<div style="background:#94A3B8;width:14px;height:14px;border-radius:7px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.15);"></div>',
        iconSize:[14,14],
        iconAnchor:[7,7],
        className:''
      });

      // Dynamic stop markers — injected from React Native when route loads
      var stopMarkers = [];
      window.clearStopMarkers = function() {
        stopMarkers.forEach(function(m) { map.removeLayer(m); });
        stopMarkers = [];
      };
      window.addStopMarkers = function(stopsJson) {
        window.clearStopMarkers();
        var arr = JSON.parse(stopsJson);
        arr.forEach(function(s) {
          var icon = s.status === 'completed' ? completedIcon : s.status === 'in-progress' ? activeIcon : upcomingIcon;
          var m = L.marker([s.lat, s.lng], { icon: icon });
          m.bindPopup(
            '<div style="font-family:sans-serif;padding:3px;text-align:center;">' +
            '<b style="font-size:12px;color:#0F172A;">' + (s.status === 'completed' ? '✨ ' : '📍 ') + s.name + '</b><br>' +
            '<span style="font-size:11px;font-weight:700;color:' + (s.status === 'completed' ? '#059669' : '#2563EB') + ';">' +
            (s.status === 'completed' ? 'Marked as Clean ✓' : 'Scheduled Stop') +
            '</span>' +
            '</div>'
          );
          m.addTo(map);
          stopMarkers.push(m);
        });
      };

      // Dynamic route layer
      window.updateTruckRoute = function(coordsJson) {
        if (routeLayer) { map.removeLayer(routeLayer); }
        var coords = JSON.parse(coordsJson);
        if (coords && coords.length > 0) {
          routeLayer = L.polyline(coords, {
            color: '#006A3B',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
          map.fitBounds(routeLayer.getBounds().pad(0.1));
        }
      };

      var TB = '${truckB64}';

      // Navigation Arrow (Directional Triangle)
      function createArrowMarker(lat, lng, bearing) {
        var arrowHtml =
          '<div style="transform: rotate(' + (bearing || 0) + 'deg); filter: drop-shadow(0 4px 10px rgba(0,106,59,0.3));">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#2196F3" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        var navIcon = L.divIcon({
          html: arrowHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: ''
        });
        return L.marker([lat, lng], { icon: navIcon, zIndexOffset: 2000 });
      }

      function getBearing(lat1, lng1, lat2, lng2) {
        var dLon = (lng2 - lng1) * Math.PI / 180;
        var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        var brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
      }

      var followMode = false;

      // Moves the arrow to the driver's real GPS position
      window.updateDriverPosition = function(lat, lng, bearing) {
        if (currentMarker) { map.removeLayer(currentMarker); }
        currentMarker = createArrowMarker(lat, lng, bearing || 0);
        currentMarker.addTo(map);
        if (followMode) {
          map.panTo([lat, lng], { animate: true, duration: 0.5 });
        }
      };

      // Called when navigation starts — zooms in and enables auto-follow
      window.startFollow = function(lat, lng, heading) {
        followMode = true;
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        currentMarker = createArrowMarker(lat, lng, heading || 0);
        currentMarker.addTo(map);
        map.flyTo([lat, lng], 17, { duration: 1.2, easeLinearity: 0.25 });
      };

      // Called when navigation ends — disables auto-follow
      window.stopFollow = function() {
        followMode = false;
      };

      // Gray idle navigation arrow
      window.showIdleTruck = function(lat, lng) {
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        var idleHtml =
          '<div style="opacity:0.6; filter: grayscale(100%);">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#9CA3AF" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        var idleIcon = L.divIcon({ html: idleHtml, iconSize: [40, 40], iconAnchor: [20, 20], className: '' });
        currentMarker = L.marker([lat, lng], { icon: idleIcon, zIndexOffset: 2000 });
        currentMarker.addTo(map);
      };

      window.centerMap = function(lat, lng) {
        map.flyTo([lat, lng], 16, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      };

      window.stopNavigation = function(lat, lng) {
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        if (lat !== undefined && lng !== undefined) {
          window.showIdleTruck(lat, lng);
        }
      };

      setTimeout(function() { 
        map.invalidateSize(); 
        window.ReactNativeWebView.postMessage('map_ready');
      }, 200);
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
  if (!coords || coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentM(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
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
  const [selectedZone, setSelectedZone] = useState(null);
  const [heatmapZones, setHeatmapZones] = useState([]); // live from /api/garbage-areas
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showTrashBins, setShowTrashBins] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showCityOutline, setShowCityOutline] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [clearingSitio, setClearingSitio] = useState(null);

  const handleMarkStopClean = async (scheduleId, sitioName) => {
    if (!scheduleId || !sitioName) return;
    setClearingSitio(sitioName);
    try {
      // 1. Mark task as complete on backend schedule
      await fetch(`${TRACKING_SERVER}/api/schedules/${scheduleId}/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitioName }),
      });

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
          wasteType: 'General',
          bins: 1,
          barangay,
          status: 'verified',
        }),
      }).catch(() => {});

      // 3. Update local state immediately
      setTodaySchedules(prev => {
        if (!prev) return prev;
        return prev.map(s => {
          if (s._id === scheduleId) {
            const updatedTasks = (s.sitioTasks || []).map(t => {
              if (t.name.toLowerCase() === sitioName.toLowerCase()) {
                return { ...t, completed: true, completedAt: new Date() };
              }
              return t;
            });
            const allDone = updatedTasks.length > 0 ? updatedTasks.every(t => t.completed) : true;
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

  const [sitioList, setSitioList] = useState([]);

  const isExpandedRef = useRef(false);
  const navigationActiveRef = useRef(false);
  const lastGpsRef = useRef(null);
  const shiftStartRef = useRef(null);
  const zoneCardAnim = useRef(new Animated.Value(0)).current;
  const socketRef = useRef(null);
  const webViewRef = useRef(null);
  const webViewReady = useRef(false);

  const activeSchedule = todaySchedules?.find(s => s._id === activeScheduleId);
  const assignedRouteBarangay = activeSchedule?.barangay || activeSchedule?.routeName || '';

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
    let routeCoords = [];
    for (const sched of todaySchedules || []) {
      if (sched.routeCoords && sched.routeCoords.length > 0) {
        routeCoords = [...routeCoords, ...sched.routeCoords];
      } else if (sched.sitioTasks && sched.sitioTasks.length > 1) {
        const coords = sched.sitioTasks.map(t => [t.lat, t.lng]);
        routeCoords = [...routeCoords, ...coords];
      }
    }
    const routeCoordsJson = JSON.stringify(routeCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
  }, [sitioList, todaySchedules, webViewReady.current]);

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

    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchTodaySchedules();
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
        if (pos && webViewRef.current) {
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

          // Always draw the truck position on the map even if shift hasn't started
          if (webViewReady.current) {
            webViewRef.current?.injectJavaScript(
              `window.updateDriverPosition(${latitude}, ${longitude}, ${heading || 0}); true;`,
            );
          }

          if (navigationActiveRef.current) {
            setCurrentSpeed(Math.round((speed || 0) * 3.6));
            socket.emit("truck:location", {
              truckId: TRUCK_ID,
              lat: latitude,
              lng: longitude,
              heading: heading || 0,
              speed: speed || 0,
            });
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

    const pos = lastGpsRef.current;
    const lat = pos?.lat ?? 10.325;
    const lng = pos?.lng ?? 123.893;
    const heading = pos?.heading ?? 0;

    webViewRef.current?.injectJavaScript(
      `window.startFollow(${lat}, ${lng}, ${heading}); true;`,
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
                    (!todaySchedules || todaySchedules.length === 0) && styles.bigStartBtnWaiting
                  ]} 
                  onPress={startNavigation}
                  activeOpacity={0.9}
                >
                  <MaterialIcons
                    name={(!todaySchedules || todaySchedules.length === 0) ? "hourglass-empty" : "local-shipping"}
                    size={22}
                    color="#FFF"
                  />
                  <Text style={styles.bigStartBtnText}>
                    {(!todaySchedules || todaySchedules.length === 0) ? "WAITING FOR SCHEDULE" : "START SHIFT"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Active Guidance Mode */
            <View style={styles.guidanceMode} pointerEvents="box-none">
              {isFocusMode && (
                <View style={styles.focusGuidanceBanner}>
                  <View style={styles.focusGuidanceTop}>
                    <View style={styles.focusTurnIconBox}>
                      <MaterialIcons name="local-shipping" size={32} color="#FFF" />
                    </View>
                    <View style={styles.focusGuidanceText}>
                      <Text style={styles.focusDistanceText}>{currentSpeed} km/h</Text>
                      <Text style={styles.focusStreetText}>Active in {assignedRouteBarangay || 'Assigned Area'}</Text>
                    </View>
                  </View>
                  <View style={styles.focusGuidanceDivider} />
                  <View style={styles.focusGuidanceBottom}>
                    <View style={styles.focusStatsBox}>
                      <Text style={styles.focusStatLabel}>DURATION</Text>
                      <Text style={styles.focusStatValue}>{elapsedDisplay}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.focusStopBtn}
                      onPress={stopNavigation}
                    >
                      <Text style={styles.focusStopBtnText}>EXIT SHIFT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Floating Actions Overlay */}
        {!isFocusMode && (
          <View style={[styles.floatingActions, { top: Math.max(16, topInset) }]}>
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
                      : (todaySchedules?.length > 0)
                      ? styles.statusBadgeDotReady
                      : styles.statusBadgeDotWaiting
                  ]} />
                  <Text style={styles.sheetTitle}>
                    {navigationActive
                      ? 'Shift In Progress'
                      : (todaySchedules?.length > 0)
                      ? 'Waiting — Ready'
                      : 'Waiting for Schedule'}
                  </Text>
                </View>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {navigationActive
                    ? `Streaming GPS for ${assignedRouteBarangay || 'assigned area'}`
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
                    : (todaySchedules?.length > 0)
                    ? styles.sheetHeaderActionBtnStart
                    : styles.sheetHeaderActionBtnWaiting
                ]}
                onPress={navigationActive ? stopNavigation : startNavigation}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={navigationActive ? "stop" : (todaySchedules?.length > 0) ? "play-arrow" : "hourglass-empty"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.sheetHeaderActionBtnText}>
                  {navigationActive ? 'End' : (todaySchedules?.length > 0) ? 'Start' : 'Waiting'}
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
                                  onPress={() => handleMarkStopClean(sched._id, task.name)}
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
                        color: navigationActive ? '#065F46' : (todaySchedules?.length > 0) ? '#D97706' : '#6B7280'
                      }}>
                        {navigationActive
                          ? 'On Duty (Active)'
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
                      : (!todaySchedules || todaySchedules.length === 0)
                      ? { backgroundColor: '#6B7280' }
                      : { backgroundColor: '#006A3B' }
                  ]}
                  onPress={navigationActive ? stopNavigation : startNavigation}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={navigationActive ? "stop" : (todaySchedules?.length > 0) ? "play-arrow" : "hourglass-empty"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.deviationBtnPrimaryText}>
                    {navigationActive
                      ? 'End Shift'
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
});
