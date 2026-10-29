'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
export default function ModelChart({
  rows,
}: {
  rows: { time: string; demand: number; lower: number | null; upper: number | null }[];
}) {
  const data = rows.map((row) => ({
    ...row,
    day: row.time.slice(5, 10),
    interval: row.lower !== null && row.upper !== null ? [row.lower, row.upper] : null,
  }));
  return (
    <div
      className="chart-frame"
      role="img"
      aria-label="Model forecast with empirical intervals when available. Exact values appear in the table below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <Area
            dataKey="interval"
            fill="#a78bfa"
            fillOpacity={0.2}
            stroke="none"
            isAnimationActive={false}
            name="Empirical interval"
          />
          <Area
            dataKey="demand"
            fill="#67e8d9"
            fillOpacity={0.12}
            stroke="#67e8d9"
            strokeWidth={2}
            isAnimationActive={false}
            name="Synthetic-input forecast"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
