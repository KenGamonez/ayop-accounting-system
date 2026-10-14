import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Overview() {
  const { txns, inventory, pos, audit, user } = useStore();
  const [unit, setUnit] = useState('All units');

  const posted = useMemo(() => txns.filter(t => t.status === 'Posted' && (unit === 'All units' || t.businessUnit === unit)), [txns, unit]);
  const pending = txns.filter(t => !['Posted', 'Reversed'].includes(t.status));
  const revenue = posted.filter(t => t.classification === 'Revenue').reduce((s, t) => s + t.amount, 0);
  const expense = posted.filter(t => t.classification === 'Expense').reduce((s, t) => s + t.amount, 0);
  const low = inventory.filter(i => i.quantity <= i.reorderLevel);
  const role = user?.role ?? '';
  const isWarehouse = ['Warehouse', 'Diagnostics Cashier', 'Pharmacy'].includes(role);
  const isAccounting = ['Accounting', 'CEO', 'HR', 'IT'].includes(role);

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
