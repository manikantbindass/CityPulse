'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  Download,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  ArrowRight,
  MapPin,
  Activity,
  Store,
  Layers,
  Bookmark,
  RefreshCw,
  Search,
  Check,
  Copy,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { districts, series, notifications, pageInfo, type District } from '../lib/seed';
import { useWorkspace, useWorkspaceReady } from '../lib/store';
import { exportCsv, getCities, getForecast } from '../lib/api';
import { Button } from './ui/button';
import { CityNetwork } from './network';
import { ChainRecords } from './chain-records';
import { MlForecast } from './ml-forecast';
import { SessionControls } from './session-controls';
import { DecisionWorkspace } from './decision-workspace';
import { PulseAI } from './pulseai';
import { BackendEvidence } from './backend-evidence';
const DemandChart = dynamic(() => import('./charts').then((m) => m.DemandChart), {
  ssr: false,
  loading: () => <div className="chart-frame skeleton" aria-label="Loading chart" />,
});
const DistrictChart = dynamic(() => import('./charts').then((m) => m.DistrictChart), {
  ssr: false,
});
const CityMap = dynamic(() => import('./city-map'), {
  ssr: false,
  loading: () => <div className="map-wrap skeleton" aria-label="Loading map" />,
});

function Panel({
  title,
  label,
  children,
  className = '',
  action,
}: {
  title: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {label && <p>{label}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function DistrictTable({
  data,
  opportunities = false,
}: {
  data: District[];
  opportunities?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      data
        .filter((row) =>
          `${row.name} ${row.opportunity}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'gap'
            ? b.demand - b.supply - (a.demand - a.supply)
            : sort === 'demand'
              ? b.demand - a.demand
              : a.name.localeCompare(b.name),
        ),
    [data, search, sort],
  );
  const maxPage = Math.max(0, Math.ceil(filtered.length / 4) - 1);
  const current = Math.min(page, maxPage);
  return (
    <>
      <div className="table-toolbar">
        <label className="input-icon">
          <Search size={16} />
          <span className="sr-only">Search districts</span>
          <input
            placeholder="Search districts…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="select-label">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">District name</option>
            <option value="gap">Largest supply gap</option>
            <option value="demand">Highest demand</option>
          </select>
        </label>
        <Button
          variant="ghost"
          size="sm"
          disabled={!filtered.length}
          onClick={() => {
            exportCsv(
              filtered.map((row) => ({
                dataset: 'SYNTHETIC',
                district: row.name,
                demand: row.demand,
                supply: row.supply,
                gap: row.demand - row.supply,
              })),
              'citypulse-sample-districts.csv',
            );
            toast.success('Sample CSV exported');
          }}
        >
          <Download size={15} />
          Export
        </Button>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
        <table>
          <caption className="sr-only">Synthetic district observations in units per day</caption>
          <thead>
            <tr>
              <th scope="col">District</th>
              <th scope="col">Demand</th>
              <th scope="col">Supply</th>
              <th scope="col">Supply gap</th>
              <th scope="col">{opportunities ? 'Sample opportunity' : 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 4, current * 4 + 4).map((row, i) => (
              <tr key={row.id}>
                <th scope="row">
                  <span className={`district-dot dot-${i % 3}`} />
                  {row.name}
                </th>
                <td>{row.demand}</td>
                <td>{row.supply}</td>
                <td className={row.demand > row.supply ? 'text-amber' : 'text-mint'}>
                  {row.demand - row.supply > 0 ? '+' : ''}
                  {row.demand - row.supply}
                </td>
                <td>
                  {opportunities ? (
                    row.opportunity
                  ) : (
                    <span
                      className={`table-badge ${row.demand > row.supply ? 'badge-amber' : 'badge-green'}`}
                    >
                      {row.demand > row.supply ? 'Demand exceeds supply' : 'Supply available'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-state">
            <Search size={26} />
            <h3>No districts match.</h3>
            <p>Try another name or clear the search.</p>
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear search
            </Button>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          {filtered.length ? current * 4 + 1 : 0}–{Math.min(current * 4 + 4, filtered.length)} of{' '}
          {filtered.length} districts
        </span>
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span aria-live="polite">
            {current + 1} / {maxPage + 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={current === maxPage}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
function RegistryStatus() {
  const q = useQuery({ queryKey: ['cities'], queryFn: getCities, retry: false });
  return (
    <div className="registry-status">
      <span className={`status-dot ${q.isSuccess ? 'connected' : ''}`} />
      <span>
        {q.isPending
          ? 'Connecting to the city registry…'
          : q.isError
            ? 'Registry offline. Workspace uses synthetic data.'
            : `API connected · ${q.data.items.length} registered cities · analytics remain synthetic`}
      </span>
      {q.isError && (
        <button onClick={() => q.refetch()} className="text-action">
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}
export function WorkspacePage({ section }: { section: string }) {
  const info = pageInfo[section];
  const store = useWorkspace();
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const data = districts.filter((row) => store.district === 'all' || row.id === store.district);
  const demand = data.reduce((n, r) => n + r.demand, 0),
    supply = data.reduce((n, r) => n + r.supply, 0),
    businesses = data.reduce((n, r) => n + r.businesses, 0);
  const [heatmap, setHeatmap] = useState(true);
  const analytics = [
    'dashboard',
    'explorer',
    'intelligence',
    'predictions',
    'opportunities',
    'optimization',
    'reports',
  ].includes(section);
  const forecast = useMutation({
    mutationFn: () =>
      getForecast(
        series.map((r) => r.demand),
        3,
      ),
    onError: (e) => toast.error(e.message),
    onSuccess: () => toast.success('Baseline returned by the AI service'),
  });
  const exportReport = () => {
    exportCsv(
      data.map((r) => ({
        dataset: 'SYNTHETIC',
        district: r.name,
        demand: r.demand,
        supply: r.supply,
      })),
      'citypulse-sample-report.csv',
    );
    toast.success('Sample report exported');
  };
  return (
    <main id="main" className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-line" /> CITY INTELLIGENCE WORKSPACE
          </p>
          <h1>{info.title}</h1>
          <p>{info.subtitle}</p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            onClick={() => {
              store.save();
              toast.success('View saved on this device');
            }}
          >
            <Bookmark size={15} />
            Save view
          </Button>
          <Button onClick={exportReport}>
            <Download size={15} />
            Export report
          </Button>
        </div>
      </div>
      <div className="sample-banner">
        <Info size={14} />
        <span>
          {section === 'analyst'
            ? 'PulseAI reads authorized backend records and labels their source mode. Workspace charts remain synthetic.'
            : 'Development preview. Analytics, overlays, and insights use synthetic data. No live city intelligence.'}
        </span>
        <Link href="/help">
          About this data <ArrowUpRight size={12} />
        </Link>
      </div>
      {analytics && (
        <div className="filterbar">
          <div className="filter-controls">
            <label>
              <MapPin size={14} />
              <select
                aria-label="District filter"
                value={store.district}
                onChange={(e) => store.setDistrict(e.target.value)}
              >
                <option value="all">Demo City · All districts</option>
                {districts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label>
              <span aria-hidden="true">▦</span>
              <select
                aria-label="Date range"
                value={store.period}
                onChange={(e) => store.setPeriod(e.target.value)}
              >
                <option value="14">Oct 1–14, 2026</option>
                <option value="7">Oct 8–14, 2026</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <span className="filter-note">Synthetic snapshot · Units / day</span>
          {mounted && store.saved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                store.restore();
                toast.success('Saved view restored');
              }}
            >
              Restore view
            </Button>
          )}
        </div>
      )}
      {section === 'dashboard' && (
        <>
          <div className="kpi-grid">
            {[
              {
                label: 'Total demand',
                value: demand,
                unit: 'units / day',
                delta: '+12.4%',
                icon: Activity,
                color: 'mint',
              },
              {
                label: 'Available supply',
                value: supply,
                unit: 'units / day',
                delta: '+8.2%',
                icon: Layers,
                color: 'violet',
              },
              {
                label: 'Registered businesses',
                value: businesses,
                unit: 'sample businesses',
                delta: '+6.1%',
                icon: Store,
                color: 'blue',
              },
              {
                label: 'Unmet demand',
                value: Math.max(0, demand - supply),
                unit: 'units / day',
                delta: '+4.2%',
                icon: SlidersHorizontal,
                color: 'amber',
              },
            ].map((item, i) => (
              <motion.article
                key={item.label}
                className={`kpi-card kpi-${item.color}`}
                initial={reduce ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.035 }}
              >
                <div className="kpi-top">
                  <p>{item.label}</p>
                  <span className="kpi-icon">
                    <item.icon size={17} />
                  </span>
                </div>
                <div className="kpi-value">
                  {item.value.toLocaleString('en-US')}
                  <svg viewBox="0 0 95 30" className="sparkline" aria-hidden="true">
                    <path
                      d={
                        i % 2
                          ? 'M1 23L12 19L21 22L33 10L45 15L54 11L67 14L78 5L94 7'
                          : 'M1 25L12 20L23 24L35 14L45 17L57 8L69 12L80 6L94 1'
                      }
                    />
                  </svg>
                </div>
                <div className="kpi-meta">
                  <span>{item.unit}</span>
                  <span className={item.color === 'amber' ? 'text-amber' : 'text-mint'}>
                    <ArrowUpRight size={12} />
                    {item.delta}
                    <small>sample change</small>
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Supply & demand trends"
              label="Daily observations · synthetic units"
              action={
                <span className="chart-key">
                  <i />
                  Demand <i />
                  Supply
                </span>
              }
            >
              <DemandChart
                days={Number(store.period)}
                multiplier={store.district === 'all' ? 1 : data[0].demand / 842}
              />
              <div className="chart-footer">
                <span className="text-mint">
                  <Activity size={13} />
                  Growing sample demand
                </span>
                <Link href="/intelligence">
                  Explore trends <ArrowRight size={14} />
                </Link>
              </div>
            </Panel>
            <Panel
              title="City at a glance"
              label="Connected districts · conceptual illustration"
              className="map-panel"
              action={
                <Link href="/explorer" aria-label="Open city explorer" className="icon-button">
                  <ArrowUpRight size={17} />
                </Link>
              }
            >
              <CityNetwork compact />
              <div className="map-panel-footer">
                <span>
                  <i className="status-dot connected" />
                  {data.length} sample districts
                </span>
                <span>No live feeds</span>
              </div>
            </Panel>
          </div>
          <div className="dashboard-lower">
            <Panel
              title="District comparison"
              label="Where needs and availability diverge"
              action={
                <Link href="/explorer" className="text-action">
                  View all <ArrowRight size={13} />
                </Link>
              }
            >
              <DistrictTable data={data} />
            </Panel>
            <Panel
              title="Signals worth a closer look"
              label="Illustrative insights from the seed dataset"
              className="insights-panel"
            >
              <Insight
                title="Room to meet the need."
                label="SUPPLY GAP"
                text="East Market has a 166-unit gap in the sample scenario."
                href="/opportunities"
              />
              <Insight
                title="Start with the evidence."
                label="DATA PROVENANCE"
                text="Create a fingerprint of sample data before exploring attestation."
                href="/verification"
              />
              <div className="insight-bottom">Human judgment stays at the center.</div>
            </Panel>
          </div>
          <RegistryStatus />
        </>
      )}
      {section === 'explorer' && (
        <>
          <Panel
            title="Geospatial workspace"
            label="Sample overlays on an OpenStreetMap basemap"
            action={
              <Button
                variant="outline"
                size="sm"
                aria-pressed={heatmap}
                onClick={() => setHeatmap((v) => !v)}
              >
                <Layers size={15} />
                {heatmap ? 'Intensity overlay on' : 'District markers'}
              </Button>
            }
          >
            <CityMap district={store.district} heatmap={heatmap} />
            <p className="fine-print">
              Teal: demand exceeds supply. Violet: supply available. Radius encodes synthetic
              demand, not measured density. Tiles require internet.
            </p>
          </Panel>
          <Panel
            title="Accessible district data"
            label="The same observations without requiring a map"
          >
            <DistrictTable data={data} />
          </Panel>
        </>
      )}
      {section === 'intelligence' && (
        <>
          <div className="dashboard-grid">
            <Panel title="Demand and supply" label="Synthetic observations">
              <DemandChart
                days={Number(store.period)}
                multiplier={store.district === 'all' ? 1 : data[0].demand / 842}
              />
            </Panel>
            <Panel title="District balance" label="Units per day">
              <DistrictChart data={data} />
            </Panel>
          </div>
          <Panel title="Observation explorer" label="Search, sort, paginate, and export">
            <DistrictTable data={data} />
          </Panel>
        </>
      )}
      {section === 'predictions' && (
        <div className="dashboard-grid">
          <Panel
            title="Trend forecast"
            label="Illustrative interval, not a calibrated confidence estimate"
          >
            <DemandChart days={Number(store.period)} forecast />
          </Panel>
          <Panel title="Model card" label="linear-trend-v1">
            <dl className="definition-list">
              <div>
                <dt>Model</dt>
                <dd>scikit-learn linear regression</dd>
              </div>
              <div>
                <dt>Input</dt>
                <dd>Equally spaced nonnegative values</dd>
              </div>
              <div>
                <dt>Limitations</dt>
                <dd>No seasonality or calibrated intervals</dd>
              </div>
              <div>
                <dt>Evaluation</dt>
                <dd>Not evaluated on real urban data</dd>
              </div>
            </dl>
            <Button onClick={() => forecast.mutate()} disabled={forecast.isPending}>
              <Sparkles size={15} />
              {forecast.isPending ? 'Requesting…' : 'Run local AI baseline'}
            </Button>
            <div aria-live="polite">
              {forecast.data && (
                <p className="result-box">
                  Next 3 sample days: {forecast.data.predictions.join(', ')} units.
                </p>
              )}
              {forecast.isError && <p className="error-message">{forecast.error.message}</p>}
            </div>
          </Panel>
        </div>
      )}
      {section === 'opportunities' && <DecisionWorkspace />}
      {section === 'intelligence' && <BackendEvidence />}
      {(section === 'dashboard' || section === 'predictions') && <MlForecast />}
      {section === 'optimization' && <DecisionWorkspace initialView="simulator" />}
      {section === 'verification' && <Verification />}
      {(section === 'verification' || section === 'admin') && <ChainRecords />}
      {section === 'analyst' && <Analyst />}
      {section === 'reports' && <Reports data={data} />}
      {section === 'notifications' && (
        <Panel
          title="Workspace notifications"
          label="Demonstration notifications stored on this device"
        >
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`notification-row ${mounted && store.readIds.includes(item.id) ? 'is-read' : ''}`}
            >
              <span className="insight-icon">
                <Info size={18} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <small>{item.time}</small>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={mounted && store.readIds.includes(item.id)}
                onClick={() => {
                  store.markRead(item.id);
                  toast.success('Marked as read');
                }}
              >
                <Check size={14} />
                {mounted && store.readIds.includes(item.id) ? 'Read' : 'Mark read'}
              </Button>
            </article>
          ))}
        </Panel>
      )}
      {section === 'settings' && <Settings />}
      {section === 'admin' && (
        <Panel
          title="Administrator preview"
          label="Demo role selection grants no server permissions"
        >
          {mounted && store.role === 'administrator' ? (
            <>
              <h3>Local administrator persona</h3>
              <p>
                Production identity management, audit search, and user provisioning are planned. No
                real accounts exist in this preview.
              </p>
              <dl className="definition-list">
                <div>
                  <dt>Identity</dt>
                  <dd>OIDC required outside local profile</dd>
                </div>
                <div>
                  <dt>Sources</dt>
                  <dd>One synthetic fixture provider</dd>
                </div>
                <div>
                  <dt>API policy</dt>
                  <dd>registry:read scope required</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="empty-state">
              <ShieldCheck size={30} />
              <h3>Administrator demo persona required</h3>
              <p>
                Choose the local administrator persona in settings. Server permissions remain
                unchanged.
              </p>
              <Link className="button button-outline" href="/settings">
                Open settings
              </Link>
            </div>
          )}
        </Panel>
      )}
      {section === 'help' && <Help />}
      <footer className="workspace-footer">
        <span>CityPulse / Local development foundation</span>
        <span>Designed for evidence. Built for people.</span>
      </footer>
    </main>
  );
}
function Insight({
  title,
  label,
  text,
  href,
}: {
  title: string;
  label: string;
  text: string;
  href: string;
}) {
  return (
    <div className="insight-item">
      <span className="insight-icon">
        <Sparkles size={17} />
      </span>
      <div>
        <span className="eyebrow text-mint">{label}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        <Link href={href}>
          Explore <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
function Verification() {
  const [payload, setPayload] = useState(
    '{"dataset":"synthetic","district":"central","demand":842}',
  );
  const [digest, setDigest] = useState('');
  async function hash() {
    try {
      const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      setDigest(
        `0x${Array.from(new Uint8Array(result))
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')}`,
      );
      toast.success('Fingerprint calculated locally');
    } catch {
      toast.error('Use localhost or HTTPS for fingerprint calculation.');
    }
  }
  return (
    <div className="dashboard-grid">
      <Panel
        title="Data fingerprint"
        label="SHA-256 of exact UTF-8 text. Whitespace changes the digest."
      >
        <label className="field-label" htmlFor="payload">
          Sample payload
        </label>
        <textarea
          id="payload"
          rows={7}
          maxLength={100000}
          value={payload}
          onChange={(e) => {
            setPayload(e.target.value);
            setDigest('');
          }}
        />
        <Button onClick={hash} disabled={!payload}>
          <ShieldCheck size={15} />
          Calculate fingerprint
        </Button>
        {digest && (
          <div className="result-box" aria-live="polite">
            <p>Local digest</p>
            <code className="digest">{digest}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(digest);
                  toast.success('Digest copied');
                } catch {
                  toast.error('Select and copy the digest manually.');
                }
              }}
            >
              <Copy size={14} />
              Copy digest
            </Button>
          </div>
        )}
      </Panel>
      <Panel title="Attestation status" label="Local contract prototype">
        <div className="verification-status">
          <ShieldCheck size={40} />
          <h3>No chain connection</h3>
          <p>
            This screen computes a local fingerprint only. The repository contains a Solidity
            registry for Hardhat. Wallet connection and transaction submission are planned.
          </p>
          <p>
            A digest proves integrity relative to a reference. It does not prove the observation is
            true.
          </p>
        </div>
      </Panel>
    </div>
  );
}
function Analyst() {
  return <PulseAI />;
}
function Reports({ data }: { data: District[] }) {
  const [fields, setFields] = useState(['demand', 'supply', 'businesses']);
  return (
    <Panel title="Report builder" label="Configure a CSV export of the current synthetic selection">
      <fieldset className="report-fields">
        <legend>Include fields</legend>
        {['demand', 'supply', 'businesses'].map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={fields.includes(f)}
              onChange={(e) =>
                setFields((p) => (e.target.checked ? [...p, f] : p.filter((v) => v !== f)))
              }
            />
            {f}
          </label>
        ))}
      </fieldset>
      <p className="fine-print">
        District and synthetic label are always included. This snapshot covers Oct 14 only. Date
        range controls trend charts.
      </p>
      <Button
        disabled={!fields.length}
        onClick={() => {
          exportCsv(
            data.map((r) => ({
              dataset: 'SYNTHETIC_OCT_14',
              district: r.name,
              ...Object.fromEntries(fields.map((f) => [f, r[f as keyof District]])),
            })),
            'citypulse-custom-report.csv',
          );
          toast.success('Custom report exported');
        }}
      >
        <Download size={15} />
        Download CSV
      </Button>
      <DistrictTable data={data} />
    </Panel>
  );
}
function Settings() {
  const ready = useWorkspaceReady();
  const store = useWorkspace();
  const [name, setName] = useState('Demo Analyst');
  return (
    <div className="dashboard-grid">
      <Panel title="Profile preferences" label="Saved only in this browser. No account is updated.">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem('citypulse-display-name', name);
            toast.success('Local display name saved');
          }}
        >
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit">Save local profile</Button>
        </form>
      </Panel>
      <Panel
        title="Session security"
        label="Identity provider session, separate from local display preferences"
      >
        <SessionControls />
      </Panel>
      <Panel title="Workspace appearance" label="Local preferences and demo navigation">
        <div className="settings-form">
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            value={store.theme}
            onChange={(e) => store.setTheme(e.target.value as 'dark' | 'light')}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
          <label htmlFor="role-select">Demo persona</label>
          <select
            id="role-select"
            disabled={!ready}
            value={store.role}
            onChange={(e) => {
              store.setRole(e.target.value as 'analyst' | 'administrator');
              toast.info('Demo navigation changed. Server permissions unchanged.');
            }}
          >
            <option value="analyst">Business analyst</option>
            <option value="administrator">Administrator preview</option>
          </select>
          <p className="fine-print">
            Production role assignment requires OIDC. This switch previews navigation only.
          </p>
        </div>
      </Panel>
    </div>
  );
}
function Help() {
  return (
    <div className="help-layout">
      <Panel title="Your first exploration" label="A short path through the foundation">
        <ol className="onboarding-list">
          {[
            [
              '01',
              'Get your bearings',
              'Choose a district on the overview and save the view.',
              '/dashboard',
            ],
            [
              '02',
              'Inspect the evidence',
              'Compare tables with district overlays. Every figure is synthetic.',
              '/explorer',
            ],
            [
              '03',
              'Test a hypothesis',
              'Run a baseline or adjust resource allocations.',
              '/predictions',
            ],
          ].map(([n, title, text, href]) => (
            <li key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link href={href}>
                  Explore <ArrowUpRight size={13} />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Good to know" label="Keyboard access and product limits">
        {[
          [
            'Is this real city data?',
            'No. Districts, statistics, insights, intervals, and notifications are synthetic. The basemap is OpenStreetMap.',
          ],
          [
            'How do keyboard shortcuts work?',
            'Press Control+K or Command+K for the palette. Tab moves between controls. Escape closes dialogs.',
          ],
          [
            'What connects to the backend?',
            'Registry status calls Spring Boot. Run local AI baseline calls FastAPI. Other data is seeded.',
          ],
          [
            'Can I create an account?',
            'Authentication screens are previews. No credentials are stored or submitted. Production authentication requires OIDC.',
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
        <a
          className="button button-outline"
          href="https://github.com/manikantbindass/CityPulse/tree/feat/citypulse-foundation/docs"
        >
          Repository documentation <ArrowUpRight size={14} />
        </a>
      </Panel>
    </div>
  );
}
