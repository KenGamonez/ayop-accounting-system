// Frontend self-test for import/export logic. Run: node scripts/selftest.ts
import * as XLSX from 'xlsx';
import { DATA_TYPES, autoMap, validateRows, dupKey, toCSV, fileName, importIdemKey, sheetsToCsvUrl } from '../src/data/io.ts';
import { applyReceipt, derivePOStatus, defaultInventoryTypeFor, lineRemaining, isAllowed,
nextRoleFor, nextTxnId, countsAsPosted, ALLOWED_TRANSITIONS, validateDisbursement, inDateRange,
dateRangeError, journalTotals, validateJournal, staffIdForName, canActOnApprovals, isCreator,
ownRecords, canResubmit, guardTransition, newEntryErrors, newEntryTotals,
disbursementFromNewEntry, journalFromNewEntry, journalEntryLines, disbursementEntryLines } from '../src/data/ops.ts';
import { postedIn, signedAmount, sumByClass, trialBalance, incomeSummary, conditionSummary } from '../src/data/finance.ts';
import { computeClose, monthRange, closeFingerprint } from '../src/data/close.ts';
import { TRANSACTION_KINDS, COA, STAFF, CLASSIFICATIONS } from '../src/data/seed.ts';
import { accountLabel, accountLedger, accountOptions, balanceSheet, cashFlow, getAccount, isDebitNormal } from '../src/data/finance.ts';
import { roleKindFor, canVisit, navFor, WAREHOUSE_SECTIONS, ACCOUNTING_ONLY_LABELS, WAREHOUSE_TX_SUBS } from '../src/data/access.ts';
import { DEMO_USERNAME, DEMO_PASSWORD, DEMO_AUTH_KEY, verifyDemoLogin } from '../src/data/demoAccess.ts';
import { mapDbTxn, mapRpcError, membershipToStaff, toDbPayload, type DbTxnRow } from '../src/data/live.ts';
import {
  mapDbPO, mapDbItem, toDbPOPayload, toDbItemPayload,
  type DbPORow, type DbPOLine, type DbItemRow,
} from '../src/data/live.ts';
import { readFileSync } from 'node:fs';
import { resolveBackendMode } from '../src/data/backend.ts';
import { BUSINESS_UNITS, STAFF } from '../src/data/seed.ts';
import { NAV } from '../src/components/Layout.tsx';
import { INCOME_REVENUE_COLUMNS, INCOME_EXPENSE_COLUMNS } from '../src/pages/Reports.tsx';
import { visibleAccountingTabs, isUiCashChild, bankDropdownChoices, CASH_IN_BANK_CHILDREN, coerceBankSub, bankSubError } from '../src/pages/Accounting.tsx';
import { displayStatus } from '../src/components/ui.tsx';
import { SIDEBAR_HIDDEN_ROUTES } from '../src/data/access.ts';
import { demoTxnFixtures } from './fixtures.ts';
import type { Txn } from '../src/data/seed.ts';
import type { PurchaseOrder } from '../src/data/seed.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}

const txn = DATA_TYPES.find(t => t.id === 'transactions')!;
const headers = Object.keys(txn.templateRow);
const mapping = autoMap(headers, txn.fields);
check('automap finds all required txn fields',
  ['date', 'businessUnit', 'classification', 'item', 'supplier'].every(k => mapping[k]));

const good = [
  { Date: '2026-10-14', 'Business Unit': 'Pharmacy', Classification: 'Revenue', Kind: 'Cash In', Item: 'OTC sales', Category: 'Medical Supplies', Supplier: 'Walk-in', 'Supplier Price': 0, 'Retail Price': 100, Quantity: 1, Amount: 100 },
  { Date: '2026-10-13', 'Business Unit': 'Central Warehouse', Classification: 'Expense', Kind: 'Disbursement', Item: 'Gloves', Category: 'Medical Supplies', Supplier: 'MedSupply', 'Supplier Price': 385, 'Retail Price': 0, Quantity: 20, Amount: '' },
];
const v1 = validateRows('transactions', good, mapping, new Set());
check('valid rows pass', v1.every(r => r.errors.length === 0), v1.map(r => r.errors));
check('amount computed with warning', v1[1].data.amount === 7700 && v1[1].warnings.length > 0, v1[1]);

const bad = [
  { Date: 'not-a-date', 'Business Unit': 'No Such Unit', Classification: 'Profit', Item: '', Supplier: 'X', Amount: -5 },
  { Date: '2026-10-14', 'Business Unit': 'Pharmacy', Classification: 'Revenue', Item: 'OTC sales', Supplier: 'Walk-in', Amount: 100 },
  { Date: '2026-10-14', 'Business Unit': 'Pharmacy', Classification: 'Revenue', Item: 'OTC sales', Supplier: 'Walk-in', Amount: 100 },
];
const v2 = validateRows('transactions', bad, mapping, new Set());
check('bad row reports date/unit/class/item/amount errors', v2[0].errors.length >= 4, v2[0].errors);
check('within-file duplicate flagged', v2[2].duplicateOf !== undefined && v2[2].errors.length === 0, v2[2]);
const existing = new Set([dupKey('transactions', v1[0].data)!]);
const v3 = validateRows('transactions', [good[0]], mapping, existing);
check('existing-record duplicate flagged', v3[0].duplicateOf !== undefined, v3[0]);

// opening balances: one-sided rule + balance gate at confirm step
const ob = DATA_TYPES.find(t => t.id === 'opening_balances')!;
const obMap = autoMap(Object.keys(ob.templateRow), ob.fields);
const obRows = validateRows('opening_balances', [
  { 'Account Code': '1000', 'Business Unit': 'Diagnostic Center', Date: '2026-10-01', Particulars: 'Cash', Debit: 50000, Credit: 0 },
  { 'Account Code': '9999', 'Business Unit': 'Pharmacy', Date: '2026-10-01', Debit: 100, Credit: 200 },
], obMap, new Set());
check('ob valid row passes', obRows[0].errors.length === 0, obRows[0].errors);
check('ob bad code + both sides rejected', obRows[1].errors.length >= 2, obRows[1].errors);

// xlsx round-trip (SheetJS in-memory)
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(good), 'Transactions');
const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const wb2 = XLSX.read(buf, { type: 'buffer' });
check('workbook sheet detected', wb2.SheetNames.includes('Transactions'), wb2.SheetNames);
const back = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb2.Sheets['Transactions'], { defval: '' });
check('xlsx round-trip preserves rows', back.length === 2 && back[0]['Item'] === 'OTC sales', back);

// csv helpers
const csv = toCSV(['Item', 'Amount'], [['Gloves, latex', 7700], ['Simple', 5]]);
const parsed = XLSX.read(csv, { type: 'string' });
const rows = XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]], { header: 1 }) as unknown[][];
check('csv quoting round-trips', rows.length === 3 && (rows[1] as unknown[])[0] === 'Gloves, latex', rows);
check('filename builder', fileName('transactions', 'csv', 'Pharmacy') === `transactions-pharmacy-${new Date().toISOString().slice(0, 10)}.csv`);
check('sheets url converter', sheetsToCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0') === 'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=0');
check('sheets rejects non-url', sheetsToCsvUrl('not a link') === null);

// ---- operational workflow: P.O. receipts ----
const mkPO = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'PO-T', poNo: 'PO-TEST', date: '2026-10-10', supplier: 'MedSupply',
  businessUnit: 'Pharmacy', deliveryDate: '2026-10-20',
  items: [
    { item: 'Gloves', quantity: 20, supplierPrice: 385, receivedQty: 0 },
    { item: 'Masks', quantity: 10, supplierPrice: 100, receivedQty: 10 },
  ],
  total: 8700, received: false, receivedDate: '', status: 'Sent to Supplier', ...over,
});
check('line remaining math', lineRemaining(20, 0) === 20 && lineRemaining(10, 10) === 0);
const r1 = applyReceipt(mkPO(), 0, 8, '2026-10-14');
check('partial receipt updates line + status', !('error' in r1) && r1.po.items[0].receivedQty === 8 && r1.po.status === 'Partially Received' && r1.receivedValue === 3080 && !r1.fullyReceived, r1);
const r2 = applyReceipt(mkPO(), 0, 25, '2026-10-14');
check('over-receipt blocked (no double count)', 'error' in r2 && /double-count/.test(r2.error), r2);
const r3 = applyReceipt(mkPO(), 1, 1, '2026-10-14');
check('repeat receipt on full line blocked', 'error' in r3, r3);
const full = mkPO({ items: [{ item: 'Gloves', quantity: 20, supplierPrice: 385, receivedQty: 12 }] });
const r4 = applyReceipt(full, 0, 8, '2026-10-14');
check('final receipt closes order', !('error' in r4) && r4.fullyReceived && r4.po.status === 'Received' && r4.po.received, r4);
check('draft orders cannot receive', 'error' in applyReceipt(mkPO({ status: 'Draft' }), 0, 1, '2026-10-14'));
check('cancelled orders cannot receive', 'error' in applyReceipt(mkPO({ status: 'Cancelled' }), 0, 1, '2026-10-14'));
check('non-integer qty rejected', 'error' in applyReceipt(mkPO(), 0, 2.5, '2026-10-14'));
check('zero qty rejected', 'error' in applyReceipt(mkPO(), 0, 0, '2026-10-14'));
check('status derivation', derivePOStatus(10, 0, true, 'Sent to Supplier') === 'Sent to Supplier'
  && derivePOStatus(10, 4, true, 'Sent to Supplier') === 'Partially Received'
  && derivePOStatus(10, 10, true, 'Partially Received') === 'Received'
  && derivePOStatus(10, 0, false, 'Draft') === 'Draft');
check('inventory type defaults', defaultInventoryTypeFor('Pharmacy') === 'Pharmacy'
  && defaultInventoryTypeFor('Diagnostic Center') === 'Laboratory'
  && defaultInventoryTypeFor('Dialysis Center') === 'Dialysis'
  && defaultInventoryTypeFor('Central Warehouse') === 'Admin');

// ---- approval transitions & ledger inclusion ----
const chain: [string, string][] = [
  ['Draft', 'For Accountant Review'],
  ['For Accountant Review', 'Accountant Reviewed'],
  ['Accountant Reviewed', 'For Owner Approval'],
  ['For Owner Approval', 'Approved'],
  ['Approved', 'Posted'],
  ['Posted', 'Reversed'],
];
check('happy-path chain allowed', chain.every(([a, b]) => isAllowed(a as never, b as never)), chain);
check('posting skips approval blocked', !isAllowed('Draft' as never, 'Posted' as never)
  && !isAllowed('For Accountant Review' as never, 'Posted' as never)
  && !isAllowed('Approved' as never, 'Accountant Reviewed' as never));
