import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MapPin, Truck, Camera, CheckCircle, AlertTriangle, Wifi, WifiOff, Navigation, Clock } from 'lucide-react';
import API from '../config';

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DriverView() {
  const [truckId, setTruckId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [started, setStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [nearArea, setNearArea] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const socketRef = useRef(null);
  const watchRef = useRef(null);
  const countdownRef = useRef(null);
  const fileRef = useRef(null);

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('truck')) setTruckId(params.get('truck'));
    if (params.get('driver')) setDriverName(params.get('driver'));
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    stopCountdown();
    setCountdown(300);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopCountdown]);

  const handleStart = useCallback(() => {
    if (!truckId.trim()) return;
    setStarted(true);

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('truck:near-area', (data) => {
      setNearArea(data);
      setTimedOut(false);
      startCountdown();
    });

    socket.on('truck:area-timeout', (data) => {
      setNearArea(data);
      setTimedOut(true);
      stopCountdown();
      setCountdown(0);
    });

    socket.on('truck:left-area', () => {
      setNearArea(null);
      setTimedOut(false);
      stopCountdown();
      setCountdown(300);
    });

    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.');
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
        setCurrentPos({ lat, lng });
        setGpsError(null);
        socket.emit('truck:location', {
          truckId: truckId.trim(),
          lat,
          lng,
          heading: heading || 0,
          speed: speed ? Math.round(speed * 3.6) : 0,
        });
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [truckId, startCountdown, stopCountdown]);

  const handleStop = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    stopCountdown();
    setStarted(false);
    setIsConnected(false);
    setCurrentPos(null);
    setNearArea(null);
    setTimedOut(false);
    setCountdown(300);
  }, [stopCountdown]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (socketRef.current) socketRef.current.disconnect();
      stopCountdown();
    };
  }, [stopCountdown]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!photo || !nearArea) return;
    setIsSubmitting(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(photo);
      });

      const res = await fetch(`${API}/api/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: truckId.trim(),
          driverName: driverName.trim(),
          areaId: nearArea.areaId,
          areaName: nearArea.areaName,
          barangay: nearArea.barangay,
          photo: base64,
          note,
          lat: currentPos?.lat,
          lng: currentPos?.lng,
          autoDetected: true,
        }),
      });
      if (!res.ok) throw new Error('Submit failed');
      setSubmitted(true);
      setNearArea(null);
      setTimedOut(false);
      setPhoto(null);
      setPhotoPreview(null);
      setNote('');
      stopCountdown();
      setCountdown(300);
      setTimeout(() => setSubmitted(false), 4000);
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Setup screen ─────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">G-TRASH Driver</h1>
              <p className="text-xs text-slate-500">Auto-cleanup detection</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Truck ID *
              </label>
              <input
                type="text"
                value={truckId}
                onChange={e => setTruckId(e.target.value)}
                placeholder="e.g. TRUCK-001"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Driver Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">How it works:</p>
            <p>• Your GPS is tracked automatically</p>
            <p>• When near a garbage area, you'll get a prompt</p>
            <p>• After 5 min in the area, take a photo to mark it clean</p>
          </div>

          <button
            onClick={handleStart}
            disabled={!truckId.trim()}
            className="w-full py-4 bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-base rounded-2xl transition-colors"
          >
            Start Tracking
          </button>
        </div>
      </div>
    );
  }

  // ── Active tracking screen ────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5" />
          <div>
            <p className="font-black text-sm">{truckId}</p>
            {driverName && <p className="text-[11px] text-emerald-300">{driverName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isConnected
              ? <><Wifi className="w-4 h-4 text-emerald-300" /><span className="text-[11px] text-emerald-300">Live</span></>
              : <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-[11px] text-red-400">Offline</span></>
            }
          </div>
          <button
            onClick={handleStop}
            className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {/* Success banner */}
        {submitted && (
          <div className="bg-emerald-600 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-lg">
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-black text-sm">Area marked as clean!</p>
              <p className="text-[11px] text-emerald-200">Photo posted to community feed</p>
            </div>
          </div>
        )}

        {/* GPS status */}
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${currentPos ? 'bg-white border border-emerald-100' : 'bg-amber-50 border border-amber-200'}`}>
          <Navigation className={`w-4 h-4 flex-shrink-0 ${currentPos ? 'text-emerald-600' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700">GPS {currentPos ? 'Active' : 'Searching...'}</p>
            {currentPos && (
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
              </p>
            )}
            {gpsError && <p className="text-[10px] text-red-500">{gpsError}</p>}
          </div>
          {currentPos && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
        </div>

        {/* Near area — no timeout yet */}
        {nearArea && !timedOut && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="bg-emerald-50 px-5 py-4 flex items-center gap-3 border-b border-emerald-100">
              <MapPin className="w-5 h-5 text-emerald-700 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-emerald-900">You're near a garbage area</p>
                <p className="text-xs font-semibold text-emerald-700">{nearArea.areaName}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-sm font-black font-mono">{fmt(countdown)}</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-slate-500">
                Stay in the area and collect trash. After the timer, you'll be prompted to submit a photo. You can also mark it clean now.
              </p>
              {renderPhotoCapture()}
              {photo && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-black rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Mark as Cleaned'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Timeout — urgent */}
        {nearArea && timedOut && (
          <div className="bg-white rounded-2xl border-2 border-red-400 shadow-md overflow-hidden">
            <div className="bg-red-50 px-5 py-4 flex items-center gap-3 border-b border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 animate-pulse" />
              <div>
                <p className="text-sm font-black text-red-900">5 minutes reached!</p>
                <p className="text-xs font-semibold text-red-700">{nearArea.areaName} — please take a photo and submit</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              {renderPhotoCapture()}
              <button
                onClick={handleSubmit}
                disabled={!photo || isSubmitting}
                className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white font-black text-base rounded-xl transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit & Mark Clean'}
              </button>
            </div>
          </div>
        )}

        {/* Idle */}
        {!nearArea && !submitted && (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-8 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
              <Navigation className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">Scanning for nearby areas…</p>
            <p className="text-xs text-slate-400">You'll get an alert when within 80m of a garbage area.</p>
          </div>
        )}
      </div>
    </div>
  );

  function renderPhotoCapture() {
    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />
        {photoPreview ? (
          <div className="space-y-2">
            <img
              src={photoPreview}
              alt="Cleanup"
              className="w-full h-48 object-cover rounded-xl border border-slate-200"
            />
            <button
              onClick={() => { setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="w-full text-xs font-bold text-slate-500 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Retake Photo
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-4 border-2 border-dashed border-emerald-300 rounded-xl flex flex-col items-center gap-2 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-bold">Take Photo of Area</span>
            <span className="text-[11px] text-slate-400">Photo will be shared publicly</span>
          </button>
        )}
        {photo && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note (e.g. 'Large pile near corner')"
            rows={2}
            className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        )}
      </div>
    );
  }
}
