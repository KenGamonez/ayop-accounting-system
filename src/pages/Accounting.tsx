import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BUSINESS_UNITS, COA, Txn, peso } from '../data/seed';
import { countsAsPosted } from '../data/ops';
import { accountLedger, accountOptions, getAccount } from '../data/finance';
import { monthRange } from '../data/close';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';
import { PrintHead } from './Reports';

type Tab = 'coa' | 'gl' | 'ap' | 'ar' | 'bank' | 'audit';
const TABS: Tab[] = ['coa', 'gl', 'ap', 'ar', 'bank', 'audit'];
const TAB_LABEL: Record<Tab, string> = {
  coa: 'Chart of Accounts',
  gl: 'General Ledger',
  ap: 'Accounts Payable',
  ar: 'Accounts Receivable',
  bank: 'Bank Reconciliation',
  audit: 'Audit Trail',
};

export default function Accounting() {
  const { txns } = useStore();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(fromUrl && TABS.includes(fromUrl) ? fromUrl : 'coa');

  useEffect(() => {
    const t = params.get('tab') as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
  }, [params]);

  const pick = (t: Tab) => { setTab(t); setParams({ tab: t }, { replace: true }); };

  const ap = txns.filter(t => t.accountCode === '2000' && t.status !== 'Reversed');
  const ar = txns.filter(t => t.accountCode === '1200' && t.status !== 'Reversed');

  return (
    <>
      <PageHead title="Accounting" sub="Chart of Accounts, General Ledger (posted entries only), payables / receivables summaries, bank reconciliation worksheet, and audit-trail preview. Synthetic demo." />
      <div className="notice">Control: only <strong>Posted</strong> transactions appear in the General Ledger and statements. Draft, in-review, and rejected items are excluded.</div>
      <div className="btn-row no-print" style={{ marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t} className={'btn small ' + (tab === t ? '' : 'ghost')} onClick={() => pick(t)}>{TAB_LABEL[t]}</button>
        ))}
      </div>
      {tab === 'coa' && (
        <div className="card"><h3>Chart of Accounts (demo structure — validate codes before production)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Code</th><th>Account name</th><th>Type</th></tr></thead>
            <tbody>{COA.map(a => <tr key={a.code}><td><strong>{a.code}</strong></td><td>{a.name}</td><td><Pill status={a.type} /></td></tr>)}</tbody></table></div>
        </div>
      )}
      {tab === 'gl' && <GeneralLedger />}
      {tab === 'ap' && <PayableTable title="Accounts Payable — supplier billings" empty="No payables in demo set. P.O. receipts queue payables here for review." rows={ap} />}
      {tab === 'ar' && <PayableTable title="Accounts Receivable — amounts due (demo)" empty="No receivables in demo set — collection entries would appear here." rows={ar} client />}
      {tab === 'bank' && <BankRec />}
      {tab === 'audit' && <AuditTable />}
    </>
  );
}