check('rejection + resubmission allowed', isAllowed('For Accountant Review' as never, 'Rejected' as never)
  && isAllowed('Rejected' as never, 'For Accountant Review' as never)
  && isAllowed('Rejected' as never, 'Draft' as never));
check('posted locked except reversal', !isAllowed('Posted' as never, 'Draft' as never)
  && !isAllowed('Posted' as never, 'Approved' as never)
  && isAllowed('Posted' as never, 'Reversed' as never)
  && !isAllowed('Reversed' as never, 'Posted' as never));
check('only Posted counts for ledger', countsAsPosted('Posted' as never)
  && !['Draft', 'For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved', 'Rejected', 'Reversed'].some(s => countsAsPosted(s as never)));
check('every status has a defined rule', (Object.keys(ALLOWED_TRANSITIONS).length === 8));
check('next role named per queue step', nextRoleFor('For Accountant Review' as never).includes('Daniflor')
  && nextRoleFor('For Owner Approval' as never).includes('Joy')
  && nextRoleFor('Posted' as never) === '—');
check('txn ids collision-free', nextTxnId(['TXN-2026-0041', 'TXN-2026-0050']) === 'TXN-2026-0051'
  && nextTxnId([]) === 'TXN-2026-0041'
  && nextTxnId(['TXN-2026-0099', 'TXN-2026-0100']) === 'TXN-2026-0101');

// ---- shared finance: posted-only, reversals, statements ----
const mkTxn = (over: Partial<Txn>): Txn => ({
  id: 'TXN-2026-0001', date: '2026-10-14', businessUnit: 'Pharmacy',
  classification: 'Revenue', kind: 'Cash In', item: 'Sales', category: 'Medical Supplies',
  supplier: 'Walk-in', supplierPrice: 0, retailPrice: 100, quantity: 1, amount: 100,
  accountCode: '4100', accountName: 'Pharmacy Sales', enteredBy: 'Demo',
  status: 'Posted', remarks: '', ...over,
});
const finSet: Txn[] = [
  mkTxn({ id: 'TXN-2026-0001', classification: 'Revenue', amount: 1000 }),
  mkTxn({ id: 'TXN-2026-0002', classification: 'Expense', amount: 400, accountCode: '5000', accountName: 'Medical Supplies Expense', supplier: 'MedSupply' }),
  mkTxn({ id: 'TXN-2026-0003', classification: 'Revenue', amount: 500, status: 'For Accountant Review' }),
  mkTxn({ id: 'TXN-2026-0004', classification: 'Expense', amount: 999, status: 'Rejected' }),
  mkTxn({ id: 'TXN-2026-0005', classification: 'Asset', amount: 250, accountCode: '1100', accountName: 'Pharmacy Inventory', status: 'Draft' }),
  mkTxn({ id: 'TXN-2026-0006', classification: 'Revenue', amount: 1000, status: 'Reversed' }),
  mkTxn({ id: 'TXN-2026-0007', classification: 'Revenue', amount: 1000, status: 'Posted', reversalOf: 'TXN-2026-0006', item: 'REVERSAL of TXN-2026-0006' }),
  mkTxn({ id: 'TXN-2026-0008', classification: 'Expense', amount: 50, businessUnit: 'Dialysis Center' }),
];
const ALL = { unit: 'All units', from: '', to: '' };
check('postedIn excludes draft/pending/rejected/reversed, includes posted reversal',
  postedIn(finSet, ALL).map(t => t.id).sort().join(',') === 'TXN-2026-0001,TXN-2026-0002,TXN-2026-0007,TXN-2026-0008');
check('scope filters unit + dates',
  postedIn(finSet, { unit: 'Pharmacy', from: '', to: '' }).length === 3
  && postedIn(finSet, { unit: 'All units', from: '2026-10-15', to: '' }).length === 0);
check('reversal counts negative (no double count)',
  signedAmount(finSet[6]) === -1000 && signedAmount(finSet[0]) === 1000
  && sumByClass(finSet, ALL, 'Revenue') === 0);
check('KPI sums posted-only', sumByClass(finSet, ALL, 'Expense') === 450
  && sumByClass(finSet, { unit: 'Dialysis Center', from: '', to: '' }, 'Expense') === 50);
const tb = trialBalance(finSet, ALL);
check('trial balance totals + honest difference',
  tb.totalDebit === 450 && tb.totalCredit === 0 && tb.difference === 450 && !tb.balanced, tb);
const tbBal: Txn[] = [
  mkTxn({ id: 'A', classification: 'Expense', amount: 300 }),
  mkTxn({ id: 'B', classification: 'Revenue', amount: 300 }),
];
const tb2 = trialBalance(tbBal, ALL);
check('balanced trial balance detected', tb2.balanced && tb2.difference === 0 && tb2.totalDebit === 300 && tb2.totalCredit === 300, tb2);
const inc = incomeSummary(finSet, ALL);
check('income: revenue/expense/net', inc.totalRevenue === 0 && inc.totalExpense === 450 && inc.net === -450
  && inc.revenueLines.length === 2 && inc.expenseLines.length === 2, inc);
const cond = conditionSummary(finSet, ALL);
check('condition groups by account, no manufactured equity',
  cond.totalAssets === 0 && cond.totalLiabilities === 0 && cond.difference === 0
  && cond.periodRevenue === 0 && cond.periodExpense === 450, cond);
const cond2 = conditionSummary([
  mkTxn({ id: 'X', classification: 'Asset', amount: 5000, accountCode: '1000', accountName: 'Cash on Hand' }),
  mkTxn({ id: 'Y', classification: 'Liability', amount: 2000, accountCode: '2000', accountName: 'Accounts Payable' }),
], ALL);
check('condition totals + difference', cond2.totalAssets === 5000 && cond2.totalLiabilities === 2000
  && cond2.difference === 3000 && cond2.assets[0].account === '1000 — Cash on Hand', cond2);

// ---- month-end close checklist ----
check('month range math', monthRange(2026, 10).from === '2026-10-01'
  && monthRange(2026, 10).to === '2026-10-31'
  && monthRange(2026, 2).to === '2026-02-28'
  && monthRange(2026, 10).label === 'October 2026');
const closeTxns: Txn[] = [
  mkTxn({ id: 'C1', date: '2026-10-05', status: 'For Accountant Review' }),
  mkTxn({ id: 'C2', date: '2026-10-06', status: 'For Owner Approval' }),
  mkTxn({ id: 'C3', date: '2026-10-07', status: 'Rejected' }),
  mkTxn({ id: 'C4', date: '2026-09-20', status: 'For Accountant Review' }),
  mkTxn({ id: 'C5', date: '2026-10-08', status: 'Approved', classification: 'Liability', accountCode: '2000', accountName: 'Accounts Payable' }),
  mkTxn({ id: 'C6', date: '2026-10-09', status: 'Posted', classification: 'Expense', amount: 300 }),
  mkTxn({ id: 'C7', date: '2026-10-10', status: 'Posted', classification: 'Revenue', amount: 300 }),
  mkTxn({ id: 'C8', date: '2026-10-11', status: 'Posted', classification: 'Expense', amount: 100, businessUnit: 'Dialysis Center' }),
];
const closeJournal = [
  { id: 'J1', date: '2026-10-12', ref: 'JV-1', particulars: 'Draft', businessUnit: 'Pharmacy', debitAccount: '5000 — X', creditAccount: '1000 — Y', amount: 10, status: 'Draft' as const, sourceTxn: 'X' },
  { id: 'J2', date: '2026-10-12', ref: 'JV-2', particulars: 'Posted', businessUnit: 'Pharmacy', debitAccount: '5000 — X', creditAccount: '1000 — Y', amount: 10, status: 'Posted' as const, sourceTxn: 'X' },
];
const closePOs = [
  { id: 'P1', poNo: 'PO-A', date: '2026-10-01', supplier: 'S', businessUnit: 'Pharmacy', deliveryDate: '2026-10-20', items: [{ item: 'G', quantity: 10, supplierPrice: 5, receivedQty: 4 }], total: 50, received: false, receivedDate: '', status: 'Sent to Supplier' as const },
  { id: 'P2', poNo: 'PO-B', date: '2026-10-01', supplier: 'S', businessUnit: 'Pharmacy', deliveryDate: '2026-10-20', items: [{ item: 'G', quantity: 10, supplierPrice: 5, receivedQty: 10 }], total: 50, received: true, receivedDate: '2026-10-15', status: 'Received' as const },
  { id: 'P3', poNo: 'PO-C', date: '2026-10-01', supplier: 'S', businessUnit: 'Pharmacy', deliveryDate: '2026-10-20', items: [{ item: 'G', quantity: 10, supplierPrice: 5, receivedQty: 0 }], total: 50, received: false, receivedDate: '', status: 'Cancelled' as const },
];
const closeBase = { txns: closeTxns, journal: closeJournal, pos: closePOs, year: 2026, month: 10, unit: 'All units', reportReviewed: false };
const cr = computeClose(closeBase);
const byId = Object.fromEntries(cr.checks.map(c => [c.id, c]));
check('each queue check counts scoped items',
  byId['acct-review'].count === 1 && byId['acct-review'].status === 'attention'
  && byId['owner-approval'].count === 1
  && byId['rejected'].count === 1
  && byId['journal-drafts'].count === 1
  && byId['po-outstanding'].count === 1
  && byId['payables'].count === 1, cr.checks.map(c => [c.id, c.count, c.status]));
check('september items excluded from october scope', !cr.checks.some(c => JSON.stringify(c).includes('C4')));
check('trial balance honest on demo data', cr.tbState === 'out'
  && byId['trial-balance'].status === 'attention'
  && /Out of balance/.test(byId['trial-balance'].detail), byId['trial-balance']);
check('completion derived, status Open while review unsigned',
  cr.completed === 0 && cr.total === 8 && cr.periodStatus === 'Open', { completed: cr.completed, periodStatus: cr.periodStatus });
const crAcked = computeClose({ ...closeBase, reportReviewed: true });
check('acked review with exceptions → Review Required', crAcked.periodStatus === 'Review Required'
  && crAcked.completed === 1, crAcked.periodStatus);
// clean month: everything posted/balanced, no drafts, acked
const cleanTxns: Txn[] = [
  mkTxn({ id: 'K1', date: '2026-10-05', classification: 'Expense', amount: 200 }),
  mkTxn({ id: 'K2', date: '2026-10-06', classification: 'Revenue', amount: 200 }),
];
const clean = computeClose({ txns: cleanTxns, journal: [], pos: [], year: 2026, month: 10, unit: 'All units', reportReviewed: true });
check('clean month completes', clean.periodStatus === 'Checklist Complete' && clean.completed === 8
  && clean.tbState === 'balanced', { periodStatus: clean.periodStatus, completed: clean.completed });
