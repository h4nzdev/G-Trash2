import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Route,
  MapPin,
  Truck,
  Trash2,
  ChevronRight,
  Plus,
  MoreVertical,
  Calendar,
  Activity,
  Pencil,
} from "lucide-react";
import axios from "axios";
import API from "../config";
import Badge from "../components/shared/Badge";

export default function RouteManager() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoutes = async () => {
    try {
      const { data } = await axios.get(`${API}/api/routes`);
      setRoutes(data);
    } catch (err) {
      console.error("Failed to fetch routes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setOpenMenuId(null);
    if (!window.confirm("Are you sure you want to delete this route? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/api/routes/${id}`);
      setRoutes((prev) => prev.filter((r) => r._id !== id));
    } catch {
      alert("Failed to delete route. Please try again.");
    }
  };

  const filtered = routes.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.truckId && r.truckId.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter =
      filter === "All" ||
      (filter === "Assigned" && r.truckId) ||
      (filter === "Unassigned" && !r.truckId);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Saved Custom Routes</h2>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Manage or edit the custom collection routes you've built.
          </p>
        </div>
        <button
          onClick={() => navigate("/route-builder")}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/10 transition-all active:scale-95 border border-emerald-700"
        >
          <Plus className="w-3.5 h-3.5" /> New Route
        </button>
      </div>

      {/* Stats Summary - Matching Official Dashboard style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Route className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Total Routes
            </p>
            <p className="text-2xl font-black text-slate-900">
              {routes.length}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Assigned
            </p>
            <p className="text-2xl font-black text-slate-900">
              {routes.filter((r) => r.truckId).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Total Stops
            </p>
            <p className="text-2xl font-black text-slate-900">
              {routes.reduce((acc, r) => acc + (r.waypoints?.length || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search routes..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {["All", "Assigned", "Unassigned"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    filter === t
                      ? "bg-emerald-800 text-white shadow-md"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {filtered.length} routes
          </p>
        </div>

        {/* Routes Grid */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Fetching Data
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Route className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-sm font-bold text-slate-900">
                No Routes Found
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Try adjusting your search or create a new route.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
              {filtered.map((route) => (
                <div
                  key={route._id}
                  onClick={() =>
                    navigate("/route-builder", { state: { editRoute: route } })
                  }
                  className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-900/5 transition-all cursor-pointer overflow-hidden border-l-4 border-l-emerald-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {route.name}
                      </h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />{" "}
                        {new Date(route.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* 3-dots menu */}
                    <div className="relative" ref={openMenuId === route._id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === route._id ? null : route._id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === route._id && (
                        <div className="absolute right-0 top-8 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[160px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              navigate("/route-builder", { state: { editRoute: route } });
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                            Edit Route
                          </button>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(route._id);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Route
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">
                        Stops
                      </p>
                      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {route.waypoints?.length || 0}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">
                        Truck ID
                      </p>
                      <p
                        className={`text-sm font-black flex items-center gap-1.5 ${route.truckId ? "text-blue-700" : "text-slate-400 italic"}`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        {route.truckId || "None"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5">
                      {route.truckId ? (
                        <div className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 text-[9px] font-black uppercase tracking-tight">
                          {route.driverName || "Assigned"}
                        </div>
                      ) : (
                        <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[9px] font-black uppercase tracking-tight">
                          Draft
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-700 group-hover:translate-x-1 transition-transform">
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monitoring Redirect - Standard UI pattern */}
      <div className="bg-emerald-900 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl border border-emerald-800">
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
          <Activity className="w-6 h-6" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-base font-black text-white">
            Live Route Tracking
          </h4>
          <p className="text-emerald-100/60 text-xs mt-1 font-medium">
            Monitor real-time progress and deviations for all assigned routes.
          </p>
        </div>
        <button
          onClick={() => navigate("/routes")}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-xs transition-all whitespace-nowrap shadow-lg shadow-emerald-900/40"
        >
          Open Monitoring
        </button>
      </div>
    </div>
  );
}
