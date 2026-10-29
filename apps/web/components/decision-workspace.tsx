'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Play, Save, FlaskConical, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { exportCsv } from '../lib/api';
import type { ScenarioInput, DecisionRun, Opportunity } from '../lib/decision-contracts';
import retail from '../../../data/sample/decisions/retail.json';
import logistics from '../../../data/sample/decisions/logistics.json';
import publicService from '../../../data/sample/decisions/public-service.json';

const MapView = dynamic(() => import('./decision-map').then((m) => m.DecisionMap), {
  ssr: false,
  loading: () => <p role="status">Loading coordinate overlay…</p>,
});
const Tradeoffs = dynamic(() => import('./decision-charts').then((m) => m.DecisionTradeoffs), {
  ssr: false,
  loading: () => <p role="status">Loading tradeoff chart…</p>,
});
const tabs = [
  ['opportunities', 'Business Opportunity Explorer'],
  ['map', 'Supply-Demand Imbalance Map'],
  ['simulator', 'Resource Optimization Simulator'],
  ['districts', 'District Comparison Tool'],
  ['scenarios', 'Scenario Comparison Dashboard'],
  ['investment', 'Investment Planning Workspace'],
  ['explanation', 'Decision Explanation Panel'],
] as const;
type View = (typeof tabs)[number][0];
type Saved = { id: string; name: string; created_at: string };
const fixtures = { retail, logistics, 'public-service': publicService };
const number = (value: number | null | undefined, digits = 1) =>
  value == null ? 'Unknown' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
