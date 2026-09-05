import React, { useState } from "react";
import { Layers, Map, Globe, Moon } from "lucide-react";

export const GOOGLE_MAP_TILES = {
  grayscale: {
    name: "Leaflet Grayscale",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    icon: Map,
    className: "leaflet-tile-grayscale",
  },
  osm: {
    name: "OpenStreetMap Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    icon: Layers,
    className: "",
  },
  dark: {
    name: "Leaflet Dark",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    icon: Moon,
    className: "leaflet-tile-dark",
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    icon: Globe,
    className: "",
  },
};

export default function MapTileControl({ activeTileKey = "grayscale", onChangeTile }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-[1000]">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200/80 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700"
          title="Change Map Style"
        >
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>{GOOGLE_MAP_TILES[activeTileKey]?.name || "Leaflet Grayscale"}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/80 py-1 z-[1001] animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              Map Style
            </div>
            {Object.entries(GOOGLE_MAP_TILES).map(([key, style]) => {
              const Icon = style.icon;
              const isActive = activeTileKey === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    onChangeTile(key);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>{style.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
