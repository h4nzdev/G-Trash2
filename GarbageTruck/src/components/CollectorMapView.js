import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Generates Leaflet HTML with stop markers, heatmap circles, route polyline and truck icon.
// All JS inside the HTML uses var/function style for WebView compatibility.
function generateCollectorMapHTML(stops, truckLat, truckLng) {
  const stopsJSON = JSON.stringify(
    stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, status: s.status }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .leaflet-control-zoom { display: none; }
    .leaflet-container { background: #f0eded; }
    img { pointer-events: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var stops = ${stopsJSON};

      var map = new L.Map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: true,
      });
      map.setView([${truckLat}, ${truckLng}], 14);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        opacity: 0.9, maxZoom: 17, minZoom: 12,
      }).addTo(map);

      // Heatmap circles
      L.circleMarker([10.295, 123.895], { radius: 35, color: '#E53935', fillColor: '#E53935', fillOpacity: 0.22, weight: 2 }).addTo(map);
      L.circleMarker([10.308, 123.895], { radius: 35, color: '#FDD835', fillColor: '#FDD835', fillOpacity: 0.22, weight: 2 }).addTo(map);
      L.circleMarker([10.328, 123.900], { radius: 35, color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 0.22, weight: 2 }).addTo(map);

      // Route polyline connecting all stops
      var coords = [];
      for (var i = 0; i < stops.length; i++) { coords.push([stops[i].lat, stops[i].lng]); }
      if (coords.length > 1) {
        L.polyline(coords, { color: '#006A3B', weight: 4, dashArray: '8, 8', opacity: 0.65 }).addTo(map);
      }

      // Stop markers
      for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        var markerHtml, iconW, iconH, aX, aY;

        if (stop.status === 'completed') {
          markerHtml = '<div style="width:26px;height:26px;border-radius:50%;background:#006E1C;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,106,59,0.4);"><span style="color:white;font-size:13px;font-weight:bold;">&#10003;</span></div>';
          iconW = 26; iconH = 26; aX = 13; aY = 13;
        } else if (stop.status === 'in-progress') {
          markerHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:32px;height:32px;border-radius:50%;background:#006A3B;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,106,59,0.5);"><span style="font-size:16px;line-height:1;">&#128666;</span></div><span style="font-size:10px;font-weight:bold;color:#006A3B;background:white;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.12);white-space:nowrap;">' + stop.name + '</span></div>';
          iconW = 72; iconH = 52; aX = 36; aY = 16;
        } else {
          markerHtml = '<div style="width:18px;height:18px;border-radius:50%;background:#BECABE;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.15);"></div>';
          iconW = 18; iconH = 18; aX = 9; aY = 9;
        }

        L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({ html: markerHtml, iconSize: [iconW, iconH], iconAnchor: [aX, aY], className: '' })
        }).addTo(map);
      }

      // Truck marker
      L.marker([${truckLat}, ${truckLng}], {
        icon: L.divIcon({
          html: '<div style="background:#006A3B;border-radius:12px;padding:6px 10px;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,106,59,0.3);border:2px solid white;white-space:nowrap;"><span style="font-size:14px;">&#128666;</span><span style="color:white;font-size:10px;font-weight:bold;">GT-402</span></div>',
          iconSize: [82, 36], iconAnchor: [41, 18], className: '',
        })
      }).addTo(map);

      setTimeout(function() { map.invalidateSize(); }, 200);
    })();
  </script>
</body>
</html>`;
}

export default function CollectorMapView({ stops, currentStopIndex, truckLocation, style }) {
  const inProgressStop = stops && currentStopIndex >= 0 ? stops[currentStopIndex] : null;
  const lat = truckLocation ? truckLocation.lat : inProgressStop ? inProgressStop.lat : 10.3157;
  const lng = truckLocation ? truckLocation.lng : inProgressStop ? inProgressStop.lng : 123.8854;

  const statusKey = stops ? stops.map(s => s.status).join(',') : '';

  return (
    <WebView
      key={statusKey}
      source={{ html: generateCollectorMapHTML(stops || [], lat, lng) }}
      style={[styles.webView, style]}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      mixedContentMode="compatibility"
    />
  );
}

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: '#F0EDED' },
});
