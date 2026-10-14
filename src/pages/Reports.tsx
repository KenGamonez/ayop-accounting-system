import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Money } from '../components/ui';

function usePosted(unit: string, from: string, to: string) {
  const { txns } = useStore();
  return useMemo(() => txns.filter(t => t.status === 'Posted'
    && (unit === 'All units' || t.businessUnit === unit)
    && (!from || t.date >= from) && (!to || t.date <= to)), [txns, unit, from, to]);
}

export function FilterBar({ unit, setUnit, from, setFrom, to, setTo }: { unit: string; setUnit: (v: string) => void; from: string; setFrom: (v: string) => void; to: string; setTo: (v: string) => void }) {
  return (
    <div className="filters no-print">
      <select value={unit} onChange={e => setUnit(e.target.value)}><option>All units</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} />
      <button className="btn ghost small" onClick={() => window.print()}>🖨 Print</button>
    </div>
  );
}

export default function Reports() {
  return (
    <>
      <PageHead title="Reports (Printable)" sub="One place for month-end style printouts. All statements use posted entries only and are labeled synthetic — they require accounting validation before production use." actions={<button className="btn ghost" onClick={() => window.print()}>🖨 Print page</button>} />
      <div className="grid g3">
        {[
          { to: '/admin/trial-balance', t: 'Trial Balance', d: 'Debit / credit balance check across ledger accounts.' },
          { to: '/admin/income-expense', t: 'Statement of Income & Expense', d: 'Revenue vs. expenses by business unit (staff terminology).' },
          { to: '/admin/financial-condition', t: 'Statement of Financial Condition', d: 'Assets, liabilities, and equity snapshot (demo).' },
          { to: '/admin/journal', t: 'Journal Register', d: 'Posted journal entries with source transactions.' },
          { to: '/admin/accounting', t: 'General Ledger', d: 'Posted ledger lines with account mapping.' },
          { to: '/admin/purchasing', t: 'Purchasing & Receiving', d: 'P.O. log with supplier, delivery date, and receiving status.' },
        ].map(r => (
          <div className="card" key={r.to}><h3>{r.t}</h3><p className="small muted">{r.d}</p><Link className="btn small ghost" to={r.to}>Open →</Link></div>
        ))}
      </div>
      <div className="warn"><strong>Scope note:</strong> Cash Flow Statement is conditional on agreed scope and is not claimed as production scope here. BIR compliance is a separate phase — nothing here claims BIR compliance.</div>
    </>
  );
}

export function TrialBalance() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const posted = usePosted(unit, from, to);
  const byAcct = useMemo(() => {
    const m = new Map<string, { name: string; debit: number; credit: number }>();
    posted.forEach(t => {
      const k = `${t.accountCode} — ${t.accountName}`;
      const e = m.get(k) ?? { name: t.accountName, debit: 0, credit: 0 };
      if (t.classification === 'Expense' || t.classification === 'Asset') e.debit += t.amount;
      else e.credit += t.amount;
      m.set(k, e);
    });
    return [...m.entries()];
  }, [posted]);
  const td = byAcct.reduce((s, [, v]) => s + v.debit, 0);
  const tc = byAcct.reduce((s, [, v]) => s + v.credit, 0);
  return (
    <>
      <PageHead title="Trial Balance" sub={`Posted entries · ${unit} · ${from} to ${to}. Synthetic demo — validate before production.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card">
        <h3>Ayop Group of Companies — Trial Balance (Demo, {peso(td)} Dr / {peso(tc)} Cr)</h3>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Account</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
          <tbody>{byAcct.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v.debit ? <Money n={v.debit} /> : '—'}</td><td className="num">{v.credit ? <Money n={v.credit} /> : '—'}</td></tr>)}
            <tr><td><strong>Totals</strong></td><td className="num"><strong><Money n={td} /></strong></td><td className="num"><strong><Money n={tc} /></strong></td></tr></tbody>
        </table></div>
        <p className="small muted">Pending and rejected entries are excluded by design. Imbalance in demo data is expected and must be resolved by accounting rules in the backend phase.</p>
      </div>
    </>
  );
}

export function IncomeExpense() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const posted = usePosted(unit, from, to);
  const rev = posted.filter(t => t.classification === 'Revenue');
  const exp = posted.filter(t => t.classification === 'Expense');
  const rT = rev.reduce((s, t) => s + t.amount, 0);
  const eT = exp.reduce((s, t) => s + t.amount, 0);
  return (
    <>
      <PageHead title="Statement of Income & Expense" sub={`Posted revenue and expenses · ${unit}. Staff terminology preserved. Synthetic demo.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card">
        <h3>Revenue ({rev.length} lines) — {peso(rT)}</h3>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Item</th><th>Unit</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{rev.map(t => <tr key={t.id}><td>{t.date}</td><td>{t.item}</td><td>{t.businessUnit}</td><td className="num"><Money n={t.amount} /></td></tr>)}</tbody></table></div>
      </div>
      <div className="card">
        <h3>Expenses ({exp.length} lines) — {peso(eT)}</h3>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{exp.map(t => <tr key={t.id}><td>{t.date}</td><td>{t.item}</td><td>{t.supplier}</td><td className="num"><Money n={t.amount} /></td></tr>)}</tbody></table></div>
        <h3 style={{ marginTop: 12 }}>Net income (demo): {peso(rT - eT)}</h3>
        <p className="small muted">Sample statement for demonstration; formulas and treatments require accounting validation before production use.</p>
      </div>
    </>
  );
}

export function FinancialCondition() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const posted = usePosted(unit, from, to);
  const sum = (c: string) => posted.filter(t => t.classification === c).reduce((s, t) => s + t.amount, 0);
  const A = sum('Asset'), L = sum('Liability'), R = sum('Revenue'), E = sum('Expense');
  const equity = R - E;
  return (
    <>
      <PageHead title="Statement of Financial Condition" sub="Assets, liabilities, and equity snapshot from posted demo entries. Requires validation." />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Section</th><th style={{ textAlign: 'right' }}>Amount (demo)</th></tr></thead>
          <tbody>
            <tr><td><strong>Assets</strong><div className="small muted">Asset-class postings in period</div></td><td className="num"><Money n={A} /></td></tr>
            <tr><td><strong>Liabilities</strong><div className="small muted">Liability-class postings in period</div></td><td className="num"><Money n={L} /></td></tr>
            <tr><td><strong>Equity (demo net)</strong><div className="small muted">Revenue − Expenses in period: {peso(R)} − {peso(E)}</div></td><td className="num"><Money n={equity} /></td></tr>
            <tr><td><strong>Liabilities + Equity (demo)</strong></td><td className="num"><strong><Money n={L + equity} /></strong></td></tr>
          </tbody>
        </table></div>
        <p className="small muted">Illustrative only — opening balances, depreciation, accruals, and costing methods are not modeled in this frontend phase.</p>
      </div>
    </>
  );
}
