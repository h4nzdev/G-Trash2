import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Gift, Plus, X, Check, AlertCircle, ChevronDown, Search,
  Trophy, Star, FileText, Tag, Clock, RefreshCw, Eye, Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const CATEGORIES = [
  { value: 'best_segregation',      label: 'Best in Segregation' },
  { value: 'most_trash_collected',  label: 'Most Trash Collected' },
  { value: 'most_reports',          label: 'Most Reports Submitted' },
  { value: 'most_active',           label: 'Most Active Resident' },
];
const REWARD_TYPES = [
  { value: 'physical_prize',  label: 'Physical Prize' },
  { value: 'certificate',     label: 'Certificate' },
  { value: 'cash',            label: 'Cash' },
  { value: 'discount',        label: 'Discount' },
  { value: 'recognition',     label: 'Recognition' },
];
const STATUS_META = {
  draft:      { label: 'Draft',     cls: 'bg-slate-100 text-slate-600' },
  published:  { label: 'Published', cls: 'bg-blue-100 text-blue-700' },
  claimed:    { label: 'Claimed',   cls: 'bg-emerald-100 text-emerald-700' },
  expired:    { label: 'Expired',   cls: 'bg-red-100 text-red-600' },
};

function statusBadge(status) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function daysLeft(deadline) {
  if (!deadline) return null;
  const d = Math.ceil((new Date(deadline) - Date.now()) / 86400000);
  return d;
}

