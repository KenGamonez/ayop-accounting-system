// Shared posted-ledger calculations (pure, no DOM/React).
// Every financial summary — Overview KPIs, Trial Balance, Income & Expense,
// Financial Condition, exports — must build on these helpers so figures agree.
// Rule: only Posted entries count, and posted reversal entries NEGATE the
// original impact instead of adding to it. Covered by scripts/selftest.ts.

import { countsAsPosted } from './ops';
import { COA } from './seed';
import type { Classification, Txn } from './seed';

export interface Scope {
  unit: string; // 'All units' or an exact business-unit name
  from: string; // YYYY-MM-DD, '' = no lower bound
  to: string; // YYYY-MM-DD, '' = no upper bound
}

export const ALL_UNITS = 'All units';

export function inScope(t: Txn, s: Scope): boolean {
  return (s.unit === ALL_UNITS || t.businessUnit === s.unit)
    && (!s.from || t.date >= s.from)
    && (!s.to || t.date <= s.to);
}

/** Posted entries inside the scope. Drafts, pending, rejected, reversed: out. */
export function postedIn(txns: Txn[], s: Scope): Txn[] {
  return txns.filter(t => countsAsPosted(t.status) && inScope(t, s));
}

/**
 * Signed amount: a posted reversal offsets the original entry, so it counts
 * negative. Without this, reversing then posting the correction would count
 * the same impact twice.
 */
export function signedAmount(t: Txn): number {
  return t.reversalOf ? -t.amount : t.amount;
}

export function sumByClass(txns: Txn[], s: Scope, cls: Classification): number {
  return postedIn(txns, s)
    .filter(t => t.classification === cls)
    .reduce((sum, t) => sum + signedAmount(t), 0);
}