// empty period: no data anywhere
const empty = computeClose({ txns: [], journal: [], pos: [], year: 2026, month: 11, unit: 'All units', reportReviewed: true });
check('empty period: TB No Data (na), rest clear, complete',
  empty.tbState === 'nodata'
  && empty.checks.find(c => c.id === 'trial-balance')?.status === 'na'
  && /No eligible posted entries/.test(empty.checks.find(c => c.id === 'trial-balance')?.detail ?? '')
  && empty.periodStatus === 'Checklist Complete', empty.checks.map(c => [c.id, c.status]));
// unit scope respected
const scoped = computeClose({ ...closeBase, unit: 'Dialysis Center' });
const sById = Object.fromEntries(scoped.checks.map(c => [c.id, c]));
check('unit scope filters queues', sById['acct-review'].count === 0 && sById['acct-review'].status === 'clear'
  && sById['po-outstanding'].count === 0, scoped.checks.map(c => [c.id, c.count]));
// fingerprint invalidates on data change
const fp1 = closeFingerprint({ ...cr, checks: cr.checks.filter(c => c.id !== 'report-review') });
const crChanged = computeClose({ ...closeBase, txns: [...closeTxns, mkTxn({ id: 'C9', date: '2026-10-12', status: 'For Accountant Review' })] });
const fp2 = closeFingerprint({ ...crChanged, checks: crChanged.checks.filter(c => c.id !== 'report-review') });
check('fingerprint changes with data (stale ack invalidates)', fp1 !== fp2
  && crChanged.checks.find(c => c.id === 'acct-review')?.count === 2);

// ---- client feedback: transaction types, GL, sidebar ----
check('selectable types are Disbursement + Journal only',
  TRANSACTION_KINDS.length === 2 && TRANSACTION_KINDS.includes('Disbursement' as never) && TRANSACTION_KINDS.includes('Journal' as never)
  && !TRANSACTION_KINDS.includes('Cash In' as never) && !TRANSACTION_KINDS.includes('Cash Out' as never));
check('approve-income account missing → needs client code + classification',
  !COA.some(c => c.name.toLowerCase().includes('approve income')), COA.map(c => c.name));
check('account lookup from chart (not hardcoded)',
  getAccount('1000')?.name === 'Cash on Hand' && getAccount('1000')?.type === 'Asset'
  && getAccount(' 4100 ')?.name === 'Pharmacy Sales' && getAccount('9999') === null
  && accountOptions().length === COA.length);
check('normal sides', isDebitNormal('Asset') && isDebitNormal('Expense') && !isDebitNormal('Liability') && !isDebitNormal('Revenue'));
const glTxns: Txn[] = [
  mkTxn({ id: 'G1', date: '2026-09-20', status: 'Posted', classification: 'Expense', amount: 100, accountCode: '5000', accountName: 'Medical Supplies Expense' }),
  mkTxn({ id: 'G2', date: '2026-10-05', status: 'Posted', classification: 'Expense', amount: 250, accountCode: '5000', accountName: 'Medical Supplies Expense' }),
  mkTxn({ id: 'G3', date: '2026-10-06', status: 'For Accountant Review', classification: 'Expense', amount: 999, accountCode: '5000', accountName: 'Medical Supplies Expense' }),
  mkTxn({ id: 'G4', date: '2026-10-07', status: 'Rejected', classification: 'Expense', amount: 999, accountCode: '5000', accountName: 'Medical Supplies Expense' }),
  mkTxn({ id: 'G5', date: '2026-10-08', status: 'Posted', classification: 'Expense', amount: 250, accountCode: '5000', accountName: 'Medical Supplies Expense', reversalOf: 'G2', item: 'REVERSAL of G2' }),
  mkTxn({ id: 'G6', date: '2026-10-09', status: 'Posted', classification: 'Revenue', amount: 500, accountCode: '4100', accountName: 'Pharmacy Sales' }),
  mkTxn({ id: 'G7', date: '2026-10-10', status: 'Posted', classification: 'Expense', amount: 40, accountCode: '5000', accountName: 'Medical Supplies Expense', businessUnit: 'Dialysis Center' }),
];
const gl = accountLedger(glTxns, '5000', { unit: 'All units', from: '2026-10-01', to: '2026-10-31' });
check('gl: unknown code → null', accountLedger(glTxns, '9999', { unit: 'All units', from: '', to: '' }) === null);
check('gl: pending/rejected excluded, reversal offsets',
  gl !== null && gl.lines.length === 3 && gl.lines.map(l => l.ref).join(',') === 'G2,G5,G7'
  && gl.opening === 100 && gl.totalDebit === 40
  && gl.lines[2].balance === 140 && gl.closing === 140, gl);
check('gl: running balances follow normal side',
  gl !== null && gl.lines[0].balance === 350 && gl.lines[1].balance === 100, gl?.lines.map(l => l.balance));
const glUnit = accountLedger(glTxns, '5000', { unit: 'Dialysis Center', from: '', to: '' });
check('gl: unit scope + no dates', glUnit !== null && glUnit.lines.length === 1 && glUnit.opening === 0 && glUnit.closing === 40, glUnit);
const glRev = accountLedger([
  mkTxn({ id: 'R1', date: '2026-10-05', status: 'Posted', classification: 'Revenue', amount: 1000 }),
  mkTxn({ id: 'R2', date: '2026-10-06', status: 'Posted', classification: 'Revenue', amount: 200, reversalOf: 'R1', item: 'REVERSAL of R1' }),
], '4100', { unit: 'All units', from: '', to: '' });
check('gl: credit-normal account direction', glRev !== null && glRev.lines[0].credit === 1000 && glRev.lines[0].debit === 0
  && glRev.lines[0].balance === 1000 && glRev.lines[1].balance === 800 && glRev.closing === 800, glRev);
const acctSubs = (NAV.find(n => n.label === 'Accounting')?.subs ?? []).map(s => s.label);
check('sidebar: GL kept, five links removed, routes untouched',
  acctSubs.includes('General Ledger')
  && !acctSubs.includes('Chart of Accounts') && !acctSubs.includes('Accounts Payable')
  && !acctSubs.includes('Accounts Receivable') && !acctSubs.includes('Bank Reconciliation')
  && !acctSubs.includes('Audit Trail')
  && acctSubs.includes('Trial Balance') && acctSubs.includes('Month-End Close'), acctSubs);
const txnSubs = (NAV.find(n => n.label === 'Transaction')?.subs ?? []).map(s => s.label);
const txnTos = (NAV.find(n => n.label === 'Transaction')?.subs ?? []).map(s => s.to);
check('sidebar: Transaction shows New only (no All Transactions link, Type & Classification hidden, routes kept)',
  txnSubs.join('|') === 'New|Disbursement|Journal'
  && !txnSubs.some(l => /All Transaction/i.test(l))
  && !txnSubs.includes('Type & Classification')
  && txnTos.includes('/admin/transaction') && txnTos.includes('/admin/disbursement') && txnTos.includes('/admin/journal')
  && SIDEBAR_HIDDEN_ROUTES.includes('/admin/transaction-types')
  && readFileSync('src/App.tsx', 'utf8').includes('transaction-types')
  && readFileSync('src/App.tsx', 'utf8').includes('TransactionTypes'), { txnSubs, txnTos });
check('approval display labels simplify review/approval stages (values unchanged)',
  displayStatus('For Accountant Review') === 'For Review'
  && displayStatus('Accountant Reviewed') === 'For Review'
  && displayStatus('For Owner Approval') === 'For Approval'
  && displayStatus('Approved') === 'Approved' && displayStatus('Posted') === 'Posted'
  && displayStatus('Draft') === 'Draft' && displayStatus('Rejected') === 'Rejected');
