'use client';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { Plan } from '../lib/decision-contracts';
export function DecisionTradeoffs({ plans, currency }: { plans: Plan[]; currency: string }) {
  const points = plans
    .filter((p) => p.status === 'optimal')
    .map((p) => ({
      name: p.objective,
      cost: p.totalCost,
      coverage: 100 * (p.minimumCoverage ?? 0),
      allocated: p.totalAllocated,
    }));
  return (
    <div>
      <p className="fine-print">
        Cost versus minimum quantity coverage · feasible objective alternatives, not a proven
        complete Pareto frontier.
      </p>
      <div style={{ height: 280 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid stroke="#344459" />
            <XAxis
              dataKey="cost"
              type="number"
              name={`Cost (${currency})`}
              tick={{ fill: '#b3c6d7' }}
            />
            <YAxis
              dataKey="coverage"
              type="number"
              name="Minimum coverage (%)"
              domain={[0, 100]}
              tick={{ fill: '#b3c6d7' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#132130',
                color: '#efffff',
                border: '1px solid #6d8395',
              }}
            />
            <Scatter data={points} fill="#8ae7dd" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="table-scroll">
        <table>
          <caption>Objective tradeoffs ({currency})</caption>
          <thead>
            <tr>
              <th scope="col">Objective</th>
              <th scope="col">Status</th>
              <th scope="col">Cost</th>
              <th scope="col">Allocated</th>
              <th scope="col">Minimum coverage</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.objective}>
                <th scope="row">{p.objective}</th>
                <td>{p.status}</td>
                <td>{p.totalCost?.toFixed(2) ?? '—'}</td>
                <td>{p.totalAllocated?.toFixed(2) ?? '—'}</td>
                <td>
                  {p.minimumCoverage != null ? `${(p.minimumCoverage * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
