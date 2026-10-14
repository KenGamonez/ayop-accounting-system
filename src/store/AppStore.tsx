import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuditEvent, InventoryItem, JournalEntry, PurchaseOrder, Staff, STAFF, Txn, seedAudit, seedInventory, seedJournal, seedPOs, seedTransactions } from '../data/seed';

interface Store {
  user: Staff | null;
  login: (id: string) => void;
  logout: () => void;
  txns: Txn[];
  addTxn: (t: Omit<Txn, 'id' | 'status'>) => Txn;
  transition: (id: string, to: Txn['status'], note?: string) => void;
  reverseTxn: (id: string) => void;
  inventory: InventoryItem[];
  adjustInventory: (id: string, delta: number) => void;
  pos: PurchaseOrder[];
  addPO: (po: Omit<PurchaseOrder, 'id' | 'total'>) => void;
  receivePO: (id: string) => void;
  journal: JournalEntry[];
  postJournal: (id: string) => void;
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
  const [pos, setPos] = useState<PurchaseOrder[]>(() => load('pos', seedPOs));
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
    adjustInventory: (id, delta) => setInventory(x => x.map(i => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))),
    pos,
    addPO: (po) => {
      const total = po.items.reduce((s, i) => s + i.quantity * i.supplierPrice, 0);
      const rec: PurchaseOrder = { ...po, id: 'PO-' + Date.now(), total };
      setPos(x => [rec, ...x]);
      log('Purchase order created', po.poNo, po.supplier + ' — ' + po.businessUnit);
    },
    receivePO: (id) => {
      setPos(x => x.map(p => (p.id === id ? { ...p, received: true, receivedDate: new Date().toISOString().slice(0, 10), status: 'Received' as const } : p)));
      const po = pos.find(p => p.id === id);
      if (po) log('P.O. received', po.poNo, 'Delivery confirmed; inventory updated (demo).');
    },
    journal,
    postJournal: (id) => {
      setJournal(x => x.map(j => (j.id === id ? { ...j, status: 'Posted' as const } : j)));
      log('Journal posted', id, 'Entry posted to General Ledger (demo).');
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
