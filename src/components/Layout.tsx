import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { STAFF } from '../data/seed';
import { canVisit, navFor } from '../data/access';

export interface Sub { to: string; label: string }
export interface Item { to: string; label: string; end?: boolean; subs?: Sub[]; dropdownOnly?: boolean }

// Visible sidebar (UI-only): Transaction shows "New" for entry; the
// "All Transactions" list lives on the same /admin/transaction route and is
// not a separate sidebar destination. Type & Classification
// (/admin/transaction-types) is intentionally hidden from the sidebar but
// its route stays registered in App.tsx for compatibility.
export const NAV: Item[] = [
  { to: '/admin', label: 'Overview', end: true },
  {
    to: '/admin/transaction', label: 'Transaction', subs: [
      { to: '/admin/transaction', label: 'New' },
      { to: '/admin/disbursement', label: 'Disbursement' },
      { to: '/admin/journal', label: 'Journal' },
    ],
  },
  {
    to: '/admin/accounting', label: 'Accounting', dropdownOnly: true, subs: [
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
  // Auto-expand when navigation lands on one of this group's destinations,
  // including deep links — but never fight a manual collapse on the same page.
  const onDestination = item.subs?.some(s => path === s.to.split('?')[0]) ?? false;
  useEffect(() => { if (onDestination) setOpen(true); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
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
        {item.dropdownOnly ? (
          <button className="nav-parent-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <span className="dot" />{item.label}
          </button>
        ) : (
          <NavLink to={item.to} onClick={() => { setOpen(o => !o); onNav(); }} className={active && !open ? 'active' : ''} style={{ flex: 1 }}>
            <span className="dot" />{item.label}
          </NavLink>
        )}
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
  const { user, login, logout, mode, liveLogout } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;
  const close = () => setOpen(false);
  // Centralized demo route guard: Warehouse accounts cannot deep-link into
  // accountant-only screens (query strings can't bypass — the path decides).
  if (user && !canVisit(user.role, path)) {
    return <Navigate to="/admin" state={{ restricted: path }} replace />;
  }
  const items = navFor(user?.role ?? '', NAV);
  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <h1>JEM51 Accounting</h1>
          <p>Ayop Group of Companies · Demo</p>
        </div>
        <nav className="nav">
          {items.map(n => <Row key={n.to + n.label} item={n} path={path} onNav={close} />)}
        </nav>
        <div className="side-foot">{mode === 'live' ? <>Live Supabase backend · txns, approvals, POs, inventory.<br />Journal drafts stay demo-local.</> : <>Frontend demo · synthetic data only.<br />No backend connected.</>}</div>
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
            <span className={'pill ' + (mode === 'live' ? 'p-posted' : mode === 'setup-error' ? 'p-review' : 'p-draft')} title={mode === 'demo' ? 'Local synthetic data only' : mode === 'live' ? 'Live Supabase records' : 'Live selected but misconfigured'}>
              {mode === 'demo' ? 'Demo' : mode === 'live' ? 'Live' : 'Setup needed'}
            </span>
            <button className="btn ghost small" onClick={() => nav('/admin/approval')}>Approvals</button>
            {mode !== 'live' && (
              <label className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Role
                <select value={user?.id ?? ''} onChange={e => login(e.target.value)} aria-label="Switch staff role">
                  {STAFF.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                </select>
              </label>
            )}
            <button className="btn ghost small" onClick={() => { if (mode === 'live') { void liveLogout().then(() => nav('/admin/login')); } else { logout(); nav('/admin/login'); } }}>Log out</button>
          </div>
        </div>
        {mode === 'demo' && (
        <div className="demo-banner">
          Demonstration environment — all figures are <strong>synthetic</strong> and require accounting validation before production use. Pending transactions are not posted.
        </div>
        )}
        {mode === 'live' && (
        <div className="demo-banner" style={{ background: '#e6f4ec', borderColor: '#bfe3cd', color: '#157347' }}>
          <strong>Live mode</strong> — transactions, approvals, purchasing, and inventory come from the shared Supabase backend. Journal drafts stay demo-local in Slice 4.
        </div>
        )}
        {mode === 'setup-error' && (
        <div className="warn" style={{ margin: '8px 22px 0' }}>Live backend is selected but misconfigured (missing project URL or key). Running on demo data — nothing switched silently. See docs/SLICE_1_SETUP.md.</div>
        )}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
