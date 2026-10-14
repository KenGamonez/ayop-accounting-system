import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';

export default function Login() {
  const { mode, liveLogin, liveError, unlockDemo, demoAuthed } = useStore();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [demoErr, setDemoErr] = useState('');
  const [busy, setBusy] = useState(false);

  const enterDemo = () => {
    const res = unlockDemo(username, password);
    if (!res.ok) { setDemoErr(res.message); return; }
    setDemoErr('');
    nav('/admin');
  };
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
          <h2 style={{ margin: '0 0 4px', color: '#14234a' }}>DEMO PRESENTATION</h2>
          <p className="small muted" style={{ margin: '0 0 10px' }}>Sign in with the presentation credentials, then switch between the seven staff profiles from the top bar.</p>
          {demoAuthed && <div className="notice">Demo access is already unlocked on this browser. <button className="btn small" onClick={() => nav('/admin')}>Continue to dashboard →</button></div>}
          {demoErr && <div className="warn">{demoErr}</div>}
          <div className="form-grid">
            <label className="f full">Demo username<input value={username} onChange={e => { setUsername(e.target.value); setDemoErr(''); }} placeholder="ayop-demo" autoComplete="username" /></label>
            <label className="f full">Demo password
              <span style={{ display: 'flex', gap: 8 }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setDemoErr(''); }} placeholder="••••••••" autoComplete="current-password" style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') enterDemo(); }} />
                <button className="btn ghost small" onClick={() => setShowPw(s => !s)}>{showPw ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={!username.trim() || !password} onClick={enterDemo}>Unlock demo →</button>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Public demo access — the presentation credentials unlock only synthetic demo data and protect nothing. Never reuse them for real accounts.</p>
        </div>
      </div>
    </div>
  );
}
