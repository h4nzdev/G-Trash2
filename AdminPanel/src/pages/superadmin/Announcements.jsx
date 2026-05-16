import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  Megaphone, Info, CheckCircle2, AlertTriangle, AlertOctagon,
  Send, Loader2, Trash2, Inbox, CheckCheck, XCircle,
} from 'lucide-react';
import API_URL from '../../config';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { value: 'info',     label: 'Info',     border: 'border-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700',    Icon: Info          },
  { value: 'success',  label: 'Success',  border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2  },
  { value: 'warning',  label: 'Warning',  border: 'border-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   Icon: AlertTriangle },
  { value: 'critical', label: 'Critical', border: 'border-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     Icon: AlertOctagon  },
];

function typeStyle(type) {
  return TYPES.find((t) => t.value === type) ?? TYPES[0];
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    axios.get(`${API_URL}/api/announcements`)
      .then(({ data }) => setAnnouncements(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('announcement:new', (doc) => {
      setAnnouncements((prev) =>
        prev.some((a) => a._id === doc._id) ? prev : [doc, ...prev]
      );
    });
    return () => socket.disconnect();
  }, []);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      showToast('Title and message are required.', false);
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/announcements`, form);
      setForm({ title: '', message: '', type: 'info' });
      showToast('Announcement sent to all platforms!');
    } catch {
      showToast('Failed to send announcement.', false);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
    } catch {
      showToast('Failed to delete.', false);
    }
  };

  const selected = typeStyle(form.type);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.ok
            ? <CheckCheck className="w-4 h-4 flex-shrink-0" />
            : <XCircle    className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Compose card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">New Announcement</h2>
            <p className="text-xs text-slate-500">Broadcasts in real-time to Officials Panel and Resident App</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.type === t.value
                      ? `${t.border} ${t.bg} ${t.text}`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <t.Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Scheduled Maintenance on Dec 25"
              maxLength={100}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Enter the full announcement details here…"
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Preview */}
          {(form.title || form.message) && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Preview</label>
              <div className={`border-l-4 ${selected.border} ${selected.bg} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <selected.Icon className={`w-4 h-4 flex-shrink-0 ${selected.text}`} />
                  <p className={`text-sm font-bold ${selected.text}`}>{form.title || 'Announcement Title'}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{form.message || 'Announcement message will appear here.'}</p>
                <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">From: {user?.name || 'Admin'} · Just now</p>
              </div>
            </div>
          )}

          {/* Send */}
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !form.title.trim() || !form.message.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
            >
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send    className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Broadcast Announcement'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Announcement History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 50 system announcements</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {announcements.length} total
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Inbox className="w-10 h-10 text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">No announcements yet</p>
            <p className="text-xs text-slate-400">Your broadcasts will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {announcements.map((a) => {
              const s = typeStyle(a.type);
              return (
                <div key={a._id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                    <s.Icon className={`w-4.5 h-4.5 ${s.text}`} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-slate-900 truncate">{a.title}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                        {a.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{a.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      By {a.createdBy} · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a._id)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
