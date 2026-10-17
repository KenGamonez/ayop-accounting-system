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
  /** Full account lines captured at entry (frontend-only; not sent to the backend). */
  lines?: JournalLine[];
  /** Display-only control reference captured at entry. */
  controlNo?: string;
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
  /** Display-only control reference captured at entry. */
  controlNo?: string;
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
  // Shared-catalog addition only (owner request): no existing rows remapped,
  // no posting rule invented. Asset-typed per its nature (amounts owed to
  // the business); flows through the existing generic ledger paths.
  { code: '2200', name: 'Accrued Income', type: 'Asset' },
  { code: '3000', name: "Owner's Equity", type: 'Equity' },
  { code: '4000', name: 'Service Revenue — Diagnostics', type: 'Revenue' },
  { code: '4100', name: 'Pharmacy Sales', type: 'Revenue' },
  { code: '4200', name: 'Dialysis Revenue', type: 'Revenue' },
  { code: '5000', name: 'Medical Supplies Expense', type: 'Expense' },
  { code: '5100', name: 'Office Supplies Expense', type: 'Expense' },
  { code: '5200', name: 'Salaries & Wages', type: 'Expense' },
  { code: '5300', name: 'Utilities Expense', type: 'Expense' },
];

// Runtime records start empty so staff work only with real entries they
// create — no fabricated books ship to the app. Reference data above (COA,
// business units, staff, transaction types) is real configuration and stays.
// Sample rows for the self-test live in scripts/fixtures.ts (test-only, never
// bundled into the app).
export const seedTransactions: Txn[] = [];

export const seedInventory: InventoryItem[] = [];

export const seedPOs: PurchaseOrder[] = [];

export const seedJournal: JournalEntry[] = [];

export const seedAudit: AuditEvent[] = [];

export function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
