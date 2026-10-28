'use client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { series, type District } from '../lib/seed';
export function DemandChart({
  days = 14,
  multiplier = 1,
  forecast = false,
}: {
  days?: number;
  multiplier?: number;
  forecast?: boolean;
}) {
  const data = series.slice(-days).map((row) => ({
    ...row,
    demand: Math.round(row.demand * multiplier),
    supply: Math.round(row.supply * multiplier),
    forecast: Math.round(row.forecast * multiplier),
    confidence: row.confidence.map((value) => Math.round(value * multiplier)),
  }));
  return (
    <div
      className="chart-frame"
      role="img"
      aria-label={`${forecast ? 'Illustrative forecast with a synthetic confidence band' : 'Synthetic demand and supply'} across ${data.length} days. Demand rises from ${data[0].demand} to ${data.at(-1)?.demand} units.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 8, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient
              id={forecast ? 'forecast-fill' : 'demand-fill'}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#5cd7d1" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#5cd7d1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
            }}
          />
          {forecast && (
            <Area
              type="monotone"
              dataKey="confidence"
              stroke="none"
              fill="#a78bfa"
              fillOpacity={0.2}
              name="Illustrative interval"
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey={forecast ? 'forecast' : 'demand'}
            stroke="#67e8d9"
            strokeWidth={2.5}
            fill={`url(#${forecast ? 'forecast-fill' : 'demand-fill'})`}
            name={forecast ? 'Sample forecast' : 'Demand'}
            isAnimationActive={false}
          />
          {!forecast && (
            <Area
              type="monotone"
              dataKey="supply"
              stroke="#9b8afb"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="transparent"
              name="Supply"
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function DistrictChart({ data }: { data: District[] }) {
  return (
    <div
      className="chart-frame"
      role="img"
      aria-label="Synthetic district supply and demand comparison. Exact values appear in the district table."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -25, right: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            tickFormatter={(name) => name.split(' ')[0]}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <Legend />
          <Bar
            dataKey="demand"
            name="Demand"
            fill="#67e8d9"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="supply"
            name="Supply"
            fill="#9b8afb"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
