import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, peso } from '../data/seed';
import { fetchLiveReference, getSupabaseClient, readBackendEnv, resolveBackendMode, type LiveReference } from '../data/backend';
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
      <BackendCard />
    </>
  );
}

function BackendCard() {
  const env = readBackendEnv();
  const mode = resolveBackendMode(env);
  const [live, setLive] = useState<LiveReference | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'live' || !env.url || !env.anonKey) return;
    setLoading(true);
    fetchLiveReference(getSupabaseClient(env.url, env.anonKey))
      .then(setLive)
      .catch((e: Error) => setError(e.message ?? 'Live read failed.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="card"><h3>Backend connection (Slice 1)</h3>
      {mode === 'demo' && (
        <p className="small muted">Mode: <strong>Demo</strong> — local synthetic data only. Live mode activates only when <code>VITE_AYOP_BACKEND=live</code> with a configured project URL and anon key.</p>
      )}
      {mode === 'setup-error' && (
        <div className="warn">Live mode is selected but the project URL or anon key is missing. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (never commit secrets). Demo data is still in use — nothing switched silently.</div>
      )}
      {mode === 'live' && (
        <>
          <p className="small muted">Mode: <strong>Live</strong> — reading verified reference data from Supabase (anon key only; no service key in this app).</p>
          {loading && <p className="small muted">Loading reference data…</p>}
          {error && <div className="warn">{error}</div>}
          {live && (
            <div className="tbl-wrap"><table className="tbl"><tbody>
              <tr><td>Business units (live)</td><td className="num"><strong>{live.units.length}</strong></td></tr>
              <tr><td>Chart of Accounts lines (live)</td><td className="num"><strong>{live.coa.length}</strong></td></tr>
              <tr><td>Staff accounts linked</td><td className="num"><strong>{live.staffLinked} of {live.staffTotal}</strong>{live.staffLinked === 0 && <span className="small muted" style={{ display: 'block' }}>No accounts linked yet — see provisioning steps in docs/SLICE_1_SETUP.md.</span>}</td></tr>
            </tbody></table></div>
          )}
          <p className="small muted">Transactions, approvals, and postings still use demo state in Slice 1 — live writes arrive in Slice 2.</p>
        </>
      )}
    </div>
  );
}