export interface TBLine { account: string; debit: number; credit: number }
export interface TrialBalanceResult {
  lines: TBLine[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
}

export function trialBalance(txns: Txn[], s: Scope): TrialBalanceResult {
  const m = new Map<string, TBLine>();
  postedIn(txns, s).forEach(t => {
    const account = `${t.accountCode} — ${t.accountName}`;
    const e = m.get(account) ?? { account, debit: 0, credit: 0 };
    const amt = signedAmount(t);
    if (t.classification === 'Expense' || t.classification === 'Asset') e.debit += amt;
    else e.credit += amt;
    m.set(account, e);
  });
  const lines = [...m.values()].sort((a, b) => a.account.localeCompare(b.account));
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const difference = totalDebit - totalCredit;
  return { lines, totalDebit, totalCredit, difference, balanced: Math.abs(difference) < 0.005 };
}

export interface IncomeResult {
  revenueLines: Txn[];
  expenseLines: Txn[];
  totalRevenue: number;
  totalExpense: number;
  net: number;
}

export function incomeSummary(txns: Txn[], s: Scope): IncomeResult {
  const rows = postedIn(txns, s);
  const revenueLines = rows.filter(t => t.classification === 'Revenue');
  const expenseLines = rows.filter(t => t.classification === 'Expense');
  const totalRevenue = revenueLines.reduce((sum, t) => sum + signedAmount(t), 0);
  const totalExpense = expenseLines.reduce((sum, t) => sum + signedAmount(t), 0);
  return { revenueLines, expenseLines, totalRevenue, totalExpense, net: totalRevenue - totalExpense };
}

export interface ConditionGroup { account: string; amount: number }export interface ConditionResult {
  assets: ConditionGroup[];
  liabilities: ConditionGroup[];
  totalAssets: number;
  totalLiabilities: number;
  periodRevenue: number;
  periodExpense: number;
  /** Assets − Liabilities. Demo data has no equity accounts, so this is shown as-is, never manufactured. */
  difference: number;
}

export function conditionSummary(txns: Txn[], s: Scope): ConditionResult {
  const group = (cls: Classification): ConditionGroup[] => {
    const m = new Map<string, number>();
    postedIn(txns, s)
      .filter(t => t.classification === cls)
      .forEach(t => {
        const k = `${t.accountCode} — ${t.accountName}`;
        m.set(k, (m.get(k) ?? 0) + signedAmount(t));
      });
    return [...m.entries()]
      .map(([account, amount]) => ({ account, amount }))
      .sort((a, b) => a.account.localeCompare(b.account));
  };
  const assets = group('Asset');
  const liabilities = group('Liability');
  const totalAssets = assets.reduce((s, g) => s + g.amount, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.amount, 0);
  return {
    assets, liabilities, totalAssets, totalLiabilities,
    periodRevenue: sumByClass(txns, s, 'Revenue'),
    periodExpense: sumByClass(txns, s, 'Expense'),
    difference: totalAssets - totalLiabilities,
  };
}

// ---------- account-first General Ledger ----------

export interface AccountRecord { code: string; name: string; type: string }

/** Look up an account in the current Chart of Accounts. Never fabricated. */
export function getAccount(code: string): AccountRecord | null {
  const found = COA.find(c => c.code === (code ?? '').trim());
  return found ? { code: found.code, name: found.name, type: found.type } : null;
}

/**
 * Display label for ITEM CODE cells: `CODE — COA description`, resolved from
 * the Chart of Accounts. Falls back to the row's own stored account name
 * (actual project data), or the bare code if neither exists — never invented.
 */
export function accountLabel(code: string, fallbackName?: string): string {
  const found = getAccount(code);
  if (found) return `${found.code} — ${found.name}`;
  const fallback = (fallbackName ?? '').trim();
  return fallback ? `${code} — ${fallback}` : code;
}

export function accountOptions(): AccountRecord[] {
  return COA.map(c => ({ code: c.code, name: c.name, type: c.type }));
}

/** Normal-balance side: debit-normal for Asset/Expense, credit-normal otherwise. */
export function isDebitNormal(accountType: string): boolean {
  return accountType === 'Asset' || accountType === 'Expense';
}

export interface LedgerLine {
  date: string;
  ref: string;
  particulars: string;
  unit: string;
  debit: number;
  credit: number;
  balance: number;
  reversalOf?: string;
}

export interface AccountLedger {
  account: AccountRecord;
  opening: number;
  lines: LedgerLine[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}

/**
 * One account's posted ledger activity. Entries map to their debit/credit
 * side by classification (same model as the Trial Balance); the running
 * balance follows the account's normal side. Opening comes from eligible
 * posted entries before the start date — when no start date is set the
 * opening is 0 and every eligible entry is shown.
 */
export function accountLedger(txns: Txn[], code: string, s: Scope): AccountLedger | null {
  const account = getAccount(code);
  if (!account) return null;
  const debitNormal = isDebitNormal(account.type);
  const sideOf = (t: Txn): 'debit' | 'credit' =>
    t.classification === 'Expense' || t.classification === 'Asset' ? 'debit' : 'credit';

  const eligible = txns.filter(t =>
    countsAsPosted(t.status)
    && t.accountCode === account.code
    && (s.unit === ALL_UNITS || t.businessUnit === s.unit));
  const before = s.from ? eligible.filter(t => t.date < s.from) : [];
  const inPeriod = eligible
    .filter(t => (!s.from || t.date >= s.from) && (!s.to || t.date <= s.to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const effect = (t: Txn): number => {
    const amt = signedAmount(t);
    const onDebitSide = sideOf(t) === 'debit';
    // Contribution to the normal-balance running total.
    return debitNormal === onDebitSide ? amt : -amt;
  };
  const opening = before.reduce((sum, t) => sum + effect(t), 0);

  let running = opening;
  const lines: LedgerLine[] = inPeriod.map(t => {
    const amt = signedAmount(t);
    const debit = sideOf(t) === 'debit' ? amt : 0;
    const credit = sideOf(t) === 'credit' ? amt : 0;
    running += effect(t);
    return {
      date: t.date, ref: t.id,
      particulars: `${t.item}${t.reversalOf ? ` (reversal of ${t.reversalOf})` : ''}`,
      unit: t.businessUnit, debit, credit, balance: running,
      reversalOf: t.reversalOf,
    };
  });

  return {
    account,
    opening,
    lines,
    totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
    totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
    closing: running,
  };
}
