import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export function BusinessUnits() {
  const { txns, inventory } = useStore();
  const [sel, setSel] = useState<string>(BUSINESS_UNITS[0]);
  const t = txns.filter(x => x.businessUnit === sel);
  const posted = t.filter(x => x.status === 'Posted');
  const rev = posted.filter(x => x.classification === 'Revenue').reduce((s, x) => s + x.amount, 0);
  const exp = posted.filter(x => x.classification === 'Expense').reduce((s, x) => s + x.amount, 0);
  const inv = inventory.filter(i => i.businessUnit === sel);
  return (
    <>
      <PageHead title="Business Units" sub="Nine official Ayop units. Each view shows posted performance plus pending queue. Consolidated reporting stays on Overview / Reports." />
      <div className="filters">{BUSINESS_UNITS.map(u => <button key={u} className={'btn small ' + (sel === u ? '' : 'ghost')} onClick={() => setSel(u)}>{u}</button>)}</div>
      <div className="grid g4">
        <div className="kpi"><div className="lbl">{sel} · posted revenue</div><div className="val">{peso(rev)}</div></div>
        <div className="kpi"><div className="lbl">Posted expenses</div><div className="val">{peso(exp)}</div></div>
        <div className="kpi"><div className="lbl">Net (demo)</div><div className="val">{peso(rev - exp)}</div></div>
        <div className="kpi"><div className="lbl">SKUs in unit</div><div className="val">{inv.length}</div><div className="sub"><Link to="/admin/inventory">Inventory →</Link></div></div>
      </div>
      <div className="card"><h3>{sel} — transactions ({t.length})</h3>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Item / Supplier</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{t.map(x => <tr key={x.id}><td>{x.id}<div className="small muted">{x.date} · {x.classification}</div></td><td>{x.item}<div className="small muted">Supplier: {x.supplier}</div></td><td><Pill status={x.status} /></td><td className="num"><Money n={x.amount} /></td></tr>)}</tbody></table></div>
      </div>
    </>
  );
}

export function Settings() {
  const { resetDemo, user } = useStore();
  return (
    <>
      <PageHead title="Settings" sub="Frontend demonstration preferences stored locally in this browser." />
      <div className="card"><h3>Session</h3>
        <p>Signed in as <strong>{user?.name}</strong> ({user?.role} · {user?.unit}). Role previews only change the displayed workspace label — they do not enforce permissions.</p>
        <div className="btn-row"><Link className="btn ghost small" to="/admin/login">Switch staff</Link><button className="btn danger small" onClick={() => { if (confirm('Reset all demo data to the shipped synthetic set?')) resetDemo(); }}>Reset demo data</button></div>
      </div>
      <div className="card"><h3>Scope & handover</h3>
        <ul className="small">
          <li>Frontend phase only — no backend, no real authentication, no persistent shared data.</li>
          <li>Backend phase will still require: secure auth, real database, validated accounting rules, BIR compliance (separate phase), and testing.</li>
          <li>Cash Flow Statement is conditional scope — not claimed here.</li>
        </ul>
      </div>
    </>
  );
}
