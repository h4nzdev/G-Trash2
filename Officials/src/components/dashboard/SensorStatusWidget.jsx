import React from 'react';
import { Wind, AlertTriangle, CheckCircle, Activity, MapPin, Radio } from 'lucide-react';

export default function SensorStatusWidget({ readings = [], onNavigateAlerts }) {


  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" /> Live MQ-135 Air Quality Telemetry
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Real-time environmental sensor updates</p>
        </div>
        {onNavigateAlerts && (
          <button
            onClick={onNavigateAlerts}
            className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
          >
            Manage IoT Alerts
          </button>
        )}
      </div>

      {/* Sensor Cards List */}
      <div className="p-4 space-y-4">
        {readings.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No registered IoT sensors connected</p>
            <p className="text-xs text-slate-400 mt-1">IoT sensor telemetry will appear here when online.</p>
          </div>
        ) : (
          readings.map((sensor) => {
            const raw = sensor.rawValue || 0;
            const status = sensor.airQuality || (raw >= 700 ? 'Critical' : raw >= 400 ? 'Moderate' : 'Clean');
            const isCritical = status === 'Critical' || status === 'Unhealthy' || status === 'Hazardous' || raw >= 700;
            const isModerate = status === 'Moderate' || (raw >= 400 && raw < 700);

            const adcPercentage = Math.min(100, Math.max(0, Math.round((raw / 4095) * 100)));
            const voltage = (raw * (3.3 / 4095.0)).toFixed(2);

            return (
              <div
                key={sensor.sensorId || sensor._id}
                className={`p-4 rounded-xl border transition-all ${
                  isCritical
                    ? 'bg-red-50/60 border-red-200'
                    : isModerate
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-emerald-50/40 border-emerald-200'
                }`}
              >
                {/* Top Row: Sensor ID & Air Quality Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCritical ? 'bg-red-100 text-red-600' : isModerate ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      <Wind className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        {sensor.sensorId}
                        <span className="text-[10px] font-normal text-slate-500">({sensor.deviceType || 'ESP32'})</span>
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {sensor.location || 'Sensor Zone'}{sensor.barangay ? `, Barangay ${sensor.barangay}` : ''}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-sm ${
                      isCritical
                        ? 'bg-red-600 text-white animate-pulse'
                        : isModerate
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isCritical ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    {status.toUpperCase()}
                  </div>
                </div>

                {/* Middle Row: Raw ADC & Voltage Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-white rounded-lg border border-slate-100 mb-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Raw ADC Value</p>
                    <p className={`text-sm font-black ${isCritical ? 'text-red-600' : 'text-slate-800'}`}>
                      {raw} <span className="text-[10px] font-medium text-slate-400">/ 4095</span>
                    </p>
                  </div>
                  <div className="border-x border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Sensor Voltage</p>
                    <p className="text-sm font-bold text-slate-800">{voltage} V</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Air Quality Rating</p>
                    <p className={`text-sm font-bold ${isCritical ? 'text-red-600' : isModerate ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {status}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: ADC Meter Bar */}
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mb-1">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-indigo-500" /> Air Quality Threshold Scale
                    </span>
                    <span>Critical Limit: 700 ADC</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-[17%] w-0.5 bg-slate-800 z-10 opacity-60" />
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCritical ? 'bg-red-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(5, adcPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
