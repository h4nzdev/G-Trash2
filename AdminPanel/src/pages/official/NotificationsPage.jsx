import { useState } from 'react';
import { Bell, Send, Users, AlertTriangle, Info, MessageSquare, CheckCheck, Trash2, Clock } from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import { notifications, notificationHistory } from '../../data/mockData';

const tabs = ['All', 'Unread', 'Alerts'];
const targets = ['All Residents', 'Zone A Residents', 'Zone B Residents', 'Zone C Residents', 'Zone D Residents', 'Collectors', 'All'];
const priorities = ['Normal', 'Important', 'Urgent'];

const typeIcon = { alert: AlertTriangle, info: Info, complaint: MessageSquare };
const typeBg = {
  alert:     { bg: 'bg-red-50',     icon: 'text-red-500',    border: 'border-red-100' },
  info:      { bg: 'bg-blue-50',    icon: 'text-blue-500',   border: 'border-blue-100' },
  complaint: { bg: 'bg-amber-50',   icon: 'text-amber-500',  border: 'border-amber-100' },
};

const priorityBadgeClass = {
  Normal:    'bg-slate-100 text-slate-600',
  Important: 'bg-blue-50 text-blue-700',
  Urgent:    'bg-red-50 text-red-700',
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [readIds, setReadIds] = useState(new Set());
  const [form, setForm] = useState({ title: '', message: '', target: 'All Residents', priority: 'Normal', schedule: 'now' });
  const [sent, setSent] = useState(false);

  const allNotifs = notifications.map(n => ({ ...n, read: n.read || readIds.has(n.id) }));
  const filtered = allNotifs.filter(n => {
    if (activeTab === 'Unread') return !n.read;
    if (activeTab === 'Alerts') return n.type === 'alert';
    return true;
  });

  const unreadCount = allNotifs.filter(n => !n.read).length;

  const markRead = id => setReadIds(s => new Set([...s, id]));
  const markAllRead = () => setReadIds(new Set(allNotifs.map(n => n.id)));

  const handleSend = () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSent(true);
    setForm({ title: '', message: '', target: 'All Residents', priority: 'Normal', schedule: 'now' });
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-slate-500 text-sm mt-1">Send announcements and view system alerts</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Compose Panel */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Compose Notification</h2>
          </div>

          {sent && (
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
              <CheckCheck className="w-4 h-4" />
              Notification sent successfully!
            </div>
          )}

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
              <input
                type="text"
                placeholder="Notification title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
              <textarea
                placeholder="Type your message here..."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <Users className="w-3.5 h-3.5 inline mr-1" /> Target
                </label>
                <select
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white outline-none focus:border-emerald-400 transition-all cursor-pointer"
                >
                  {targets.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white outline-none focus:border-emerald-400 transition-all cursor-pointer"
                >
                  {priorities.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Schedule</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm(f => ({ ...f, schedule: 'now' }))}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-all ${form.schedule === 'now' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  Send Now
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, schedule: 'later' }))}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-all ${form.schedule === 'later' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          {(form.title || form.message) && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2">Preview</p>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{form.title || 'Title...'}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{form.message || 'Message...'}</p>
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priorityBadgeClass[form.priority]}`}>
                  {form.priority}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={!form.title.trim() || !form.message.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-all"
          >
            <Send className="w-4 h-4" />
            {form.schedule === 'now' ? 'Send Notification' : 'Schedule Notification'}
          </button>
        </div>

        {/* Notifications Panel */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {/* Inbox */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-slate-900">Inbox</h2>
                {unreadCount > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-slate-50 rounded-lg p-0.5">
                  {tabs.map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button onClick={markAllRead} className="text-xs text-emerald-600 hover:underline font-medium whitespace-nowrap">
                  Mark all read
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {filtered.map(n => {
                const cfg = typeBg[n.type] ?? typeBg.info;
                const Icon = typeIcon[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex items-start gap-3.5 px-5 py-4 cursor-pointer transition-colors ${n.read ? 'hover:bg-slate-50' : 'bg-blue-50/30 hover:bg-blue-50/60'}`}
                  >
                    <div className={`w-9 h-9 ${cfg.bg} border ${cfg.border} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${cfg.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {n.time} · from {n.from}
                      </p>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm">No notifications</div>
              )}
            </div>
          </div>

          {/* Sent History */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Sent History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Date', 'Title', 'Target', 'Recipients', 'Open Rate', 'Status'].map(col => (
                      <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {notificationHistory.map(n => (
                    <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-500">{n.sentAt}</td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-700 max-w-40 truncate">{n.title}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{n.target}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-slate-800">{n.recipients.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-emerald-600 font-medium">{n.openRate}</td>
                      <td className="px-5 py-3"><StatusBadge status={n.status} showDot /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
