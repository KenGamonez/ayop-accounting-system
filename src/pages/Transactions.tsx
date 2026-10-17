import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, CLASSIFICATIONS } from '../data/seed';
import { canResubmit } from '../data/ops';
import { toCSV, fileName } from '../data/io';
import { download } from '../components/download';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';
import TransactionEntryForm from '../components/TransactionEntryForm';

export default function Transactions() {
  const { txns, transition, user } = useStore();
  const [fUnit, setFUnit] = useState('All');
  const [fClass, setFClass] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [q, setQ] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [show, setShow] = useState(false);

  const filtered = useMemo(() => txns.filter(t =>
    (fUnit === 'All' || t.businessUnit === fUnit) &&
    (fClass === 'All' || t.classification === fClass) &&
    (fStatus === 'All' || t.status === fStatus) &&
    (!mineOnly || !user || t.createdBy === user.id) &&
    (!q || (t.item + t.supplier + t.id).toLowerCase().includes(q.toLowerCase()))
  ), [txns, fUnit, fClass, fStatus, q, mineOnly, user]);

  // Front-end only: the new entry form keeps its state and totals in the
  // browser. Nothing is persisted here — no addTxn, no API, no journal.
  const handleFormSubmit = (_data: unknown) => {
    setShow(false);
  };

  return (
    <>
      <div className={show ? 'no-print' : undefined}>
        <PageHead title="Transaction" actions={<button className="btn blue" onClick={() => setShow(s => !s)}>{show ? 'Close entry form' : '+ New transaction'}</button>} />
      </div>
      {show && (
        <TransactionEntryForm
          onSubmit={handleFormSubmit}
          onCancel={() => setShow(false)}
          onPrint={() => window.print()}
        />
      )}
      {!show && (
        <div className="card">
        <div className="filters">
          <select value={fUnit} onChange={e => setFUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <select value={fClass} onChange={e => setFClass(e.target.value)}><option>All</option>{CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}</select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)}><option>All</option>{['Draft', 'For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted', 'Rejected', 'Reversed'].map(s => <option key={s}>{s}</option>)}</select>
          <input placeholder="Search Item / Supplier / ID" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 220 }} />
          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> Mine only</label>
          <button className="btn ghost small" onClick={() => download(new Blob([toCSV(
            ['ID', 'Date', 'Business Unit', 'Classification', 'Kind', 'Item', 'Category', 'Supplier', 'Supplier Price', 'Retail Price', 'Quantity', 'Amount', 'Status'],
            filtered.map(t => [t.id, t.date, t.businessUnit, t.classification, t.kind, t.item, t.category, t.supplier, t.supplierPrice, t.retailPrice, t.quantity, t.amount, t.status])
          )], { type: 'text/csv' }), fileName('transactions', 'csv'))}>Export CSV ({filtered.length})</button>
          <Link className="btn ghost small" to="/admin/import-export">Import →</Link>
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID / Date</th><th>Item / Supplier</th><th>Unit</th><th>Class</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th>Next step</th></tr></thead>
          <tbody>{filtered.map(t => (
            <tr key={t.id}>
              <td><strong>{t.id}</strong><div className="small muted">{t.date} · {t.kind}</div></td>
              <td>{t.item}<div className="small muted">Supplier: {t.supplier} · {t.category}</div></td>
              <td>{t.businessUnit}</td><td>{t.classification}</td>
              <td><Pill status={t.status} /></td>
              <td className="num"><Money n={t.amount} /></td>
              <td>{t.status === 'Draft' || t.status === 'Rejected' ? (canResubmit(user?.role ?? '', user?.id, t) ? <button className="btn small ghost" onClick={async () => { const r = await transition(t.id, 'For Accountant Review', undefined, user?.id); if (!r.ok) alert(r.message); }}>Resubmit</button> : <span className="small muted">Originator resubmits</span>) : <span className="small muted">In queue</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        </div>
      )}
    </>
  );
}
