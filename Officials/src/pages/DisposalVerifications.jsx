import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  Camera,
  Trash2,
  MapPin,
  Calendar,
  CheckCircle2,
  Search,
  Filter,
  Flame,
  Award,
  Truck,
  X,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import API from "../config";

export default function DisposalVerifications() {
  const { official } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarangay, setSelectedBarangay] = useState(official?.barangay || "All");
  const [selectedImage, setSelectedImage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModalPhoto, setDeleteModalPhoto] = useState(null);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const url = selectedBarangay && selectedBarangay !== "All"
        ? `${API}/api/disposal/photos?barangay=${encodeURIComponent(selectedBarangay)}`
        : `${API}/api/disposal/photos`;
      const { data } = await axios.get(url);
      setPhotos(data);
    } catch (err) {
      console.error("Failed to fetch disposal photos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [selectedBarangay]);

  useEffect(() => {
    const socket = io(API, { transports: ["polling", "websocket"] });
    socket.on("disposal:photo:new", (newRecord) => {
      if (selectedBarangay === "All" || newRecord.barangay?.toLowerCase() === selectedBarangay?.toLowerCase()) {
        setPhotos((prev) => [newRecord, ...prev]);
      }
    });
    return () => socket.disconnect();
  }, [selectedBarangay]);

  const handleDeletePhoto = async () => {
    if (!deleteModalPhoto) return;
    const id = deleteModalPhoto._id;
    setDeletingId(id);
    try {
      await axios.delete(`${API}/api/disposal/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p._id !== id));
      setDeleteModalPhoto(null);
    } catch (err) {
      alert("Failed to delete photo. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50">
      {/* Header Banner - Soft UI */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-emerald-100 text-xs font-semibold">
            <Camera className="w-3.5 h-3.5" />
            <span>Resident Waste Validations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Disposal Photo Gallery</h1>
          <p className="text-emerald-100/90 text-sm max-w-xl">
            Monitor real-time resident waste disposal verifications, check curb photos, and manage photo validation records.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-emerald-100 ml-2" />
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer pr-4 [&>option]:text-slate-900"
            >
              <option value="All">All Barangays</option>
              <option value="Apas">Barangay Apas</option>
              <option value="Lahug">Barangay Lahug</option>
              <option value="Mabolo">Barangay Mabolo</option>
              <option value="Talamban">Barangay Talamban</option>
              <option value="Banilad">Barangay Banilad</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Gallery */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm animate-pulse space-y-4">
              <div className="h-48 bg-slate-100 rounded-2xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Disposal Photos Yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              {selectedBarangay !== "All"
                ? `No active disposal verification photos submitted in Barangay ${selectedBarangay}.`
                : "Residents haven't submitted disposal photos for verification yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {photos.map((photo) => (
            <div
              key={photo._id}
              className="group bg-white rounded-3xl border border-slate-100/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
            >
              {/* Photo Image Card with Strava Badge Overlay */}
              <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setSelectedImage(photo.photoUrl)}>
                <img
                  src={photo.photoUrl}
                  alt="Disposed Waste"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Soft Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />

                {/* Top Badge: Streak & Points */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div className="px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-white/20">
                    <Flame className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>{photo.streakCount || 1}-Day Streak</span>
                  </div>
                  {photo.pointsAwarded > 0 && (
                    <div className="px-2.5 py-1 rounded-full bg-amber-500/90 backdrop-blur-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-white/20">
                      <Award className="w-3.5 h-3.5 text-yellow-200" />
                      <span>+10 Pts</span>
                    </div>
                  )}
                </div>

                {/* Bottom Overlay Info (Strava Style) */}
                <div className="absolute bottom-3 left-3 right-3 text-white pointer-events-none">
                  <div className="flex items-center gap-1.5 text-xs font-bold drop-shadow-md">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{photo.sitio ? `${photo.sitio}, ` : ""}{photo.barangay}</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(photo.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{photo.residentName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{photo.truckId ? `Verified by ${photo.truckId}` : "Curb Disposal"}</p>
                </div>

                <button
                  onClick={() => setDeleteModalPhoto(photo)}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-100 transition-colors flex items-center justify-center flex-shrink-0"
                  title="Dismiss & Notify Resident"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedImage} alt="Enlarged Disposal" className="w-full max-h-[85vh] object-contain bg-black" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Soft UI Modal */}
      {deleteModalPhoto && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-extrabold text-slate-900">Dismiss Photo Record?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will remove the photo from the LGU dashboard and send a clearance update to <b>{deleteModalPhoto.residentName}</b>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteModalPhoto(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePhoto}
                disabled={!!deletingId}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-colors flex items-center justify-center gap-2"
              >
                {deletingId ? "Dismissing..." : "Dismiss Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
