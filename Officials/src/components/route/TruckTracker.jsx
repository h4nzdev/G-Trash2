import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const statusColors = { active: '#10b981', delayed: '#f59e0b', stopped: '#ef4444' };

function createTruckIcon(truck) {
  const color = statusColors[truck.status] || '#10b981';
  return L.divIcon({
    className: 'truck-icon',
    html: `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        font-family: Inter, system-ui, sans-serif;
      ">${truck.id.split('-')[1]}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const routeLines = {
  'GT-401': [[10.325, 123.893], [10.330, 123.890], [10.335, 123.885]],
  'GT-402': [[10.330, 123.940], [10.325, 123.930], [10.318, 123.920]],
  'GT-403': [[10.327, 123.898], [10.330, 123.903], [10.333, 123.908]],
  'GT-404': [[10.340, 123.910], [10.345, 123.905], [10.350, 123.900]],
  'GT-405': [[10.295, 123.895], [10.298, 123.888], [10.301, 123.880]],
  'GT-406': [[10.308, 123.891], [10.303, 123.888], [10.298, 123.886]],
  'GT-407': [[10.370, 123.920], [10.375, 123.915], [10.380, 123.910]],
  'GT-408': [[10.318, 123.909], [10.322, 123.914], [10.326, 123.919]],
};

export default function TruckTracker({ trucks, selectedTruck }) {
  return (
    <MapContainer
      center={[10.3157, 123.8854]}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      className="rounded-2xl z-0"
    >
      <TileLayer
        className="leaflet-tile-grayscale"
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {trucks.map((truck) => {
        const color = statusColors[truck.status] || '#10b981';
        const line = routeLines[truck.id];
        return (
          <div key={truck.id}>
            <Marker
              position={[truck.lat, truck.lng]}
              icon={createTruckIcon(truck)}
            >
              <Popup>
                <div className="p-1 min-w-[160px]">
                  <p className="font-bold text-slate-900 text-sm">{truck.id}</p>
                  <p className="text-xs text-slate-600">{truck.driver}</p>
                  <p className="text-xs text-slate-500 mt-1">📍 {truck.currentLocation}</p>
                  <p className="text-xs text-slate-500">🚛 {truck.route}</p>
                  <p className="text-xs text-slate-500">🕐 ETA: {truck.eta}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-xs font-semibold capitalize" style={{ color }}>
                      {truck.status}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>

            {line && (
              <Polyline
                positions={line}
                pathOptions={{
                  color,
                  weight: 3,
                  opacity: 0.6,
                  dashArray: truck.status !== 'active' ? '6 6' : undefined,
                }}
              />
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
