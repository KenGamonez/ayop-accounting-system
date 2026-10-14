import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS } from '../data/seed';
import { closeFingerprint, computeClose, monthRange } from '../data/close';
import { useStore } from '../store/AppStore';
import { PageHead, Pill } from '../components/ui';

const ACK_KEY = 'jem51-demo-v1:close-ack';
interface Ack { by: string; at: string; fp: string }
function loadAcks(): Record<string, Ack> {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) ?? '{}'); } catch { return {}; }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2025, 2026, 2027];

function statusPill(s: string) {
  return <Pill status={s === 'clear' ? 'Clear' : s === 'na' ? 'N/A' : 'Needs action'} />;
}

export default function CloseChecklist() {
  const { txns, journal, pos, user } = useStore();
  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);
  const [unit, setUnit] = useState('All units');
  const [acks, setAcks] = useState<Record<string, Ack>>(loadAcks);
  const key = `${unit}|${year}-${String(month).padStart(2, '0')}`;
  const { label } = monthRange(year, month);

  // Base result (no acknowledgement) → fingerprint of the 7 data checks.
  const base = useMemo(
    () => computeClose({ txns, journal, pos, year, month, unit, reportReviewed: false }),
    [txns, journal, pos, year, month, unit],
  );
  const fp = closeFingerprint({ ...base, checks: base.checks.filter(c => c.id !== 'report-review') });
  const stored = acks[key];
  // A stale acknowledgement (underlying data changed) invalidates automatically.
  const ackValid = stored != null && stored.fp === fp;
  const result = useMemo(
    () => computeClose({ txns, journal, pos, year, month, unit, reportReviewed: ackValid }),
    [txns, journal, pos, year, month, unit, ackValid],
  );

  const acknowledge = () => {
    const next = { ...acks, [key]: { by: user?.name ?? 'Demo user', at: new Date().toLocaleString('en-PH'), fp } };
    setAcks(next);
    try { localStorage.setItem(ACK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const pct = Math.round((result.completed / result.total) * 100);

  return (
    <>
      <PageHead title="Month-End Close" sub={`${label} · ${unit}. Demo checklist only — no accounting period is locked.`} />
      <div className="warn">Demo close checklist only — no accounting period is locked, and reviewing this list changes no accounting records.</div>
      <div className="card">
        <div className="filters">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>{YEARS.map(y => <option key={y}>{y}</option>)}</select>
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All units</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <span className="pill" style={{ alignSelf: 'center' }}>
            {result.periodStatus === 'Checklist Complete' ? <Pill status="Posted" /> : result.periodStatus === 'Open' ? <Pill status="Draft" /> : <Pill status="For Owner Approval" />}
            <span className="small" style={{ marginLeft: 6 }}><strong>{result.periodStatus}</strong> · {result.completed}/{result.total} checks · {pct}%</span>
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#eef1f7', overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: pct + '%', height: '100%', background: result.periodStatus === 'Checklist Complete' ? '#157347' : '#2563eb' }} />
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Check</th><th>Status</th><th style={{ textAlign: 'right' }}>Count</th><th>Action</th></tr></thead>
          <tbody>{result.checks.map(c => (
            <tr key={c.id}>
              <td><strong>{c.label}</strong><div className="small muted">{c.detail}</div></td>
              <td>{statusPill(c.status)}</td>
              <td className="num">{c.id === 'report-review' ? (ackValid ? '✓' : '—') : c.count}</td>
              <td><Link className="btn small ghost" to={c.link}>{c.linkLabel} →</Link></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card">
        <h3>Statement review acknowledgement (simulated)</h3>
        {ackValid
          ? <p className="small muted">Recorded by <strong>{stored.by}</strong> at {stored.at} for {label} · {unit}. If underlying demo data changes, this acknowledgement invalidates and the check reopens.</p>
          : <p className="small muted">Review the Trial Balance, Income &amp; Expense, and Financial Condition for this scope, then record it here. Stored in this browser only — not a lock, audit guarantee, or permission.</p>}
        <div className="btn-row">
          <Link className="btn ghost small" to="/admin/trial-balance">Trial Balance</Link>
          <Link className="btn ghost small" to="/admin/income-expense">Income &amp; Expense</Link>
          <Link className="btn ghost small" to="/admin/financial-condition">Financial Condition</Link>
          {!ackValid && <button className="btn small" onClick={acknowledge}>Record review acknowledgement</button>}
        </div>
      </div>
    </>
  );
}
