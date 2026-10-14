import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { poOutstandingLines } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';
import { MySubmissions } from './Overview';

// Distinct Warehouse dashboard for the Warehouse role (e.g. JeAnn).
// Contains only the four permitted work areas plus account controls — no
// accounting KPIs, financial summaries, reports, ledger, or audit content.
export default function WarehouseDashboard() {
  const { txns, pos, inventory, user } = useStore();
  const loc = useLocation() as { state?: { restricted?: string } };
  const restricted = loc.state?.restricted;

  if (!user) return null;
  const openPOs = pos.filter(p => p.status !== 'Cancelled' && poOutstandingLines(p) > 0);
  const low = inventory.filter(i => i.quantity <= i.reorderLevel);
  const myQueued = txns.filter(t => t.createdBy === user.id && !['Posted', 'Reversed'].includes(t.status));

  return (
    <>
      <PageHead title={`Warehouse Dashboard — ${user.name}`} sub={`${user.role} · ${user.unit}. Your work areas: Purchasing, Inventory, Approval tracking, Transaction. Synthetic demo.`} />
      {restricted && <div className="warn">Access restricted: {restricted} is an accounting-only screen. Your Warehouse dashboard covers Purchasing, Inventory, Approval tracking, and Transaction — ask accounting staff for anything else.</div>}
      <div className="notice">Need an accounting report, ledger entry, or approval action? Contact accounting staff (Daniflor Calago) — restricted areas need their help. Demo permissions are presentation-only, not secure authorization.</div>
      <div className="grid g4">
        <div className="kpi"><div className="lbl">My items awaiting review</div><div className="val">{myQueued.length}</div><div className="sub"><Link to="/admin/approval">Track in Approval →</Link></div></div>
        <div className="kpi"><div className="lbl">P.O.s awaiting receiving</div><div className="val">{openPOs.length}</div><div className="sub"><Link to="/admin/purchasing">Open Purchasing →</Link></div></div>
        <div className="kpi"><div className="lbl">Low-stock items</div><div className="val">{low.length}</div><div className="sub"><Link to="/admin/inventory">Check inventory →</Link></div></div>
        <div className="kpi"><div className="lbl">My purchase orders</div><div className="val">{pos.filter(p => p.createdBy === user.id).length}</div><div className="sub"><Link to="/admin/transaction">New transaction →</Link></div></div>
      </div>
      <MySubmissions txns={txns} pos={pos} userId={user.id} userName={user.name} />
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Receiving tasks</h3>
          {openPOs.length === 0 ? <p className="small muted">Nothing outstanding — all orders received.</p> : (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>P.O.</th><th>Supplier</th><th>Status</th></tr></thead>
              <tbody>{openPOs.slice(0, 5).map(p => (
                <tr key={p.id}><td>{p.poNo}</td><td>{p.supplier}</td><td><Pill status={p.status} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
          <div className="btn-row" style={{ marginTop: 8 }}><Link className="btn small ghost" to="/admin/purchasing">Go to Purchasing →</Link></div>
        </div>
        <div className="card">
          <h3>Approval tracking — my submissions</h3>
          {myQueued.length === 0 ? <p className="small muted">No submissions waiting. Approval decisions stay with Accounting and Owner roles.</p> : (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Ref</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>{myQueued.slice(0, 5).map(t => (
                <tr key={t.id}><td>{t.id}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
          <div className="btn-row" style={{ marginTop: 8 }}><Link className="btn small ghost" to="/admin/approval">Track in Approval →</Link></div>
        </div>
      </div>
    </>
  );
}
