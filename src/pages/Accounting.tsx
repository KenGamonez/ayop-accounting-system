import React, { useMemo, useState } from 'react';
import { COA } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Accounting() {
  const { txns, journal, audit } = useStore();
  const [tab, setTab] = useState<'coa' | 'gl' | 'ap' | 'ar' | 'audit'>('coa');
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
      <PageHead title="Accounting" sub="Chart of Accounts, General Ledger (posted entries only), payables / receivables summaries, and audit-trail preview. Synthetic demo." />
      <div className="notice">Control: only <strong>Posted</strong> transactions appear in the General Ledger and statements. Draft, in-review, and rejected items are excluded.</div>
      <div className="btn-row no-print" style={{ marginBottom: 12 }}>
        {(['coa', 'gl', 'ap', 'ar', 'audit'] as const).map(t => (
          <button key={t} className={'btn small ' + (tab === t ? '' : 'ghost')} onClick={() => setTab(t)}>
            {t === 'coa' ? 'Chart of Accounts' : t === 'gl' ? 'General Ledger' : t === 'ap' ? 'Accounts Payable' : t === 'ar' ? 'Accounts Receivable' : 'Audit Trail'}
          </button>
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
      {tab === 'audit' && (
        <div className="card"><h3>Audit-trail preview (who did what, when)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Ref</th><th>Detail</th></tr></thead>
            <tbody>{audit.map(a => <tr key={a.id}><td>{a.at}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.ref}</td><td>{a.detail}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </>
  );
}
