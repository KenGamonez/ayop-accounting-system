// Staff directory for the premium sign-in dashboard.
//
// The four portraits shown on the login screen. Each card maps to an existing
// Staff record by `id` so the demo identity — and the role-based views that
// follow sign-in — resolve from the same single source of truth as the rest of
// the app (src/data/seed.ts / src/data/access.ts).
//
// DEMO ONLY: picking a card sets a *simulated* identity inside the frontend
// demo. It never grants real privileges — live sign-in resolves the role from
// the server membership record, never from this selection.

export interface StaffCard {
  /** Existing Staff record id (src/data/seed.ts). */
  id: string;
  /** Display name shown on the card and in the sign-in panel. */
  name: string;
  /** Presentation title shown beneath the name. */
  title: string;
  /** Portrait served from /public/staff. */
  photo: string;
}

export const STAFF_CARDS: StaffCard[] = [
  { id: 'joy', name: 'Joy Ayop', title: 'CEO', photo: '/staff/joy-ayop.jpg' },
  { id: 'dani', name: 'Daniflor', title: 'Accounting', photo: '/staff/daniflor.jpg' },
  { id: 'jeann', name: 'Je Anne', title: 'Warehouse', photo: '/staff/je-anne.jpg' },
  { id: 'rodel', name: 'Rodel A', title: 'IT', photo: '/staff/rodel.jpg' },
];

/** Look up a card by its Staff record id. */
export function staffCardById(id: string | null | undefined): StaffCard | null {
  if (!id) return null;
  return STAFF_CARDS.find(c => c.id === id) ?? null;
}
