import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { STAFF_CARDS, staffCardById } from '../data/staffDirectory';
import { DEMO_USERNAME, DEMO_PASSWORD } from '../data/demoAccess';

export default function Login() {
  const { mode, liveLogin, liveError, unlockDemo, demoAuthed, login } = useStore();
  const nav = useNavigate();

  // Demo dashboard: the chosen profile card drives the (simulated) identity.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPw, setShowPw] = useState(false);
  const [demoErr, setDemoErr] = useState('');

  // Live mode keeps the real credential form — independent of any selection.
  const [email, setEmail] = useState('');
  const [livePassword, setLivePassword] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = staffCardById(selectedId);

  const enterDemo = () => {
    const res = unlockDemo(username, password);
    if (!res.ok) { setDemoErr(res.message); return; }
    setDemoErr('');
    // The selected profile becomes the simulated identity for role-based views.
    // `unlockDemo` may set a default id first; this overrides it in the same tick.
    if (selectedId) login(selectedId);
    nav('/admin');
  };
  const enterLive = async () => {
    setBusy(true);
    const res = await liveLogin(email, livePassword);
    setBusy(false);
    if (res.ok) nav('/admin');
  };

  if (mode === 'live') {
    return (
      <div className="login-wrap">
        <div className="login-stage">
          <div className="login-hero">
            <div className="login-brandmark">JEM51</div>
            <div className="login-hero-text">
              <h1>JEM51 Accounting System</h1>
              <p className="small">Ayop Group of Companies — live backend sign-in.</p>
            </div>
            <span className="login-live-badge">Live</span>
          </div>
          <div className="login-body login-live">
            <h2 style={{ margin: '0 0 4px', color: '#14234a' }}>Staff sign-in (live)</h2>
            <p className="small muted" style={{ margin: '0 0 10px' }}>Sign in with your provisioned staff account. Your role and permissions resolve from the server membership record — never from anything you select here. Unlinked logins are rejected — ask an administrator to provision and link your account.</p>
            {liveError && <div className="warn">{liveError}</div>}
            <div className="form-grid">
              <label className="f full">Work email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ayop.example" /></label>
              <label className="f full">Password<input type="password" value={livePassword} onChange={e => setLivePassword(e.target.value)} /></label>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy || !email.trim() || !livePassword} onClick={() => { void enterLive(); }}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-stage">
        <div className="login-hero">
          <div className="login-brandmark">JEM51</div>
          <div className="login-hero-text">
            <h1>JEM51 Accounting System</h1>
            <p className="small">Ayop Group of Companies — staff sign-in.</p>
          </div>
          <span className="login-demo-badge">Demo</span>
        </div>

        <div className="login-body">
          <div className="login-eyebrow">Step 1 · Choose your profile</div>
          <h2 className="login-heading">Who's signing in?</h2>

          <div className="staff-grid" role="listbox" aria-label="Staff profiles">
            {STAFF_CARDS.map(card => {
              const active = card.id === selectedId;
              return (
                <button
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={'staff-card' + (active ? ' selected' : '')}
                  onClick={() => { setSelectedId(card.id); setDemoErr(''); }}
                >
                  <span className="staff-photo">
                    <img src={card.photo} alt={`${card.name} — ${card.title}`} />
                    <span className="staff-check" aria-hidden="true">✓</span>
                  </span>
                  <span className="staff-meta">
                    <span className="staff-name">{card.name}</span>
                    <span className="staff-title">{card.title}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={'login-panel' + (selected ? '' : ' login-panel-idle')}>
            {selected ? (
              <>
                <div className="login-panel-head">
                  <img className="avatar login-panel-avatar" src={selected.photo} alt="" />
                  <div>
                    <div className="login-panel-name">{selected.name}</div>
                    <div className="small muted">{selected.title} · signing in</div>
                  </div>
                  <button className="btn ghost small" style={{ marginLeft: 'auto' }} onClick={() => setSelectedId(null)}>Change</button>
                </div>

                <div className="login-eyebrow">Step 2 · Confirm your credentials</div>
                {demoAuthed && (
                  <div className="notice" style={{ marginTop: 10 }}>
                    Demo access is already unlocked on this browser.
                    {' '}<button className="btn small" onClick={() => { if (selectedId) login(selectedId); nav('/admin'); }}>Continue as {selected.name} →</button>
                  </div>
                )}
                {demoErr && <div className="warn" style={{ marginTop: 10 }}>{demoErr}</div>}
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label className="f full">Demo username
                    <input value={username} onChange={e => { setUsername(e.target.value); setDemoErr(''); }} placeholder="ayop-demo" autoComplete="username" />
                  </label>
                  <label className="f full">Demo password
                    <span style={{ display: 'flex', gap: 8 }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setDemoErr(''); }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        style={{ flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') enterDemo(); }}
                      />
                      <button className="btn ghost small" type="button" onClick={() => setShowPw(s => !s)}>{showPw ? 'Hide' : 'Show'}</button>
                    </span>
                  </label>
                </div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn" disabled={!username.trim() || !password} onClick={enterDemo}>Sign in as {selected.name} →</button>
                </div>
                <p className="small muted" style={{ marginTop: 12 }}>
                  Public demo access — choosing a profile sets a <strong>simulated</strong> identity and grants no real privileges (roles come from the signed-in account). The credentials are visible to anyone and unlock only synthetic demo data. Never reuse them for real accounts.
                </p>
              </>
            ) : (
              <div className="login-panel-empty">
                <div className="login-panel-empty-icon" aria-hidden="true">↑</div>
                <div className="login-panel-name">Select a profile to continue</div>
                <span className="small muted">Pick one of the four staff members above to reveal the sign-in panel.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
