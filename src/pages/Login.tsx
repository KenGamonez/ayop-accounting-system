import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { STAFF_CARDS, staffCardById } from '../data/staffDirectory';
import { DEMO_USERNAME, DEMO_PASSWORD } from '../data/demoAccess';

/* ── inline icons (no icon dependency) ───────────────────────────────────── */
function IcUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IcLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.6" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
function IcEye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6.1A11 11 0 0 1 12 6c6.4 0 10 6 10 6a17.9 17.9 0 0 1-3 3.5" />
          <path d="M6.3 7.7A17.4 17.4 0 0 0 2 12s3.6 6 10 6c1.4 0 2.7-.3 3.8-.8" />
          <path d="M9.9 10.1a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      )}
    </svg>
  );
}
function IcCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 12.6 3.9 3.9 8.1-9" />
    </svg>
  );
}
function IcArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M8.4 12h7.2" /><path d="M12.9 8.4 16.5 12l-3.6 3.6" />
    </svg>
  );
}
function IcSpinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
function IcIdCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.4" /><circle cx="8.6" cy="11" r="1.6" />
      <path d="M5.7 15.6c.5-1.2 1.6-1.9 2.9-1.9s2.4.7 2.9 1.9" /><path d="M14.6 10.2h4.1" /><path d="M14.6 13.4h4.1" />
    </svg>
  );
}
function IcShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 5 6v5.6c0 4.3 2.9 7.4 7 9.4 4.1-2 7-5.1 7-9.4V6l-7-3Z" /><path d="m9.3 12 1.9 1.9 3.6-3.7" />
    </svg>
  );
}

/* Portrait + spotlight copy for each directory card (keyed by Staff id). */
const PEOPLE: Record<string, { avatar: string; portrait: string; quote: [string, string] }> = {
  joy: { avatar: '/staff/joy-avatar.jpg', portrait: '/staff/joy-portrait.jpg', quote: ['Leading with purpose.', 'Building a stronger Ayop.'] },
  dani: { avatar: '/staff/daniflor-avatar.jpg', portrait: '/staff/daniflor-portrait.jpg', quote: ['Accuracy in every peso.', 'Clarity in every ledger.'] },
  jeann: { avatar: '/staff/jeanne-avatar.jpg', portrait: '/staff/jeanne-portrait.jpg', quote: ['Every item accounted for.', 'Nothing left to chance.'] },
  rodel: { avatar: '/staff/rodel-avatar.jpg', portrait: '/staff/rodel-portrait.jpg', quote: ['Keeping systems running.', 'Securing every transaction.'] },
};

