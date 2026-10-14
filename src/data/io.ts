// Reusable import/export logic for the JEM51 frontend phase.
// Pure functions only (no DOM, no React) so a later backend phase can reuse
// the same validation and mapping concepts. All demo — nothing persists to a
// real database.

import {
  BUSINESS_UNITS,
  CLASSIFICATIONS,
  COA,
  ITEM_CATEGORIES,
  INVENTORY_TYPES,
} from './seed';

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  aliases: string[];
}

export interface DataTypeDef {
  id: DataType;
  label: string;
  short: string;
  description: string;
  controlled?: boolean;
  fields: FieldDef[];
  templateRow: Record<string, string | number>;
}

export type DataType =
  | 'transactions'
  | 'inventory'
  | 'suppliers'
  | 'purchase_orders'
  | 'opening_balances';

export const UNITS = [...BUSINESS_UNITS];
export const CLASSES = [...CLASSIFICATIONS];
export const CATS = [...ITEM_CATEGORIES];
export const ITYPES = [...INVENTORY_TYPES];
export const COA_CODES = COA.map(c => c.code);

export const DATA_TYPES: DataTypeDef[] = [
  {
    id: 'transactions',
    label: 'Transactions',
    short: 'Cash, disbursement & journal entries',
    description: 'Ordinary entries. Everything imports as “For Accountant Review” — imports can never bypass approval or post directly.',
    fields: [
      { key: 'date', label: 'Date', required: true, hint: 'YYYY-MM-DD', aliases: ['date', 'trandate', 'txndate'] },
      { key: 'businessUnit', label: 'Business Unit', required: true, hint: 'One of the 9 official units', aliases: ['businessunit', 'unit', 'branch', 'department'] },
      { key: 'classification', label: 'Classification', required: true, hint: 'Expense, Revenue, Asset, Liability', aliases: ['classification', 'type', 'trxclass'] },
      { key: 'kind', label: 'Kind', required: false, hint: 'Cash In, Cash Out, Disbursement, Journal', aliases: ['kind', 'transactiontype', 'trxtype', 'cashflow'] },
      { key: 'item', label: 'Item', required: true, hint: 'Item name (not Description)', aliases: ['item', 'description', 'particulars', 'details'] },
      { key: 'category', label: 'Category', required: false, hint: 'Medical Supplies, Medical Equipment, Office Supplies', aliases: ['category', 'itemcategory'] },
      { key: 'supplier', label: 'Supplier', required: true, hint: 'Supplier (not Counterpart)', aliases: ['supplier', 'counterpart', 'vendor', 'payee', 'client'] },
      { key: 'supplierPrice', label: 'Supplier Price', required: false, hint: 'Number', aliases: ['supplierprice', 'unitcost', 'cost', 'price'] },
      { key: 'retailPrice', label: 'Retail Price', required: false, hint: 'Number', aliases: ['retailprice', 'srp', 'sellingprice'] },
      { key: 'quantity', label: 'Quantity', required: false, hint: 'Whole number, default 1', aliases: ['quantity', 'qty', 'pieces'] },
      { key: 'amount', label: 'Amount', required: false, hint: 'Total ₱ (computed from Supplier Price × Qty if blank)', aliases: ['amount', 'total', 'totalamount'] },
    ],
    templateRow: { Date: '2026-10-14', 'Business Unit': 'Diagnostic Center', Classification: 'Expense', Kind: 'Disbursement', Item: 'CBC reagent kit, 10 boxes', Category: 'Medical Supplies', Supplier: 'LabServe Inc.', 'Supplier Price': 2500, 'Retail Price': 3400, Quantity: 10, Amount: 25000 },
  },
  {
    id: 'inventory',
    label: 'Inventory',
    short: 'Stock levels by unit & type',
    description: 'New items are added; matches on Item + Business Unit are flagged as duplicates with Skip / Add-new / Update choices. Nothing is silently overwritten.',
    fields: [
      { key: 'businessUnit', label: 'Business Unit', required: true, hint: 'One of the 9 official units', aliases: ['businessunit', 'unit', 'branch'] },
      { key: 'type', label: 'Type', required: true, hint: 'Laboratory, Pharmacy, Dialysis, Admin', aliases: ['type', 'inventorytype', 'stocktype'] },
      { key: 'item', label: 'Item', required: true, hint: 'Item name', aliases: ['item', 'description', 'product', 'stockitem'] },
      { key: 'category', label: 'Category', required: false, hint: 'Defaults to Medical Supplies', aliases: ['category'] },
      { key: 'quantity', label: 'Quantity', required: true, hint: 'Whole number ≥ 0', aliases: ['quantity', 'qty', 'stock', 'onhand'] },
      { key: 'supplier', label: 'Supplier', required: true, hint: 'Supplier name', aliases: ['supplier', 'vendor'] },
      { key: 'supplierPrice', label: 'Supplier Price', required: false, hint: 'Number', aliases: ['supplierprice', 'unitcost', 'cost'] },
      { key: 'retailPrice', label: 'Retail Price', required: false, hint: 'Number', aliases: ['retailprice', 'srp'] },
      { key: 'amount', label: 'Amount', required: false, hint: 'Stock value (computed if blank)', aliases: ['amount', 'totalvalue', 'value'] },
      { key: 'reorderLevel', label: 'Reorder Level', required: false, hint: 'Whole number, default 10', aliases: ['reorderlevel', 'reorder', 'minimum'] },
    ],
    templateRow: { 'Business Unit': 'Pharmacy', Type: 'Pharmacy', Item: 'Paracetamol 500mg, 100s', Category: 'Medical Supplies', Quantity: 240, Supplier: 'MedSupply Trading', 'Supplier Price': 160, 'Retail Price': 220, Amount: 38400, 'Reorder Level': 100 },
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    short: 'Supplier directory',
    description: 'Supplier names and contact details for the directory and purchase orders.',
    fields: [
      { key: 'supplier', label: 'Supplier', required: true, hint: 'Supplier name', aliases: ['supplier', 'suppliername', 'vendor', 'name'] },
      { key: 'contact', label: 'Contact Person', required: false, hint: '', aliases: ['contact', 'contactperson'] },
      { key: 'phone', label: 'Phone', required: false, hint: '', aliases: ['phone', 'contactno', 'mobile'] },
      { key: 'address', label: 'Address', required: false, hint: '', aliases: ['address', 'location'] },
      { key: 'terms', label: 'Terms', required: false, hint: 'e.g. 30-day, COD', aliases: ['terms', 'paymentterms'] },
    ],
    templateRow: { Supplier: 'MedSupply Trading', 'Contact Person': 'J. Cruz', Phone: '0917-000-0000', Address: 'Bislig City', Terms: '30-day' },
  },
  {
    id: 'purchase_orders',
    label: 'Purchase Orders',
    short: 'Supplier, delivery date & lines',
    description: 'Rows sharing the same P.O. No. become one order. Imports arrive as Draft orders awaiting receiving.',
    fields: [
      { key: 'poNo', label: 'P.O. No.', required: true, hint: 'Rows with the same no. merge into one order', aliases: ['pono', 'po', 'ponumber', 'orderno'] },
      { key: 'date', label: 'Date', required: true, hint: 'YYYY-MM-DD', aliases: ['date', 'podate'] },
      { key: 'supplier', label: 'Supplier', required: true, hint: 'Supplier name', aliases: ['supplier', 'vendor'] },
      { key: 'businessUnit', label: 'Business Unit', required: true, hint: 'One of the 9 official units', aliases: ['businessunit', 'unit'] },
      { key: 'deliveryDate', label: 'Delivery Date', required: true, hint: 'Date of Delivery, YYYY-MM-DD', aliases: ['deliverydate', 'dateofdelivery', 'delivery', 'eta'] },
      { key: 'item', label: 'Item', required: true, hint: 'Item name', aliases: ['item', 'description', 'product'] },
      { key: 'quantity', label: 'Quantity', required: true, hint: 'Whole number > 0', aliases: ['quantity', 'qty'] },
      { key: 'supplierPrice', label: 'Supplier Price', required: true, hint: 'Number ≥ 0', aliases: ['supplierprice', 'unitprice', 'price', 'cost'] },
    ],
    templateRow: { 'P.O. No.': 'PO-2026-0191', Date: '2026-10-14', Supplier: 'MedSupply Trading', 'Business Unit': 'Central Warehouse', 'Delivery Date': '2026-10-20', Item: 'Surgical gloves (latex)', Quantity: 20, 'Supplier Price': 385 },
  },
  {
    id: 'opening_balances',
    label: 'Opening Balances',
    short: 'Controlled accounting import',
    description: 'CONTROLLED import: enters as Draft journal lines for accountant validation. Blocked unless total debits equal total credits.',
    controlled: true,
    fields: [
      { key: 'accountCode', label: 'Account Code', required: true, hint: 'Must exist in Chart of Accounts', aliases: ['accountcode', 'code', 'acctcode'] },
      { key: 'businessUnit', label: 'Business Unit', required: true, hint: 'One of the 9 official units', aliases: ['businessunit', 'unit'] },
      { key: 'date', label: 'Date', required: true, hint: 'Opening date, YYYY-MM-DD', aliases: ['date', 'openingdate'] },
      { key: 'particulars', label: 'Particulars', required: false, hint: 'Defaults to “Opening balance”', aliases: ['particulars', 'item', 'description', 'memo'] },
      { key: 'debit', label: 'Debit', required: false, hint: 'Number (one of Debit / Credit must be > 0)', aliases: ['debit', 'dr'] },
      { key: 'credit', label: 'Credit', required: false, hint: 'Number', aliases: ['credit', 'cr'] },
    ],
    templateRow: { 'Account Code': '1000', 'Business Unit': 'Diagnostic Center', Date: '2026-10-01', Particulars: 'Opening balance — Cash on Hand', Debit: 50000, Credit: 0 },
  },
];