type GLPreset = 'Monthly' | 'Quarterly' | 'Six months' | 'Yearly' | 'Custom';
const GL_YEARS = [2025, 2026, 2027];
const GL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function presetRange(preset: GLPreset, year: number, sub: number, customFrom: string, customTo: string): { from: string; to: string } {
  if (preset === 'Custom') return { from: customFrom, to: customTo };
  if (preset === 'Yearly') return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (preset === 'Monthly') return monthRange(year, sub);
  if (preset === 'Quarterly') {
    const m0 = (sub - 1) * 3 + 1;
    const last = new Date(year, m0 + 2, 0).getDate();
    return { from: `${year}-${String(m0).padStart(2, '0')}-01`, to: `${year}-${String(m0 + 2).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  // Six months: sub 1 = Jan–Jun, sub 2 = Jul–Dec
  return sub === 1 ? { from: `${year}-01-01`, to: `${year}-06-30` } : { from: `${year}-07-01`, to: `${year}-12-31` };
}

function GeneralLedger() {
  const { txns } = useStore();
  const options = useMemo(() => accountOptions(), []);
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState('All units');
  const [preset, setPreset] = useState<GLPreset>('Monthly');
  const [year, setYear] = useState(2026);
  const [sub, setSub] = useState(10);
  const [customFrom, setCustomFrom] = useState('2026-10-01');
  const [customTo, setCustomTo] = useState('2026-10-31');

  const range = presetRange(preset, year, sub, customFrom, customTo);
  const rangeBad = !!range.from && !!range.to && range.from > range.to;

  const code = (input.split('—')[0] ?? '').trim();
  const account = code ? getAccount(code) : null;
  const ledger = useMemo(
    () => (account && !rangeBad ? accountLedger(txns, account.code, { unit, from: range.from, to: range.to }) : null),
    [txns, account, unit, range.from, range.to, rangeBad],
  );

  const subLabel = preset === 'Monthly' ? 'Month' : preset === 'Quarterly' ? 'Quarter' : preset === 'Six months' ? 'Half' : null;

  return (
    <div className="card statement">
      <h3>General Ledger — account first, then period</h3>
      <div className="form-grid no-print">
        <label className="f">Account Code (searchable, from Chart of Accounts)
          <input list="gl-accounts" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. 1000 — Cash on Hand" />
          <datalist id="gl-accounts">
            {options.map(o => <option key={o.code} value={`${o.code} — ${o.name}`} />)}
          </datalist>
        </label>
        <label className="f">Business Unit
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All units</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
        </label>
        <label className="f">Period
          <select value={preset} onChange={e => setPreset(e.target.value as GLPreset)}>
            <option>Monthly</option><option>Quarterly</option><option>Six months</option><option>Yearly</option><option>Custom</option>
          </select>
        </label>
        <label className="f">Year
          <select value={year} onChange={e => setYear(Number(e.target.value))}>{GL_YEARS.map(y => <option key={y}>{y}</option>)}</select>
        </label>
        {subLabel && <label className="f">{subLabel}
          <select value={sub} onChange={e => setSub(Number(e.target.value))}>
            {preset === 'Monthly' && GL_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            {preset === 'Quarterly' && [1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
            {preset === 'Six months' && [<option key={1} value={1}>January – June</option>, <option key={2} value={2}>July – December</option>]}
          </select>
        </label>}
        {preset === 'Custom' && <label className="f">From<input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>}
        {preset === 'Custom' && <label className="f">To<input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>}
      </div>
      {!account && (
        input.trim()
          ? <div className="warn">No account matches “{input.trim()}”. Pick a code from the Chart of Accounts list above.</div>
          : <div className="notice">Select an account code above to view its posted ledger activity. Nothing is shown until an account is selected — no balances are fabricated.</div>
      )}
      {rangeBad && <div className="warn">Invalid date range: From ({range.from}) is after To ({range.to}). Adjust the dates.</div>}
      {account && (
        <div className="notice" style={{ marginTop: 10 }}>
          <strong>{account.code} — {account.name}</strong> · Type: {account.type} (balance follows the {account.type === 'Asset' || account.type === 'Expense' ? 'debit' : 'credit'} side)
        </div>
      )}
      {ledger && (
        <>
          <PrintHead title={`General Ledger — ${ledger.account.code} — ${ledger.account.name}`} unit={unit} from={range.from} to={range.to} />
          {ledger.lines.length === 0 ? (
            <div className="notice">No eligible posted transactions for {ledger.account.code} in this scope and period. Pending, draft, rejected, and reversed entries are excluded by design.</div>
          ) : (
            <>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Date</th><th>Ref</th><th>Particulars / Unit</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Running balance</th></tr></thead>
                <tbody>
                  <tr><td colSpan={5}><strong>Opening balance (posted entries before {range.from || 'period start'})</strong></td><td className="num"><strong><Money n={ledger.opening} /></strong></td></tr>
                  {ledger.lines.map((l, i) => (
                    <tr key={i}><td>{l.date}</td><td>{l.ref}</td>
                      <td>{l.particulars}<div className="small muted">{l.unit}</div></td>
                      <td className="num">{l.debit ? <Money n={l.debit} /> : '—'}</td>
                      <td className="num">{l.credit ? <Money n={l.credit} /> : '—'}</td>
                      <td className="num"><Money n={l.balance} /></td></tr>
                  ))}
                  <tr className="total-row"><td colSpan={3}><strong>Period totals</strong></td><td className="num"><strong><Money n={ledger.totalDebit} /></strong></td><td className="num"><strong><Money n={ledger.totalCredit} /></strong></td><td className="num"><strong><Money n={ledger.closing} /></strong></td></tr>
                </tbody>
              </table></div>
              <p className="small muted">
                Closing balance {peso(ledger.closing)} = opening {peso(ledger.opening)} adjusted by period activity on the account's normal side.
                Demo model note: each entry contributes to one side by its classification; reversals offset the original.
              </p>
            </>
          )}
          <div className="btn-row no-print"><button className="btn ghost small" onClick={() => window.print()}>🖨 Print ledger</button></div>
        </>
      )}
    </div>
  );
}

function PayableTable({ title, empty, rows, client }: { title: string; empty: string; rows: Txn[]; client?: boolean }) {
  const awaiting = rows.filter(t => !countsAsPosted(t.status));
  const settled = rows.filter(t => countsAsPosted(t.status));
  const group = (label: string, list: Txn[]) => (
    <>
      <h3 style={{ margin: '12px 0 6px', fontSize: 13 }}>{label} ({list.length})</h3>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Ref</th><th>{client ? 'Supplier / Client' : 'Supplier'}</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>{list.length ? list.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.supplier}</td><td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>) : <tr><td colSpan={5} className="muted">None.</td></tr>}</tbody></table></div>
    </>
  );
  return (
    <div className="card"><h3>{title}</h3>
      {rows.length === 0
        ? <p className="small muted">{empty}</p>
        : <><p className="small muted">Only Posted rows feed the ledger — items below awaiting review are obligations to track, not posted results.</p>
          {group('Awaiting review / approval', awaiting)}
          {group('Posted', settled)}</>}
    </div>
  );
}

function BankRec() {
  const [book, setBook] = useState(128450);
  const [bank, setBank] = useState(141200);
  const [deposit, setDeposit] = useState(12750);
  const [outstanding, setOutstanding] = useState(0);
  const adjusted = bank + deposit - outstanding;
  const diff = adjusted - book;
  return (
    <div className="card">
      <h3>Bank Reconciliation (demo worksheet — validate before production)</h3>
      <p className="small muted">Compare the cash book against the bank statement. Demonstration figures only; enter the month-end values from your actual records.</p>
      <div className="form-grid">
        <label className="f">Cash book balance (₱)<input type="number" value={book} onChange={e => setBook(Number(e.target.value))} /></label>
        <label className="f">Bank statement balance (₱)<input type="number" value={bank} onChange={e => setBank(Number(e.target.value))} /></label>
        <label className="f">Deposits in transit (₱)<input type="number" value={deposit} onChange={e => setDeposit(Number(e.target.value))} /></label>
        <label className="f">Outstanding checks (₱)<input type="number" value={outstanding} onChange={e => setOutstanding(Number(e.target.value))} /></label>
      </div>
      <div className="tbl-wrap" style={{ marginTop: 12 }}><table className="tbl">
        <tbody>
          <tr><td>Adjusted bank balance (statement + transit − outstanding)</td><td className="num"><strong><Money n={adjusted} /></strong></td></tr>
          <tr><td>Cash book balance</td><td className="num"><Money n={book} /></td></tr>
          <tr><td><strong>Difference {diff === 0 ? '— reconciled ✓' : '(unreconciled — investigate)'}</strong></td><td className="num"><strong><Money n={diff} /></strong></td></tr>
        </tbody>
      </table></div>
    </div>
  );
}

function AuditTable() {
  const { audit } = useStore();
  return (
    <div className="card"><h3>Audit-trail preview (who did what, when)</h3>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Ref</th><th>Detail</th></tr></thead>
        <tbody>{audit.map(a => <tr key={a.id}><td>{a.at}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.ref}</td><td>{a.detail}</td></tr>)}</tbody></table></div>
    </div>
  );
}
