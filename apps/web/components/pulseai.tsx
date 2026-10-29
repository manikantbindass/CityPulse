'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Sparkles, Send, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

type Fact = { id: string; text: string; evidence: Record<string, unknown> };
type Answer = {
  documents?: { path: string; sha256: string; excerpt: string; label: string }[];
  statements: Fact[];
  provider: string;
  notice: string;
  empty: boolean;
  limitations: string[];
  followUps: string[];
  views: { label: string; href: string }[];
};
type Message = { question: string; answer: Answer };
type Session = { id: string; created_at: string };

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/pulseai/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  if (!response.ok) throw new Error(value.detail ?? 'Analyst request failed');
  return value;
}

export function PulseAI() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cityId, setCityId] = useState('10000000-0000-0000-0000-000000000001');
  const [commodity, setCommodity] = useState('rice');
  const [comparisonCommodity, setComparisonCommodity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-01-02');
  const [forecastId, setForecastId] = useState('');
  async function load() {
    setError('');
    try {
      setSessions(await api<Session[]>('sessions'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError('');
    try {
      const rows = await api<{ question: string; answer: string }[]>(`sessions/${id}`);
      setMessages(
        rows.map((r) => ({ question: r.question, answer: JSON.parse(r.answer) as Answer })),
      );
      setSession(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const id = session || (await api<{ id: string }>('sessions', 'POST')).id;
      setSession(id);
      const answer = await api<Answer>(`sessions/${id}/messages`, 'POST', {
        question,
        cityId,
        commodity,
        comparisonCommodity: comparisonCommodity || null,
        unit,
        from: `${from}T00:00:00Z`,
        to: `${to}T00:00:00Z`,
        forecastId: forecastId || null,
      });
      setMessages((m) => [...m, { question, answer }]);
      setQuestion('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel pulseai" aria-labelledby="pulseai-title">
      <header className="panel-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> Evidence before answers
          </span>
          <h2 id="pulseai-title">PulseAI analyst</h2>
          <p className="fine-print">
            Read-only records · tenant permissions enforced · optional model selection
          </p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>
      <p className="fine-print">
        Defaults select the synthetic local fixture, not live city intelligence. Dates use UTC. The
        analyst never substitutes the dashboard’s sample figures for database records.
      </p>
      <details className="pulse-context" open>
        <summary>Data context &amp; filters</summary>
        <div className="pulse-fields">
          <label>
            Authorized city UUID
            <input required value={cityId} onChange={(e) => setCityId(e.target.value)} />
          </label>
          <label>
            Commodity
            <input
              required
              maxLength={80}
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            />
          </label>
          <label>
            Compare commodity (optional)
            <input
              maxLength={80}
              value={comparisonCommodity}
              onChange={(e) => setComparisonCommodity(e.target.value)}
            />
          </label>
          <label>
            Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['kg', 'count', 'litre', 'kwh', 'trip'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            From (UTC)
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Until, exclusive (UTC)
            <input type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Forecast UUID (optional)
            <input value={forecastId} onChange={(e) => setForecastId(e.target.value)} />
          </label>
        </div>
      </details>
      <div className="pulse-tools">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSession('');
            setMessages([]);
            setError('');
          }}
        >
          <Plus size={15} /> New conversation
        </Button>
        <Button variant="outline" disabled={busy} onClick={load}>
          Load my conversations
        </Button>
        {sessions.length > 0 && (
          <label>
            Conversation
            <select
              value={session}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) void open(e.target.value);
              }}
            >
              <option value="">Select conversation</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}
        {session && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`sessions/${session}`, 'DELETE');
                setSession('');
                setMessages([]);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={15} /> Delete conversation
          </Button>
        )}
      </div>
      <div
        className="chat-messages"
        role="log"
        aria-label="PulseAI conversation"
        aria-live="polite"
        aria-busy={busy}
      >
        {!messages.length && (
          <article className="chat-message assistant">
            <span>PulseAI</span>
            <p>
              Ask about measured intervals or source provenance. If observations or permissions are
              missing, I’ll say so. Each factual statement includes its database record references.
            </p>
          </article>
        )}
        {messages.map((message, i) => (
          <div key={i}>
            <article className="chat-message user">
              <span>You</span>
              <p>{message.question}</p>
            </article>
            <article className="chat-message assistant">
              <span>PulseAI · {message.answer.provider}</span>
              {message.answer.empty && (
                <p>
                  No authorized records match these filters. No analytical conclusion is available.
                </p>
              )}
              {message.answer.statements.map((f) => (
                <div key={f.id}>
                  <p>{f.text}</p>
                  <details>
                    <summary>Evidence {f.id}</summary>
                    <pre className="pulse-evidence">{JSON.stringify(f.evidence, null, 2)}</pre>
                  </details>
                </div>
              ))}
              {message.answer.documents?.map((d) => (
                <details key={d.path}>
                  <summary>Documentation: {d.path}</summary>
                  <p className="fine-print">
                    {d.label} · SHA-256 {d.sha256}
                  </p>
                  <pre className="pulse-evidence">{d.excerpt}</pre>
                </details>
              ))}
              <p className="fine-print">{message.answer.notice}</p>
              <details>
                <summary>Uncertainty &amp; limitations</summary>
                <ul>
                  {message.answer.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </details>
              <div className="pulse-tools">
                {message.answer.views.map((v) => (
                  <Link key={v.href} href={v.href}>
                    {v.label} ↗
                  </Link>
                ))}
              </div>
            </article>
          </div>
        ))}
        {busy && <p role="status">Retrieving permitted evidence and validating the response…</p>}
      </div>
      {error && (
        <p role="alert" className="pulse-error">
          {error}
        </p>
      )}
      <div className="pulse-tools">
        {[
          'Explain source provenance',
          'Compare the observed intervals',
          'What data is missing for allocation planning?',
        ].map((q) => (
          <button
            className="pulse-suggestion"
            key={q}
            disabled={busy}
            onClick={() => setQuestion(q)}
          >
            {q}
          </button>
        ))}
      </div>
      <form onSubmit={send} className="chat-form">
        <label htmlFor="pulse-question" className="sr-only">
          Ask PulseAI
        </label>
        <input
          id="pulse-question"
          required
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does the evidence show?"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !question.trim()} aria-label="Send question">
          <Send size={18} />
        </Button>
      </form>
      <p className="fine-print">
        Conversations expire after seven days. Avoid personal data. Local preview shares the
        development identity; deploy end-user OIDC before multi-user access.
      </p>
    </section>
  );
}
