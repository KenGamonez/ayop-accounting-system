// Live transaction + approval adapter (Slice 2). Used only in live mode;
// demo paths never touch this module. All identity comes from the Supabase
// session resolved against public.staff — the browser never supplies role,
// staff ID, creator ID, or status: the RPCs derive and validate everything.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './backend';
import type { InventoryItem, PurchaseOrder, Staff, Txn, TxnStatus } from './seed';

export interface LiveMembership {
  id: string;
  name: string;
  role: string;
  unit: string;
}

export function membershipToStaff(m: LiveMembership): Staff {
  const initials = m.name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return { id: m.id, name: m.name, role: m.role, unit: m.unit, initials };
}

function clientError(e: unknown): Error {
  const msg =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e);
  return new Error(msg);
}

/** Sign in with a provisioned staff account. Throws a plain-language error. */
export async function signInLive(url: string, key: string, email: string, password: string): Promise<LiveMembership> {
  const client = getSupabaseClient(url, key);
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw mapAuthError(error.message);
  const membership = await resolveLiveMembership(client);
  if (!membership) {
    await client.auth.signOut();
    throw membershipError();
  }
  return membership;
}

export async function signOutLive(url: string, key: string): Promise<void> {
  await getSupabaseClient(url, key).auth.signOut();
}

/** Resolve the signed-in session to a linked staff record, or null. */
export async function resolveLiveMembership(client: SupabaseClient): Promise<LiveMembership | null> {
  const { data: { session } } = await client.auth.getSession();
  if (!session) return null;
  const { data, error } = await client
    .from('staff')
    .select('id,name,role,business_unit')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; name: string; role: string; business_unit: string };
  return { id: row.id, name: row.name, role: row.role, unit: row.business_unit };
}

export function membershipError(): Error {
  return new Error('Signed in, but this login is not linked to a staff record. Ask an administrator to link it (docs/SLICE_1_SETUP.md §3).');
}

function mapAuthError(message: string): Error {
  if (/invalid login credentials/i.test(message))
    return new Error('Email or password is incorrect.');
  if (/email not confirmed/i.test(message))
    return new Error('This login is not confirmed yet. Ask an administrator to confirm it.');
  return new Error('Sign-in failed: ' + message);
}

export interface DbTxnRow {
  id: string;
  date: string;
  business_unit: string;
  classification: Txn['classification'];
  kind: Txn['kind'];
  item: string;
  category: string;
  supplier: string;
  supplier_price: number | string;
  retail_price: number | string;
  quantity: number | string;
  amount: number | string;
  account_code: string;
  account_name: string;
  entered_by: string;
  created_by: string;
  status: TxnStatus;
  remarks: string;
  reversal_of: string | null;
}

/** Database row → frontend Txn. Numeric columns arrive as strings via PostgREST. */
export function mapDbTxn(r: DbTxnRow): Txn {
  return {
    id: r.id,
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : String(r.date),
    businessUnit: r.business_unit,
    classification: r.classification,
    kind: r.kind,
    item: r.item,
    category: r.category,
    supplier: r.supplier,
    supplierPrice: Number(r.supplier_price),
    retailPrice: Number(r.retail_price),
    quantity: Number(r.quantity),
    amount: Number(r.amount),
    accountCode: r.account_code,
    accountName: r.account_name,
    enteredBy: r.entered_by,
    createdBy: r.created_by,
    status: r.status,
    remarks: r.remarks,
    reversalOf: r.reversal_of ?? undefined,
  };
}

export interface TxnDraft {
  date: string;
  businessUnit: string;
  classification: string;
  kind: string;
  item: string;
  category: string;
  supplier: string;
  supplierPrice: number;
  retailPrice: number;
  quantity: number;
  amount: number;
  accountCode: string;
  accountName: string;
  remarks: string;
}

/** Whitelist sent to the RPC — id, status, creator, and identity are never trusted from the client. */
export function toDbPayload(t: TxnDraft): Record<string, unknown> {
  return {
    date: t.date,
    business_unit: t.businessUnit,
    classification: t.classification,
    kind: t.kind,
    item: t.item,
    category: t.category,
    supplier: t.supplier,
    supplier_price: t.supplierPrice,
    retail_price: t.retailPrice,
    quantity: t.quantity,
    amount: t.amount,
    account_code: t.accountCode,
    account_name: t.accountName,
    remarks: t.remarks,
  };
}

