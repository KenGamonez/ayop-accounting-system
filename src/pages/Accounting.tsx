import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { COA } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

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
  const { txns, journal } = useStore();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(fromUrl && TABS.includes(fromUrl) ? fromUrl : 'coa');

  useEffect(() => {
    const t = params.get('tab') as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
  }, [params]);

  const pick = (t: Tab) => { setTab(t); setParams({ tab: t }, { replace: true }); };

  const posted = useMemo(() => txns.filter(t => t.status === 'Posted'), [txns]);
  const gl = useMemo(() => posted.map(t => ({
    date: t.date, ref: t.id, particulars: `${t.item} — ${t.businessUnit}`,
    debit: t.classification === 'Expense' || t.classification === 'Asset' ? t.amount : 0,
    credit: t.classification === 'Revenue' || t.classification === 'Liability' ? t.amount : 0,
    account: `${t.accountCode} — ${t.accountName}`,
  })), [posted]);
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
      {tab === 'gl' && (
        <div className="card"><h3>General Ledger — posted entries ({gl.length})</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Ref</th><th>Particulars / Account</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
            <tbody>{gl.map((g, i) => <tr key={i}><td>{g.date}</td><td>{g.ref}</td><td>{g.particulars}<div className="small muted">{g.account}</div></td><td className="num">{g.debit ? <Money n={g.debit} /> : '—'}</td><td className="num">{g.credit ? <Money n={g.credit} /> : '—'}</td></tr>)}</tbody></table></div>
          <p className="small muted">Journal drafts ({journal.filter(j => j.status === 'Draft').length}) are not included until posted from the Journal screen.</p>
        </div>
      )}
      {tab === 'ap' && (
        <div className="card"><h3>Accounts Payable — supplier billings</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Ref</th><th>Supplier</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{ap.length ? ap.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.supplier}</td><td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>) : <tr><td colSpan={5} className="muted">No payables in demo set.</td></tr>}</tbody></table></div>
        </div>
      )}
      {tab === 'ar' && (
        <div className="card"><h3>Accounts Receivable — amounts due (demo)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Ref</th><th>Supplier / Client</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{ar.length ? ar.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.supplier}</td><td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>) : <tr><td colSpan={5} className="muted">No receivables in demo set — collection entries would appear here.</td></tr>}</tbody></table></div>
        </div>
      )}
      {tab === 'bank' && <BankRec />}
      {tab === 'audit' && <AuditTable />}
    </>
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
