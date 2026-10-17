// Pure operational workflow helpers (no DOM, no React): purchase-order
// receipt math, status derivation, and inventory-type defaults. Covered by
// scripts/selftest.ts so the rules stay honest as the UI evolves.

import type { JournalEntry, JournalLine, PurchaseOrder, Txn, TxnStatus } from './seed';
import { BUSINESS_UNITS, COA, STAFF, TRANSACTION_KINDS } from './seed';

export type POStatus = PurchaseOrder['status'];

export function lineRemaining(ordered: number, received: number): number {
  return Math.max(0, ordered - received);
}

export function poReceivedTotal(po: PurchaseOrder): number {
  return po.items.reduce((s, l) => s + (l.receivedQty ?? 0), 0);
}

export function poOrderedTotal(po: PurchaseOrder): number {
  return po.items.reduce((s, l) => s + l.quantity, 0);
}

export function poOutstandingLines(po: PurchaseOrder): number {
  return po.items.filter(l => lineRemaining(l.quantity, l.receivedQty ?? 0) > 0).length;
}

/** Derive lifecycle status from line receipts. Draft/Cancelled are sticky. */
export function derivePOStatus(
  ordered: number, received: number, sent: boolean, current: POStatus,
): POStatus {
  if (current === 'Draft' || current === 'Cancelled') return current;
  if (ordered > 0 && received >= ordered) return 'Received';
  if (received > 0) return 'Partially Received';
  return sent ? 'Sent to Supplier' : current;
}

export interface ReceiptResult {
  po: PurchaseOrder;
  receivedQty: number;
  receivedValue: number;
  fullyReceived: boolean;
}
export interface ReceiptError { error: string }

export function applyReceipt(
  po: PurchaseOrder, lineIdx: number, qty: number, today: string,
): ReceiptResult | ReceiptError {
  if (po.status === 'Cancelled') return { error: 'This order is cancelled — no receipts allowed.' };
  if (po.status === 'Draft') return { error: 'Send the order to the supplier before recording a receipt.' };
  if (po.status === 'Received') return { error: 'This order is already fully received.' };
  const line = po.items[lineIdx];
  if (!line) return { error: 'Order line not found.' };
  if (!Number.isInteger(qty) || qty <= 0)
    return { error: 'Receipt quantity must be a whole number greater than 0.' };
  const remaining = lineRemaining(line.quantity, line.receivedQty ?? 0);
  if (remaining <= 0) return { error: `"${line.item}" is already fully received (${line.quantity} of ${line.quantity}).` };
  if (qty > remaining)
    return { error: `Only ${remaining} of "${line.item}" still outstanding — ${qty} would double-count stock.` };

  const items = po.items.map((l, i) =>
    i === lineIdx ? { ...l, receivedQty: (l.receivedQty ?? 0) + qty } : l,
  );
  const received = items.reduce((s, l) => s + l.receivedQty, 0);
  const ordered = items.reduce((s, l) => s + l.quantity, 0);
  const fullyReceived = received >= ordered;
  const next: PurchaseOrder = {
    ...po,
    items,
    received: fullyReceived,
    receivedDate: today,
    status: derivePOStatus(ordered, received, true, fullyReceived ? 'Sent to Supplier' : po.status),
  };
  // derivePOStatus needs a non-sticky current: Sent flows forward correctly.
  if (fullyReceived) next.status = 'Received';
  else if (received > 0) next.status = 'Partially Received';
  return { po: next, receivedQty: qty, receivedValue: qty * line.supplierPrice, fullyReceived };
}

export function defaultInventoryTypeFor(unit: string): string {
  if (unit === 'Pharmacy' || unit === 'PhilHealth Gamot') return 'Pharmacy';
  if (unit === 'Diagnostic Center' || unit === 'Animal Bite Center' || unit === 'PhilHealth Yakap/Konsulta') return 'Laboratory';
  if (unit === 'Dialysis Center') return 'Dialysis';
  return 'Admin';
}