async function api<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const response = await fetch(`/api/decisions/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value.detail === 'string' ? value.detail : 'Decision request failed validation',
    );
  return value;
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DecisionWorkspace({ initialView = 'opportunities' }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [input, setInput] = useState<ScenarioInput>(structuredClone(retail) as ScenarioInput);
  const [run, setRun] = useState<DecisionRun | null>(null);
  const [runs, setRuns] = useState<DecisionRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [editor, setEditor] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string; timezone: string }[]>([]);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [categories, setCategories] = useState('rice');
  const [from, setFrom] = useState('2026-01-01T00:00');
  const [to, setTo] = useState('2026-01-01T03:00');
  const [compareId, setCompareId] = useState('');
  const attempt = useRef({ body: '', key: '' });
  const config = useQuery({
    queryKey: ['decision-config'],
    queryFn: () => api<{ localComputeAllowed: boolean }>('config'),
    retry: false,
  });
  const result = run?.result;
  const addRun = (value: DecisionRun) => {
    setRun(value);
    setRuns((old) => [value, ...old.filter((r) => r.id !== value.id)].slice(0, 8));
  };
  async function evaluate(local: boolean) {
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify(input);
      if (attempt.current.body !== body) attempt.current = { body, key: crypto.randomUUID() };
      addRun(
        await api<DecisionRun>(
          local ? 'local' : 'scenarios',
          'POST',
          { scenario: input },
          attempt.current.key,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadSaved() {
    setBusy(true);
    setError('');
    try {
      setSaved(await api<Saved[]>('scenarios'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(id: string) {
    setBusy(true);
    setError('');
    try {
      addRun(await api<DecisionRun>(`scenarios/${id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadCities() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/pulseai/cities');
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail ?? 'Authorized cities unavailable');
      setCities(value);
      if (value.length) setCityIds([value[0].id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function snapshot() {
    setBusy(true);
    setError('');
    try {
      const value = await api<{
        id: string;
        snapshot: {
          districts: ScenarioInput['districts'];
          stocks: ScenarioInput['stocks'];
          dataMode: ScenarioInput['dataMode'];
          unit: ScenarioInput['unit'];
          periodStart: string;
          periodEnd: string;
        };
      }>('snapshots', 'POST', {
        cityIds,
        categories: categories.split(',').map((v) => v.trim()),
        unit: input.unit,
        from: `${from}:00Z`,
        to: `${to}:00Z`,
      });
      setInput((old) => ({
        ...old,
        origin: 'authorized-snapshot',
        snapshotId: value.id,
        dataMode: value.snapshot.dataMode,
        unit: value.snapshot.unit,
        periodStart: value.snapshot.periodStart,
        periodEnd: value.snapshot.periodEnd,
        districts: value.snapshot.districts,
        stocks: value.snapshot.stocks.map((s) => ({ ...s, unitCost: 0 })),
        lanes: [],
        networkId: null,
        maxTravelMinutes: null,
        demandBasis: 'observed',
      }));
      setRun(null);
      setError(
        'Snapshot loaded. Inventory unit costs default to an explicit zero-cost assumption: review costs, capacity and risk before saving. Missing observations remain unknown.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const comparison = runs.find((r) => r.id === compareId);
  const comparable =
    result &&
    comparison &&
    ['unit', 'currency', 'periodStart', 'periodEnd'].every(
      (field) =>
        result.canonicalInput[field as keyof ScenarioInput] ===
        comparison.result.canonicalInput[field as keyof ScenarioInput],
    );
  return (
    <section className="panel decision-workspace" aria-labelledby="decision-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Evidence · assumptions · constrained decisions</p>
          <h2 id="decision-title">CityPulse decision lab</h2>
          <p>Explore opportunity. Test constraints. Keep the reasoning.</p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>
      <p className="decision-notice">
        {input.origin === 'synthetic'
          ? 'SYNTHETIC DEVELOPMENT DATA'
          : input.origin === 'manual-assumptions'
            ? 'OPERATOR ASSUMPTIONS'
            : 'AUTHORIZED SNAPSHOT'}{' '}
        · {input.unit} · {input.currency} · {input.timeZone}. Scores do not predict profit or
        guarantee investment success.
      </p>
      <div className="decision-controls">
        <label>
          Example use case
          <select
            value={input.useCase}
            onChange={(e) => {
              setInput(
                structuredClone(fixtures[e.target.value as keyof typeof fixtures]) as ScenarioInput,
              );
              setRun(null);
              setError('');
            }}
          >
            <option value="retail">Retail · synthetic</option>
            <option value="logistics">Logistics · synthetic lanes</option>
            <option value="public-service">Public service · synthetic</option>
          </select>
        </label>
        <label>
          Scenario name
          <input
            maxLength={120}
            value={input.name}
            onChange={(e) => setInput({ ...input, name: e.target.value })}
          />
        </label>
        <label>
          Budget ({input.currency})
          <input
            type="number"
            min={0}
            max={10000000}
            value={input.budget}
            onChange={(e) => setInput({ ...input, budget: Number(e.target.value) })}
          />
        </label>
        <label>
          Objective
          <select
            value={input.objective}
            onChange={(e) =>
              setInput({ ...input, objective: e.target.value as ScenarioInput['objective'] })
            }
          >
            {['balanced', 'throughput', 'coverage', 'fairness', 'cost'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Minimum quantity coverage
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={input.minimumCoverage ?? 0}
            onChange={(e) => setInput({ ...input, minimumCoverage: Number(e.target.value) })}
          />
        </label>
        <label>
          What-if demand multiplier
          <input
            type="number"
            min={0}
            max={5}
            step={0.05}
            value={input.demandMultiplier ?? 1}
            onChange={(e) => setInput({ ...input, demandMultiplier: Number(e.target.value) })}
          />
        </label>
        <label>
          Demand basis
          <select
            value={input.demandBasis ?? 'observed'}
            onChange={(e) =>
              setInput({ ...input, demandBasis: e.target.value as 'observed' | 'forecast' })
            }
          >
            <option value="observed">Input demand</option>
            <option value="forecast">Forecast input (separate assumption/lineage)</option>
          </select>
        </label>
        <label className="decision-checkbox">
          <input
            type="checkbox"
            checked={input.integral ?? false}
            onChange={(e) => setInput({ ...input, integral: e.target.checked })}
          />
          Indivisible allocation (integer units)
        </label>
      </div>
      <div className="decision-actions">
        {config.data?.localComputeAllowed && (
          <Button
            disabled={busy || input.origin === 'authorized-snapshot'}
            onClick={() => evaluate(true)}
          >
            <FlaskConical size={15} /> Evaluate locally
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => evaluate(false)}>
          <Save size={15} /> Run &amp; save via API
        </Button>
        <Button variant="outline" disabled={busy} onClick={loadSaved}>
          Load my saved scenarios
        </Button>
        <Button
          variant="outline"
          disabled={!run || busy}
          onClick={() =>
            download(run, `citypulse-scenario-${run?.result.inputFingerprint.slice(0, 12)}.json`)
          }
        >
          <Download size={15} /> Export reproducible JSON
        </Button>
      </div>
      <p className="fine-print">
        Local evaluation uses the real solver but has no database persistence or server audit trail.
        Saving and authorized data retrieval require the Java API. Displayed results always use the
        last evaluated inputs, not unsaved control edits.
      </p>
      {busy && <p role="status">Validating inputs and solving bounded constraints…</p>}
      {error && (
        <p role="alert" className="decision-error">
          {error}
        </p>
      )}
      <details className="decision-details">
        <summary>Authorized observation and inventory snapshot</summary>
        <p>
          Use registered tenant data. Categories are canonical observation commodities, not inferred
          business sectors. Stocks are latest reported inventory within this UTC window; source
          completeness is not guaranteed.
        </p>
        <div className="decision-actions">
          <Button variant="outline" disabled={busy} onClick={loadCities}>
            Load permitted cities
          </Button>
        </div>
        <div className="decision-controls">
          <label>
            Cities (up to five)
            <select
              multiple
              size={3}
              value={cityIds}
              onChange={(e) => setCityIds(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.timezone}
                </option>
              ))}
            </select>
          </label>
          <label>
            Commodities (comma separated)
            <input value={categories} onChange={(e) => setCategories(e.target.value)} />
          </label>
          <label>
            From (UTC)
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Until, exclusive (UTC)
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <Button disabled={busy || !cityIds.length} onClick={snapshot}>
          Create immutable snapshot
        </Button>
      </details>
      <details
        className="decision-details"
        onToggle={(e) => {
          if (e.currentTarget.open) setEditor(JSON.stringify(input, null, 2));
        }}
      >
        <summary>Advanced scenario: weights, stocks, capacity, risk, lanes and provenance</summary>
        <p>
          All costs, risk values, priorities and multipliers are explicit business assumptions. JSON
          is validated by the published schema. An authorized snapshot overwrites client-supplied
          measured quantities on the server.
        </p>
        <label>
          Scenario JSON
          <textarea
            rows={14}
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
            spellCheck={false}
          />
        </label>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            try {
              const next = JSON.parse(editor);
              if (!next || !Array.isArray(next.districts) || !Array.isArray(next.stocks))
                throw new Error('Districts and stocks arrays are required');
              setInput(next as ScenarioInput);
              setError('');
            } catch (e) {
              setError(`Invalid scenario JSON: ${(e as Error).message}`);
            }
          }}
        >
          Apply scenario JSON
        </Button>
      </details>
      {saved.length > 0 && (
        <div className="decision-saved">
          <h3>Saved scenarios · first 20, newest first</h3>
          {saved.map((s) => (
            <Button key={s.id} variant="outline" disabled={busy} onClick={() => load(s.id)}>
              {s.name} · {new Date(s.created_at).toLocaleDateString()}
            </Button>
          ))}
        </div>
      )}
      <div role="tablist" aria-label="Decision dashboards" className="decision-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            id={`decision-tab-${id}`}
            role="tab"
            aria-selected={view === id}
            aria-controls="decision-view"
            tabIndex={view === id ? 0 : -1}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const i = tabs.findIndex((t) => t[0] === view);
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setView(tabs[next][0]);
              document.getElementById(`decision-tab-${tabs[next][0]}`)?.focus();
            }}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="decision-view" aria-labelledby={`decision-tab-${view}`} tabIndex={0}>
        {!result || !run ? (
          <div className="decision-empty">
            <Play size={25} />
            <h3>Evaluate a scenario to see its evidence and tradeoffs.</h3>
            <p>
              There are no precomputed recommendations here. Choose an explicitly synthetic case,
              review its inputs, and run the engine.
            </p>
          </div>
        ) : (
          <>
            <p className="fine-print">
              Result: {result.canonicalInput.name} ·{' '}
              {run.persisted ? 'SAVED AND AUDITED' : 'LOCAL · UNSAVED'} ·{' '}
              {result.canonicalInput.dataMode} · engine {result.engineVersion} · computed in{' '}
              {number(result.computeMs)} ms.
            </p>
            <div className="decision-kpis">
              <div>
                <span>Allocation</span>
                <strong>
                  {number(result.optimization.totalAllocated)} {result.canonicalInput.unit}
                </strong>
              </div>
              <div>
                <span>Planning cost</span>
                <strong>
                  {number(result.optimization.totalCost, 2)} {result.canonicalInput.currency}
                </strong>
              </div>
              <div>
                <span>Minimum coverage</span>
                <strong>
                  {result.optimization.minimumCoverage == null
                    ? 'Unknown'
                    : `${number(result.optimization.minimumCoverage * 100)}%`}
                </strong>
              </div>
              <div>
                <span>Solver status</span>
                <strong>{result.optimization.status.replaceAll('_', ' ')}</strong>
              </div>
            </div>
            {result.optimization.status !== 'optimal' && (
              <div role="status" className="decision-error">
                <h3>No feasible plan is being presented.</h3>
                {result.optimization.diagnostics.map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </div>
            )}
            {view === 'opportunities' && (
              <OpportunityTable rows={result.opportunities} unit={result.canonicalInput.unit} />
            )}
            {view === 'map' && <MapView rows={result.opportunities} />}
            {view === 'simulator' && (
              <>
                <h3>Inventory redistribution plan</h3>
                <p>Stocks are explicit; existing availability is not moved. No dispatch occurs.</p>
                <div className="table-scroll">
                  <table>
                    <caption>Recommended source-to-district quantities</caption>
                    <thead>
                      <tr>
                        <th scope="col">Stock</th>
                        <th scope="col">District</th>
                        <th scope="col">Quantity ({result.canonicalInput.unit})</th>
                        <th scope="col">Unit cost ({result.canonicalInput.currency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.optimization.allocations.map((a, i) => (
                        <tr key={i}>
                          <th scope="row">
                            {result.canonicalInput.stocks.find((s) => s.id === a.sourceId)?.name ??
                              a.sourceId}
                          </th>
                          <td>
                            {result.opportunities.find((d) => d.id === a.districtId)?.name ??
                              a.districtId}
                          </td>
                          <td>{number(a.quantity, 4)}</td>
                          <td>{number(a.unitCost, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!result.optimization.allocations.length && (
                  <p>
                    No positive transfers. Cost-only planning may correctly choose zero allocation
                    when coverage floors are zero.
                  </p>
                )}
                <Tradeoffs
                  plans={[
                    result.optimization,
                    ...result.tradeoffs.filter(
                      (p) => p.objective !== result.optimization.objective,
                    ),
                  ]}
                  currency={result.canonicalInput.currency}
                />
              </>
            )}
            {view === 'districts' && (
              <>
                <OpportunityTable rows={result.opportunities} unit={result.canonicalInput.unit} />
                <h3>Multi-city comparison</h3>
                <p>
                  Comparable period, unit and currency; mean score weights each district/category
                  group equally. This is not measured business profitability.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">City</th>
                        <th scope="col">Groups</th>
                        <th scope="col">Mean score</th>
                        <th scope="col">Known gap</th>
                        <th scope="col">Planned allocation</th>
                        <th scope="col">Missing groups</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.cityComparisons.map((c) => (
                        <tr key={c.city}>
                          <th scope="row">{c.city}</th>
                          <td>{c.groupCount}</td>
                          <td>{number(c.meanScore)}</td>
                          <td>{number(c.knownGap)}</td>
                          <td>{number(c.plannedAllocation)}</td>
                          <td>{c.missingDistricts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {view === 'scenarios' && (
              <>
                <h3>Compare evaluated or loaded scenarios</h3>
                <label>
                  Comparison scenario
                  <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                    <option value="">Choose an evaluated scenario</option>
                    {runs
                      .filter((r) => r.id !== run.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.result.canonicalInput.name} · {r.result.canonicalInput.budget} ·{' '}
                          {r.result.optimization.objective}
                        </option>
                      ))}
                  </select>
                </label>
                {comparison && !comparable && (
                  <p role="status">
                    These scenarios have incompatible units, currencies or periods. No numerical
                    comparison is provided.
                  </p>
                )}
                {comparable && (
                  <div className="table-scroll">
                    <table>
                      <caption>
                        Side-by-side planning outcomes, with source modes kept separate
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Scenario</th>
                          <th scope="col">Source mode</th>
                          <th scope="col">Status</th>
                          <th scope="col">Allocated</th>
                          <th scope="col">Cost</th>
                          <th scope="col">Minimum coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[run, comparison!].map((r) => (
                          <tr key={r.id}>
                            <th scope="row">{r.result.canonicalInput.name}</th>
                            <td>{r.result.canonicalInput.dataMode}</td>
                            <td>{r.result.optimization.status}</td>
                            <td>{number(r.result.optimization.totalAllocated)}</td>
                            <td>{number(r.result.optimization.totalCost)}</td>
                            <td>{number((r.result.optimization.minimumCoverage ?? 0) * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p>
                  Use budget, priorities or demand multipliers to create a second evaluated
                  scenario. Only actual solver outputs appear here.
                </p>
              </>
            )}
            {view === 'investment' && (
              <>
                <h3>Expansion and operating-budget investigation</h3>
                <p>
                  No revenue, fixed capital expenditure, permits or ROI model is available. Gap
                  scores identify places to investigate, not investments to buy. Site access and
                  risk inputs are operator assumptions.
                </p>
                <div className="decision-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setInput({
                        ...input,
                        budget: Math.round(result.canonicalInput.budget * 0.5),
                        name: `${result.canonicalInput.name.slice(0, 85)} · half budget`,
                      })
                    }
                  >
                    Stage half-budget what-if
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setInput({
                        ...input,
                        budget: Math.min(1e7, Math.round(result.canonicalInput.budget * 1.5)),
                        name: `${result.canonicalInput.name.slice(0, 85)} · larger budget`,
                      })
                    }
                  >
                    Stage 1.5× budget what-if
                  </Button>
                </div>
                <p>Staging changes controls only; evaluate to obtain a new result.</p>
                <OpportunityTable rows={result.opportunities} unit={result.canonicalInput.unit} />
              </>
            )}
            {view === 'explanation' && (
              <>
                <h3>Decision explanation and lineage</h3>
                <p>
                  Input demand, forecast input, business assumptions and computed allocations are
                  stored separately. Risk scores are not calibrated probabilities.
                </p>
                <dl>
                  <dt>Input fingerprint (SHA-256)</dt>
                  <dd>{result.inputFingerprint}</dd>
                  <dt>Result fingerprint (SHA-256)</dt>
                  <dd>{result.resultFingerprint}</dd>
                  <dt>Solver</dt>
                  <dd>
                    {result.solver} · SciPy {result.scipyVersion}
                  </dd>
                  <dt>Time window</dt>
                  <dd>
                    {result.canonicalInput.periodStart} — {result.canonicalInput.periodEnd} ·{' '}
                    {result.canonicalInput.timeZone}
                  </dd>
                </dl>
                <pre className="pulse-evidence">{JSON.stringify(result.assumptions, null, 2)}</pre>
                <ul>
                  {result.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                {run.persisted && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const value = await api<{ sameInput: boolean; sameResult: boolean }>(
                          `scenarios/${run.id}/reproduce`,
                          'POST',
                          {},
                          crypto.randomUUID(),
                        );
                        setError(
                          `Reproduction completed: same input ${value.sameInput}; exact result match ${value.sameResult}.`,
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Reproduce saved run through API
                  </Button>
                )}
                <OpportunityTable rows={result.opportunities} unit={result.canonicalInput.unit} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function OpportunityTable({ rows, unit }: { rows: Opportunity[]; unit: string }) {
  const [city, setCity] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('score');
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (city === 'all' || r.city === city) &&
            (category === 'all' || r.category === category) &&
            `${r.name} ${r.city}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (sort === 'gap'
              ? (b.gap ?? -1) - (a.gap ?? -1)
              : sort === 'risk'
                ? (a.risk ?? 0.5) - (b.risk ?? 0.5)
                : (b.score ?? -1) - (a.score ?? -1)) || a.id.localeCompare(b.id),
        ),
    [rows, city, category, query, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const current = Math.min(page, pages - 1);
  return (
    <div>
      <div className="decision-controls">
        <label>
          Filter city
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All cities</option>
            {Array.from(new Set(rows.map((r) => r.city))).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Filter category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All categories</option>
            {Array.from(new Set(rows.map((r) => r.category))).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Search districts
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Sort opportunities
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">Score descending</option>
            <option value="gap">Gap descending</option>
            <option value="risk">Assumed risk ascending</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <caption>
            District/category opportunities · quantities in {unit} · unknown is never zero
          </caption>
          <thead>
            <tr>
              <th scope="col">District / category</th>
              <th scope="col">Input demand</th>
              <th scope="col">Forecast input</th>
              <th scope="col">Effective gap</th>
              <th scope="col">Gap ratio</th>
              <th scope="col">Heuristic score / 100</th>
              <th scope="col">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 6, current * 6 + 6).map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  {r.name}
                  <br />
                  <span className="fine-print">
                    {r.city} · {r.category}
                  </span>
                </th>
                <td>{number(r.demand)}</td>
                <td>{number(r.forecastDemand)}</td>
                <td>{number(r.gap)}</td>
                <td>{number(r.ratio, 3)}</td>
                <td>{number(r.score)}</td>
                <td>
                  <details>
                    <summary>Factors &amp; references</summary>
                    <p>{r.interpretation}</p>
                    <p>
                      Seasonal change:{' '}
                      {r.seasonalChangeFraction == null
                        ? 'Unknown'
                        : `${number(r.seasonalChangeFraction * 100)}%`}{' '}
                      versus compatible baseline input.
                    </p>
                    <pre className="pulse-evidence">
                      {JSON.stringify(
                        {
                          contributions: r.contributions,
                          missing: r.missingFeatures,
                          evidence: r.evidence,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p>No district/category matches these filters.</p>}
      <div className="decision-actions">
        <Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous opportunities
        </Button>
        <span>
          Page {current + 1} of {pages}
        </span>
        <Button
          variant="outline"
          disabled={current >= pages - 1}
          onClick={() => setPage(current + 1)}
        >
          Next opportunities
        </Button>
        <Button
          variant="outline"
          disabled={!filtered.length}
          onClick={() =>
            exportCsv(
              filtered.map((r) => ({
                city: r.city,
                district: r.name,
                category: r.category,
                unit,
                demand: r.demand ?? 'unknown',
                availability: r.availability ?? 'unknown',
                gap: r.gap ?? 'unknown',
                score: r.score ?? 'unknown',
              })),
              'citypulse-opportunities.csv',
            )
          }
        >
          Export filtered CSV
        </Button>
      </div>
    </div>
  );
}
