import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STAFF } from '../data/seed';
import { useStore } from '../store/AppStore';

export default function Login() {
  const { login, mode, liveLogin, liveError } = useStore();
  const nav = useNavigate();
  const [demoId, setDemoId] = useState('dani');
  const [pin, setPin] = useState('demo-1234');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const enter = (id: string) => { login(id); nav('/admin'); };
  const enterLive = async () => {
    setBusy(true);
    const res = await liveLogin(email, password);
    setBusy(false);
    if (res.ok) nav('/admin');
  };

  if (mode === 'live') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-side">
            <h1>JEM51 Accounting System</h1>
            <p style={{ margin: '0 0 14px', color: '#aebad6' }}>Ayop Group of Companies — live backend sign-in.</p>
            <div className="small" style={{ color: '#dbe3f5', lineHeight: 1.7 }}>
              Sign in with your provisioned staff account. Your role and
              permissions resolve from the server membership record — never
              from anything you select here.
            </div>
          </div>
          <div className="login-form">
            <h2 style={{ margin: '0 0 4px', color: '#14234a' }}>Staff sign-in (live)</h2>
            <p className="small muted" style={{ margin: '0 0 10px' }}>Unlinked logins are rejected — ask an administrator to provision and link your account.</p>
            {liveError && <div className="warn">{liveError}</div>}
            <div className="form-grid">
              <label className="f full">Work email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ayop.example" /></label>
              <label className="f full">Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy || !email.trim() || !password} onClick={() => { void enterLive(); }}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-side">
          <h1>JEM51 Accounting System</h1>
          <p style={{ margin: '0 0 14px', color: '#aebad6' }}>Ayop Group of Companies — staff workflow demonstration.</p>
          <div className="small" style={{ color: '#dbe3f5', lineHeight: 1.7 }}>
            <strong style={{ color: '#fff' }}>Staff workflow:</strong> Transaction Entry → Accountant Review → Owner / Management Approval → General Ledger posting.<br /><br />
            Pending transactions never appear as posted. Rejected items return for correction. Posted entries are protected; corrections use reversal entries.
          </div>
          <div className="small" style={{ marginTop: 16, color: '#93a1c4' }}>
            Demo only — this login is a frontend simulation and provides no real authentication or authorization. All data is synthetic.
          </div>
        </div>
        <div className="login-form">
          <h2 style={{ margin: '0 0 4px', color: '#14234a' }}>Staff entry</h2>
          <p className="small muted" style={{ margin: '0 0 10px' }}>Select a staff profile to preview their workspace. Fictional demo credentials only.</p>
          <div className="staff-list">
            {STAFF.map(s => (
              <button key={s.id} className="staff-btn" onClick={() => enter(s.id)}>
                <span className="avatar">{s.initials}</span>
                <span><strong>{s.name}</strong><br /><span className="small muted">{s.role} · {s.unit}</span></span>
                <span style={{ marginLeft: 'auto' }} className="small muted">Enter →</span>
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="f">Demo ID<select value={demoId} onChange={e => setDemoId(e.target.value)}>{STAFF.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="f">Demo passphrase<input value={pin} onChange={e => setPin(e.target.value)} placeholder="demo-****" /></label>
            <label className="f" style={{ justifyContent: 'flex-end' }}><span>&nbsp;</span><button className="btn" onClick={() => enter(demoId)}>Continue as staff</button></label>
          </div>
        </div>
      </div>
    </div>
  );
}
