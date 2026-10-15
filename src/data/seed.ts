export type Classification = 'Expense' | 'Revenue' | 'Asset' | 'Liability' | 'Equity';
export type TxnStatus = 'Draft' | 'For Accountant Review' | 'Accountant Reviewed' | 'For Owner Approval' | 'Approved' | 'Posted' | 'Rejected' | 'Reversed';
export type CashKind = 'Cash In' | 'Cash Out' | 'Disbursement' | 'Journal';

/** Selectable transaction types for new entries (client feedback: Cash In / Cash Out
 *  removed from selectors; historical records keep their original kind). */
export const TRANSACTION_KINDS: CashKind[] = ['Disbursement', 'Journal'];

export interface Staff {
  id: string;
  name: string;
  role: string;
  unit: string;
  initials: string;
}

export const STAFF: Staff[] = [
  { id: 'joy', name: 'Joy Ayop', role: 'CEO', unit: 'Management', initials: 'JA' },
  { id: 'eve', name: 'Eve Rasonable', role: 'HR', unit: 'Management', initials: 'ER' },
  { id: 'dani', name: 'Daniflor Calago', role: 'Accounting', unit: 'Accounting', initials: 'DC' },
  { id: 'jeann', name: 'Jeann', role: 'Warehouse', unit: 'Central Warehouse', initials: 'JN' },
  { id: 'jinky', name: 'Jinky', role: 'Diagnostics Cashier', unit: 'Diagnostic Center', initials: 'JK' },
  { id: 'mae', name: 'Mae Sherylou', role: 'Pharmacy', unit: 'Pharmacy', initials: 'MS' },
  { id: 'rodel', name: 'Rodel', role: 'IT', unit: 'Management', initials: 'RD' },
];

export const BUSINESS_UNITS = [
  'Diagnostic Center',
  'Dialysis Center',
  'Pharmacy',
  'Halo Enterprises Wholesale',
  'Doc’J Boxing Gym',
  'Animal Bite Center',
  'PhilHealth Gamot',
  'PhilHealth Yakap/Konsulta',
  'Central Warehouse',
] as const;

// Classification option only — no account code or debit/credit mapping is
// invented here. Shared by the entry form, filters, type list, and import
// validation via this single source of truth.
export const CLASSIFICATIONS: Classification[] = ['Expense', 'Revenue', 'Asset', 'Liability', 'Equity'];

export const ITEM_CATEGORIES = ['Medical Supplies', 'Medical Equipment', 'Office Supplies'] as const;

export const INVENTORY_TYPES = ['Laboratory', 'Pharmacy', 'Dialysis', 'Admin'] as const;

export interface Txn {
  id: string;
  date: string;
  businessUnit: string;
  classification: Classification;
  kind: CashKind;
  item: string;
  category: string;
  supplier: string;
  supplierPrice: number;
  retailPrice: number;
  quantity: number;
  amount: number;
  accountCode: string;
  accountName: string;
  enteredBy: string;
  /** Staff user ID of the creator — used for "my submissions" filtering. */
  createdBy?: string;
  status: TxnStatus;
  remarks: string;
  /** Set on offsetting correction entries — finance counts them negative. */
  reversalOf?: string;
}

export interface InventoryItem {
  id: string;
  businessUnit: string;
  type: string;
  item: string;
  category: string;
  quantity: number;
  amount: number;
  supplier: string;
  supplierPrice: number;
  retailPrice: number;
  reorderLevel: number;
  /** Staff user ID of the creator (opening stock has none). */
  createdBy?: string;
}

