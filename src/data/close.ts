// Month-End Close checklist logic (pure, no DOM/React).
// Builds on src/data/finance.ts and existing statuses — no competing posted
// definition. Demo only: acknowledgements live in localStorage and nothing
// here locks a period or mutates accounting records. Covered by selftest.

import { trialBalance } from './finance';
import type { JournalEntry, PurchaseOrder, Txn } from './seed';

export type CheckStatus = 'clear' | 'attention' | 'na';
export type PeriodStatus = 'Open' | 'Review Required' | 'Checklist Complete';

export interface CloseCheck {
  id: string;
  label: string;
  detail: string;
  count: number;
  status: CheckStatus;
  link: string;
  linkLabel: string;
}

export interface CloseResult {
  checks: CloseCheck[];
  completed: number;
  total: number;
  periodStatus: PeriodStatus;
  tbState: 'nodata' | 'balanced' | 'out';
}

export interface CloseInputs {
  txns: Txn[];
  journal: JournalEntry[];
  pos: PurchaseOrder[];
  year: number;
  month: number; // 1-12
  unit: string; // 'All units' or exact unit
  reportReviewed: boolean;
}

export function monthRange(year: number, month: number): { from: string; to: string; label: string } {
  const m = String(month).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(last).padStart(2, '0')}`, label: `${names[month]} ${year}` };
}

function inScope(t: { date?: string; businessUnit?: string }, unit: string, from: string, to: string): boolean {
  return (unit === 'All units' || t.businessUnit === unit)
    && (!t.date || (t.date >= from && t.date <= to));
}

const REVIEW_CHAIN = ['For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved'];

export function computeClose(inp: CloseInputs): CloseResult {
  const { txns, journal, pos, unit, reportReviewed } = inp;
  const { from, to } = monthRange(inp.year, inp.month);
  const scoped = txns.filter(t => inScope(t, unit, from, to));

  const acctReview = scoped.filter(t => t.status === 'For Accountant Review');
  const ownerQueue = scoped.filter(t => t.status === 'Accountant Reviewed' || t.status === 'For Owner Approval');
  const drafts = journal.filter(j => j.status === 'Draft' && (unit === 'All units' || j.businessUnit === unit));
  const rejected = scoped.filter(t => t.status === 'Rejected');
  const openPOs = pos.filter(p =>
    p.status !== 'Cancelled'
    && (unit === 'All units' || p.businessUnit === unit)
    && p.items.some(l => (l.quantity - (l.receivedQty ?? 0)) > 0));
  const pendingPayables = scoped.filter(t =>
    t.classification === 'Liability' && REVIEW_CHAIN.includes(t.status));

  const tb = trialBalance(txns, { unit, from, to });
  const tbState: CloseResult['tbState'] =
    tb.lines.length === 0 ? 'nodata' : tb.balanced ? 'balanced' : 'out';

  const attn = (label: string, count: number, unit_word: string) =>
    `${count} ${unit_word}${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} ${label}.`;

  const checks: CloseCheck[] = [
    {
      id: 'acct-review', label: 'Accountant review queue',
      detail: acctReview.length ? attn('accountant review', acctReview.length, 'entry') : 'No entries waiting for accountant review.',
      count: acctReview.length, status: acctReview.length ? 'attention' : 'clear',
      link: '/admin/approval', linkLabel: 'Open Approval',
    },
    {
      id: 'owner-approval', label: 'Owner / management approval',
      detail: ownerQueue.length ? attn('owner approval', ownerQueue.length, 'entry') : 'Nothing waiting for owner approval.',
      count: ownerQueue.length, status: ownerQueue.length ? 'attention' : 'clear',
      link: '/admin/approval', linkLabel: 'Open Approval',
    },
    {
      id: 'journal-drafts', label: 'Draft journal entries',
      detail: drafts.length ? attn('review before they can post', drafts.length, 'draft') : 'No unposted journal drafts.',
      count: drafts.length, status: drafts.length ? 'attention' : 'clear',
      link: '/admin/journal', linkLabel: 'Open Journal',
    },
    {
      id: 'rejected', label: 'Rejected needs correction',
      detail: rejected.length ? attn('correction and resubmission', rejected.length, 'entry') : 'No rejected entries outstanding.',
      count: rejected.length, status: rejected.length ? 'attention' : 'clear',
      link: '/admin/approval', linkLabel: 'Review rejected',
    },
    {
      id: 'po-outstanding', label: 'P.O.s with outstanding receipts',
      detail: openPOs.length ? attn('receiving', openPOs.length, 'order') : 'All orders received or none outstanding.',
      count: openPOs.length, status: openPOs.length ? 'attention' : 'clear',
      link: '/admin/purchasing', linkLabel: 'Open Purchasing',
    },
    {
      id: 'payables', label: 'Payables awaiting review',
      detail: pendingPayables.length ? attn('accounting review (not yet posted)', pendingPayables.length, 'payable') : 'No unposted payables in this scope.',
      count: pendingPayables.length, status: pendingPayables.length ? 'attention' : 'clear',
      link: '/admin/approval', linkLabel: 'Open Approval',
    },
    {
      id: 'trial-balance', label: 'Trial Balance balanced',
      detail: tbState === 'nodata'
        ? 'No eligible posted entries in this scope — no balance to check (not marked balanced).'
        : tbState === 'balanced'
          ? `Balanced ✓ — debits equal credits at ${tb.totalDebit.toLocaleString('en-PH')}.`
          : `Out of balance — difference ${tb.difference.toLocaleString('en-PH')}. Resolve before relying on statements.`,
      count: tb.lines.length, status: tbState === 'balanced' ? 'clear' : tbState === 'nodata' ? 'na' : 'attention',
      link: '/admin/trial-balance', linkLabel: 'Open Trial Balance',
    },
    {
      id: 'report-review', label: 'Financial statements reviewed',
      detail: reportReviewed
        ? 'Statements reviewed (simulated acknowledgement — not a lock).'
        : 'Open the three statements, review them, then record acknowledgement below.',
      count: reportReviewed ? 1 : 0, status: reportReviewed ? 'clear' : 'attention',
      link: '/admin/reports', linkLabel: 'Open Reports',
    },
  ];

  const completed = checks.filter(c => c.status !== 'attention').length;
  const attention = checks.filter(c => c.status === 'attention').length;
  // Open = work in progress (reviewer hasn't signed off yet); Review Required
  // = reviewer signed off but exceptions still block completion.
  const reportAcked = checks.find(c => c.id === 'report-review')?.status === 'clear';
  const periodStatus: PeriodStatus =
    attention === 0 ? 'Checklist Complete' : reportAcked ? 'Review Required' : 'Open';

  return { checks, completed, total: checks.length, periodStatus, tbState };
}

/** Fingerprint of the underlying data so a stale acknowledgement invalidates. */
export function closeFingerprint(r: CloseResult): string {
  return r.checks.map(c => `${c.id}:${c.count}:${c.status}`).join('|');
}