function person(id: string) {
  return PEOPLE[id] ?? { avatar: '/staff/joy-avatar.jpg', portrait: '/staff/joy-portrait.jpg', quote: ['', ''] as [string, string] };
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Login() {
  const { mode, liveLogin, liveError, unlockDemo, demoAuthed, user, login } = useStore();
  const nav = useNavigate();
  const location = useLocation();

  // Where to return after a successful sign-in (set by the guarded routes).
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const dest = (from?.pathname ?? '/admin') + (from?.search ?? '');

  // Live builds open on the real credential form; the demo build opens on the selector.
  const isLiveBuild = mode === 'live';

  const [selectedId, setSelectedId] = useState<string>(STAFF_CARDS[0].id);
  const [shownId, setShownId] = useState<string>(STAFF_CARDS[0].id); // painted spotlight
  const [fading, setFading] = useState(false);

  const [view, setView] = useState<'demo' | 'email'>(isLiveBuild ? 'email' : 'demo');
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [email, setEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fadeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);

  const selected = staffCardById(selectedId) ?? STAFF_CARDS[0];
  const shown = staffCardById(shownId) ?? STAFF_CARDS[0];
  const shownPerson = person(shown.id);

  // Already signed in (demo or live) — never show the login again.
  if (mode === 'live' ? !!user : demoAuthed && !!user) {
    return <Navigate to={dest} replace />;
  }

  function select(id: string, focus = false) {
    const index = STAFF_CARDS.findIndex(c => c.id === id);
    if (focus) rowRefs.current[index]?.focus();
    if (id === selectedId) return;
    setSelectedId(id);
    setError('');
    if (prefersReducedMotion()) { setShownId(id); return; }
    setFading(true);
    window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => { setShownId(id); setFading(false); }, 175);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const i = STAFF_CARDS.findIndex(c => c.id === selectedId);
    const len = STAFF_CARDS.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(STAFF_CARDS[(i + 1) % len].id, true); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(STAFF_CARDS[(i - 1 + len) % len].id, true); }
    else if (e.key === 'Home') { e.preventDefault(); select(STAFF_CARDS[0].id, true); }
    else if (e.key === 'End') { e.preventDefault(); select(STAFF_CARDS[len - 1].id, true); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(selectedId, true); }
  }

  function setMode(next: 'demo' | 'email') {
    setError('');
    setView(next);
    if (next === 'email') { setEmail(''); setEmailPw(''); }
    else { setUsername(DEMO_USERNAME); setPassword(DEMO_PASSWORD); }
  }

  function submitDemo(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    // Existing demo gate: same credentials as the rest of the app.
    const res = unlockDemo(username, password);
    if (!res.ok) { setError(res.message); setBusy(false); return; }
    // The selected card becomes the simulated identity for role-based views.
    login(selectedId);
    nav(dest, { replace: true });
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    // Existing live flow: role/permissions resolve from the server membership.
    const res = await liveLogin(email, emailPw);
    if (res.ok) { nav(dest, { replace: true }); return; }
    setError(res.message);
    setBusy(false);
  }

  const swapOut = fading ? ' is-out' : '';
  const canSubmit = view === 'demo'
    ? Boolean(username.trim() && password)
    : Boolean(email.trim() && emailPw);

  return (
    <div className="jem-login">
      <div className="bgphoto" aria-hidden="true" />

      <main className="stage">
        <svg className="decor" viewBox="0 0 1672 941" aria-hidden="true">
          <g fill="none" stroke="#4F7BC8" strokeWidth="1">
            <circle cx="-84" cy="292" r="284" opacity=".1" />
            <circle cx="-90" cy="784" r="300" opacity=".09" />
            <circle cx="1734" cy="168" r="330" opacity=".08" />
            <path d="M -80 300 Q 250 -60 720 30" opacity=".1" />
            <path d="M 1160 941 Q 1420 846 1672 824" opacity=".28" />
          </g>
          <g fill="none" stroke="#E6C987" strokeWidth="1">
            <path d="M 1300 322 Q 1470 132 1672 94" opacity=".5" />
            <path d="M 1504 26 Q 1560 92 1672 122" opacity=".28" />
          </g>
          <g stroke="#FFFFFF" strokeWidth="1" opacity=".06">
            <line x1="1160" y1="78" x2="1672" y2="78" />
            <line x1="1480" y1="0" x2="1480" y2="300" />
          </g>
          <g fill="#F2D98C">
            <circle cx="1583" cy="80" r="4" />
            <circle cx="1482" cy="148" r="4" />
            <circle cx="1289" cy="882" r="5" />
          </g>
        </svg>

        <header className="brand">
          <div className="badge">JEM51</div>
          <div>
            <div className="brand__title">JEM51 Accounting System</div>
            <div className="brand__sub">Ayop Group of Companies</div>
          </div>
        </header>

        <section className="col-left">
          <p className="eyebrow">Ayop Group of Companies</p>
          <h1 className="h1">Welcome <em>back.</em></h1>
          <p className="lede">{isLiveBuild ? 'Sign in with your provisioned staff account.' : 'Select your account to continue.'}</p>

          {isLiveBuild ? (
            <div className="live-note">
              <span className="live-note__ic"><IcShield /></span>
              <div>
                <div className="live-note__title">Live backend sign-in</div>
                <div className="live-note__text">Your role and permissions are resolved from the server membership record — never from anything on this screen.</div>
              </div>
            </div>
          ) : (
            <div className="list" role="radiogroup" aria-label="Select your account" onKeyDown={onKeyDown}>
              {STAFF_CARDS.map((card, i) => {
                const active = card.id === selectedId;
                return (
                  <div
                    key={card.id}
                    ref={el => { rowRefs.current[i] = el; }}
                    className="row"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    data-id={card.id}
                    onClick={() => select(card.id, true)}
                  >
                    <span className="row__avatar"><img src={person(card.id).avatar} alt="" /></span>
                    <span className="row__meta">
                      <span className="row__name">{card.name}</span>
                      <span className="row__role">{card.title}</span>
                    </span>
                    <span className="row__mark" aria-hidden="true"><IcCheck /></span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card" aria-label="Account sign in">
          <div className="spot">
            <div className={'spot__figure' + swapOut}>
              <img src={shownPerson.portrait} alt={`${shown.name}, ${shown.title}`} />
            </div>
            <svg className="spot__arc" viewBox="0 0 274 470" aria-hidden="true">
              <path d="M 206 424 Q 252 380 300 330" fill="none" stroke="#E6C987" strokeWidth="1" opacity=".55" />
            </svg>
            <div className="spot__body">
              <div className={'spot__name' + swapOut}>{shown.name}</div>
              <div className={'spot__role' + swapOut}>{shown.title}</div>
              <span className="spot__bar" />
              <p className={'spot__quote' + swapOut}>
                {shownPerson.quote.map((line, i) => <span key={i}>{line}</span>)}
              </p>
            </div>
          </div>

          <form className="form" onSubmit={view === 'demo' ? submitDemo : submitEmail} noValidate>
            <div className="pill"><span className="pill__dot" />{mode === 'live' ? 'Live Environment' : 'Demo Environment'}</div>
            <h2 className="form__title">Sign in to your account</h2>
            <p className="form__lede">Use your credentials to access the accounting system.</p>

            <label className="field__label" htmlFor="login-user">{view === 'demo' ? 'Username' : 'Email'}</label>
            <div className="field">
              <span className="field__icon" aria-hidden="true"><IcUser /></span>
              <input
                id="login-user"
                name="username"
                type={view === 'demo' ? 'text' : 'email'}
                autoComplete={view === 'demo' ? 'username' : 'email'}
                spellCheck={false}
                placeholder={view === 'demo' ? '' : 'name@company.com'}
                value={view === 'demo' ? username : email}
                onChange={e => {
                  setError('');
                  if (view === 'demo') setUsername(e.target.value); else setEmail(e.target.value);
                }}
              />
            </div>

            <label className="field__label" htmlFor="login-pass">Password</label>
            <div className="field">
              <span className="field__icon" aria-hidden="true"><IcLock /></span>
              <input
                id="login-pass"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                spellCheck={false}
                value={view === 'demo' ? password : emailPw}
                onChange={e => {
                  setError('');
                  if (view === 'demo') setPassword(e.target.value); else setEmailPw(e.target.value);
                }}
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                aria-pressed={showPw}
              >
                <IcEye off={showPw} />
              </button>
            </div>

            <p className="form__error" role="alert" aria-live="polite">{error || (view === 'email' ? liveError : '')}</p>

            <button className={'btn-primary' + (busy ? ' is-loading' : '')} type="submit" disabled={busy || !canSubmit}>
              <span className="btn-primary__icon" aria-hidden="true">{busy ? <IcSpinner /> : <IcArrow />}</span>
              <span className="btn-primary__label">{busy ? 'Signing in…' : 'Sign In'}</span>
            </button>

            <div className="or">
              <span className="or__line" />
              <span className="or__text">Or</span>
              <span className="or__line" />
            </div>

            <button className="btn-secondary" type="button" onClick={() => setMode(view === 'demo' ? 'email' : 'demo')}>
              <span className="btn-secondary__icon" aria-hidden="true"><IcIdCard /></span>
              <span>{view === 'demo' ? 'Use your email and password' : 'Use the demo account selector'}</span>
            </button>

            <p className="form__foot"><IcShield /> Your data is secure and protected.</p>
          </form>
        </section>

        <div className="tagline">
          <span className="tagline__line" aria-hidden="true" />
          <span className="tagline__text">Better systems. Stronger business.</span>
        </div>
      </main>
    </div>
  );
}
