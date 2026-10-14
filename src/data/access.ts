// Centralized demo role policy (pure, no DOM/React).
// Single source of truth for who sees which dashboard, navigation, and
// routes. Roles come from the Staff record ID — never display-name matching.
//
// DEMO LIMITATION: these are UI presentation + route guards only. There is
// no backend, so they are not secure server-enforced authorization.

export type RoleKind = 'warehouse' | 'full';

/** Only the Warehouse role is restricted; every other role keeps the full experience. */
export function roleKindFor(role: string): RoleKind {
  return role === 'Warehouse' ? 'warehouse' : 'full';
}

/** Routes a Warehouse account may visit (dashboard + 4 work areas + account controls). */
const WAREHOUSE_PREFIXES = [
  '/admin/transaction',
  '/admin/transaction-types',
  '/admin/disbursement',
  '/admin/journal',
  '/admin/approval',
  '/admin/inventory',
  '/admin/purchasing',
];
const WAREHOUSE_EXACT = ['/admin', '/admin/settings', '/admin/login'];

/** Accountant-only destinations, hidden from Warehouse navigation and routes. */
export const ACCOUNTING_ONLY_LABELS = [
  'Trial Balance',
  'Income & Expense',
  'Financial Condition',
  'All Reports (Printable)',
  'Month-End Close',
  'General Ledger',
  'Chart of Accounts',
  'Accounts Payable',
  'Accounts Receivable',
  'Bank Reconciliation',
  'Audit Trail',
];

/** Warehouse dashboard sections — no financial-summary panels by design. */
export const WAREHOUSE_SECTIONS = [
  'my-submissions',
  'receiving-tasks',
  'stock-levels',
  'approval-tracking',
] as const;

export function canVisit(role: string, pathname: string): boolean {
  if (roleKindFor(role) !== 'warehouse') return true;
  if (WAREHOUSE_EXACT.includes(pathname)) return true;
  return WAREHOUSE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export interface NavEntry {
  to: string;
  label: string;
  end?: boolean;
  subs?: { to: string; label: string }[];
}

/**
 * Transaction submenu destinations shown to the Warehouse role: New Entry
 * only. Other roles keep the full submenu. Routes themselves are untouched.
 */
export const WAREHOUSE_TX_SUBS = ['/admin/transaction'];

/**
 * Navigation visible to a role, derived from the full NAV definition so
 * labels/routes stay consistent. Warehouse sees dashboard + 4 work areas +
 * Settings only.
 */
export function navFor(role: string, fullNav: NavEntry[]): NavEntry[] {
  if (roleKindFor(role) !== 'warehouse') return fullNav;
  const keep = new Set(['/admin', '/admin/transaction', '/admin/approval', '/admin/inventory', '/admin/purchasing', '/admin/settings']);
  return fullNav
    .filter(n => keep.has(n.to))
    .map(n => {
      if (n.to !== '/admin/transaction' || !n.subs) return n;
      return { ...n, subs: n.subs.filter(s => WAREHOUSE_TX_SUBS.includes(s.to.split('?')[0])) };
    });
}