// ---------- header normalization & auto-mapping ----------

export function normHeader(h: string): string {
  return (h ?? '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function autoMap(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of fields) {
    const candidates = [f.key, f.label, ...f.aliases].map(normHeader);
    const hit = headers.find(h => !used.has(h) && candidates.includes(normHeader(h)));
    if (hit) { map[f.key] = hit; used.add(hit); }
  }
  return map;
}

// ---------- value helpers ----------

export function isValidDate(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (v instanceof Date && !isNaN(v.getTime())) return true;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    return !isNaN(d.getTime());
  }
  const d = new Date(s);
  return !isNaN(d.getTime());
}

export function toISODate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = Number(String(v).replace(/₱/g, '').replace(/,/g, '').trim());
  return isFinite(n) ? n : null;
}

function matchList(v: string, list: string[]): string | null {
  const t = v.trim().toLowerCase();
  return list.find(x => x.toLowerCase() === t) ?? null;
}

// ---------- row validation ----------

export interface RowIssue { row: number; field: string; message: string }
export interface ValidatedRow {
  index: number;
  data: Record<string, unknown>;
  errors: RowIssue[];
  warnings: string[];
  duplicateOf?: string;
}

export function validateRows(
  type: DataType,
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  existingKeys: Set<string>,
): ValidatedRow[] {
  const seen = new Set<string>();
  return rows.map((src, i) => {
    const rowNo = i + 2; // 1-based + header row
    const get = (key: string): unknown => {
      const h = mapping[key];
      if (!h) return undefined;
      const v = src[h];
      return typeof v === 'string' ? v.trim() : v;
    };
    const errors: RowIssue[] = [];
    const warnings: string[] = [];
    const data: Record<string, unknown> = {};
    const need = (key: string, label: string) => {
      const v = get(key);
      if (v === undefined || v === null || v === '') errors.push({ row: rowNo, field: label, message: `${label} is required.` });
      return v;
    };

    if (type === 'transactions') {
      const date = need('date', 'Date');
      if (date && !isValidDate(date)) errors.push({ row: rowNo, field: 'Date', message: `"${date}" is not a readable date (use YYYY-MM-DD).` });
      else if (date) data.date = toISODate(date);
      const unit = need('businessUnit', 'Business Unit');
      if (unit) {
        const m = matchList(String(unit), UNITS);
        if (!m) errors.push({ row: rowNo, field: 'Business Unit', message: `"${unit}" is not one of the 9 official business units.` });
        else data.businessUnit = m;
      }
      const cls = need('classification', 'Classification');
      if (cls) {
        const m = matchList(String(cls), CLASSES);
        if (!m) errors.push({ row: rowNo, field: 'Classification', message: `"${cls}" must be Expense, Revenue, Asset, or Liability.` });
        else data.classification = m;
      }
      const kind = String(get('kind') ?? 'Disbursement').trim();
      const km = matchList(kind, ['Cash In', 'Cash Out', 'Disbursement', 'Journal']);
      if (!km) errors.push({ row: rowNo, field: 'Kind', message: `"${kind}" must be Cash In, Cash Out, Disbursement, or Journal.` });
      else { data.kind = km; if (!mapping.kind) warnings.push('Kind column not mapped — defaulted to Disbursement.'); }
      data.item = need('item', 'Item');
      const cat = String(get('category') ?? 'Medical Supplies').trim();
      const cm = matchList(cat, CATS);
      if (!cm) errors.push({ row: rowNo, field: 'Category', message: `"${cat}" must be Medical Supplies, Medical Equipment, or Office Supplies.` });
      else { data.category = cm; if (!mapping.category) warnings.push('Category column not mapped — defaulted to Medical Supplies.'); }
      data.supplier = need('supplier', 'Supplier');
      const sp = toNum(get('supplierPrice')); const rp = toNum(get('retailPrice'));
      const qty = toNum(get('quantity')); let amt = toNum(get('amount'));
      if (sp !== null && sp < 0) errors.push({ row: rowNo, field: 'Supplier Price', message: 'Supplier Price cannot be negative.' });
      if (qty !== null && (!Number.isInteger(qty) || qty < 0)) errors.push({ row: rowNo, field: 'Quantity', message: 'Quantity must be a whole number ≥ 0.' });
      if (amt !== null && amt < 0) errors.push({ row: rowNo, field: 'Amount', message: 'Amount cannot be negative.' });
      data.supplierPrice = sp ?? 0; data.retailPrice = rp ?? 0; data.quantity = qty ?? 1;
      if (amt === null && sp !== null) { amt = sp * (qty ?? 1); warnings.push(`Amount computed as Supplier Price × Quantity = ${amt.toLocaleString()}.`); }
      if (amt === null) errors.push({ row: rowNo, field: 'Amount', message: 'Amount is required (or give Supplier Price and Quantity).' });
      else data.amount = amt;
    }

    if (type === 'inventory') {
      const unit = need('businessUnit', 'Business Unit');
      if (unit) {
        const m = matchList(String(unit), UNITS);
        if (!m) errors.push({ row: rowNo, field: 'Business Unit', message: `"${unit}" is not one of the 9 official business units.` });
        else data.businessUnit = m;
      }
      const ty = need('type', 'Type');
      if (ty) {
        const m = matchList(String(ty), ITYPES);
        if (!m) errors.push({ row: rowNo, field: 'Type', message: `"${ty}" must be Laboratory, Pharmacy, Dialysis, or Admin.` });
        else data.type = m;
      }
      data.item = need('item', 'Item');
      const cat = String(get('category') ?? 'Medical Supplies').trim();
      const cm = matchList(cat, CATS);
      if (!cm) errors.push({ row: rowNo, field: 'Category', message: `"${cat}" is not a known item category.` });
      else data.category = cm;
      const qty = need('quantity', 'Quantity');
      const qn = toNum(qty);
      if (qn !== null && (!Number.isInteger(qn) || qn < 0)) errors.push({ row: rowNo, field: 'Quantity', message: 'Quantity must be a whole number ≥ 0.' });
      else if (qn !== null) data.quantity = qn;
      data.supplier = need('supplier', 'Supplier');
      const sp = toNum(get('supplierPrice')) ?? 0; const rp = toNum(get('retailPrice')) ?? 0;
      let amt = toNum(get('amount'));
      if (sp < 0 || rp < 0) errors.push({ row: rowNo, field: 'Price', message: 'Prices cannot be negative.' });
      if (amt === null && data.quantity !== undefined) { amt = sp * (data.quantity as number); if (sp > 0) warnings.push('Amount computed from Supplier Price × Quantity.'); }
      data.supplierPrice = sp; data.retailPrice = rp; data.amount = amt ?? 0;
      const rl = toNum(get('reorderLevel'));
      data.reorderLevel = rl === null ? 10 : Math.max(0, Math.floor(rl));
    }

    if (type === 'suppliers') {
      data.supplier = need('supplier', 'Supplier');
      data.contact = get('contact') ?? '';
      data.phone = get('phone') ?? '';
      data.address = get('address') ?? '';
      data.terms = get('terms') ?? '';
    }

    if (type === 'purchase_orders') {
      data.poNo = need('poNo', 'P.O. No.');
      const date = need('date', 'Date');
      if (date && !isValidDate(date)) errors.push({ row: rowNo, field: 'Date', message: `"${date}" is not a readable date.` });
      else if (date) data.date = toISODate(date);
      data.supplier = need('supplier', 'Supplier');
      const unit = need('businessUnit', 'Business Unit');
      if (unit) {
        const m = matchList(String(unit), UNITS);
        if (!m) errors.push({ row: rowNo, field: 'Business Unit', message: `"${unit}" is not one of the 9 official business units.` });
        else data.businessUnit = m;
      }
      const dd = need('deliveryDate', 'Delivery Date');
      if (dd && !isValidDate(dd)) errors.push({ row: rowNo, field: 'Delivery Date', message: `"${dd}" is not a readable date.` });
      else if (dd) data.deliveryDate = toISODate(dd);
      data.item = need('item', 'Item');
      const qty = need('quantity', 'Quantity');
      const qn = toNum(qty);
      if (qn !== null && (!Number.isInteger(qn) || qn <= 0)) errors.push({ row: rowNo, field: 'Quantity', message: 'Quantity must be a whole number greater than 0.' });
      else if (qn !== null) data.quantity = qn;
      const sp = need('supplierPrice', 'Supplier Price');
      const sn = toNum(sp);
      if (sn !== null && sn < 0) errors.push({ row: rowNo, field: 'Supplier Price', message: 'Supplier Price cannot be negative.' });
      else if (sn !== null) data.supplierPrice = sn;
    }

    if (type === 'opening_balances') {
      const code = need('accountCode', 'Account Code');
      if (code) {
        const c = String(code).trim();
        if (!COA_CODES.includes(c)) errors.push({ row: rowNo, field: 'Account Code', message: `"${c}" is not in the Chart of Accounts.` });
        else data.accountCode = c;
      }
      const unit = need('businessUnit', 'Business Unit');
      if (unit) {
        const m = matchList(String(unit), UNITS);
        if (!m) errors.push({ row: rowNo, field: 'Business Unit', message: `"${unit}" is not one of the 9 official business units.` });
        else data.businessUnit = m;
      }
      const date = need('date', 'Date');
      if (date && !isValidDate(date)) errors.push({ row: rowNo, field: 'Date', message: `"${date}" is not a readable date.` });
      else if (date) data.date = toISODate(date);
      data.particulars = String(get('particulars') ?? 'Opening balance').trim() || 'Opening balance';
      const dr = toNum(get('debit')) ?? 0; const cr = toNum(get('credit')) ?? 0;
      if (dr < 0 || cr < 0) errors.push({ row: rowNo, field: 'Debit/Credit', message: 'Debit and Credit cannot be negative.' });
      if (dr === 0 && cr === 0) errors.push({ row: rowNo, field: 'Debit/Credit', message: 'One of Debit or Credit must be greater than 0.' });
      if (dr > 0 && cr > 0) errors.push({ row: rowNo, field: 'Debit/Credit', message: 'Use only one side per row (Debit or Credit, not both).' });
      data.debit = dr; data.credit = cr;
    }

    // duplicate detection (within file + against existing demo records)
    const key = dupKey(type, data);
    let duplicateOf: string | undefined;
    if (key && errors.length === 0) {
      if (seen.has(key)) duplicateOf = 'Duplicate of another row in this file.';
      else if (existingKeys.has(key)) duplicateOf = 'Possible duplicate of an existing demo record.';
      seen.add(key);
    }
    return { index: i, data, errors, warnings, duplicateOf };
  });
}

