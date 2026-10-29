'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
const ModelChart = dynamic(() => import('./model-chart'), { ssr: false });
type Result = {
  id: string;
  model: string;
  modelVersion: string;
  trainingDataMode: string | null;
  intervalMethod: string;
  fallbackReason: string | null;
  predictionLatencyMs: number;
  predictions: {
    time: string;
    demand: number;
    lower: number | null;
    upper: number | null;
    supplyBaseline: number | null;
    imbalance: number | null;
  }[];
};
export function MlForecast() {
  const [district, setDistrict] = useState('central');
  const [category, setCategory] = useState('groceries');
  const query = useMutation<Result>({
    mutationFn: async () => {
      const observations = Array.from({ length: 28 }, (_, i) => ({
        time: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
        demand: Math.round((100 + i * 0.3 + [8, 12, 8, 18, 30, 20, 0][i % 7]) * 100) / 100,
        supply: 95 + i * 0.2,
      }));
      const response = await fetch('/api/ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'bengaluru',
          district,
          category,
          horizon: 7,
          dataMode: 'synthetic',
          observations,
        }),
      });
      if (!response.ok)
        throw new Error(
          'Start the Spring API and AI services to run this synthetic forecast. No results are substituted.',
        );
      return response.json();
    },
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Forecast lab · real inference, synthetic inputs</h2>
          <p>
            Bengaluru example · January 2026 daily scenario · independent of the illustrative
            dashboard filters
          </p>
        </div>
        <Sparkles size={18} className="text-mint" />
      </div>
      <div className="filterbar">
        <label className="select-label">
          District
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              query.reset();
            }}
          >
            <option value="central">Central</option>
            <option value="north">North</option>
          </select>
        </label>
        <label className="select-label">
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              query.reset();
            }}
          >
            <option value="groceries">Groceries</option>
            <option value="mobility">Mobility</option>
          </select>
        </label>
        <Button onClick={() => query.mutate()} disabled={query.isPending}>
          <Sparkles size={14} />
          {query.isPending ? 'Running inference…' : 'Forecast next 7 days'}
        </Button>
      </div>
      {query.isError && (
        <p role="status" className="fine-print">
          {query.error.message}
        </p>
      )}
      {query.data && (
        <>
          <p className="fine-print">
            Model: {query.data.model} · version {query.data.modelVersion} · measured inference{' '}
            {query.data.predictionLatencyMs} ms · training mode{' '}
            {query.data.trainingDataMode ?? 'untrained fallback'}
          </p>
          {query.data.fallbackReason && <p className="fine-print">{query.data.fallbackReason}</p>}
          <ModelChart rows={query.data.predictions} />
          <p className="fine-print">{query.data.intervalMethod}</p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable data table"
          >
            <table>
              <caption className="sr-only">Actual AI output from synthetic daily inputs</caption>
              <thead>
                <tr>
                  <th scope="col">Date (UTC)</th>
                  <th scope="col">Demand</th>
                  <th scope="col">Lower</th>
                  <th scope="col">Upper</th>
                  <th scope="col">Gap</th>
                </tr>
              </thead>
              <tbody>
                {query.data.predictions.map((row) => (
                  <tr key={row.time}>
                    <th scope="row">{row.time.slice(0, 10)}</th>
                    <td>{row.demand}</td>
                    <td>{row.lower ?? 'Uncalibrated'}</td>
                    <td>{row.upper ?? 'Uncalibrated'}</td>
                    <td>{row.imbalance ?? 'No supply input'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!query.data && !query.isError && (
        <p className="fine-print">
          Run inference to show returned values and intervals. Measured model comparisons are stored
          in the repository evaluation report. Synthetic evaluation does not establish real-world
          accuracy.
        </p>
      )}
    </section>
  );
}
