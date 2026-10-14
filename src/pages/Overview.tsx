import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso, Txn, PurchaseOrder } from '../data/seed';
import { ownRecords } from '../data/ops';
import { roleKindFor } from '../data/access';
import WarehouseDashboard from './WarehouseDashboard';
import { sumByClass } from '../data/finance';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Overview() {
  const { txns, inventory, pos, audit, user } = useStore();
  const [unit, setUnit] = useState('All units');

  const pending = txns.filter(t => !['Posted', 'Reversed'].includes(t.status));
  const scope = useMemo(() => ({ unit, from: '', to: '' }), [unit]);
  const revenue = sumByClass(txns, scope, 'Revenue');
  const expense = sumByClass(txns, scope, 'Expense');
  const low = inventory.filter(i => i.quantity <= i.reorderLevel);
  const role = user?.role ?? '';
  const isWarehouse = ['Warehouse', 'Diagnostics Cashier', 'Pharmacy'].includes(role);
  const isAccounting = ['Accounting', 'CEO', 'HR', 'IT'].includes(role);

  // Warehouse accounts get their own dashboard — never the accountant's
  // financial summaries. Derived from the live user record every render, so
  // switching accounts immediately swaps dashboards with no stale content.
  if (roleKindFor(role) === 'warehouse') return <WarehouseDashboard />;

  return (
    <>
      <PageHead title="Overview" sub="Day-to-day position across the nine Ayop business units. Synthetic demonstration figures." actions={<>
        <select value={unit} onChange={e => setUnit(e.target.value)}>
          <option>All units</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
        <Link className="btn blue" to="/admin/transaction">+ New transaction</Link>
      </>} />
      <div className="grid g4">
        <div className="kpi"><div className="lbl">Posted revenue ({unit})</div><div className="val">{peso(revenue)}</div><div className="sub">Posted only · pending excluded</div></div>
        <div className="kpi"><div className="lbl">Posted expenses ({unit})</div><div className="val">{peso(expense)}</div><div className="sub">Net (demo): {peso(revenue - expense)}</div></div>
        <div className="kpi"><div className="lbl">Awaiting review / approval</div><div className="val">{pending.length}</div><div className="sub"><Link to="/admin/approval">Open approval queue →</Link></div></div>
        <div className="kpi"><div className="lbl">Low-stock items</div><div className="val">{low.length}</div><div className="sub"><Link to="/admin/inventory">Review inventory →</Link></div></div>
      </div>
      {user && <MySubmissions txns={txns} pos={pos} userId={user.id} userName={user.name} />}
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>{isWarehouse ? 'Warehouse — daily tasks' : isAccounting ? 'Accounting — daily tasks' : 'Quick tasks'}</h3>
          <p className="small muted">
            {isWarehouse
              ? 'Enter stock movements, check levels, and receive deliveries. Signed in as ' + (user?.name ?? 'demo') + ' (preview only — no enforced permissions).'
              : isAccounting
              ? 'Review entries, clear approvals, and print statements. Signed in as ' + (user?.name ?? 'demo') + ' (preview only — no enforced permissions).'
              : 'Shortcuts for your workspace. Role previews never enforce access — this is a frontend demo.'}
          </p>
          <div className="btn-row">
            {(isWarehouse ? [
              { to: '/admin/transaction', l: '+ New transaction entry' },
              { to: '/admin/inventory', l: 'Check inventory' },
              { to: '/admin/purchasing', l: 'Receive P.O. deliveries' },
            ] : isAccounting ? [
              { to: '/admin/transaction', l: '+ New transaction entry' },
              { to: '/admin/approval', l: 'Review approvals' },
              { to: '/admin/reports', l: 'Print reports' },
            ] : [
              { to: '/admin/transaction', l: 'New transaction' },
              { to: '/admin/approval', l: 'Approvals' },
              { to: '/admin/inventory', l: 'Inventory' },
            ]).map(a => <Link key={a.to + a.l} className="btn small ghost" to={a.to}>{a.l}</Link>)}
          </div>
        </div>
        <div className="card">
          <h3>Latest transactions</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Item</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{txns.slice(0, 6).map(t => (
              <tr key={t.id}><td>{t.id}</td><td>{t.item}<div className="small muted">{t.businessUnit} · {t.date}</div></td><td>{t.classification}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <h3>Approvals & receiving</h3>
          <p className="small muted">For Accountant Review: <strong>{txns.filter(t => t.status === 'For Accountant Review').length}</strong> · For Owner Approval: <strong>{txns.filter(t => t.status === 'For Owner Approval' || t.status === 'Accountant Reviewed').length}</strong> · Open P.O.s: <strong>{pos.filter(p => !p.received && p.status !== 'Cancelled').length}</strong></p>
          <div className="btn-row">
            <Link className="btn small" to="/admin/approval">Review approvals</Link>
            <Link className="btn ghost small" to="/admin/purchasing">Receiving</Link>
            <Link className="btn ghost small" to="/admin/reports">Print reports</Link>
          </div>
          <h3 style={{ marginTop: 14 }}>Audit-trail preview</h3>
          <ul className="audit small">{audit.slice(0, 5).map(a => <li key={a.id}><strong>{a.action}</strong> · {a.ref} — {a.detail} <span className="muted">({a.actor}, {a.at})</span></li>)}</ul>
        </div>
      </div>
    </>
  );
}

export function MySubmissions({ txns, pos, userId, userName }: { txns: Txn[]; pos: PurchaseOrder[]; userId: string; userName: string }) {
  const mine = ownRecords(txns, userId).slice(0, 5);
  const myPOs = ownRecords(pos, userId);
  const awaiting = mine.filter(t => !['Posted', 'Reversed'].includes(t.status)).length;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>My submissions — {userName}</h3>
      {mine.length === 0 && myPOs.length === 0 ? (
        <p className="small muted">Nothing submitted under your account yet. Entries you create in Transaction, Purchasing, or Inventory appear here with their live statuses.</p>
      ) : (
        <>
          <p className="small muted">{mine.length} recent transaction{mine.length === 1 ? '' : 's'} · {myPOs.length} purchase order{myPOs.length === 1 ? '' : 's'} · {awaiting} awaiting review or approval.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Ref</th><th>Details</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {mine.map(t => (
                <tr key={t.id}><td>{t.id}<div className="small muted">{t.date}</div></td>
                  <td>{t.item}<div className="small muted">{t.businessUnit}</div></td>
                  <td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td></tr>
              ))}
              {myPOs.slice(0, 3).map(p => (
                <tr key={p.id}><td>{p.poNo}<div className="small muted">{p.date}</div></td>
                  <td>P.O. — {p.supplier}<div className="small muted">{p.businessUnit}</div></td>
                  <td><Pill status={p.status} /></td><td className="num"><Money n={p.total} /></td></tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <Link className="btn small ghost" to="/admin/approval">Track in Approval →</Link>
        <Link className="btn small ghost" to="/admin/transaction">New transaction →</Link>
      </div>
    </div>
  );
}
