import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';

const GROUPS: { section: string; links: { to: string; label: string }[] }[] = [
  { section: 'Main', links: [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/transaction', label: 'Transaction' },
    { to: '/admin/accounting', label: 'Accounting' },
    { to: '/admin/transaction-types', label: 'Transaction Types' },
  ]},
  { section: 'Cash', links: [
    { to: '/admin/disbursement', label: 'Disbursement' },
    { to: '/admin/cash-in', label: 'Cash In' },
    { to: '/admin/cash-out', label: 'Cash Out' },
    { to: '/admin/journal', label: 'Journal' },
  ]},
  { section: 'Reports (Printable)', links: [
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/trial-balance', label: 'Trial Balance' },
    { to: '/admin/income-expense', label: 'Statement of Income & Expense' },
    { to: '/admin/financial-condition', label: 'Statement of Financial Condition' },
  ]},
  { section: 'Operations', links: [
    { to: '/admin/approval', label: 'Approval' },
    { to: '/admin/inventory', label: 'Inventory' },
    { to: '/admin/purchasing', label: 'Purchasing (P.O.)' },
    { to: '/admin/business-units', label: 'Business Units' },
  ]},
  { section: 'System', links: [{ to: '/admin/settings', label: 'Settings' }] },
];

export default function Layout() {
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <h1>JEM51 Accounting</h1>
          <p>Ayop Group of Companies · Demo</p>
        </div>
        <nav className="nav">
          {GROUPS.map(g => (
            <React.Fragment key={g.section}>
              <div className="nav-section">{g.section}</div>
              {g.links.map(l => (
                <NavLink key={l.to} to={l.to} end={l.to === '/admin'} onClick={() => setOpen(false)}>
                  <span className="dot" />{l.label}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
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