/** Server RPC messages are already plain-language after the CODE prefix. */
export function mapRpcError(e: unknown): string {
  const msg = clientError(e).message;
  const i = msg.indexOf(': ');
  const core = (i >= 0 ? msg.slice(i + 2) : msg).trim();
  return core.slice(0, 300) || 'Live request failed.';
}

export async function listLiveTxns(client: SupabaseClient): Promise<Txn[]> {
  const { data, error } = await client
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw new Error(mapRpcError(error));
  return ((data ?? []) as DbTxnRow[]).map(mapDbTxn);
}

export async function createLiveTxn(client: SupabaseClient, draft: TxnDraft, idemKey: string): Promise<Txn> {
  const { data, error } = await client.rpc('create_transaction', { p: toDbPayload(draft), p_idem: idemKey });
  if (error) throw new Error(mapRpcError(error));
  return mapDbTxn(data as DbTxnRow);
}

export async function transitionLiveTxn(client: SupabaseClient, id: string, to: TxnStatus, note?: string): Promise<Txn> {
  const { data, error } = await client.rpc('transition_transaction', { p_id: id, p_to: to, p_note: note ?? null });
  if (error) throw new Error(mapRpcError(error));
  return mapDbTxn(data as DbTxnRow);
}

export async function reverseLiveTxn(client: SupabaseClient, id: string, reason?: string): Promise<Txn> {
  const { data, error } = await client.rpc('reverse_transaction', { p_id: id, p_reason: reason ?? null });
  if (error) throw new Error(mapRpcError(error));
  return mapDbTxn(data as DbTxnRow);
}

// ---------------- purchase orders (Slice 4) ----------------

export interface DbPORow {
  id: string;
  po_no: string;
  date: string;
  supplier: string;
  business_unit: string;
  delivery_date: string;
  total: number | string;
  received: boolean;
  received_date: string | null;
  status: PurchaseOrder['status'];
  created_by: string;
}

export interface DbPOLine {
  id: number;
  po_id: string;
  item: string;
  quantity: number | string;
  supplier_price: number | string;
  received_qty: number | string;
}

export function mapDbPO(po: DbPORow, lines: DbPOLine[]): PurchaseOrder {
  return {
    id: po.id,
    poNo: po.po_no,
    date: typeof po.date === 'string' ? po.date.slice(0, 10) : String(po.date),
    supplier: po.supplier,
    businessUnit: po.business_unit,
    deliveryDate: typeof po.delivery_date === 'string' ? po.delivery_date.slice(0, 10) : String(po.delivery_date),
    items: lines
      .filter(l => l.po_id === po.id)
      .sort((a, b) => a.id - b.id)
      .map(l => ({
        lineId: l.id,
        item: l.item,
        quantity: Number(l.quantity),
        supplierPrice: Number(l.supplier_price),
        receivedQty: Number(l.received_qty),
      })),
    total: Number(po.total),
    received: po.received,
    receivedDate: po.received_date ? String(po.received_date).slice(0, 10) : '',
    status: po.status,
    createdBy: po.created_by,
  };
}

export interface POLineDraft { item: string; quantity: number; supplierPrice: number }
export interface PODraft {
  poNo: string;
  date: string;
  supplier: string;
  businessUnit: string;
  deliveryDate: string;
  items: POLineDraft[];
}

export function toDbPOPayload(p: PODraft): Record<string, unknown> {
  return {
    po_no: p.poNo,
    date: p.date,
    supplier: p.supplier,
    business_unit: p.businessUnit,
    delivery_date: p.deliveryDate,
    items: p.items.map(l => ({ item: l.item, quantity: l.quantity, supplier_price: l.supplierPrice })),
  };
}

export async function listLivePOs(client: SupabaseClient): Promise<PurchaseOrder[]> {
  const [{ data: pos, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    client.from('purchase_orders').select('*').order('date', { ascending: false }),
    client.from('po_lines').select('*'),
  ]);
  if (e1) throw new Error(mapRpcError(e1));
  if (e2) throw new Error(mapRpcError(e2));
  return ((pos ?? []) as DbPORow[]).map(p => mapDbPO(p, (lines ?? []) as DbPOLine[]));
}