export function dupKey(type: DataType, d: Record<string, unknown>): string | null {
  try {
    if (type === 'transactions' && d.date && d.item && d.supplier && d.amount !== undefined)
      return ['txn', d.date, d.businessUnit, String(d.item).toLowerCase(), String(d.supplier).toLowerCase(), d.amount].join('|');
    if (type === 'inventory' && d.item && d.businessUnit)
      return ['inv', d.businessUnit, String(d.item).toLowerCase()].join('|');
    if (type === 'suppliers' && d.supplier) return ['sup', String(d.supplier).toLowerCase()].join('|');
    if (type === 'purchase_orders' && d.poNo && d.item)
      return ['po', String(d.poNo).toLowerCase(), String(d.item).toLowerCase(), d.quantity].join('|');
    if (type === 'opening_balances' && d.accountCode && d.businessUnit)
      return ['ob', d.accountCode, d.businessUnit, d.date].join('|');
  } catch { /* ignore */ }
  return null;
}

// ---------- CSV helpers (no external dependency) ----------

export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

export function fileName(base: string, ext: string, unit?: string): string {
  const d = new Date().toISOString().slice(0, 10);
  const u = unit && unit !== 'All units' && unit !== 'All' ? '-' + unit.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  return `${base}${u}-${d}.${ext}`;
}

/**
 * Deterministic idempotency key for one import row, so retrying the same
 * file neither duplicates records nor silently drops them — the server
 * returns the prior outcome for a repeated key.
 */
export function importIdemKey(file: string, type: string, index: number): string {
  const slug = (file || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
  return `imp-${type}-${slug}-${index}`;
}

// Google Sheets: accept published CSV links or convert /edit URLs to export URLs.
export function sheetsToCsvUrl(input: string): string | null {
  const s = input.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  if (/output=csv|export\?format=csv|export\/csv/i.test(s)) return s;
  const m = s.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) {
    const gid = (s.match(/[?&#]gid=(\d+)/) ?? [])[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  }
  if (/\.csv(\?|$)/i.test(s)) return s;
  return null;
}