// ── Create / Edit Modal ──────────────────────────────────────
function RewardModal({ reward, onClose, onSaved, official }) {
  const isEdit = !!reward;
  const [form, setForm] = useState({
    title: reward?.title || '',
    description: reward?.description || '',
    category: reward?.category || 'most_reports',
    barangay: reward?.barangay || official?.barangay || '',
    rewardType: reward?.rewardType || 'certificate',
    rewardValue: reward?.rewardValue || '',
    notes: reward?.notes || '',
    claimDeadline: reward?.claimDeadline
      ? new Date(reward.claimDeadline).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    recipientId: reward?.recipientId || '',
    recipientName: reward?.recipientName || '',
  });
  const [eligible, setEligible] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!form.barangay) return;
    axios.get(`${API}/api/rewards/leaderboard-eligible?barangay=${form.barangay}`)
      .then(r => setEligible(r.data[form.barangay] || []))
      .catch(() => {});
  }, [form.barangay]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async (publish = false) => {
    if (!form.title || !form.recipientId) {
      setError('Title and recipient are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const { data } = await axios.patch(`${API}/api/rewards/${reward._id}`, {
          title: form.title, description: form.description,
          rewardType: form.rewardType, rewardValue: form.rewardValue,
          notes: form.notes, claimDeadline: form.claimDeadline,
          ...(publish ? { action: 'publish', issuedByName: official?.name } : {}),
        });
        onSaved(data);
      } else {
        const { data } = await axios.post(`${API}/api/rewards`, {
          ...form,
          publish,
          issuedByName: official?.name,
        });
        onSaved(data);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save reward.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Gift className="w-4 h-4 text-emerald-700" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Reward' : 'Create Reward'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Best in Segregation — May 2026"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category *</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Barangay *</label>
              <input
                value={form.barangay}
                onChange={e => set('barangay', e.target.value)}
                disabled={official?.barangay !== 'All'}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Recipient * {eligible.length > 0 && <span className="text-emerald-600 normal-case font-normal">— top performers auto-suggested</span>}
            </label>
            {eligible.length > 0 ? (
              <select
                value={form.recipientId}
                onChange={e => {
                  const found = eligible.find(r => r._id === e.target.value);
                  set('recipientId', e.target.value);
                  set('recipientName', found ? found.name : '');
                }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              >
                <option value="">— Select recipient —</option>
                {eligible.map(r => (
                  <option key={r._id} value={r._id}>
                    {r.name} · {r.reportCount} reports
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.recipientId}
                  onChange={e => set('recipientId', e.target.value)}
                  placeholder="Resident ID"
                  className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
                <input
                  value={form.recipientName}
                  onChange={e => set('recipientName', e.target.value)}
                  placeholder="Recipient name"
                  className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reward Type *</label>
              <select
                value={form.rewardType}
                onChange={e => set('rewardType', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              >
                {REWARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Claim Deadline</label>
              <input
                type="date"
                value={form.claimDeadline}
                onChange={e => set('claimDeadline', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reward Value / Prize</label>
            <input
              value={form.rewardValue}
              onChange={e => set('rewardValue', e.target.value)}
              placeholder="e.g. ₱500 Gift Certificate, Groceries Package"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Awarded for achieving the highest segregation accuracy this month."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={1}
              placeholder="For official use only"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
            {saving ? 'Saving…' : 'Publish & Notify'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail / Action Modal ────────────────────────────────────
function DetailModal({ reward, onClose, onUpdated, official }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRevoke, setShowRevoke] = useState(false);

  const act = async (action) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.patch(`${API}/api/rewards/${reward._id}`, {
        action,
        issuedByName: official?.name,
      });
      onUpdated(data);
    } catch (e) {
      if (e.response?.data?.revoked) { onUpdated(null); return; }
      setError(e.response?.data?.error || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    setLoading(true);
    try {
      await axios.patch(`${API}/api/rewards/${reward._id}`, { action: 'revoke' });
      onUpdated(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Revoke failed.');
      setLoading(false);
    }
  };

  const days = daysLeft(reward.claimDeadline);
  const catLabel = CATEGORIES.find(c => c.value === reward.category)?.label || reward.category;

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Status bar */}
        <div className={`h-1.5 w-full ${reward.status === 'claimed' ? 'bg-emerald-500' : reward.status === 'published' ? 'bg-blue-500' : reward.status === 'expired' ? 'bg-red-400' : 'bg-slate-300'}`} />

        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              {statusBadge(reward.status)}
              <span className="text-[10px] text-slate-400 font-medium">{catLabel}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">{reward.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
          )}

          <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400 text-xs">Recipient</span><span className="font-semibold text-slate-800">{reward.recipientName || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-xs">Barangay</span><span className="font-semibold text-slate-800">{reward.barangay}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-xs">Reward</span><span className="font-semibold text-slate-800">{reward.rewardValue || '—'}</span></div>
            {reward.claimCode && (
              <div className="flex justify-between items-center"><span className="text-slate-400 text-xs">Claim Code</span><span className="font-mono font-bold text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded-lg">{reward.claimCode}</span></div>
            )}
            {reward.claimDeadline && (
              <div className="flex justify-between"><span className="text-slate-400 text-xs">Deadline</span>
                <span className={`font-semibold text-xs ${days != null && days <= 7 ? 'text-red-600' : 'text-slate-700'}`}>
                  {new Date(reward.claimDeadline).toLocaleDateString()} {days != null ? `(${days > 0 ? `${days}d left` : 'Expired'})` : ''}
                </span>
              </div>
            )}
            {reward.claimedDate && (
              <div className="flex justify-between"><span className="text-slate-400 text-xs">Claimed On</span><span className="font-semibold text-slate-800 text-xs">{new Date(reward.claimedDate).toLocaleDateString()}</span></div>
            )}
          </div>

          {reward.description ? <p className="text-sm text-slate-600 leading-relaxed">{reward.description}</p> : null}

          {/* Status timeline */}
          <div className="flex items-center gap-1 pt-1">
            {['draft', 'published', 'claimed'].map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${['draft','published','claimed'].indexOf(reward.status) >= i ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i + 1}
                </div>
                <span className="text-[9px] text-slate-400 capitalize">{s}</span>
                {i < 2 && <div className={`flex-1 h-0.5 ${['draft','published','claimed'].indexOf(reward.status) > i ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          {reward.status === 'draft' && (
            <button
              onClick={() => act('publish')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Publish & Notify Resident
            </button>
          )}
          {reward.status === 'published' && (
            <button
              onClick={() => act('mark_claimed')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Mark as Physically Claimed
            </button>
          )}
          {(reward.status === 'draft' || reward.status === 'published') && !showRevoke && (
            <button
              onClick={() => setShowRevoke(true)}
              className="w-full py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              Revoke Reward
            </button>
          )}
          {showRevoke && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-red-700 font-semibold">Revoke within 24 hours of publishing only. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowRevoke(false)} className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl">Cancel</button>
                <button onClick={revoke} disabled={loading} className="flex-1 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">Confirm Revoke</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function RewardsManagement() {
  const { official } = useAuth();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailReward, setDetailReward] = useState(null);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (official?.barangay && official.barangay !== 'All') params.set('barangay', official.barangay);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      const { data } = await axios.get(`${API}/api/rewards?${params}`);
      setRewards(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [official, filterStatus, filterCategory]);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const onSaved = (reward) => {
    setRewards(prev => {
      const idx = prev.findIndex(r => r._id === reward._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reward; return next; }
      return [reward, ...prev];
    });
    setShowCreate(false);
    setDetailReward(null);
  };

  const onUpdated = (reward) => {
    if (!reward) {
      // revoked — remove
      setRewards(prev => prev.filter(r => r._id !== detailReward?._id));
    } else {
      setRewards(prev => prev.map(r => r._id === reward._id ? reward : r));
    }
    setDetailReward(null);
  };

  const filtered = rewards.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title?.toLowerCase().includes(q) || r.recipientName?.toLowerCase().includes(q) || r.barangay?.toLowerCase().includes(q);
  });

  const pendingCt = rewards.filter(r => r.status === 'published').length;
  const expiringSoon = rewards.filter(r => r.status === 'published' && daysLeft(r.claimDeadline) != null && daysLeft(r.claimDeadline) <= 7).length;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Rewards Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Grant and track resident rewards</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Reward
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-6 pb-4 grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Rewards</p>
          <p className="text-2xl font-extrabold text-slate-900">{rewards.length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Pending Claim</p>
          <p className="text-2xl font-extrabold text-blue-700">{pendingCt}</p>
        </div>
        <div className={`border rounded-2xl p-4 shadow-sm ${expiringSoon > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Expiring Soon</p>
          <p className={`text-2xl font-extrabold ${expiringSoon > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{expiringSoon}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rewards…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={fetchRewards} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-6 min-h-0 overflow-auto">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Gift className="w-10 h-10 mb-3 text-slate-200" />
              <p className="text-sm font-semibold">No rewards found</p>
              <p className="text-xs mt-1">Create your first reward to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Barangay</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Deadline</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => {
                  const days = daysLeft(r.claimDeadline);
                  const catLabel = CATEGORIES.find(c => c.value === r.category)?.label || r.category;
                  return (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 truncate max-w-[200px]">{r.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{catLabel}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{r.recipientName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.barangay}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.rewardType?.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3">
                        {r.claimDeadline ? (
                          <span className={`text-xs font-semibold ${days != null && days <= 7 && r.status === 'published' ? 'text-red-600' : 'text-slate-500'}`}>
                            {new Date(r.claimDeadline).toLocaleDateString()}
                            {days != null && r.status === 'published' && ` (${days > 0 ? `${days}d` : 'today'})`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailReward(r)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <RewardModal
          onClose={() => setShowCreate(false)}
          onSaved={onSaved}
          official={official}
        />
      )}
      {detailReward && (
        <DetailModal
          reward={detailReward}
          onClose={() => setDetailReward(null)}
          onUpdated={onUpdated}
          official={official}
        />
      )}
    </div>
  );
}
