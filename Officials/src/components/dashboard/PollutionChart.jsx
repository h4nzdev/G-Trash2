import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const rawData = payload[0]?.payload || {};
  const raw = payload[0]?.value || rawData.rawValue || 0;
  const voltage = ((raw * 3.3) / 4095.0).toFixed(2);
  const status = raw >= 700 ? 'Critical' : raw >= 400 ? 'Moderate' : 'Clean';
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-1">
      <p className="font-bold text-slate-700 mb-1 border-b border-slate-100 pb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
        <span className="text-slate-600">Raw ADC Value:</span>
        <span className="font-extrabold text-slate-900">{raw} / 4095</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
        <span className="text-slate-600">Voltage:</span>
        <span className="font-bold text-slate-800">{voltage} V</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
        <span className="text-slate-600">Air Quality Rating:</span>
        <span className={`font-bold ${raw >= 700 ? 'text-red-600' : raw >= 400 ? 'text-amber-600' : 'text-emerald-600'}`}>{status}</span>
      </div>
    </div>
  );
};

export default function PollutionChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs font-medium">
        No telemetry history recorded for registered sensors yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          iconType="circle"
          iconSize={8}
        />
        <Line
          type="monotone"
          dataKey="rawValue"
          name="Raw ADC Value"
          stroke="#006A3B"
          strokeWidth={2.5}
          dot={{ fill: '#006A3B', r: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
