import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { accountLabel, balanceSheet, conditionSummary, incomeSummary, postedIn, trialBalance } from '../data/finance';
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
export function PrintHead({ title, unit, from, to }: { title: string; unit: string; from: string; to: string }) {
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
          { to: '/admin/balance-sheet', t: 'Balance Sheet', d: 'Assets, liabilities, equity accounts, and period Net Income.' },
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

/** Income & Expense column headings. ITEM CODE values come straight from each
 *  row's Chart of Accounts account code (t.accountCode) — never inferred. */
export const INCOME_REVENUE_COLUMNS = ['Date', 'ITEM CODE', 'Particulars', 'Unit', 'Status', 'Amount'] as const;
export const INCOME_EXPENSE_COLUMNS = ['Date', 'ITEM CODE', 'Particulars', 'Supplier', 'Status', 'Amount'] as const;

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
          <div className="tbl-wrap"><table className="tbl"><thead><tr>{INCOME_REVENUE_COLUMNS.map((c, i) => <th key={c} style={i === 5 ? { textAlign: 'right' } : undefined}>{c}</th>)}</tr></thead>
            <tbody>{inc.revenueLines.map(t => <tr key={t.id}><td>{t.date}</td><td><strong>{accountLabel(t.accountCode, t.accountName)}</strong></td><td>{t.item}{t.reversalOf ? <div className="small muted">Reversal of {t.reversalOf} (offsets)</div> : ''}</td><td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.reversalOf ? -t.amount : t.amount} /></td></tr>)}
              <tr className="total-row"><td colSpan={5}><strong>Total revenue</strong></td><td className="num"><strong><Money n={inc.totalRevenue} /></strong></td></tr></tbody></table></div>
          <h3 style={{ marginTop: 14 }}>Expenses — {peso(inc.totalExpense)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr>{INCOME_EXPENSE_COLUMNS.map((c, i) => <th key={c} style={i === 5 ? { textAlign: 'right' } : undefined}>{c}</th>)}</tr></thead>
            <tbody>{inc.expenseLines.map(t => <tr key={t.id}><td>{t.date}</td><td><strong>{accountLabel(t.accountCode, t.accountName)}</strong></td><td>{t.item}{t.reversalOf ? <div className="small muted">Reversal of {t.reversalOf} (offsets)</div> : ''}</td><td>{t.supplier}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.reversalOf ? -t.amount : t.amount} /></td></tr>)}
              <tr className="total-row"><td colSpan={5}><strong>Total expenses</strong></td><td className="num"><strong><Money n={inc.totalExpense} /></strong></td></tr></tbody></table></div>
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

export function BalanceSheet() {
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const { txns } = useStore();
  const b = useMemo(() => balanceSheet(txns, { unit, from, to }), [txns, unit, from, to]);
  const empty = b.assets.length === 0 && b.liabilities.length === 0 && b.equityAccounts.length === 0;
  const section = (title: string, total: number, groups: { account: string; amount: number }[], none: string) => (
    <>
      <h3 style={{ marginTop: 14 }}>{title} — {peso(total)}</h3>
      {groups.length === 0
        ? <p className="small muted">{none}</p>
        : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Account code — name</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
          <tbody>{groups.map(g => <tr key={g.account}><td>{g.account}</td><td className="num"><Money n={g.amount} /></td></tr>)}
            <tr className="total-row"><td><strong>{title} total</strong></td><td className="num"><strong><Money n={total} /></strong></td></tr></tbody></table></div>}
    </>
  );
  return (
    <>
      <PageHead title="Balance Sheet" sub={`Assets, liabilities, and equity · ${unit} · ${from} to ${to}. Synthetic demo — validate before production.`} />
      <FilterBar unit={unit} setUnit={setUnit} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="card statement">
        <PrintHead title="Balance Sheet" unit={unit} from={from} to={to} />
        {empty && b.netIncome === 0 ? <EmptyState what="no posted balance-sheet entries in this period" /> : <>
          {section('Assets', b.totalAssets, b.assets, 'No posted asset balances in this scope — shown as zero, not estimated.')}
          {section('Liabilities', b.totalLiabilities, b.liabilities, 'No posted liability balances in this scope — shown as zero, not estimated.')}
          <h3 style={{ marginTop: 14 }}>Equity — {peso(b.totalEquity)}</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Account / line</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>
              {b.equityAccounts.length === 0
                ? <tr><td>Equity accounts<span className="small muted" style={{ display: 'block' }}>No posted balances on Equity-type chart codes — zero, not manufactured.</span></td><td className="num"><Money n={0} /></td></tr>
                : b.equityAccounts.map(g => <tr key={g.account}><td>{g.account}</td><td className="num"><Money n={g.amount} /></td></tr>)}
              <tr><td><strong>Net Income (period)</strong><span className="small muted" style={{ display: 'block' }}>Revenue less expenses for this period — distinct from equity-account balances above.</span></td><td className="num"><strong><Money n={b.netIncome} /></strong></td></tr>
              <tr className="total-row"><td><strong>Total equity</strong></td><td className="num"><strong><Money n={b.totalEquity} /></strong></td></tr>
            </tbody></table></div>
          <div className={Math.abs(b.difference) < 0.005 ? 'notice' : 'warn'} style={{ marginTop: 12 }}>
            Total Assets {peso(b.totalAssets)} · Total Liabilities + Equity {peso(b.totalLiabilitiesAndEquity)} ·
            Difference <strong>{peso(b.difference)}</strong>.
            {Math.abs(b.difference) >= 0.005 && ' Not concealed: demo postings are single-sided, so a difference is expected until proper double-entry rules land in the backend phase.'}
          </div>
        </>}
        <p className="small muted">Posted entries only — drafts, pending review, rejected, and reversed entries are excluded. Revenue and expenses are never classified as equity accounts; they contribute only through the Net Income line.</p>
      </div>
    </>
  );
}