export async function createLivePO(client: SupabaseClient, draft: PODraft, idemKey: string): Promise<void> {
  const { error } = await client.rpc('create_purchase_order', { p: toDbPOPayload(draft), p_idem: idemKey });
  if (error) throw new Error(mapRpcError(error));
}

export async function sendLivePO(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('send_purchase_order', { p_id: id });
  if (error) throw new Error(mapRpcError(error));
}

export async function cancelLivePO(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('cancel_purchase_order', { p_id: id });
  if (error) throw new Error(mapRpcError(error));
}

export interface ReceiptResult {
  duplicate: boolean;
  poStatus: string;
  payableId?: string;
}

export async function recordLiveReceipt(
  client: SupabaseClient, poId: string, lineId: number, qty: number, idemKey: string,
): Promise<ReceiptResult> {
  const { data, error } = await client.rpc('record_receipt', {
    p_po_id: poId, p_line_id: lineId, p_qty: qty, p_idem: idemKey,
  });
  if (error) throw new Error(mapRpcError(error));
  return data as ReceiptResult;
}

// ---------------- inventory (Slice 4) ----------------

export interface DbItemRow {
  id: string;
  business_unit: string;
  type: string;
  item: string;
  category: string;
  quantity: number | string;
  amount: number | string;
  supplier: string;
  supplier_price: number | string;
  retail_price: number | string;
  reorder_level: number | string;
  created_by: string | null;
}

export function mapDbItem(r: DbItemRow): InventoryItem {
  return {
    id: r.id,
    businessUnit: r.business_unit,
    type: r.type,
    item: r.item,
    category: r.category,
    quantity: Number(r.quantity),
    amount: Number(r.amount),
    supplier: r.supplier,
    supplierPrice: Number(r.supplier_price),
    retailPrice: Number(r.retail_price),
    reorderLevel: Number(r.reorder_level),
    createdBy: r.created_by ?? undefined,
  };
}

export interface ItemDraft {
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
}

export function toDbItemPayload(t: ItemDraft): Record<string, unknown> {
  return {
    business_unit: t.businessUnit,
    type: t.type,
    item: t.item,
    category: t.category,
    quantity: t.quantity,
    amount: t.amount,
    supplier: t.supplier,
    supplier_price: t.supplierPrice,
    retail_price: t.retailPrice,
    reorder_level: t.reorderLevel,
  };
}

export async function listLiveInventory(client: SupabaseClient): Promise<InventoryItem[]> {
  const { data, error } = await client.from('inventory_items').select('*').order('item');
  if (error) throw new Error(mapRpcError(error));
  return ((data ?? []) as DbItemRow[]).map(mapDbItem);
}

export async function addLiveItem(client: SupabaseClient, draft: ItemDraft, idemKey: string): Promise<void> {
  const { error } = await client.rpc('add_inventory_item', { p: toDbItemPayload(draft), p_idem: idemKey });
  if (error) throw new Error(mapRpcError(error));
}

export async function adjustLiveStock(client: SupabaseClient, id: string, delta: number, reason: string): Promise<void> {
  const { error } = await client.rpc('adjust_stock', { p_item_id: id, p_delta: delta, p_reason: reason });
  if (error) throw new Error(mapRpcError(error));
}

export async function updateLiveItem(client: SupabaseClient, id: string, patch: Record<string, unknown>): Promise<void> {
  const allowed: Record<string, unknown> = {};
  if (typeof patch.type === 'string') allowed.type = patch.type;
  if (typeof patch.category === 'string') allowed.category = patch.category;
  if (typeof patch.supplier === 'string') allowed.supplier = patch.supplier;
  if (typeof patch.supplierPrice === 'number') allowed.supplier_price = patch.supplierPrice;
  if (typeof patch.retailPrice === 'number') allowed.retail_price = patch.retailPrice;
  if (typeof patch.reorderLevel === 'number') allowed.reorder_level = patch.reorderLevel;
  const { error } = await client.rpc('update_inventory_item', { p_id: id, p: allowed });
  if (error) throw new Error(mapRpcError(error));
}
