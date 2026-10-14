// DEMO PRESENTATION access gate (Slice: presentation-ready demo).
//
// PUBLIC DEMO CREDENTIALS — NOT SECURITY. These values ship in the public
// frontend bundle so a presenter can open the demo without real staff
// accounts. They protect nothing: anyone can read them, and they grant
// access ONLY to local synthetic demo data. Never reuse them for real
// authentication, and never treat this gate as authorization.

export const DEMO_USERNAME = 'ayop-demo';
export const DEMO_PASSWORD = 'jem51-demo';

export const DEMO_PUBLIC_NOTICE =
  'Public demo access — these credentials are visible to anyone and unlock only synthetic demo data.';

/** Username is trimmed and case-insensitive; password must match exactly. */
export function verifyDemoLogin(username: string, password: string): boolean {
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}

/** localStorage key holding the demo session (unlocked flag + profile). */
export const DEMO_AUTH_KEY = 'jem51-demo-auth';
