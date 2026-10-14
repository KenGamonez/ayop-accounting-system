// Frontend self-test for import/export logic. Run: node scripts/selftest.ts
import * as XLSX from 'xlsx';
import { DATA_TYPES, autoMap, validateRows, dupKey, toCSV, fileName, sheetsToCsvUrl } from '../src/data/io.ts';
import { applyReceipt, derivePOStatus, defaultInventoryTypeFor, lineRemaining, isAllowed, nextRoleFor, nextTxnId, countsAsPosted, ALLOWED_TRANSITIONS } from '../src/data/ops.ts';
import { postedIn, signedAmount, sumByClass, trialBalance, incomeSummary, conditionSummary } from '../src/data/finance.ts';
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
