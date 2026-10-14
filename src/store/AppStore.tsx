import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuditEvent, InventoryItem, JournalEntry, PurchaseOrder, Staff, STAFF, Txn, seedAudit, seedInventory, seedJournal, seedPOs, seedTransactions } from '../data/seed';
import { applyReceipt, defaultInventoryTypeFor } from '../data/ops';

// Older demo state saved P.O. lines without receivedQty — backfill so the
// receipt workflow degrades gracefully instead of crashing or double-counting.
function normalizePO(p: PurchaseOrder): PurchaseOrder {
  return {
    ...p,
    items: (p.items ?? []).map(l => ({ ...l, receivedQty: l.receivedQty ?? (p.received ? l.quantity : 0) })),
  };
}

interface Store {
  user: Staff | null;
  login: (id: string) => void;
  logout: () => void;
  txns: Txn[];
  addTxn: (t: Omit<Txn, 'id' | 'status'>) => Txn;
  transition: (id: string, to: Txn['status'], note?: string) => void;
  reverseTxn: (id: string) => void;
  inventory: InventoryItem[];
  adjustInventory: (id: string, delta: number, reason?: string) => void;
  setInventoryQty: (id: string, qty: number, reason?: string) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, patch: Partial<Omit<InventoryItem, 'id' | 'quantity'>>) => void;
  pos: PurchaseOrder[];
  addPO: (po: Omit<PurchaseOrder, 'id' | 'total'>) => void;
  sendPO: (id: string) => void;
  cancelPO: (id: string) => void;
  receivePOLine: (id: string, lineIdx: number, qty: number) => { ok: boolean; message: string };
  journal: JournalEntry[];
  postJournal: (id: string) => void;
  addJournal: (j: Omit<JournalEntry, 'id'>) => void;
  audit: AuditEvent[];
  log: (action: string, ref: string, detail: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = 'jem51-demo-v1';

function load<T>(k: string, fb: T): T {
  try {
    const raw = localStorage.getItem(KEY + ':' + k);
    if (!raw) return fb;
    return JSON.parse(raw) as T;
  } catch { return fb; }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => load('user', null as string | null));
  const [txns, setTxns] = useState<Txn[]>(() => load('txns', seedTransactions));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => load('inv', seedInventory));
  const [pos, setPos] = useState<PurchaseOrder[]>(() => load('pos', seedPOs).map(normalizePO));
  const [journal, setJournal] = useState<JournalEntry[]>(() => load('je', seedJournal));
  const [audit, setAudit] = useState<AuditEvent[]>(() => load('audit', seedAudit));

  useEffect(() => {
    try {
      localStorage.setItem(KEY + ':user', JSON.stringify(userId));
      localStorage.setItem(KEY + ':txns', JSON.stringify(txns));
      localStorage.setItem(KEY + ':inv', JSON.stringify(inventory));
      localStorage.setItem(KEY + ':pos', JSON.stringify(pos));
      localStorage.setItem(KEY + ':je', JSON.stringify(journal));
      localStorage.setItem(KEY + ':audit', JSON.stringify(audit));
    } catch { /* private mode */ }
  }, [userId, txns, inventory, pos, journal, audit]);

  const user = useMemo(() => STAFF.find(s => s.id === userId) ?? null, [userId]);

  const log = (action: string, ref: string, detail: string) => {
    const actor = user?.name ?? 'Demo user';
    const now = new Date();
    const at = now.toLocaleString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    setAudit(a => [{ id: 'A-' + Date.now(), at, actor, action, ref, detail }, ...a].slice(0, 200));
  };

  const value: Store = {
    user,
    login: (id) => setUserId(id),
    logout: () => setUserId(null),
    txns,
    addTxn: (t) => {
      const n = txns.length + 41;
      const txn: Txn = { ...t, id: 'TXN-2026-' + String(n).padStart(4, '0'), status: 'For Accountant Review' };
      setTxns(x => [txn, ...x]);
      const actor = STAFF.find(s => s.name === t.enteredBy)?.name ?? t.enteredBy;
      setAudit(a => [{ id: 'A-' + Date.now(), at: new Date().toLocaleString(), actor, action: 'Created transaction', ref: txn.id, detail: t.item }, ...a]);
      return txn;
    },
    transition: (id, to, note) => {
      setTxns(x => x.map(t => {
        if (t.id !== id) return t;
        // Posted entries are protected: only reversal path changes them
        if (t.status === 'Posted' && to !== 'Reversed') return t;
        return { ...t, status: to, remarks: note ?? t.remarks };
      }));
      const labels: Record<string, string> = {
        'For Accountant Review': 'Submitted for accountant review',
        'Accountant Reviewed': 'Accountant reviewed',
        'For Owner Approval': 'Forwarded for owner approval',
        'Approved': 'Owner approved',
        'Posted': 'Posted to ledger',
        'Rejected': 'Rejected for correction',
        'Draft': 'Returned to draft',
      };
      log(labels[to] ?? to, id, note ?? '');
    },
    reverseTxn: (id) => {
      setTxns(x => x.map(t => (t.id === id ? { ...t, status: 'Reversed' as const } : t)));
      log('Reversal entry recorded', id, 'Correcting reversal created; original preserved for audit.');
    },
    inventory,
    adjustInventory: (id, delta, reason) => {
      setInventory(x => x.map(i => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory adjusted', item?.item ?? id, `${delta > 0 ? '+' : ''}${delta} (now ${Math.max(0, (item?.quantity ?? 0) + delta)})${reason ? ' — ' + reason : ''} · demo only`);
    },
    setInventoryQty: (id, qty, reason) => {
      setInventory(x => x.map(i => (i.id === id ? { ...i, quantity: Math.max(0, qty) } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory quantity set', item?.item ?? id, `Set to ${Math.max(0, qty)}${reason ? ' — ' + reason : ''} · demo only`);
    },
    addInventoryItem: (item) => {
      const rec = { ...item, id: 'INV-' + Date.now() };
      setInventory(x => [rec, ...x]);
      log('Inventory item added (demo import)', rec.item, rec.businessUnit + ' · qty ' + rec.quantity);
    },
    updateInventoryItem: (id, patch) => {
      setInventory(x => x.map(i => (i.id === id ? { ...i, ...patch } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory item edited', item?.item ?? id, Object.keys(patch).join(', ') + ' · demo only');
    },
    pos,
    addPO: (po) => {
      const items = po.items.map(l => ({ ...l, receivedQty: l.receivedQty ?? 0 }));
      const total = items.reduce((s, i) => s + i.quantity * i.supplierPrice, 0);
      const rec: PurchaseOrder = { ...po, items, id: 'PO-' + Date.now(), total };
      setPos(x => [rec, ...x]);
      log('Purchase order created', po.poNo, po.supplier + ' — ' + po.businessUnit);
    },
    sendPO: (id) => {
      setPos(x => x.map(p => (p.id === id && p.status === 'Draft' ? { ...p, status: 'Sent to Supplier' as const } : p)));
      const po = pos.find(p => p.id === id);
      if (po) log('P.O. sent to supplier', po.poNo, po.supplier + ' · delivery ' + po.deliveryDate);
    },
    cancelPO: (id) => {
      setPos(x => x.map(p => {
        if (p.id !== id) return p;
        if (p.status === 'Received' || p.status === 'Cancelled') return p;
        return { ...p, status: 'Cancelled' as const };
      }));
      const po = pos.find(p => p.id === id);
      if (po) log('P.O. cancelled', po.poNo, 'Outstanding lines voided · demo only');
    },
    receivePOLine: (id, lineIdx, qty) => {
      const po = pos.find(p => p.id === id);
      if (!po) return { ok: false, message: 'Purchase order not found.' };
      const today = new Date().toISOString().slice(0, 10);
      const res = applyReceipt(po, lineIdx, qty, today);
      if ('error' in res) return { ok: false, message: res.error };
      const line = po.items[lineIdx];
      setPos(x => x.map(p => (p.id === id ? res.po : p)));
      // Receiving updates physical stock AND queues a pending payable for
      // accountant review — it never posts to the ledger directly.
      const match = inventory.find(i =>
        i.businessUnit === po.businessUnit && i.item.toLowerCase() === line.item.toLowerCase());
      if (match) {
        const addValue = res.receivedValue;
        setInventory(x => x.map(i => (i.id === match.id
          ? { ...i, quantity: i.quantity + res.receivedQty, amount: i.amount + addValue }
          : i)));
      } else {
        const rec: InventoryItem = {
          id: 'INV-' + Date.now(), businessUnit: po.businessUnit,
          type: defaultInventoryTypeFor(po.businessUnit), item: line.item,
          category: 'Medical Supplies', quantity: res.receivedQty,
          amount: res.receivedValue, supplier: po.supplier,
          supplierPrice: line.supplierPrice, retailPrice: 0, reorderLevel: 10,
        };
        setInventory(x => [rec, ...x]);
      }
      const n = txns.length + 41;
      const txn: Txn = {
        id: 'TXN-2026-' + String(n).padStart(4, '0'),
        date: today, businessUnit: po.businessUnit, classification: 'Liability',
        kind: 'Journal', item: `Supplier billing — ${po.poNo} (${line.item} × ${res.receivedQty})`,
        category: 'Medical Supplies', supplier: po.supplier,
        supplierPrice: line.supplierPrice, retailPrice: 0, quantity: res.receivedQty,
        amount: res.receivedValue, accountCode: '2000', accountName: 'Accounts Payable',
        enteredBy: user?.name ?? 'Demo user', status: 'For Accountant Review',
        remarks: `Auto-queued from P.O. receipt ${po.poNo} — awaiting accountant review, not posted`,
      };
      setTxns(x => [txn, ...x]);
      const actor = user?.name ?? 'Demo user';
      setAudit(a => [
        { id: 'A-' + Date.now(), at: new Date().toLocaleString(), actor, action: 'P.O. receipt recorded', ref: po.poNo, detail: `${line.item} × ${res.receivedQty} received; stock updated; ${txn.id} queued for review` },
      ...a].slice(0, 200));
      return {
        ok: true,
        message: `Received ${res.receivedQty} × ${line.item} — stock updated, ${txn.id} queued for accountant review${res.fullyReceived ? '; order fully received' : ''}.`,
      };
    },
    journal,
    postJournal: (id) => {
      setJournal(x => x.map(j => (j.id === id ? { ...j, status: 'Posted' as const } : j)));
      log('Journal posted', id, 'Entry posted to General Ledger (demo).');
    },
    addJournal: (j) => {
      const rec = { ...j, id: 'JE-' + Date.now() };
      setJournal(x => [rec, ...x]);
      log('Journal draft created (demo import)', rec.ref, rec.particulars);
    },
    audit,
    log,
    resetDemo: () => {
      setTxns(seedTransactions); setInventory(seedInventory); setPos(seedPOs); setJournal(seedJournal); setAudit(seedAudit);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store missing');
  return s;
}
