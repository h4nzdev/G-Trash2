import React, { useState, useEffect, useRef } from 'react';
import { Wind, AlertTriangle, CheckCircle, Activity, MapPin, Radio, History, TrendingUp, TrendingDown, Minus, Clock, Info } from 'lucide-react';
import API from '../../config';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SensorStatusWidget({ readings = [], onNavigateAlerts }) {
  const [historyMap, setHistoryMap] = useState({});
  const lastReadingsRef = useRef({});

  useEffect(() => {
    readings.forEach(async (sensor) => {
      const sId = sensor.sensorId;
      if (!sId) return;

      // Track runtime changes when new readings stream in
      const prevStored = lastReadingsRef.current[sId];
      if (prevStored && prevStored.rawValue !== sensor.rawValue) {
        setHistoryMap((h) => ({
          ...h,
          [sId]: prevStored,
        }));
      }
      lastReadingsRef.current[sId] = {
        rawValue: sensor.rawValue,
        airQuality: sensor.airQuality,
        timestamp: sensor.timestamp || new Date().toISOString(),
      };

      // Also query historical readings from the database if not yet cached
      if (!historyMap[sId] && !sensor.previousReading) {
        try {
          const headers = {};
          const token = localStorage.getItem('gtrash_token');
          if (token) headers.Authorization = `Bearer ${token}`;

          const res = await fetch(`${API}/api/iot/readings?sensorId=${encodeURIComponent(sId)}&limit=5`, { headers });
          if (res.ok) {
            const list = await res.json();
            // list[0] is current reading; list[1] is the data prior to the current main reading
            if (Array.isArray(list) && list.length > 1) {
              setHistoryMap((h) => ({
                ...h,
                [sId]: list[1],
              }));
            }
          }
        } catch (e) {
          // gracefully fallback
        }
      }
    });
  }, [readings]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" /> Garbage-Area Air Quality Status
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Real-time MQ-135 environmental operational classification</p>
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
            const cleanThresh = sensor.cleanThreshold || 200;
            const critThresh = sensor.criticalThreshold || 400;

            // Strict 3-level operational classification: CLEAN | MODERATE | CRITICAL
            let status = 'CLEAN';
            if (sensor.airQuality) {
              const u = String(sensor.airQuality).toUpperCase();
              if (u === 'CRITICAL' || u === 'UNHEALTHY' || u === 'HAZARDOUS') status = 'CRITICAL';
              else if (u === 'MODERATE') status = 'MODERATE';
              else status = 'CLEAN';
            } else {
              if (raw >= critThresh) status = 'CRITICAL';
              else if (raw >= cleanThresh) status = 'MODERATE';
              else status = 'CLEAN';
            }

            const isCritical = status === 'CRITICAL';
            const isModerate = status === 'MODERATE';

            const adcPercentage = Math.min(100, Math.max(0, Math.round((raw / 4095) * 100)));
            const voltage = (raw * (3.3 / 4095.0)).toFixed(2);

            // Previous data prior to the current main reading
            const prevReading = sensor.previousReading || historyMap[sensor.sensorId] || null;
            const prevRaw = prevReading?.rawValue ?? null;
            const prevVoltage = prevRaw !== null ? (prevRaw * (3.3 / 4095.0)).toFixed(2) : null;
            let prevStatus = null;
            if (prevRaw !== null) {
              prevStatus = prevRaw >= critThresh ? 'CRITICAL' : prevRaw >= cleanThresh ? 'MODERATE' : 'CLEAN';
            } else if (prevReading?.airQuality) {
              const pu = String(prevReading.airQuality).toUpperCase();
              prevStatus = (pu === 'CRITICAL' || pu === 'UNHEALTHY' || pu === 'HAZARDOUS') ? 'CRITICAL' : pu === 'MODERATE' ? 'MODERATE' : 'CLEAN';
            }
            const prevIsCritical = prevStatus === 'CRITICAL';
            const prevIsModerate = prevStatus === 'MODERATE';
            const deltaRaw = prevRaw !== null ? raw - prevRaw : null;

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
                    {status}
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Operational Status</p>
                    <p className={`text-sm font-bold ${isCritical ? 'text-red-600' : isModerate ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {status}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: ADC Meter Bar & Active Thresholds */}
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mb-1">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-indigo-500" /> Operational Scale: Clean (&lt;{cleanThresh}) | Moderate ({cleanThresh}-{critThresh}) | Critical (&ge;{critThresh})
                    </span>
                    <span>Critical: {critThresh} ADC</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-[9.8%] w-0.5 bg-slate-800 z-10 opacity-60" title={`Critical Limit: ${critThresh} ADC`} />
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCritical ? 'bg-red-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(5, adcPercentage)}%` }}
                    />
                  </div>
                </div>

                {/* Previous Reading (Recent Data Prior to Current Push) */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-500">Prior Reading:</span>
                    {prevRaw !== null ? (
                      <span className="font-bold text-slate-800">
                        {prevRaw} ADC
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({prevVoltage} V)
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Initial baseline broadcast</span>
                    )}
                  </div>

                  {prevRaw !== null && (
                    <div className="flex items-center gap-2">
                      {/* Previous Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          prevIsCritical
                            ? 'bg-red-100 text-red-700'
                            : prevIsModerate
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {prevStatus}
                      </span>

                      {/* Delta Shift Indicator */}
                      <span
                        className={`font-extrabold flex items-center gap-0.5 text-[10px] ${
                          deltaRaw > 0
                            ? 'text-red-600'
                            : deltaRaw < 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                        }`}
                        title={
                          deltaRaw > 0
                            ? `Increased by ${deltaRaw} ADC from prior reading`
                            : deltaRaw < 0
                            ? `Decreased by ${Math.abs(deltaRaw)} ADC from prior reading`
                            : 'No change from prior reading'
                        }
                      >
                        {deltaRaw > 0 ? (
                          <>
                            <TrendingUp className="w-3 h-3" />
                            +{deltaRaw} ADC
                          </>
                        ) : deltaRaw < 0 ? (
                          <>
                            <TrendingDown className="w-3 h-3" />
                            {deltaRaw} ADC
                          </>
                        ) : (
                          <>
                            <Minus className="w-3 h-3" />
                            Steady
                          </>
                        )}
                      </span>

                      {/* Timestamp */}
                      {prevReading?.timestamp && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-300" />
                          {timeAgo(prevReading.timestamp)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Research Disclaimer Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-start gap-2 text-[10px] text-slate-500 leading-normal">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <span className="font-bold text-slate-600">Research Disclaimer:</span> The G-TRASH air-quality status is an MQ-135-based operational classification for garbage-area monitoring and is not a direct measurement of the official national Air Quality Index.
        </p>
      </div>
    </div>
  );
}