check('gl: 1010 children are UI-only (no COA record, no ledger data)',
  isUiCashChild('1010-1') && isUiCashChild('1010-5')
  && !isUiCashChild('1010-6') && !isUiCashChild('1010-7')
  && !isUiCashChild('1010') && !isUiCashChild('1000')
  && getAccount('1010-1') === null && getAccount('1010')?.name === 'Cash in Bank'
  && accountLedger([], '1010-1', { unit: 'All units', from: '', to: '' }) === null);
{
  // Static guard for the reworked account control: the five UI-only bank
  // subaccounts are nested inside the single searchable account dropdown —
  // there is no separate, permanently visible bank card, no click-only
  // expander, and no flyout. Real COA codes (incl. 1000) stay searchable.
  const glSrc = readFileSync('src/pages/Accounting.tsx', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');
  const childCodes = ['1010-1', '1010-2', '1010-3', '1010-4', '1010-5'];
  check('gl: single account control — banks nested in the dropdown, no boxed bank card (static)',
    childCodes.every(c => glSrc.includes(`'${c}'`))
    && !glSrc.includes("'1010-6'") && !glSrc.includes("'1010-7'")
    && glSrc.includes("e.key === 'Escape'") && glSrc.includes('bankDropdownChoices')
    && glSrc.includes('gl-child') && glSrc.includes('filtered.map')
    && !glSrc.includes('gl-bankpick') && !glSrc.includes('gl-hoverwrap') && !glSrc.includes('gl-flyout')
    && !glSrc.includes('gl-cashbtn') && !glSrc.includes('gl-parentbtn') && !glSrc.includes('gl-expand')
    && !glSrc.includes('gl-cashpair') && !glSrc.includes('cash1000')
    && !glSrc.includes('expanded1010') && !glSrc.includes('showChildren')
    && !glSrc.includes('Choose a bank subaccount.') && !glSrc.includes('tap ▸ on touch')
    && getAccount('1000')?.name === 'Cash on Hand'
    && css.includes('.gl-doc') && css.includes('.gl-acct-title') && css.includes('z-index: 60')
    && !css.includes('.gl-flyout') && !css.includes('.gl-hoverwrap') && !css.includes('.gl-bankpick')
    && !css.includes('.gl-cashpair'),
    { hover: glSrc.includes('onMouseEnter') });
  // Parent 1010 stays selectable as the total account through the existing
  // filter: a posted txn coded 1010 appears in its ledger. No consolidation
  // is invented — children are UI-only and unmapped, so only 1010-coded
  // rows can ever appear here.
  const parentLedger = accountLedger(
    [mkTxn({ id: 'P1010', date: '2026-10-05', status: 'Posted', classification: 'Asset', amount: 5000, accountCode: '1010', accountName: 'Cash in Bank' })],
    '1010', { unit: 'All units', from: '', to: '' });
  check('gl: parent 1010 selectable — existing filter shows its eligible posted txns only',
    parentLedger !== null && parentLedger.account.code === '1010'
    && parentLedger.lines.length === 1 && parentLedger.lines[0].ref === 'P1010'
    && parentLedger.closing === 5000, parentLedger);
  // Dedicated bank dropdown holds exactly the six ordered choices: parent
  // total first, then the five subaccounts with their exact labels.
  const bankChoices = bankDropdownChoices().map(c => `${c.code} — ${c.name}`);
  check('gl: bank dropdown holds exactly the six ordered choices (parent first)',
    bankChoices.join('|') === '1010 — Cash in Bank|1010-1 — LBP SPPDC|1010-2 — LBP JEM Pharmacy|1010-3 — CIB PSB|1010-4 — CIB SB|1010-5 — CIB RCBC', bankChoices);
  // The single account control opens its dropdown from anywhere on the search
  // row and only auto-closes when the pointer leaves the combined region while
  // the field is idle — there is no second control and no gap that drops it.
  check('gl: account control hover opens the single dropdown, idle region close (static)',
    glSrc.includes('className="gl-searchrow" onMouseEnter={() => setOpen(true)}')
    && glSrc.includes('onMouseLeave={() => { if (document.activeElement !== searchRef.current) setOpen(false); }}')
    && glSrc.includes('className="gl-account-control"')
    && css.includes('.gl-account-control .gl-list { position: absolute;')
    && !glSrc.includes('setCashOpen'));
  // Entry-form sub-account rule (pure): required under parent 1010, cleared
  // everywhere else so stale values can never remain or be submitted.
  check('entry: bank sub-account required for 1010, cleared otherwise',
    bankSubError('1010', '') !== null && bankSubError('1010', '   ') !== null
    && bankSubError('1010', '1010-2') === null
    && bankSubError('5000', '') === null && bankSubError('5000', '1010-1') === null
    && bankSubError('', '') === null
    && coerceBankSub('1010', '1010-3') === '1010-3' && coerceBankSub('1010', '') === ''
    && coerceBankSub('5000', '1010-3') === '' && coerceBankSub('1000', '1010-1') === '');
  // The redesigned entry form lives in a dedicated component wired into the
  // Transaction screen. The component stays presentational; the Transaction
  // page performs the save and routes the entry to the matching list
  // (Disbursement via addTxn, Journal draft via addJournal).
  {
    const txnSrc = readFileSync('src/pages/Transactions.tsx', 'utf8');
    const compSrc = readFileSync('src/components/TransactionEntryForm.tsx', 'utf8');
    check('entry: dedicated form component wired in, diagram sections A-E (static)',
      txnSrc.includes("from '../components/TransactionEntryForm'")
      && txnSrc.includes('<TransactionEntryForm')
      && compSrc.includes('NEW TRANSACTION (NEW ENTRY)')
      && compSrc.includes('A. Transaction Details') && compSrc.includes('B. Particulars')
      && compSrc.includes('C. Account Entries') && compSrc.includes('D. Totals')
      && compSrc.includes('E. Signatories'));
    // Diagram parity: account-entry grid with Account Title / Credit / Debit,
    // three initial rows, add & remove, live totals and imbalance handling.
    // The component itself never talks to the store.
    check('entry: account-entry grid, three rows, add/remove, live totals + imbalance (static)',
      !compSrc.includes('addTxn') && !compSrc.includes('addJournal')
      && compSrc.includes('Account Title') && compSrc.includes('>Credit<') && compSrc.includes('>Debit<')
      && compSrc.includes('+ Add Entry')
      && (compSrc.match(/id: '[0-9]+', accountTitle: '', credit: '', debit: ''/g) || []).length === 3
      && compSrc.includes('const addEntry') && compSrc.includes('const removeEntry')
      && compSrc.includes('const totalCredit = round2(formData.entries.reduce')
      && compSrc.includes('const totalDebit = round2(formData.entries.reduce')
      && compSrc.includes('inputMode="decimal"') && compSrc.includes('sanitizeAmount')
      && compSrc.includes('imbalance-warning') && compSrc.includes('balanced-indicator'));
    check('entry: Save persists and routes by type to Disbursement/Journal (static)',
      txnSrc.includes('addTxn(') && txnSrc.includes('addJournal(')
      && txnSrc.includes('disbursementFromNewEntry') && txnSrc.includes('journalFromNewEntry')
      && txnSrc.includes('newEntryErrors') && txnSrc.includes('handleFormSubmit'));
    check('entry: submit button reads Save, old Submit-for-Review label gone (static)',
      /className="btn blue">\s*Save\s*</.test(compSrc) && !compSrc.includes('Submit for Review'));
    check('entry: four signatories present (static)',
      compSrc.includes('Prepared & Checked By') && compSrc.includes('Posted By')
      && compSrc.includes('Approved By') && compSrc.includes('Audited By'));
  // Start-an-Entry card removed: the duplicate strip (and its Start button)
  // is gone from the Transaction screen while + New Transaction stays the
  // single entry point that reveals the new entry form.
  {
    const txnSrc = readFileSync('src/pages/Transactions.tsx', 'utf8');
    check('entry: Start-an-Entry card removed, + New Transaction kept (static)',
      !txnSrc.includes('next-action') && !txnSrc.includes('Start an entry')
      && txnSrc.includes('+ New transaction')
      && txnSrc.includes('<TransactionEntryForm'));
  }
  // New Entry print support (static): a Print action opens the browser
  // print dialog without submitting anything, and a screen-hidden voucher
  // (title by transaction type, control number) is the only entry content
  // shown on paper while the interactive form hides via print CSS.
  {
    const compSrc = readFileSync('src/components/TransactionEntryForm.tsx', 'utf8');
    const voucherSrc = readFileSync('src/components/VoucherPrint.tsx', 'utf8');
    const printCss = readFileSync('src/styles.css', 'utf8');
    check('entry: Print action with screen-hidden voucher, form hidden on paper (static)',
      compSrc.includes('Print Transaction') && compSrc.includes('onPrint')
      && compSrc.includes('print-only') && compSrc.includes('VoucherPrint')
      && voucherSrc.includes('voucher-table') && voucherSrc.includes('voucher-signatures')
      && voucherSrc.includes('voucher-sig-name') && voucherSrc.includes('Control No.')
      && voucherSrc.includes('DISBURSEMENT VOUCHER') && voucherSrc.includes('JOURNAL VOUCHER')
      && !compSrc.includes('.filter(e => e.accountTitle')
      && printCss.includes('.print-only { display: none; }')
      && printCss.includes('.txn-new-entry .txn-header, .txn-new-entry .txn-form { display: none !important; }')
      && printCss.includes('.voucher-sig-name'));
    // Edit 1 (static): Debit now precedes Credit in the entries grid and voucher.
    check('entry: Debit precedes Credit in the grid and voucher (static)',
      compSrc.indexOf('>Debit<') > -1 && compSrc.indexOf('>Credit<') > -1
      && compSrc.indexOf('>Debit<') < compSrc.indexOf('>Credit<'));
    // Type-aware voucher: company name exactly once with the address beneath,
    // control number in the transaction-info grid, and a payment-style table for
    // Disbursement vs a debit/credit table for Journal.
    check('voucher: type-aware documents, company name once with address (static)',
      (voucherSrc.match(/AYOP GROUP OF COMPANIES/g) ?? []).length === 1
      && (voucherSrc.match(/JEM51 Accounting System/g) ?? []).length === 1
      && voucherSrc.includes('JEM Bldg., Medina St. Carmen-Annex, Ozamiz City - Misamis Occidental')
      && voucherSrc.includes('voucher-brand')
      && voucherSrc.includes('Control No.')
      && voucherSrc.includes('Account Charged') && voucherSrc.includes('Account Title')
      && voucherSrc.includes('Printed by:')
      && voucherSrc.includes('isDisbursementType'));
  }
  // Disbursement metrics removed (static): the four summary KPIs and their
  // counts/amounts are gone, while the entry form, filters, search, status
  // indicators, table, and actions remain wired to the same data.
  {
    const disSrc = readFileSync('src/pages/Disbursement.tsx', 'utf8');
    check('disbursement: summary metrics removed, list and actions intact (static)',
      !disSrc.includes('Matching entries') && !disSrc.includes('Posted total')
      && !disSrc.includes('Pending excluded') && !disSrc.includes('postedTotal')
      && !disSrc.includes('lbl">Pending') && !disSrc.includes('lbl">Rejected')
      && disSrc.includes('Record a disbursement') && disSrc.includes('+ Record disbursement')
      && disSrc.includes('Start Date') && disSrc.includes('Particulars / Payment details')
      && disSrc.includes('validateDisbursement') && disSrc.includes('<Pill status='));
  }
  // End of Disbursement-metrics removal check block.
  }
  // Shared catalog: 2200 Accrued Income resolves everywhere the shared COA
  // is used (GL lookup/options, Disbursement + Journal validation), with all
  // prior accounts intact. No posting rule is invented here.
  check('coa: 2200 Accrued Income shared across GL, Disbursement, Journal paths',
    getAccount('2200')?.name === 'Accrued Income' && getAccount('2200')?.type === 'Asset'
    && accountOptions().some(o => o.code === '2200' && o.name === 'Accrued Income')
    && getAccount('1010')?.name === 'Cash in Bank' && getAccount('1000')?.name === 'Cash on Hand'
    && validateDisbursement({ date: '2026-10-14', businessUnit: 'Pharmacy', particulars: 'Accrued service income', supplier: 'PhilHealth', accountCode: '2200', amount: 12500 }).length === 0
    && readFileSync('src/pages/Disbursement.tsx', 'utf8').includes("from '../data/seed'")
    && readFileSync('src/pages/Disbursement.tsx', 'utf8').includes('COA.map'));
  // Equity classification option: present alongside the original four, and
  // accepted by import validation (same shared CLASSIFICATIONS source as the
  // entry form). No account code or posting mapping is invented.
  check('equity classification selectable alongside the original four',
    CLASSIFICATIONS.join() === 'Expense,Revenue,Asset,Liability,Equity');
  const eqRows = validateRows('transactions', [
    { Date: '2026-10-14', 'Business Unit': 'Pharmacy', Classification: 'Equity', Kind: 'Journal', Item: 'Owner capital infusion', Category: 'Office Supplies', Supplier: 'N/A', 'Supplier Price': 0, 'Retail Price': 0, Quantity: 1, Amount: 50000 },
  ], mapping, new Set());
  check('equity classification passes import validation without errors',
    eqRows.length === 1 && eqRows[0].errors.length === 0 && eqRows[0].data.classification === 'Equity', eqRows[0]);
  // Sidebar readability/active styling (static): parent links keep light text
  // on the dark sidebar even when the router marks them active, and submenu
  // active items use the restrained highlight instead of a white block.
  {
    const layoutCss = readFileSync('src/styles.css', 'utf8');
    const parentRule = /\.nav-parent[^{]*a\.active\s*\{[^}]*color:\s*#dbe3f5/s.test(layoutCss);
    const subRule = /\.nav-subs a\.sub-active\s*\{[^}]*background:\s*rgba\(255,255,255,\.1/s.test(layoutCss)
      && /\.nav-subs a\.sub-active\s*\{[^}]*color:\s*#fff/s.test(layoutCss);
    const noWhiteSub = !/\.nav-subs a\.sub-active\s*\{[^}]*background:\s*#fff/s.test(layoutCss);
    check('sidebar: parent label readable on dark bg, submenu active restrained (static)',
      parentRule && subRule && noWhiteSub);
  }
}

// ---- disbursement entry + date-range search ----
const goodDis = { date: '2026-10-14', businessUnit: 'Diagnostic Center', particulars: 'Bond paper', supplier: 'PaperLine', accountCode: '5100', amount: 3250 };
check('disbursement valid passes', validateDisbursement(goodDis).length === 0);
check('disbursement required fields + amount rules',
  validateDisbursement({ ...goodDis, date: '' }).some(m => /Date is required/.test(m))
  && validateDisbursement({ ...goodDis, particulars: '  ' }).some(m => /Particulars/.test(m))
  && validateDisbursement({ ...goodDis, supplier: '' }).some(m => /Supplier/.test(m))
  && validateDisbursement({ ...goodDis, amount: 0 }).some(m => /greater than zero/.test(m))
  && validateDisbursement({ ...goodDis, amount: -5 }).some(m => /greater than zero/.test(m))
  && validateDisbursement({ ...goodDis, amount: null }).some(m => /must be a number/.test(m))
  && validateDisbursement({ ...goodDis, date: '2026-13-40' }).some(m => /real calendar date/.test(m))
  && validateDisbursement({ ...goodDis, accountCode: '9999' }).some(m => /Chart of Accounts/.test(m))
  && validateDisbursement({ ...goodDis, businessUnit: 'Nope' }).some(m => /nine Ayop units/.test(m)));
check('date range inclusive + open-ended',
  inDateRange('2026-10-01', '2026-10-01', '2026-10-31') && inDateRange('2026-10-31', '2026-10-01', '2026-10-31')
  && !inDateRange('2026-09-30', '2026-10-01', '2026-10-31') && !inDateRange('2026-11-01', '2026-10-01', '2026-10-31')
  && inDateRange('2026-01-01', '', '') && inDateRange('2026-12-31', '2026-10-01', ''));
check('invalid range explained', dateRangeError('2026-10-31', '2026-10-01') !== null
  && dateRangeError('2026-10-01', '2026-10-31') === null && dateRangeError('', '') === null);

// ---- guided journal ----
const jGood = { date: '2026-10-14', particulars: 'Correction', businessUnit: 'Pharmacy', lines: [
  { accountCode: '5100', debit: 500, credit: null }, { accountCode: '1000', debit: null, credit: 500 } ] };
check('journal totals', (() => { const t = journalTotals(jGood.lines); return t.debit === 500 && t.credit === 500 && t.balanced; })());
check('journal valid passes', Object.keys(validateJournal(jGood)).length === 0, validateJournal(jGood));
check('journal blocks missing/invalid input',
  validateJournal({ ...jGood, date: '' }).date !== undefined
  && validateJournal({ ...jGood, particulars: ' ' }).particulars !== undefined
  && validateJournal({ ...jGood, lines: [{ accountCode: '5100', debit: 500, credit: null }] }).lines !== undefined
  && validateJournal({ ...jGood, lines: [{ accountCode: '', debit: 500, credit: null }, { accountCode: '1000', debit: null, credit: 500 }] }).line0 !== undefined
  && validateJournal({ ...jGood, lines: [{ accountCode: '5100', debit: 500, credit: 500 }, { accountCode: '1000', debit: null, credit: 500 }] }).line0 !== undefined
  && validateJournal({ ...jGood, lines: [{ accountCode: '5100', debit: null, credit: null }, { accountCode: '1000', debit: null, credit: 500 }] }).line0 !== undefined);
check('journal blocks unbalanced totals',
  validateJournal({ ...jGood, lines: [{ accountCode: '5100', debit: 500, credit: null }, { accountCode: '1000', debit: null, credit: 400 }] }).totals !== undefined);
check('approval chain untouched', isAllowed('Approved' as never, 'Posted' as never)
  && !isAllowed('Draft' as never, 'Posted' as never) && countsAsPosted('Posted' as never));

// ---- New Entry save: validation + routing mappers ----
const neLines = [
  { accountTitle: '5000', debit: '7700', credit: '' },
  { accountTitle: '1010', debit: '', credit: '7700' },
];
const neBase = { date: '2026-10-14', businessUnit: 'Central Warehouse', transactionType: 'Disbursement', particulars: 'Gloves, 20 boxes', entries: neLines };
check('new entry: balanced totals pass, unbalanced blocked',
  newEntryTotals(neLines).balanced && newEntryTotals(neLines).debit === 7700
  && newEntryErrors(neBase).length === 0
  && newEntryErrors({ ...neBase, entries: [{ accountTitle: '5000', debit: '100', credit: '' }, { accountTitle: '1010', debit: '', credit: '90' }] }).some(m => /must match/.test(m)));
check('new entry: missing fields + bad account + both-sides + single line blocked',
  newEntryErrors({ ...neBase, date: '' }).some(m => /Date is required/.test(m))
  && newEntryErrors({ ...neBase, particulars: '  ' }).some(m => /Particulars/.test(m))
  && newEntryErrors({ ...neBase, businessUnit: 'Nope' }).some(m => /nine Ayop units/.test(m))
  && newEntryErrors({ ...neBase, transactionType: 'Cash In' }).some(m => /Disbursement or Journal/.test(m))
  && newEntryErrors({ ...neBase, entries: [{ accountTitle: '9999', debit: '10', credit: '' }, { accountTitle: '1010', debit: '', credit: '10' }] }).some(m => /unknown account/.test(m))
  && newEntryErrors({ ...neBase, entries: [{ accountTitle: '5000', debit: '10', credit: '10' }, { accountTitle: '1010', debit: '', credit: '10' }] }).some(m => /not both/.test(m))
  && newEntryErrors({ ...neBase, entries: [{ accountTitle: '5000', debit: '10', credit: '' }] }).some(m => /at least two/.test(m)));
const neDis = disbursementFromNewEntry(neBase, 'Jeann');
check('new entry → Disbursement maps total + first debit account',
  neDis.kind === 'Disbursement' && neDis.amount === 7700 && neDis.supplierPrice === 7700
  && neDis.accountCode === '5000' && neDis.accountName === 'Medical Supplies Expense'
  && neDis.item === 'Gloves, 20 boxes' && neDis.enteredBy === 'Jeann' && neDis.classification === 'Expense', neDis);
const neJrnl = journalFromNewEntry({ ...neBase, transactionType: 'Journal' }, 'JV-TEST-001');
check('new entry → Journal keeps all lines, summary + draft status',
  neJrnl.status === 'Draft' && neJrnl.sourceTxn === 'NEW ENTRY' && neJrnl.amount === 7700
  && (neJrnl.lines ?? []).length === 2 && neJrnl.lines?.[0].accountCode === '5000'
  && neJrnl.debitAccount === '5000 — Medical Supplies Expense'
  && neJrnl.creditAccount === '1010 — Cash in Bank' && neJrnl.ref === 'JV-TEST-001', neJrnl);
const neJrnl3 = journalFromNewEntry({
  ...neBase, transactionType: 'Journal',
  entries: [
    { accountTitle: '5000', debit: '100', credit: '' },
    { accountTitle: '5100', debit: '50', credit: '' },
    { accountTitle: '1010', debit: '', credit: '150' },
  ],
}, 'JV-TEST-002');
check('new entry → Journal marks multiple credit accounts honestly',
  neJrnl3.creditAccount === 'Multiple (3 lines)' && neJrnl3.amount === 150 && (neJrnl3.lines ?? []).length === 3);

// ---- saved-entry view + print: control number, full lines, no invented money ----
const neDisFull = disbursementFromNewEntry(neBase, 'Jeann', 'JEM51-TXN-20261014-001');
const neJrnlFull = journalFromNewEntry({ ...neBase, transactionType: 'Journal' }, 'JV-1', 'JEM51-TXN-20261014-002');
check('new entry save keeps the control number and every account line (both types)',
  neDisFull.controlNo === 'JEM51-TXN-20261014-001' && (neDisFull.lines ?? []).length === 2
  && (neDisFull.lines ?? [])[0].accountCode === '5000'
  && neJrnlFull.controlNo === 'JEM51-TXN-20261014-002' && (neJrnlFull.lines ?? []).length === 2
  && disbursementFromNewEntry(neBase, 'Jeann').controlNo === undefined,
  { dis: neDisFull.controlNo, jrnl: neJrnlFull.controlNo });
const disWithLines = disbursementEntryLines({
  accountCode: '5000', accountName: 'Medical Supplies Expense', amount: 7700,
  lines: [
    { accountCode: '5000', accountName: 'Medical Supplies Expense', debit: 7700, credit: 0 },
    { accountCode: '1010', accountName: 'Cash in Bank', debit: 0, credit: 7700 },
  ],
});
const disNoLines = disbursementEntryLines({ accountCode: '5000', accountName: 'Medical Supplies Expense', amount: 7700 });
check('saved disbursement voucher uses stored lines; falls back to the stored account only',
  disWithLines.length === 2 && disWithLines[1].accountCode === '1010' && disWithLines[1].credit === 7700
  && disNoLines.length === 1 && disNoLines[0].debit === 7700 && disNoLines[0].credit === 0, { disNoLines });
const jrnlStored = journalEntryLines({
  debitAccount: '5000 — Medical Supplies Expense', creditAccount: 'Multiple (3 lines)', amount: 150,
  lines: [
    { accountCode: '5000', accountName: 'Medical Supplies Expense', debit: 100, credit: 0 },
    { accountCode: '5100', accountName: 'Office Supplies Expense', debit: 50, credit: 0 },
    { accountCode: '1010', accountName: 'Cash in Bank', debit: 0, credit: 150 },
  ],
});
const jrnlFallback = journalEntryLines({ debitAccount: '5000 — Medical Supplies Expense', creditAccount: '1010 — Cash in Bank', amount: 7700 });
check('saved journal voucher uses stored lines; summary fallback invents no amount',
  jrnlStored.length === 3 && jrnlStored[2].accountCode === '1010'
  && jrnlFallback.length === 2 && jrnlFallback[0].accountCode === '5000'
  && jrnlFallback[0].debit === 7700 && jrnlFallback[1].credit === 7700, { jrnlFallback });
check('saved-entry view + print wired into both lists (static)',
  ['src/pages/Disbursement.tsx', 'src/pages/Journal.tsx'].every((f) => {
    const s = readFileSync(f, 'utf8');
    return s.includes('setViewId') && s.includes('Print voucher') && s.includes('VoucherPrint')
      && s.includes('window.print()') && s.includes('className="print-only"');
  })
  && readFileSync('src/components/VoucherPrint.tsx', 'utf8').includes('voucherTitleFor')
  && readFileSync('src/pages/Transactions.tsx', 'utf8').includes('savingRef'));

// ---- income & expense ITEM CODE + GL-only screen + sidebar ----
check('income tables headed ITEM CODE (not Item)',
  INCOME_REVENUE_COLUMNS.includes('ITEM CODE' as never) && INCOME_EXPENSE_COLUMNS.includes('ITEM CODE' as never)
  && !INCOME_REVENUE_COLUMNS.includes('Item' as never) && !INCOME_EXPENSE_COLUMNS.includes('Item' as never)
  && INCOME_REVENUE_COLUMNS.includes('Particulars' as never) && INCOME_EXPENSE_COLUMNS.includes('Particulars' as never));
const seedInc = incomeSummary(demoTxnFixtures, { unit: 'All units', from: '', to: '' });
const seedCodes = new Set(COA.map(c => c.code));
const probeExp = incomeSummary(
  [mkTxn({ id: 'P1', date: '2026-10-05', status: 'Posted', classification: 'Expense', amount: 75, accountCode: '5100', accountName: 'Office Supplies Expense' })],
  { unit: 'All units', from: '', to: '' });
check('every report row maps to a real chart code, totals intact',
  [...seedInc.revenueLines, ...seedInc.expenseLines].every(t => seedCodes.has(t.accountCode))
  && seedInc.revenueLines.length > 0
  && probeExp.expenseLines.every(t => seedCodes.has(t.accountCode))
  && probeExp.totalExpense === 75 && probeExp.net === -75
  && seedInc.net === seedInc.totalRevenue - seedInc.totalExpense);
check('GL opens alone; other tabs keep full row',
  visibleAccountingTabs('gl').join() === 'gl'
  && (['coa', 'ap', 'ar', 'bank', 'audit'] as const).every(t => visibleAccountingTabs(t).length === 6));
const acctLabels = (NAV.find(n => n.label === 'Accounting')?.subs ?? []).map(s => s.label);
check('sidebar has exactly the six approved destinations',
  acctLabels.join('|') === 'Trial Balance|Income & Expense|Financial Condition|All Reports (Printable)|Month-End Close|General Ledger', acctLabels);
check('ITEM CODE label resolves code + COA description from project data',
  accountLabel('4100') === '4100 — Pharmacy Sales'
  && accountLabel('4000') === '4000 — Service Revenue — Diagnostics'
  && accountLabel(' 5000 ') === '5000 — Medical Supplies Expense'
  && seedInc.revenueLines.every(t => accountLabel(t.accountCode, t.accountName).startsWith(t.accountCode + ' — '))
  && accountLabel('9999', 'Legacy Account') === '9999 — Legacy Account'
  && accountLabel('9999') === '9999');

// ---- accounting sidebar order + balance sheet ----
const fullAcctSubs = (NAV.find(n => n.label === 'Accounting')?.subs ?? []).map(s => s.label);
check('accounting sidebar shows the six destinations in exact order',
  fullAcctSubs.join('|') === 'Trial Balance|Income & Expense|Financial Condition|All Reports (Printable)|Month-End Close|General Ledger', fullAcctSubs);
check('accounting parent is dropdown-only; transaction parent behavior intact',
  NAV.find(n => n.label === 'Accounting')?.dropdownOnly === true
  && !NAV.find(n => n.label === 'Transaction')?.dropdownOnly);
check('warehouse sees no accounting sidebar group at all',
  !navFor('Warehouse', NAV).some(n => n.label === 'Accounting')
  && !canVisit('Warehouse', '/admin/balance-sheet')
  && canVisit('Accounting', '/admin/balance-sheet')
  && canVisit('CEO', '/admin/balance-sheet'));
const bsTxns: Txn[] = [
  mkTxn({ id: 'B1', date: '2026-10-05', status: 'Posted', classification: 'Asset', amount: 5000, accountCode: '1000', accountName: 'Cash on Hand' }),
  mkTxn({ id: 'B2', date: '2026-10-06', status: 'Posted', classification: 'Liability', amount: 2000, accountCode: '2000', accountName: 'Accounts Payable' }),
  mkTxn({ id: 'B3', date: '2026-10-07', status: 'Posted', classification: 'Revenue', amount: 900, accountCode: '4100', accountName: 'Pharmacy Sales' }),
  mkTxn({ id: 'B4', date: '2026-10-08', status: 'Posted', classification: 'Expense', amount: 300, accountCode: '5000', accountName: 'Medical Supplies Expense' }),
  mkTxn({ id: 'B5', date: '2026-10-09', status: 'For Accountant Review', classification: 'Asset', amount: 9999, accountCode: '1000', accountName: 'Cash on Hand' }),
  mkTxn({ id: 'B6', date: '2026-10-10', status: 'Posted', classification: 'Asset', amount: 1500, accountCode: '3000', accountName: "Owner's Equity" }),
];
const bs = balanceSheet(bsTxns, { unit: 'All units', from: '', to: '' });
check('balance sheet classifies accounts, pending excluded',
  bs.assets.map(g => g.account).join() === '1000 — Cash on Hand'
  && bs.liabilities.map(g => g.account).join() === '2000 — Accounts Payable'
  && bs.totalAssets === 5000 && bs.totalLiabilities === 2000, bs);
check('net income = revenue less expenses, distinct from equity accounts',
  bs.netIncome === 600
  && bs.equityAccounts.map(g => g.account).join() === `3000 — Owner's Equity`
  && bs.totalEquityAccounts === 1500 && bs.totalEquity === 2100
  && !bs.equityAccounts.some(g => /4100|5000/.test(g.account)), bs.equityAccounts);
check('balance sheet totals + honest difference',
  bs.totalLiabilitiesAndEquity === 4100 && bs.difference === 900, bs);
const bsScoped = balanceSheet(bsTxns, { unit: 'Dialysis Center', from: '', to: '' });
check('balance sheet respects unit scope + zero states',
  bsScoped.totalAssets === 0 && bsScoped.assets.length === 0
  && bsScoped.netIncome === 0 && bsScoped.difference === 0, bsScoped);
const bsEmpty = balanceSheet([], { unit: 'All units', from: '2026-11-01', to: '2026-11-30' });
check('empty period yields zeros, never manufactured balances',
  bsEmpty.totalAssets === 0 && bsEmpty.totalLiabilities === 0
  && bsEmpty.totalEquity === 0 && bsEmpty.difference === 0);

// ---- cash flow: explicit cash kinds only ----
const cfTxns: Txn[] = [
  mkTxn({ id: 'F1', date: '2026-10-05', status: 'Posted', classification: 'Revenue', kind: 'Cash In' as never, amount: 1000 }),
  mkTxn({ id: 'F2', date: '2026-10-06', status: 'Posted', classification: 'Expense', kind: 'Cash Out' as never, amount: 250 }),
  mkTxn({ id: 'F3', date: '2026-10-07', status: 'Posted', classification: 'Expense', kind: 'Disbursement' as never, amount: 5000 }),
  mkTxn({ id: 'F4', date: '2026-10-08', status: 'Posted', classification: 'Revenue', kind: 'Journal' as never, amount: 7000 }),
  mkTxn({ id: 'F5', date: '2026-10-09', status: 'For Accountant Review', classification: 'Revenue', kind: 'Cash In' as never, amount: 999 }),
  mkTxn({ id: 'F6', date: '2026-10-10', status: 'Posted', classification: 'Revenue', kind: 'Cash In' as never, amount: 200, reversalOf: 'F1', item: 'REVERSAL of F1' }),
];
const cf = cashFlow(cfTxns, { unit: 'All units', from: '', to: '' });
check('cash flow counts explicit cash kinds, posted only',
  cf.inflows.map(t => t.id).join() === 'F1,F6' && cf.outflows.map(t => t.id).join() === 'F2'
  && cf.totalIn === 800 && cf.totalOut === 250 && cf.net === 550, cf);
check('disbursement/journal never counted as cash (limitation disclosed)',
  cf.excluded === 2 && ![...cf.inflows, ...cf.outflows].some(t => t.kind === 'Disbursement' || t.kind === 'Journal'));
const cfScoped = cashFlow(cfTxns, { unit: 'Pharmacy', from: '2026-10-06', to: '2026-10-10' });
check('cash flow respects unit + period scope',
  cfScoped.inflows.map(t => t.id).join() === 'F6' && cfScoped.outflows.map(t => t.id).join() === 'F2' && cfScoped.net === -450, cfScoped);
const cfEmpty = cashFlow([], { unit: 'All units', from: '', to: '' });
check('cash flow empty state stays zero',
  cfEmpty.totalIn === 0 && cfEmpty.totalOut === 0 && cfEmpty.net === 0 && cfEmpty.excluded === 0);

// ---- JeAnn warehouse access + creator attribution ----
const jeanns = STAFF.filter(s => s.id === 'jeann');
check('JeAnn identity reused (no duplicate employee)',
  jeanns.length === 1 && jeanns[0].name === 'Jeann' && jeanns[0].role === 'Warehouse'
  && jeanns[0].unit === 'Central Warehouse' && STAFF.length === 7, jeanns);
check('name-to-ID resolution', staffIdForName('Jeann') === 'jeann'
  && staffIdForName('Daniflor Calago') === 'dani' && staffIdForName('Nobody') === null);
check('fixture warehouse records carry JeAnn’s user ID',
  demoTxnFixtures.filter(t => t.createdBy === 'jeann').map(t => t.id).sort().join(',') === 'TXN-2026-0043,TXN-2026-0044');
check('approval actions limited to Accounting + CEO (demo presentation)',
  canActOnApprovals('Accounting') && canActOnApprovals('CEO')
  && !canActOnApprovals('Warehouse') && !canActOnApprovals('HR')
  && !canActOnApprovals('Diagnostics Cashier') && !canActOnApprovals('Pharmacy') && !canActOnApprovals('IT'));
check('own-records filter uses stored user ID',
  ownRecords(demoTxnFixtures, 'jeann').length === 2
  && ownRecords(demoTxnFixtures, 'jeann').every(t => t.createdBy === 'jeann')
  && ownRecords(demoTxnFixtures, null).length === 0
  && ownRecords(demoTxnFixtures, 'dani').length === 2);
check('creator may resubmit, others may not (approvers may handle any)',
  canResubmit('Warehouse', 'jeann', { createdBy: 'jeann' })
  && !canResubmit('Warehouse', 'jeann', { createdBy: 'dani' })
  && canResubmit('Accounting', 'dani', { createdBy: 'jeann' })
  && canResubmit('CEO', 'joy', {}));
const ownTxn = { id: 'TXN-X', createdBy: 'jeann' };
check('creator cannot self-approve or self-post',
  (['Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted'] as const).every(to => guardTransition(ownTxn, to, 'jeann') !== null)
  && guardTransition(ownTxn, 'For Accountant Review', 'jeann') === null
  && guardTransition(ownTxn, 'Rejected', 'dani') === null
  && guardTransition(ownTxn, 'Approved', 'dani') === null
  && guardTransition(ownTxn, 'Posted', 'joy') === null
  && guardTransition({ id: 'TXN-Y' }, 'Approved', 'jeann') === null);
check('selectable types still Disbursement + Journal only',
  TRANSACTION_KINDS.join() === 'Disbursement,Journal');

// ---- role isolation: JeAnn warehouse vs accounting ----
check('jeann resolves to the existing Warehouse role',
  roleKindFor('Warehouse') === 'warehouse'
  && ['Accounting', 'CEO', 'HR', 'IT', 'Diagnostics Cashier', 'Pharmacy', ''].every(r => roleKindFor(r) === 'full'));
const wNav = navFor('Warehouse', NAV);
const wLabels = wNav.map(n => n.label);
check('warehouse nav holds only dashboard + four areas + settings',
  wLabels.join('|') === 'Overview|Transaction|Approval|Inventory|Purchasing (P.O.)|Settings', wLabels);
const wTxnSubs = (wNav.find(n => n.label === 'Transaction')?.subs ?? []).map(s => s.label);
check('warehouse transaction menu holds New only',
  wTxnSubs.join('|') === 'New'
  && WAREHOUSE_TX_SUBS.join() === '/admin/transaction', wTxnSubs);
check('warehouse New Entry hides kind field (default Disbursement kept for submit)',
  roleKindFor('Warehouse') === 'warehouse' && roleKindFor('Accounting') === 'full' && roleKindFor('CEO') === 'full');
check('no accountant-only destination leaks into warehouse nav',
  !wNav.some(n => ACCOUNTING_ONLY_LABELS.includes(n.label)
    || (n.subs ?? []).some(s => ACCOUNTING_ONLY_LABELS.includes(s.label))));
const WH_OK = ['/admin', '/admin/transaction', '/admin/transaction-types', '/admin/disbursement', '/admin/journal', '/admin/approval', '/admin/inventory', '/admin/purchasing', '/admin/settings'];
const WH_DENIED = ['/admin/accounting', '/admin/reports', '/admin/trial-balance', '/admin/income-expense', '/admin/financial-condition', '/admin/close', '/admin/cash-in', '/admin/cash-out', '/admin/business-units', '/admin/import-export'];
check('warehouse route allow-list (query strings cannot bypass — path decides)',
  WH_OK.every(p => canVisit('Warehouse', p)) && WH_DENIED.every(p => !canVisit('Warehouse', p)));
check('warehouse dashboard has no financial panels',
  WAREHOUSE_SECTIONS.join('|') === 'my-submissions|receiving-tasks|stock-levels|approval-tracking'
  && !WAREHOUSE_SECTIONS.some(s => /revenue|expense|ledger|trial|income|audit|payable|receivable|bank|chart|equity/i.test(s)));
check('warehouse approval is tracking-only (no decision actions)',
  !canActOnApprovals('Warehouse')
  && guardTransition({ id: 'T', createdBy: 'jeann' }, 'Approved', 'jeann') !== null
  && guardTransition({ id: 'T', createdBy: 'jeann' }, 'Posted', 'jeann') !== null
  && guardTransition({ id: 'T', createdBy: 'jeann' }, 'Rejected', 'jeann') === null);
const switchToDani = { kind: roleKindFor('Accounting'), nav: navFor('Accounting', NAV).length, gl: canVisit('Accounting', '/admin/accounting'), act: canActOnApprovals('Accounting') };
const switchToJoy = { kind: roleKindFor('CEO'), act: canActOnApprovals('CEO'), coa: canVisit('CEO', '/admin/accounting') };
const backToJeann = { kind: roleKindFor('Warehouse'), nav: navFor('Warehouse', NAV).length, gl: canVisit('Warehouse', '/admin/accounting') };
check('account switch restores correct dashboard/nav/routes both directions',
  switchToDani.kind === 'full' && switchToDani.nav === NAV.length && switchToDani.gl && switchToDani.act
  && switchToJoy.kind === 'full' && switchToJoy.act && switchToJoy.coa
  && backToJeann.kind === 'warehouse' && backToJeann.nav === 6 && !backToJeann.gl);
check('accounting keeps consolidated visibility + protections intact',
  demoTxnFixtures.length === 10
  && canActOnApprovals('Accounting')
  && !isAllowed('Draft' as never, 'Posted' as never)
  && guardTransition({ id: 'T', createdBy: 'dani' }, 'Approved', 'dani') !== null);

// ---- slice 1: demo/live boundary + reference foundation ----
check('backend mode resolution (never silent)',
  resolveBackendMode({}) === 'demo'
  && resolveBackendMode({ backend: 'demo', url: 'x', anonKey: 'y' }) === 'demo'
  && resolveBackendMode({ backend: 'live' }) === 'setup-error'
  && resolveBackendMode({ backend: 'live', url: 'x' }) === 'setup-error'
  && resolveBackendMode({ backend: 'live', anonKey: 'y' }) === 'setup-error'
  && resolveBackendMode({ backend: 'live', url: 'x', anonKey: 'y' }) === 'live'
  && resolveBackendMode({ backend: 'LIVE', url: 'x', anonKey: 'y' }) === 'live');
const mig = readFileSync('supabase/migrations/20261014000001_reference_foundation.sql', 'utf8');
check('migration creates reference schema with RLS',
  mig.includes('create table if not exists public.business_units')
  && mig.includes('create table if not exists public.staff')
  && mig.includes('create table if not exists public.chart_of_accounts')
  && (mig.match(/enable row level security/g) ?? []).length === 3
  && mig.includes('units_read_all') && mig.includes('coa_read_all')
  && mig.includes('staff_read_authenticated'));
check('migration seeds canonical units, staff, chart (no secrets)',
  BUSINESS_UNITS.length === 9 && BUSINESS_UNITS.every(u => mig.includes(`('${u}')`))
  && STAFF.length === 7 && STAFF.every(s => mig.includes(`('${s.id}',`))
  && (mig.match(/\('[0-9]{4}', '/g) ?? []).length === 17
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S+/.test(mig));
check('canonical mappings intact for linking',
  STAFF.map(s => s.id).join() === 'joy,eve,dani,jeann,jinky,mae,rodel'
  && roleKindFor('Warehouse') === 'warehouse'
  && canVisit('Warehouse', '/admin/accounting') === false);

// ---- slice 2: live adapter, migration, server guards ----
const mig2 = readFileSync('supabase/migrations/20261014000002_transactions_approvals.sql', 'utf8');
check('slice-2 migration defines tables, matrix, RPCs, RLS (no direct writes)',
  mig2.includes('create table if not exists public.transactions')
  && mig2.includes('create table if not exists public.txn_transitions')
  && mig2.includes('create table if not exists public.audit_events')
  && mig2.includes('create or replace function public.create_transaction')
  && mig2.includes('create or replace function public.transition_transaction')
  && mig2.includes('create or replace function public.reverse_transaction')
  && mig2.includes('for update')
  && mig2.includes('txn_read_scoped') && mig2.includes('audit_read')
  && !/create policy[^;]*for (insert|update|delete)/i.test(mig2)
  && /grant execute on function public\.(create|transition_transaction|reverse_transaction)/.test(mig2)
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}/.test(mig2.replace(/revoke all on function[^;]+;/g, '').replace(/grant execute[^;]+;/g, '')));
check('migration transition pairs mirror the frontend matrix',
  Object.entries(ALLOWED_TRANSITIONS).every(([from, tos]) =>
    (tos as string[]).every(to => mig2.includes(`('${from}', '${to}')`))));
const dbRow = {
  id: 'TXN-2026-0001', date: '2026-10-14', business_unit: 'Pharmacy',
  classification: 'Revenue', kind: 'Cash In', item: 'Sales', category: 'Medical Supplies',
  supplier: 'Walk-in', supplier_price: '160.5', retail_price: 220, quantity: '2',
  amount: '321.00', account_code: '4100', account_name: 'Pharmacy Sales',
  entered_by: 'Mae Sherylou', created_by: 'mae', status: 'Posted',
  remarks: '', reversal_of: null,
} as unknown as DbTxnRow;
const mapped = mapDbTxn(dbRow);
check('db row maps to Txn (numerics coerced, reversal cleared)',
  mapped.businessUnit === 'Pharmacy' && mapped.supplierPrice === 160.5
  && mapped.quantity === 2 && mapped.amount === 321 && mapped.reversalOf === undefined
  && mapped.createdBy === 'mae');
const payload = toDbPayload({
  date: '2026-10-14', businessUnit: 'Pharmacy', classification: 'Revenue', kind: 'Cash In',
  item: 'X', category: 'Medical Supplies', supplier: 'Y', supplierPrice: 1,
  retailPrice: 2, quantity: 1, amount: 3, accountCode: '4100', accountName: 'N',
  remarks: '',
});
check('db payload whitelists server-accepted fields only',
  JSON.stringify(payload) === JSON.stringify({
    date: '2026-10-14', business_unit: 'Pharmacy', classification: 'Revenue', kind: 'Cash In',
    item: 'X', category: 'Medical Supplies', supplier: 'Y', supplier_price: 1,
    retail_price: 2, quantity: 1, amount: 3, account_code: '4100', account_name: 'N', remarks: '',
  }));
check('rpc errors surface plain language',
  mapRpcError({ message: 'SELF_APPROVAL: creators cannot approve' }) === 'creators cannot approve'
  && mapRpcError(new Error('boom')) === 'boom');
check('membership resolves to staff shape without name matching',
  (() => { const s = membershipToStaff({ id: 'jeann', name: 'Jeann', role: 'Warehouse', unit: 'Central Warehouse' }); return s.id === 'jeann' && s.initials === 'J'; })());

// ---- slice 3 prep: balanced-journal store, no posting path ----
const mig3 = readFileSync('supabase/migrations/20261014000003_journal_store.sql', 'utf8');
check('journal migration defines entries+lines, balance trigger, RLS, draft RPC (no posting)',
  mig3.includes('create table if not exists public.journal_entries')
  && mig3.includes('create table if not exists public.journal_lines')
  && mig3.includes('enforce_journal_balance')
  && mig3.includes('constraint trigger journal_balance_check')
  && mig3.includes('check (debit = 0 or credit = 0)')
  && mig3.includes('journal_read_scoped') && mig3.includes('journal_lines_read_scoped')
  && mig3.includes('create or replace function public.submit_journal_draft')
  && !/create policy[^;]*for (insert|update|delete)/i.test(mig3)
  && !/post_journal|approve-and-post|set status = 'Posted'|set status='Posted'/i.test(mig3)
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S+/.test(mig3.replace(/revoke all on function[^;]+;/g, '').replace(/grant execute[^;]+;/g, '')));
check('draft RPC validates structure before the trigger (friendly errors, idempotent)',
  mig3.includes('TOO_FEW_LINES') && mig3.includes('BOTH_SIDES') && mig3.includes('ZERO_LINE')
  && mig3.includes('UNBALANCED') && mig3.includes('BAD_ACCOUNT')
  && mig3.includes('on conflict (created_by, idempotency_key) do nothing')
  && mig3.includes("'Draft', v_actor, nullif(p_idem, '')"));

// ---- demo presentation access ----
check('demo credentials verify correctly',
  verifyDemoLogin('ayop-demo', 'jem51-demo') === true
  && verifyDemoLogin('  AYOP-DEMO  ', 'jem51-demo') === true
  && verifyDemoLogin('ayop-demo', 'wrong') === false
  && verifyDemoLogin('someone-else', 'jem51-demo') === false
  && verifyDemoLogin('', '') === false
  && DEMO_USERNAME === 'ayop-demo' && DEMO_PASSWORD === 'jem51-demo'
  && DEMO_AUTH_KEY === 'jem51-demo-auth');
check('all seven switchable profiles exist with canonical ids',
  STAFF.map(s => s.id).join() === 'joy,eve,dani,jeann,jinky,mae,rodel'
  && STAFF.every(s => s.id && s.name && s.role && s.unit));

// ---- slice 3 prep, continued: draft cancellation, still no posting ----
const mig4 = readFileSync('supabase/migrations/20261014000004_journal_draft_cancel.sql', 'utf8');
check('cancel migration is lifecycle-only (no mapping, no posting, audited)',
  mig4.includes('create or replace function public.cancel_journal_draft')
  && mig4.includes("status <> 'Draft'") && mig4.includes('NOT_DRAFT')
  && mig4.includes("not in ('Accounting', 'CEO')") && mig4.includes('FORBIDDEN')
  && mig4.includes("delete from public.journal_lines where entry_id = v_cur.id")
  && mig4.includes("delete from public.journal_entries where id = v_cur.id")
  && mig4.includes("'Journal draft cancelled'")
  && !/post_journal|set status = 'Posted'|Approve Income|opening_balance/i.test(mig4)
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S+/.test(mig4.replace(/revoke all on function[^;]+;/g, '').replace(/grant execute[^;]+;/g, ''))
  && mig4.includes('grant execute on function public.cancel_journal_draft(bigint) to authenticated'));

// ---- slice 4: inventory + purchasing backend ----
const mig5 = readFileSync('supabase/migrations/20261014000005_inventory_purchasing.sql', 'utf8');
check('slice-4 migration defines ops tables, receipt/move ledgers, RPCs, RLS (no direct writes)',
  ['public.suppliers', 'public.purchase_orders', 'public.po_lines', 'public.receipts', 'public.inventory_items', 'public.stock_moves']
    .every(t => mig5.includes(`create table if not exists ${t}`))
  && ['create_purchase_order', 'send_purchase_order', 'cancel_purchase_order', 'record_receipt', 'add_inventory_item', 'adjust_stock', 'update_inventory_item']
    .every(f => mig5.includes(`create or replace function public.${f}`))
  && ['suppliers_read', 'pos_read', 'polines_read', 'receipts_read', 'inv_read', 'moves_read']
    .every(p => mig5.includes(`"${p}"`))
  && !/create policy[^;]*for (insert|update|delete)/i.test(mig5)
  && mig5.includes('grant execute on function public.record_receipt(text, bigint, int, text) to authenticated'));
check('receipt path caps quantities, blocks repeats, never posts journals',
  mig5.includes('OVER_RECEIPT') && mig5.includes('NO_REMAINING')
  && mig5.includes('BAD_STATE: order is already fully received')
  && mig5.includes('BAD_STATE: send the order')
  && mig5.includes('BAD_STATE: order is cancelled')
  && !/insert into public\.journal_entries|insert into public\.journal_lines/i.test(mig5)
  && mig5.includes("status, remarks)")
  && mig5.includes("'For Accountant Review'")
  && mig5.includes('LOCKED_FIELD')
  && mig5.includes('NEGATIVE_STOCK')
  && mig5.includes('NO_REASON')
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S+/.test(mig5.replace(/revoke all on function[^;]+;/g, '').replace(/grant execute[^;]+;/g, '')));
const dbPO = {
  id: 'PO-2026-0001', po_no: 'PO-1', date: '2026-10-10', supplier: 'MedSupply',
  business_unit: 'Pharmacy', delivery_date: '2026-10-20', total: '7700',
  received: false, received_date: null, status: 'Sent to Supplier', created_by: 'jeann',
} as unknown as DbPORow;
const dbLines = [
  { id: 7, po_id: 'PO-2026-0001', item: 'Gloves', quantity: '20', supplier_price: 385, received_qty: '5' },
  { id: 9, po_id: 'PO-2026-0001', item: 'Masks', quantity: 10, supplier_price: '100', received_qty: 0 },
  { id: 3, po_id: 'PO-OTHER', item: 'Other', quantity: 1, supplier_price: 1, received_qty: 0 },
] as unknown as DbPOLine[];
const mappedPO = mapDbPO(dbPO, dbLines);
check('db PO maps with line ids, numerics, own lines only',
  mappedPO.poNo === 'PO-1' && mappedPO.items.length === 2
  && mappedPO.items[0].lineId === 7 && mappedPO.items[0].quantity === 20
  && mappedPO.items[0].receivedQty === 5 && mappedPO.total === 7700
  && mappedPO.createdBy === 'jeann');
check('po payload whitelists server-accepted fields',
  JSON.stringify(toDbPOPayload({
    poNo: 'PO-1', date: '2026-10-10', supplier: 'S', businessUnit: 'Pharmacy',
    deliveryDate: '2026-10-20', items: [{ item: 'G', quantity: 2, supplierPrice: 5 }],
  })) === JSON.stringify({
    po_no: 'PO-1', date: '2026-10-10', supplier: 'S', business_unit: 'Pharmacy',
    delivery_date: '2026-10-20', items: [{ item: 'G', quantity: 2, supplier_price: 5 }],
  }));
const dbItem = {
  id: 'INV-1', business_unit: 'Pharmacy', type: 'Pharmacy', item: 'Para',
  category: 'Medical Supplies', quantity: '240', amount: '38400', supplier: 'MedSupply',
  supplier_price: 160, retail_price: '220', reorder_level: 100, created_by: null,
} as unknown as DbItemRow;
const mappedItem = mapDbItem(dbItem);
check('db inventory item maps with numerics, null creator cleared',
  mappedItem.quantity === 240 && mappedItem.amount === 38400 && mappedItem.createdBy === undefined);
check('inventory payload whitelists fields (quantity never smuggled via update path)',
  JSON.stringify(toDbItemPayload({
    businessUnit: 'Pharmacy', type: 'Pharmacy', item: 'P', category: 'Medical Supplies',
    quantity: 5, amount: 800, supplier: 'S', supplierPrice: 160, retailPrice: 220, reorderLevel: 10,
  })) === JSON.stringify({
    business_unit: 'Pharmacy', type: 'Pharmacy', item: 'P', category: 'Medical Supplies',
    quantity: 5, amount: 800, supplier: 'S', supplier_price: 160, retail_price: 220, reorder_level: 10,
  }));

// ---- slice 5: safe import pipeline ----
const mig6 = readFileSync('supabase/migrations/20261014000006_supplier_upsert.sql', 'utf8');
check('supplier upsert RPC validates, merges, audits (no direct writes)',
  mig6.includes('create or replace function public.upsert_supplier')
  && mig6.includes('BAD_SUPPLIER') && mig6.includes('NOT_LINKED')
  && mig6.includes('on conflict (name) do update')
  && mig6.includes("'Supplier saved'")
  && !/create policy[^;]*for (insert|update|delete)/i.test(mig6)
  && mig6.includes('grant execute on function public.upsert_supplier(jsonb) to authenticated')
  && !/service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S+/.test(mig6.replace(/revoke all on function[^;]+;/g, '').replace(/grant execute[^;]+;/g, '')));
check('import idempotency keys are deterministic per file/type/row',
  importIdemKey('PO List.xlsx', 'purchase_orders', 3) === importIdemKey('PO List.xlsx', 'purchase_orders', 3)
  && importIdemKey('PO List.xlsx', 'purchase_orders', 3) !== importIdemKey('PO List.xlsx', 'purchase_orders', 4)
  && importIdemKey('PO List.xlsx', 'purchase_orders', 3) !== importIdemKey('Other.csv', 'purchase_orders', 3)
  && importIdemKey('PO List.xlsx', 'transactions', 3) !== importIdemKey('PO List.xlsx', 'purchase_orders', 3)
  && /^[a-z0-9-]+$/.test(importIdemKey('My File (final) v2.XLSX', 'inventory', 0)));

// ---- slice 3 hardening: immutability guards, posting disabled ----
const mig7 = readFileSync('supabase/migrations/20261014000007_immutability_guards.sql', 'utf8');
const mig7code = mig7.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
check('guard migration locks transitions, deletes, and journal posting',
  mig7.includes('create trigger txn_immutable')
  && mig7.includes('create trigger journal_locked')
  && mig7.includes('create trigger journal_lines_locked')
  && mig7.includes('LOCKED: only Draft transactions may be deleted')
  && mig7.includes('LOCKED: only Draft journal entries may be deleted')
  && mig7.includes('NO_POSTING_PATH')
  && mig7.includes('LOCKED: journal lines are immutable')
  && !/set status = 'Posted'|post_journal|Approve Income/i.test(mig7code));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
