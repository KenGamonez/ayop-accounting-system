import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

function KindPage({ kind, title, sub }: { kind: string; title: string; sub: string }) {
  const { txns } = useStore();
  const [unit, setUnit] = useState('All');
  const rows = useMemo(() => txns.filter(t => t.kind === kind && (unit === 'All' || t.businessUnit === unit)), [txns, unit, kind]);
  const total = rows.filter(t => t.status === 'Posted').reduce((s, t) => s + t.amount, 0);
  return (
    <>
      <PageHead title={title} sub={sub} actions={<select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>} />
      <div className="grid g4">
        <div className="kpi"><div className="lbl">Entries</div><div className="val">{rows.length}</div><div className="sub">{kind} · demo</div></div>
        <div className="kpi"><div className="lbl">Posted total</div><div className="val">{'₱' + total.toLocaleString('en-PH')}</div><div className="sub">Pending excluded</div></div>
        <div className="kpi"><div className="lbl">Pending</div><div className="val">{rows.filter(t => !['Posted', 'Reversed'].includes(t.status)).length}</div><div className="sub">In review / approval</div></div>
        <div className="kpi"><div className="lbl">Rejected</div><div className="val">{rows.filter(t => t.status === 'Rejected').length}</div><div className="sub">Returned for correction</div></div>
      </div>
      <div className="card">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID / Date</th><th>Item / Supplier</th><th>Unit</th><th>Class</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{rows.map(t => (
            <tr key={t.id}><td><strong>{t.id}</strong><div className="small muted">{t.date}</div></td>
              <td>{t.item}<div className="small muted">Supplier: {t.supplier} · Entered by {t.enteredBy}</div><div className="small muted">Supplier ₱{t.supplierPrice.toLocaleString()} · Retail ₱{t.retailPrice.toLocaleString()} · Qty {t.quantity}</div></td>
              <td>{t.businessUnit}</td><td>{t.classification}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>
          ))}</tbody>
        </table></div>
        <p className="small muted">New {kind.toLowerCase()} entries are created from the <Link to="/admin/transaction">Transaction</Link> screen so every entry follows the same approval chain.</p>
      </div>
    </>
  );
}

export function Disbursement() {
  return <KindPage kind="Disbursement" title="Disbursement" sub="Supplier payments and operating pay-outs. Staff fields: Item, Supplier, Supplier Price, delivery / receipt references." />;
}
export function CashIn() {
  return <KindPage kind="Cash In" title="Cash In" sub="Cash collections — pharmacy sales, diagnostics, gym, reimbursements. Entered by cashiers; verified by accounting." />;
}
export function CashOut() {
  return <KindPage kind="Cash Out" title="Cash Out" sub="Petty and operational cash releases with cashier accountability and receipt requirements." />;
}
