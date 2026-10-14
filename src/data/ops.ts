// Pure operational workflow helpers (no DOM, no React): purchase-order
// receipt math, status derivation, and inventory-type defaults. Covered by
// scripts/selftest.ts so the rules stay honest as the UI evolves.

import type { PurchaseOrder, TxnStatus } from './seed';

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
