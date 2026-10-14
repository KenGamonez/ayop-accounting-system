// Frontend self-test for import/export logic. Run: node scripts/selftest.ts
import * as XLSX from 'xlsx';
import { DATA_TYPES, autoMap, validateRows, dupKey, toCSV, fileName, sheetsToCsvUrl } from '../src/data/io.ts';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