export interface POLine {
  item: string;
  quantity: number;
  supplierPrice: number;
  receivedQty: number;
  /** Live database line id (Slice 4); absent on demo rows. */
  lineId?: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  date: string;
  supplier: string;
  businessUnit: string;
  deliveryDate: string;
  items: POLine[];
  total: number;
  received: boolean;
  receivedDate: string;
  status: 'Draft' | 'Sent to Supplier' | 'Partially Received' | 'Received' | 'Cancelled';
  /** Staff user ID of the creator. */
  createdBy?: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  ref: string;
  particulars: string;
  businessUnit: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: 'Draft' | 'Posted';
  sourceTxn: string;
  queuedTxn?: string;
  /** Multi-line breakdown for guided entries; summary fields stay compatible. */
  lines?: JournalLine[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  ref: string;
  detail: string;
}

export const COA = [
  { code: '1000', name: 'Cash on Hand', type: 'Asset' },
  { code: '1010', name: 'Cash in Bank', type: 'Asset' },
  { code: '1100', name: 'Pharmacy Inventory', type: 'Asset' },
  { code: '1110', name: 'Laboratory Inventory', type: 'Asset' },
  { code: '1120', name: 'Dialysis Inventory', type: 'Asset' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
  { code: '1500', name: 'Medical Equipment', type: 'Asset' },
  { code: '2000', name: 'Accounts Payable', type: 'Liability' },
  { code: '2100', name: 'Accrued Expenses', type: 'Liability' },
  { code: '3000', name: "Owner's Equity", type: 'Equity' },
  { code: '4000', name: 'Service Revenue — Diagnostics', type: 'Revenue' },
  { code: '4100', name: 'Pharmacy Sales', type: 'Revenue' },
  { code: '4200', name: 'Dialysis Revenue', type: 'Revenue' },
  { code: '5000', name: 'Medical Supplies Expense', type: 'Expense' },
  { code: '5100', name: 'Office Supplies Expense', type: 'Expense' },
  { code: '5200', name: 'Salaries & Wages', type: 'Expense' },
  { code: '5300', name: 'Utilities Expense', type: 'Expense' },
];

export const seedTransactions: Txn[] = [
  { id: 'TXN-2026-0041', date: '2026-10-12', businessUnit: 'Pharmacy', classification: 'Revenue', kind: 'Cash In', item: 'OTC medicines — walk-in sales', category: 'Medical Supplies', supplier: 'Walk-in customers', supplierPrice: 0, retailPrice: 18450, quantity: 1, amount: 18450, accountCode: '4100', accountName: 'Pharmacy Sales', enteredBy: 'Mae Sherylou', createdBy: 'mae', status: 'Posted', remarks: 'Daily pharmacy sales summary' },
  { id: 'TXN-2026-0042', date: '2026-10-12', businessUnit: 'Diagnostic Center', classification: 'Revenue', kind: 'Cash In', item: 'Laboratory procedures — OR #1181–1204', category: 'Medical Supplies', supplier: 'Outpatient clients', supplierPrice: 0, retailPrice: 32780, quantity: 1, amount: 32780, accountCode: '4000', accountName: 'Service Revenue — Diagnostics', enteredBy: 'Jinky', createdBy: 'jinky', status: 'Posted', remarks: 'Cashier daily remittance' },
  { id: 'TXN-2026-0043', date: '2026-10-13', businessUnit: 'Central Warehouse', classification: 'Expense', kind: 'Disbursement', item: 'Surgical gloves (latex), 20 boxes', category: 'Medical Supplies', supplier: 'MedSupply Trading', supplierPrice: 385, retailPrice: 0, quantity: 20, amount: 7700, accountCode: '5000', accountName: 'Medical Supplies Expense', enteredBy: 'Jeann', createdBy: 'jeann', status: 'Accountant Reviewed', remarks: 'For review — SI #5521 attached' },
  { id: 'TXN-2026-0044', date: '2026-10-13', businessUnit: 'Dialysis Center', classification: 'Expense', kind: 'Disbursement', item: 'Dialyzer membranes, 30 pcs', category: 'Medical Equipment', supplier: 'NephroCare Distributors', supplierPrice: 1450, retailPrice: 0, quantity: 30, amount: 43500, accountCode: '5000', accountName: 'Medical Supplies Expense', enteredBy: 'Jeann', createdBy: 'jeann', status: 'For Accountant Review', remarks: 'PO-2026-0187 match pending' },
  { id: 'TXN-2026-0045', date: '2026-10-13', businessUnit: 'Animal Bite Center', classification: 'Revenue', kind: 'Cash In', item: 'Anti-rabies vaccination, 14 px', category: 'Medical Supplies', supplier: 'Walk-in patients', supplierPrice: 0, retailPrice: 21000, quantity: 14, amount: 21000, accountCode: '4000', accountName: 'Service Revenue — Diagnostics', enteredBy: 'Jinky', createdBy: 'jinky', status: 'For Owner Approval', remarks: 'Verified by accounting' },
  { id: 'TXN-2026-0046', date: '2026-10-14', businessUnit: 'Pharmacy', classification: 'Asset', kind: 'Journal', item: 'Stock transfer — Central Warehouse to Pharmacy', category: 'Medical Supplies', supplier: 'Central Warehouse', supplierPrice: 12400, retailPrice: 16800, quantity: 1, amount: 12400, accountCode: '1100', accountName: 'Pharmacy Inventory', enteredBy: 'Daniflor Calago', createdBy: 'dani', status: 'Draft', remarks: 'Internal transfer slip' },
  { id: 'TXN-2026-0047', date: '2026-10-14', businessUnit: 'Doc’J Boxing Gym', classification: 'Revenue', kind: 'Cash In', item: 'Monthly memberships — 22 members', category: 'Office Supplies', supplier: 'Gym members', supplierPrice: 0, retailPrice: 19800, quantity: 22, amount: 19800, accountCode: '4000', accountName: 'Service Revenue — Diagnostics', enteredBy: 'Eve Rasonable', createdBy: 'eve', status: 'Posted', remarks: 'Posted' },
  { id: 'TXN-2026-0048', date: '2026-10-14', businessUnit: 'Diagnostic Center', classification: 'Expense', kind: 'Cash Out', item: 'Bond paper & printer ink', category: 'Office Supplies', supplier: 'PaperLine Depot', supplierPrice: 3250, retailPrice: 0, quantity: 1, amount: 3250, accountCode: '5100', accountName: 'Office Supplies Expense', enteredBy: 'Jinky', createdBy: 'jinky', status: 'Rejected', remarks: 'Returned: attach official receipt' },
  { id: 'TXN-2026-0049', date: '2026-10-14', businessUnit: 'Halo Enterprises Wholesale', classification: 'Liability', kind: 'Journal', item: 'Supplier billing — MedSupply Trading, 30-day terms', category: 'Medical Supplies', supplier: 'MedSupply Trading', supplierPrice: 58200, retailPrice: 0, quantity: 1, amount: 58200, accountCode: '2000', accountName: 'Accounts Payable', enteredBy: 'Daniflor Calago', createdBy: 'dani', status: 'Approved', remarks: 'Awaiting GL posting batch' },
  { id: 'TXN-2026-0050', date: '2026-10-14', businessUnit: 'PhilHealth Gamot', classification: 'Revenue', kind: 'Cash In', item: 'PhilHealth Gamot reimbursements received', category: 'Medical Supplies', supplier: 'PhilHealth', supplierPrice: 0, retailPrice: 45230, quantity: 1, amount: 45230, accountCode: '4100', accountName: 'Pharmacy Sales', enteredBy: 'Mae Sherylou', createdBy: 'mae', status: 'Posted', remarks: 'Bank credit advice' },
];

export const seedInventory: InventoryItem[] = [
  { id: 'INV-001', businessUnit: 'Pharmacy', type: 'Pharmacy', item: 'Paracetamol 500mg, 100s', category: 'Medical Supplies', quantity: 240, amount: 38400, supplier: 'MedSupply Trading', supplierPrice: 160, retailPrice: 220, reorderLevel: 100 },
  { id: 'INV-002', businessUnit: 'Diagnostic Center', type: 'Laboratory', item: 'CBC reagent kit', category: 'Medical Supplies', quantity: 18, amount: 45000, supplier: 'LabServe Inc.', supplierPrice: 2500, retailPrice: 3400, reorderLevel: 10 },
  { id: 'INV-003', businessUnit: 'Dialysis Center', type: 'Dialysis', item: 'Dialyzer membrane F6', category: 'Medical Equipment', quantity: 64, amount: 92800, supplier: 'NephroCare Distributors', supplierPrice: 1450, retailPrice: 2100, reorderLevel: 40 },
  { id: 'INV-004', businessUnit: 'Central Warehouse', type: 'Admin', item: 'Bond paper A4, 40 reams', category: 'Office Supplies', quantity: 96, amount: 24960, supplier: 'PaperLine Depot', supplierPrice: 260, retailPrice: 340, reorderLevel: 30 },
  { id: 'INV-005', businessUnit: 'Animal Bite Center', type: 'Pharmacy', item: 'Anti-rabies vaccine vial', category: 'Medical Supplies', quantity: 42, amount: 63000, supplier: 'VaxPharma Corp.', supplierPrice: 1500, retailPrice: 1950, reorderLevel: 20 },
  { id: 'INV-006', businessUnit: 'Pharmacy', type: 'Pharmacy', item: 'Digital BP apparatus', category: 'Medical Equipment', quantity: 12, amount: 21600, supplier: 'MediEquip Supply', supplierPrice: 1800, retailPrice: 2500, reorderLevel: 5 },
];

export const seedPOs: PurchaseOrder[] = [
  { id: 'PO-1', poNo: 'PO-2026-0187', date: '2026-10-10', supplier: 'NephroCare Distributors', businessUnit: 'Dialysis Center', deliveryDate: '2026-10-17', items: [{ item: 'Dialyzer membrane F6', quantity: 30, supplierPrice: 1450, receivedQty: 0 }], total: 43500, received: false, receivedDate: '', status: 'Sent to Supplier' },
  { id: 'PO-2', poNo: 'PO-2026-0188', date: '2026-10-11', supplier: 'MedSupply Trading', businessUnit: 'Central Warehouse', deliveryDate: '2026-10-15', items: [{ item: 'Surgical gloves (latex)', quantity: 20, supplierPrice: 385, receivedQty: 20 }], total: 7700, received: true, receivedDate: '2026-10-13', status: 'Received' },
  { id: 'PO-3', poNo: 'PO-2026-0189', date: '2026-10-12', supplier: 'PaperLine Depot', businessUnit: 'Diagnostic Center', deliveryDate: '2026-10-16', items: [{ item: 'Bond paper A4', quantity: 40, supplierPrice: 260, receivedQty: 0 }], total: 10400, received: false, receivedDate: '', status: 'Draft' },
];

export const seedJournal: JournalEntry[] = [
  { id: 'JE-001', date: '2026-10-12', ref: 'JV-2026-0301', particulars: 'Pharmacy daily sales — cash to revenue', businessUnit: 'Pharmacy', debitAccount: '1000 — Cash on Hand', creditAccount: '4100 — Pharmacy Sales', amount: 18450, status: 'Posted', sourceTxn: 'TXN-2026-0041' },
  { id: 'JE-002', date: '2026-10-12', ref: 'JV-2026-0302', particulars: 'Diagnostics remittance — cash to revenue', businessUnit: 'Diagnostic Center', debitAccount: '1000 — Cash on Hand', creditAccount: '4000 — Service Revenue', amount: 32780, status: 'Posted', sourceTxn: 'TXN-2026-0042' },
  { id: 'JE-003', date: '2026-10-14', ref: 'JV-2026-0305', particulars: 'Supplier billing — inventory to payables', businessUnit: 'Halo Enterprises Wholesale', debitAccount: '1100 — Pharmacy Inventory', creditAccount: '2000 — Accounts Payable', amount: 58200, status: 'Draft', sourceTxn: 'TXN-2026-0049' },
];

export const seedAudit: AuditEvent[] = [
  { id: 'A-1', at: '2026-10-14 09:02', actor: 'Mae Sherylou', action: 'Created transaction', ref: 'TXN-2026-0050', detail: 'PhilHealth Gamot reimbursement entry' },
  { id: 'A-2', at: '2026-10-14 09:40', actor: 'Daniflor Calago', action: 'Accountant reviewed', ref: 'TXN-2026-0045', detail: 'Receipts verified, forwarded for owner approval' },
  { id: 'A-3', at: '2026-10-14 10:05', actor: 'Joy Ayop', action: 'Posted to ledger', ref: 'TXN-2026-0047', detail: 'Approved and posted batch B-104' },
  { id: 'A-4', at: '2026-10-14 10:12', actor: 'Daniflor Calago', action: 'Rejected for correction', ref: 'TXN-2026-0048', detail: 'Missing official receipt — returned to cashier' },
];

export function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
