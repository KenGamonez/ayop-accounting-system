import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { conditionSummary, incomeSummary, postedIn, trialBalance } from '../data/finance';
import { useStore } from '../store/AppStore';
import { PageHead, Money, Pill } from '../components/ui';

function usePosted(unit: string, from: string, to: string) {
  const { txns } = useStore();
  return useMemo(() => postedIn(txns, { unit, from, to }), [txns, unit, from, to]);
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

/** Print-only report masthead (screen shows PageHead instead). */
function PrintHead({ title, unit, from, to }: { title: string; unit: string; from: string; to: string }) {
  return (
    <div className="print-head">
      <div className="print-company">Ayop Group of Companies — JEM51 Accounting System</div>
      <h2>{title}</h2>
      <div className="print-meta">
        Scope: {unit} · Period: {from || '—'} to {to || '—'} · Printed: {new Date().toLocaleString('en-PH')}
      </div>
      <div className="print-demo">SYNTHETIC DEMONSTRATION DATA — requires accounting validation before production use.</div>
    </div>
  );
}

function EmptyState({ what }: { what: string }) {
  return (
    <div className="notice">
      No eligible posted entries for this scope — {what}. Drafts, pending review, rejected, and reversed entries are excluded by design.
      Approve and post entries from the <Link to="/admin/approval">Approval queue</Link>.
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
          { to: '/admin/close', t: 'Month-End Close', d: 'Checklist: review queues, receipts, Trial Balance, and statement review.' },
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
  const { txns } = useStore();
  const tb = useMemo(() => trialBalance(txns, { unit, from, to }), [txns, unit, from, to]);
  return (
    <>
      <PageHead title="Trial Balance" sub={`Posted entries · ${unit} · ${from} to ${to}. Synthetic demo — validate before production.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card statement">
        <PrintHead title="Trial Balance" unit={unit} from={from} to={to} />
        <h3 className="no-print">Ayop Group of Companies — Trial Balance (Demo)</h3>
        {tb.lines.length === 0 ? <EmptyState what="nothing posted in this period" /> : <>
          <div className={tb.balanced ? 'notice' : 'warn'}>
            {tb.balanced
              ? `Balanced ✓ — total debits equal total credits at ${peso(tb.totalDebit)}.`
              : `OUT OF BALANCE — debits ${peso(tb.totalDebit)} vs. credits ${peso(tb.totalCredit)} (difference ${peso(tb.difference)}). Not concealed: resolve with proper double-entry postings before production use.`}
          </div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Account code — name</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
            <tbody>{tb.lines.map(l => <tr key={l.account}><td>{l.account}</td><td className="num">{l.debit ? <Money n={l.debit} /> : '—'}</td><td className="num">{l.credit ? <Money n={l.credit} /> : '—'}</td></tr>)}
              <tr className="total-row"><td><strong>Totals</strong></td><td className="num"><strong><Money n={tb.totalDebit} /></strong></td><td className="num"><strong><Money n={tb.totalCredit} /></strong></td></tr>
              <tr><td><strong>Difference (Dr − Cr)</strong></td><td className="num" colSpan={2}><strong><Money n={tb.difference} /></strong></td></tr></tbody>
          </table></div>
        </>}
        <p className="small muted">Posted entries only — drafts, pending review, rejected, and reversed entries are excluded. Reversal corrections count against the original so impacts are not doubled.</p>
      </div>
    </>
  );
}

export function IncomeExpense() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const { txns } = useStore();
  const inc = useMemo(() => incomeSummary(txns, { unit, from, to }), [txns, unit, from, to]);
  const empty = inc.revenueLines.length === 0 && inc.expenseLines.length === 0;
  return (
    <>
      <PageHead title="Statement of Income & Expense" sub={`Posted revenue and expenses · ${unit} · ${from} to ${to}. Staff terminology preserved. Synthetic demo.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card statement">
        <PrintHead title="Statement of Income & Expense" unit={unit} from={from} to={to} />
        {empty ? <EmptyState what="no posted revenue or expenses in this period" /> : <>
          <h3>Revenue — {peso(inc.totalRevenue)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Item</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{inc.revenueLines.map(t => <tr key={t.id}><td>{t.date}</td><td>{t.item}{t.reversalOf ? <div className="small muted">Reversal of {t.reversalOf} (offsets)</div> : ''}</td><td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.reversalOf ? -t.amount : t.amount} /></td></tr>)}
              <tr className="total-row"><td colSpan={4}><strong>Total revenue</strong></td><td className="num"><strong><Money n={inc.totalRevenue} /></strong></td></tr></tbody></table></div>
          <h3 style={{ marginTop: 14 }}>Expenses — {peso(inc.totalExpense)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{inc.expenseLines.map(t => <tr key={t.id}><td>{t.date}</td><td>{t.item}{t.reversalOf ? <div className="small muted">Reversal of {t.reversalOf} (offsets)</div> : ''}</td><td>{t.supplier}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.reversalOf ? -t.amount : t.amount} /></td></tr>)}
              <tr className="total-row"><td colSpan={4}><strong>Total expenses</strong></td><td className="num"><strong><Money n={inc.totalExpense} /></strong></td></tr></tbody></table></div>
          <h3 style={{ marginTop: 12 }}>Net {inc.net >= 0 ? 'income' : 'loss'} (demo): {peso(inc.net)}</h3>
        </>}
        <p className="small muted">Posted entries only, same rule as every financial summary. Sample statement for demonstration; formulas and treatments require accounting validation before production use.</p>
      </div>
    </>
  );
}

export function FinancialCondition() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const { txns } = useStore();
  const c = useMemo(() => conditionSummary(txns, { unit, from, to }), [txns, unit, from, to]);
  const empty = c.assets.length === 0 && c.liabilities.length === 0;
  return (
    <>
      <PageHead title="Statement of Financial Condition" sub={`Assets, liabilities, and balancing position · ${unit} · ${from} to ${to}. Requires validation.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card statement">
        <PrintHead title="Statement of Financial Condition" unit={unit} from={from} to={to} />
        {empty ? <EmptyState what="no posted asset or liability entries in this period" /> : <>
          <h3>Assets — {peso(c.totalAssets)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Account code — name</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{c.assets.map(g => <tr key={g.account}><td>{g.account}</td><td className="num"><Money n={g.amount} /></td></tr>)}
              <tr className="total-row"><td><strong>Total assets</strong></td><td className="num"><strong><Money n={c.totalAssets} /></strong></td></tr></tbody></table></div>
          <h3 style={{ marginTop: 14 }}>Liabilities — {peso(c.totalLiabilities)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Account code — name</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{c.liabilities.map(g => <tr key={g.account}><td>{g.account}</td><td className="num"><Money n={g.amount} /></td></tr>)}
              <tr className="total-row"><td><strong>Total liabilities</strong></td><td className="num"><strong><Money n={c.totalLiabilities} /></strong></td></tr></tbody></table></div>
          <div className={Math.abs(c.difference) < 0.005 ? 'notice' : 'warn'} style={{ marginTop: 12 }}>
            Assets − Liabilities = <strong>{peso(c.difference)}</strong>.
            Demo data has no equity accounts, opening balances, depreciation, or accruals, so no equity is manufactured to force a balance.
            Period memo: revenue {peso(c.periodRevenue)} · expenses {peso(c.periodExpense)}.
          </div>
        </>}
        <p className="small muted">Posted entries only, grouped by the application's Chart of Accounts codes. Illustrative — incomplete account mapping limits this result.</p>
      </div>
    </>
  );
}