// ---------- approval & ledger-integrity rules (single source of truth) ----------

/** Only this status contributes to posted-ledger views and financial summaries. */
export function countsAsPosted(status: TxnStatus): boolean {
  return status === 'Posted';
}

/** Legal frontend workflow transitions. Anything else is rejected by the store. */
export const ALLOWED_TRANSITIONS: Record<TxnStatus, TxnStatus[]> = {
  'Draft': ['For Accountant Review'],
  'For Accountant Review': ['Accountant Reviewed', 'Rejected'],
  'Accountant Reviewed': ['For Owner Approval', 'Rejected'],
  'For Owner Approval': ['Approved', 'Rejected'],
  'Approved': ['Posted', 'Rejected'],
  'Posted': ['Reversed'],
  'Rejected': ['For Accountant Review', 'Draft'],
  'Reversed': [],
};

export function isAllowed(from: TxnStatus, to: TxnStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Who must act next on a queued transaction (display helper — not enforcement). */
export function nextRoleFor(status: TxnStatus): string {
  switch (status) {
    case 'For Accountant Review': return 'Accounting — Daniflor Calago';
    case 'Accountant Reviewed': return 'Accounting — forward to owner';
    case 'For Owner Approval': return 'Owner/Management — Joy Ayop';
    case 'Approved': return 'Posting to General Ledger';
    case 'Draft': return 'Originator — submit for review';
    case 'Rejected': return 'Originator — correct and resubmit';
    default: return '—';
  }
}

/** Collision-free demo id: max numeric TXN-2026-NNNN suffix + 1. */
export function nextTxnId(existing: string[]): string {
  let max = 40;
  existing.forEach(id => {
    const m = /^TXN-2026-(\d+)$/.exec(id ?? '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'TXN-2026-' + String(max + 1).padStart(4, '0');
}

// ---------- staff identity, creator attribution, demo permissions ----------

/** Resolve a display name to a staff user ID (one-time migration help only). */
export function staffIdForName(name: string): string | null {
  return STAFF.find(s => s.name === (name ?? '').trim())?.id ?? null;
}

/** Roles whose demo workspace includes approval/posting actions. */
export const APPROVER_ROLES = ['Accounting', 'CEO'];

/**
 * Demo-only permission helper. This reflects UI presentation, NOT
 * server-enforced authorization — there is no backend in this phase.
 */
export function canActOnApprovals(role: string): boolean {
  return APPROVER_ROLES.includes(role);
}

export function isCreator(userId: string | null | undefined, rec: { createdBy?: string }): boolean {
  return !!userId && rec.createdBy === userId;
}

export function ownRecords<T extends { createdBy?: string }>(rows: T[], userId: string | null | undefined): T[] {
  if (!userId) return [];
  return rows.filter(r => r.createdBy === userId);
}

/** Originators may correct/resubmit their own rejected work; approvers may handle any. */
export function canResubmit(role: string, userId: string | null | undefined, txn: { createdBy?: string }): boolean {
  return canActOnApprovals(role) || isCreator(userId, txn);
}

const SELF_APPROVAL_BLOCKED: TxnStatus[] = ['Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted'];

/**
 * Block a creator from approving/posting their own entry. Returns an error
 * message, or null when the actor may proceed (store still enforces order).
 */
export function guardTransition(
  txn: { createdBy?: string; id: string },
  to: TxnStatus,
  actorId: string | null | undefined,
): string | null {
  if (actorId && txn.createdBy && txn.createdBy === actorId && SELF_APPROVAL_BLOCKED.includes(to)) {
    return `You created ${txn.id} — approval and posting need a different reviewer (demo control). It stays in the queue.`;
  }
  return null;
}

// ---------- disbursement entry + date-range search ----------

export interface DisbursementInput {
  date: string;
  businessUnit: string;
  particulars: string;
  supplier: string;
  accountCode: string;
  amount: number | null;
}

/** Plain-language validation for the staff disbursement form. */
export function validateDisbursement(d: DisbursementInput): string[] {
  const errs: string[] = [];
  if (!d.date) errs.push('Date is required — pick the payment date.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(new Date(d.date + 'T00:00:00').getTime()))
    errs.push('Date must be a real calendar date (YYYY-MM-DD).');
  if (!d.particulars.trim()) errs.push('Particulars are required — say in plain words what the payment was for.');
  if (!d.supplier.trim()) errs.push('Supplier is required — who was paid?');
  if (!BUSINESS_UNITS.includes(d.businessUnit as never))
    errs.push('Business Unit must be one of the nine Ayop units.');
  if (!COA.some(c => c.code === d.accountCode))
    errs.push('Account must be chosen from the Chart of Accounts.');
  if (d.amount === null || !isFinite(d.amount)) errs.push('Amount must be a number.');
  else if (d.amount <= 0) errs.push('Amount must be greater than zero.');
  return errs;
}

/** Inclusive date-range match; empty bounds mean open-ended. */
export function inDateRange(date: string, from: string, to: string): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

export function dateRangeError(from: string, to: string): string | null {
  if (from && to && from > to) return 'Start Date is later than End Date — swap them or clear the filter.';
  return null;
}

// ---------- guided journal entry ----------

export interface JournalLineInput {
  accountCode: string;
  debit: number | null;
  credit: number | null;
}

export interface JournalInput {
  date: string;
  particulars: string;
  businessUnit: string;
  lines: JournalLineInput[];
}

export function journalTotals(lines: JournalLineInput[]): { debit: number; credit: number; diff: number; balanced: boolean } {
  const num = (v: number | null) => (v !== null && isFinite(v) && v > 0 ? v : 0);
  const debit = lines.reduce((s, l) => s + num(l.debit), 0);
  const credit = lines.reduce((s, l) => s + num(l.credit), 0);
  const diff = debit - credit;
  return { debit, credit, diff, balanced: debit > 0 && Math.abs(diff) < 0.005 };
}

/** Field-level errors keyed for inline display; empty object = submittable. */
export function validateJournal(j: JournalInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!j.date) e.date = 'Entry date is required.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date) || isNaN(new Date(j.date + 'T00:00:00').getTime()))
    e.date = 'Entry date must be a real calendar date.';
  if (!j.particulars.trim()) e.particulars = 'Tell us in plain words what this entry records and why.';
  if (!BUSINESS_UNITS.includes(j.businessUnit as never)) e.businessUnit = 'Pick one of the nine Ayop business units.';
  const usable = j.lines.filter(l => l.accountCode || (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  if (usable.length < 2) e.lines = 'Add at least two lines — one debit and one credit.';
  j.lines.forEach((l, i) => {
    const tag = `line${i}`;
    if (!l.accountCode) { if ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0) e[tag] = `Line ${i + 1}: choose an account from the chart.`; return; }
    if (!COA.some(c => c.code === l.accountCode)) { e[tag] = `Line ${i + 1}: unknown account code.`; return; }
    const d = l.debit ?? 0, c = l.credit ?? 0;
    if ((d < 0 || c < 0) || !isFinite(d) || !isFinite(c)) e[tag] = `Line ${i + 1}: amounts cannot be negative.`;
    else if (d > 0 && c > 0) e[tag] = `Line ${i + 1}: put the amount in Debit or Credit, not both.`;
    else if (d === 0 && c === 0) e[tag] = `Line ${i + 1}: enter an amount in Debit or Credit.`;
  });
  const t = journalTotals(j.lines);
  if (!e.lines && t.debit === 0) e.totals = 'Enter at least one debit amount.';
  else if (!e.lines && !t.balanced) e.totals = `Debits and credits must match — difference is ${Math.abs(t.diff).toLocaleString('en-PH')}. Adjust the lines above.`;
  return e;
}

// ---------- New Entry save: route to Disbursement or Journal by type ----------

/** One account line from the New Entry form (amounts are raw typed strings). */
export interface NewEntryLine {
  accountTitle: string;
  debit: string;
  credit: string;
}

/** The New Entry form payload, narrowed to the fields the save path needs. */
export interface NewEntryInput {
  date: string;
  businessUnit: string;
  transactionType: string;
  particulars: string;
  entries: NewEntryLine[];
}

/** Same money rule the entry form uses: blank/invalid -> 0, never negative. */
function entryMoney(raw: string): number {
  const parsed = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export function newEntryTotals(entries: NewEntryLine[]): { debit: number; credit: number; balanced: boolean } {
  const debit = entries.reduce((s, e) => s + entryMoney(e.debit), 0);
  const credit = entries.reduce((s, e) => s + entryMoney(e.credit), 0);
  return { debit, credit, balanced: debit > 0 && Math.abs(debit - credit) < 0.005 };
}

/**
 * Plain-language validation for a New Entry save. Balanced debit=credit is
 * required so both destination records (Disbursement amount, Journal draft)
 * are structurally valid.
 */
export function newEntryErrors(d: NewEntryInput): string[] {
  const errs: string[] = [];
  if (!d.date) errs.push('Date is required — pick the transaction date.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(new Date(d.date + 'T00:00:00').getTime()))
    errs.push('Date must be a real calendar date (YYYY-MM-DD).');
  if (!d.particulars.trim()) errs.push('Particulars are required — say in plain words what this entry records.');
  if (!BUSINESS_UNITS.includes(d.businessUnit as never))
    errs.push('Business Unit must be one of the nine Ayop units.');
  if (!TRANSACTION_KINDS.includes(d.transactionType as never))
    errs.push('Transaction Type must be Disbursement or Journal.');
  const touched = d.entries.filter(e => (e.accountTitle ?? '').trim() || entryMoney(e.debit) > 0 || entryMoney(e.credit) > 0);
  if (touched.length < 2) errs.push('Add at least two account lines — one debit and one credit.');
  d.entries.forEach((e, i) => {
    const code = (e.accountTitle ?? '').trim();
    const dr = entryMoney(e.debit);
    const cr = entryMoney(e.credit);
    if (!code && dr === 0 && cr === 0) return; // untouched row
    if (!code) { errs.push(`Line ${i + 1}: choose an account from the chart.`); return; }
    if (!COA.some(c => c.code === code)) { errs.push(`Line ${i + 1}: unknown account code.`); return; }
    if (dr > 0 && cr > 0) errs.push(`Line ${i + 1}: put the amount in Debit or Credit, not both.`);
    else if (dr === 0 && cr === 0) errs.push(`Line ${i + 1}: enter an amount in Debit or Credit.`);
  });
  const t = newEntryTotals(d.entries);
  if (!errs.length) {
    if (t.debit === 0) errs.push('Enter at least one debit amount.');
    else if (!t.balanced)
      errs.push(`Debits and credits must match — difference is ${Math.abs(t.debit - t.credit).toLocaleString('en-PH')}. Adjust the lines above.`);
  }
  return errs;
}

/** Account code/name of the first debit line (falls back to the first coded line). */
function firstDebitAccount(d: NewEntryInput): { code: string; name: string } {
  const lines = d.entries.map(e => ({ code: (e.accountTitle ?? '').trim(), debit: entryMoney(e.debit) }));
  const hit = lines.find(l => l.debit > 0) ?? lines.find(l => l.code);
  const acct = COA.find(c => c.code === hit?.code);
  return { code: acct?.code ?? hit?.code ?? '', name: acct?.name ?? '' };
}

/**
 * Every usable New Entry line (coded + non-zero), with account names resolved
 * from the shared chart. Used by both save mappers so a saved record keeps the
 * complete debit/credit breakdown, not just a summary.
 */
function newEntryLines(d: NewEntryInput): JournalLine[] {
  return d.entries
    .map(e => ({ code: (e.accountTitle ?? '').trim(), debit: entryMoney(e.debit), credit: entryMoney(e.credit) }))
    .filter(l => l.code && (l.debit > 0 || l.credit > 0))
    .map(l => {
      const acct = COA.find(c => c.code === l.code);
      return { accountCode: l.code, accountName: acct?.name ?? '', debit: l.debit, credit: l.credit };
    });
}

/**
 * Map a balanced New Entry to a Disbursement record: the entry total becomes
 * the payment amount and the first debit line its account (the form has no
 * supplier, shown as an em dash). Every account line and the entry's control
 * number are kept so the saved record can be reopened and printed exactly.
 * Nothing here is invented beyond the existing Disbursement shape; it queues
 * for accountant review via addTxn.
 */
export function disbursementFromNewEntry(d: NewEntryInput, enteredBy: string, controlNo?: string): Omit<Txn, 'id' | 'status'> {
  const t = newEntryTotals(d.entries);
  const acct = firstDebitAccount(d);
  return {
    date: d.date,
    businessUnit: d.businessUnit,
    classification: 'Expense',
    kind: 'Disbursement',
    item: d.particulars.trim(),
    category: 'Medical Supplies',
    supplier: '—',
    supplierPrice: t.debit,
    retailPrice: 0,
    quantity: 1,
    amount: t.debit,
    accountCode: acct.code,
    accountName: acct.name,
    enteredBy,
    remarks: 'New entry saved from Transaction — queued for accountant review, not posted',
    lines: newEntryLines(d),
    controlNo,
  };
}

/**
 * Map a balanced New Entry to a Journal draft, keeping every usable line.
 * Summary fields mirror the guided journal form (first debit/credit accounts).
 */
export function journalFromNewEntry(d: NewEntryInput, ref: string, controlNo?: string): Omit<JournalEntry, 'id'> {
  const lines = newEntryLines(d);
  const firstDr = lines.find(l => l.debit > 0);
  const firstCr = lines.find(l => l.credit > 0);
  const total = lines.reduce((s, l) => s + l.debit, 0);
  return {
    date: d.date,
    ref,
    particulars: d.particulars.trim(),
    businessUnit: d.businessUnit,
    debitAccount: firstDr ? `${firstDr.accountCode} — ${firstDr.accountName}` : '',
    creditAccount: firstCr
      ? (lines.length === 2 ? `${firstCr.accountCode} — ${firstCr.accountName}` : `Multiple (${lines.length} lines)`)
      : '',
    amount: total,
    status: 'Draft',
    sourceTxn: 'NEW ENTRY',
    lines,
    controlNo,
  };
}

/**
 * Voucher display lines for a saved Journal entry. Uses the stored line
 * breakdown when present; otherwise reconstructs two lines from the stored
 * summary fields — reusing the already-saved amount, never inventing money.
 */
export function journalEntryLines(j: Pick<JournalEntry, 'lines' | 'debitAccount' | 'creditAccount' | 'amount'>): JournalLine[] {
  if (j.lines && j.lines.length) return j.lines.map(l => ({ ...l }));
  const codeOf = (s: string) => /^\s*([A-Za-z0-9-]+)/.exec(s ?? '')?.[1] ?? '';
  return [
    { accountCode: codeOf(j.debitAccount), accountName: '', debit: j.amount, credit: 0 },
    { accountCode: codeOf(j.creditAccount), accountName: '', debit: 0, credit: j.amount },
  ];
}

/**
 * Voucher display lines for a saved Disbursement. Uses the stored line
 * breakdown when present; otherwise the single stored account/amount — never
 * inventing a counter-account the record does not hold.
 */
export function disbursementEntryLines(t: Pick<Txn, 'lines' | 'accountCode' | 'accountName' | 'amount'>): JournalLine[] {
  if (t.lines && t.lines.length) return t.lines.map(l => ({ ...l }));
  return [{ accountCode: t.accountCode, accountName: t.accountName, debit: t.amount, credit: 0 }];
}
