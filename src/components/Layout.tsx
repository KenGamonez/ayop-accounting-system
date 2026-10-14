import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';

export interface Sub { to: string; label: string }
export interface Item { to: string; label: string; end?: boolean; subs?: Sub[] }

export const NAV: Item[] = [
  { to: '/admin', label: 'Overview', end: true },
  {
    to: '/admin/transaction', label: 'Transaction', subs: [
      { to: '/admin/transaction', label: 'New Entry / All Transactions' },
      { to: '/admin/transaction-types', label: 'Type & Classification' },
      { to: '/admin/disbursement', label: 'Disbursement' },
      { to: '/admin/journal', label: 'Journal' },
    ],
  },
  {
    to: '/admin/accounting', label: 'Accounting', subs: [
      { to: '/admin/trial-balance', label: 'Trial Balance' },
      { to: '/admin/income-expense', label: 'Income & Expense' },
      { to: '/admin/financial-condition', label: 'Financial Condition' },
      { to: '/admin/reports', label: 'All Reports (Printable)' },
      { to: '/admin/close', label: 'Month-End Close' },
      { to: '/admin/accounting?tab=gl', label: 'General Ledger' },
    ],
  },
  { to: '/admin/approval', label: 'Approval' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/purchasing', label: 'Purchasing (P.O.)' },
  { to: '/admin/business-units', label: 'Business Units' },
  { to: '/admin/import-export', label: 'Import & Export' },
  { to: '/admin/settings', label: 'Settings' },
];

function Row({ item, path, onNav }: { item: Item; path: string; onNav: () => void }) {
  const [open, setOpen] = useState(() => item.subs?.some(s => path === s.to || path.startsWith(s.to.split('?')[0] + '/')) ?? false);
  const active = item.end ? path === item.to : path === item.to || path.startsWith(item.to + '/') || (item.subs?.some(s => path === s.to.split('?')[0]) ?? false);
  if (!item.subs) {
    return (
      <NavLink to={item.to} end={item.end} onClick={onNav} className={active ? 'active' : ''}>
        <span className="dot" />{item.label}
      </NavLink>
    );
  }
  return (
    <>
      <div className={'nav-parent' + (active ? ' active-parent' : '')}>
        <NavLink to={item.to} onClick={onNav} className={active && !open ? 'active' : ''} style={{ flex: 1 }}>
          <span className="dot" />{item.label}
        </NavLink>
        <button className="nav-toggle" aria-label={(open ? 'Collapse ' : 'Expand ') + item.label} onClick={() => setOpen(o => !o)}>
          {open ? '▾' : '▸'}
        </button>
      </div>
      {open && (
        <div className="nav-subs">
          {item.subs.map(s => (
            <NavLink key={s.to} to={s.to} onClick={onNav} className={path === s.to.split('?')[0] && (s.to.includes('?') ? window.location.search.includes(s.to.split('?')[1]) : true) ? 'active sub-active' : ''}>
              {s.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export default function Layout() {
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const path = useLocation().pathname;
  const close = () => setOpen(false);
  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <h1>JEM51 Accounting</h1>
          <p>Ayop Group of Companies · Demo</p>
        </div>
        <nav className="nav">
          {NAV.map(n => <Row key={n.to + n.label} item={n} path={path} onNav={close} />)}
        </nav>
        <div className="side-foot">Frontend demo · synthetic data only.<br />No backend connected.</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="btn ghost small hamb" onClick={() => setOpen(o => !o)}>☰ Menu</button>
          <div className="who">
            <div className="avatar">{user ? user.initials : '–'}</div>
            <div>
              <div style={{ fontWeight: 700, color: '#14234a' }}>{user ? user.name : 'Not signed in'}</div>
              <div className="small muted">{user ? `${user.role} · ${user.unit}` : ''}</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }} className="btn-row">
            <button className="btn ghost small" onClick={() => nav('/admin/approval')}>Approvals</button>
            <button className="btn ghost small" onClick={() => { logout(); nav('/admin/login'); }}>Switch staff</button>
          </div>
        </div>
        <div className="demo-banner">
          Demonstration environment — all figures are <strong>synthetic</strong> and require accounting validation before production use. Pending transactions are not posted.
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
