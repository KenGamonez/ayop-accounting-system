import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuditEvent, COA, InventoryItem, JournalEntry, PurchaseOrder, Staff, STAFF, Txn, TxnStatus, seedAudit, seedInventory, seedJournal, seedPOs, seedTransactions } from '../data/seed';
import { applyReceipt, defaultInventoryTypeFor, guardTransition, isAllowed, nextTxnId, staffIdForName } from '../data/ops';
import { verifyDemoLogin } from '../data/demoAccess';
import { getSupabaseClient, readBackendEnv, resolveBackendMode } from '../data/backend';
import {
  createLiveTxn, listLiveTxns, mapRpcError, membershipToStaff, resolveLiveMembership,
  reverseLiveTxn, signInLive, signOutLive, transitionLiveTxn,
  addLiveItem, adjustLiveStock, cancelLivePO, createLivePO, listLiveInventory,
  listLivePOs, recordLiveReceipt, sendLivePO, updateLiveItem,
  type LiveMembership, type TxnDraft,
} from '../data/live';

const ENV = readBackendEnv();
const LIVE_MODE = resolveBackendMode(ENV) === 'live';
const SETUP_ERROR = resolveBackendMode(ENV) === 'setup-error';

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
  /** Demo presentation gate: true after the public demo credential check. */
  demoAuthed: boolean;
  unlockDemo: (username: string, password: string) => { ok: boolean; message: string };
  /** Backend posture: demo (local), live (Supabase), or setup-error (misconfigured live). */
  mode: 'demo' | 'live' | 'setup-error';
  /** Live-mode membership resolved from the signed-in session; null until linked sign-in. */
  liveStaff: LiveMembership | null;
  liveError: string;
  liveLogin: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  liveLogout: () => Promise<void>;
  refreshLiveTxns: () => Promise<void>;
  txns: Txn[];
  addTxn: (t: Omit<Txn, 'id' | 'status'>) => Promise<Txn>;
  transition: (id: string, to: TxnStatus, note?: string, actorId?: string) => Promise<{ ok: boolean; message: string }>;
  reverseTxn: (id: string) => Promise<{ ok: boolean; message: string }>;
  inventory: InventoryItem[];
  adjustInventory: (id: string, delta: number, reason?: string) => Promise<void>;
  setInventoryQty: (id: string, qty: number, reason?: string) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, patch: Partial<Omit<InventoryItem, 'id' | 'quantity'>>) => Promise<void>;
  pos: PurchaseOrder[];
  addPO: (po: Omit<PurchaseOrder, 'id' | 'total'>) => Promise<void>;
  sendPO: (id: string) => Promise<void>;
  cancelPO: (id: string) => Promise<void>;
  receivePOLine: (id: string, lineIdx: number, qty: number) => Promise<{ ok: boolean; message: string }>;
  journal: JournalEntry[];
  queueJournal: (id: string) => Promise<{ ok: boolean; message: string }>;
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
  const [userId, setUserId] = useState<string | null>(() => (LIVE_MODE ? null : load('user', null as string | null)));
  const [demoAuthed, setDemoAuthed] = useState<boolean>(() => load('demoAuth', false));
  const [txns, setTxns] = useState<Txn[]>(() => (LIVE_MODE
    ? []
    : load('txns', seedTransactions).map(t => ({
      ...t,
      createdBy: t.createdBy ?? staffIdForName(t.enteredBy) ?? undefined,
    }))));
  const [liveStaff, setLiveStaff] = useState<LiveMembership | null>(null);
  const [liveError, setLiveError] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>(() => (LIVE_MODE ? [] : load('inv', seedInventory)));
  const [pos, setPos] = useState<PurchaseOrder[]>(() => (LIVE_MODE ? [] : load('pos', seedPOs).map(normalizePO)));
  const [journal, setJournal] = useState<JournalEntry[]>(() => load('je', seedJournal));
  const [audit, setAudit] = useState<AuditEvent[]>(() => load('audit', seedAudit));

  useEffect(() => {
    try {
      if (!LIVE_MODE) localStorage.setItem(KEY + ':user', JSON.stringify(userId));
      localStorage.setItem(KEY + ':demoAuth', JSON.stringify(demoAuthed));
      // Live transactions are never written to localStorage: demo and live
      // records must not mix invisibly.
      if (!LIVE_MODE) localStorage.setItem(KEY + ':txns', JSON.stringify(txns));
      // Live POs/inventory live server-side only (Slice 4); demo copies stay local.
      if (!LIVE_MODE) localStorage.setItem(KEY + ':inv', JSON.stringify(inventory));
      if (!LIVE_MODE) localStorage.setItem(KEY + ':pos', JSON.stringify(pos));
      localStorage.setItem(KEY + ':je', JSON.stringify(journal));
      localStorage.setItem(KEY + ':audit', JSON.stringify(audit));
    } catch { /* private mode */ }
  }, [userId, demoAuthed, txns, inventory, pos, journal, audit]);

  const liveClient = () => getSupabaseClient(ENV.url ?? '', ENV.anonKey ?? '');

  const refreshLiveTxns = async () => {
    const rows = await listLiveTxns(liveClient());
    setTxns(rows);
  };

  /** Reload all live operational state (transactions + POs + inventory). */
  const loadLiveAll = async () => {
    const [t, p, inv] = await Promise.all([
      listLiveTxns(liveClient()),
      listLivePOs(liveClient()),
      listLiveInventory(liveClient()),
    ]);
    setTxns(t);
    setPos(p);
    setInventory(inv);
  };

  // Live session → linked membership. Runs only in live mode.
  useEffect(() => {
    if (!LIVE_MODE) return;
    let cancelled = false;
    liveClient().auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (!session) return;
      try {
        const m = await resolveLiveMembership(liveClient());
        if (cancelled) return;
        if (!m) {
          setLiveError('Signed in, but this login is not linked to a staff record. Ask an administrator to link it (docs/SLICE_1_SETUP.md §3).');
          return;
        }
        setLiveStaff(m);
        setLiveError('');
        await loadLiveAll();
      } catch (e) {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : 'Live load failed.');
      }
    });
    const { data: { subscription } } = liveClient().auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      if (!session) {
        setLiveStaff(null);
        setLiveError('');
        setTxns([]);
        setPos([]);
        setInventory([]);
        return;
      }
      try {
        const m = await resolveLiveMembership(liveClient());
        if (cancelled) return;
        if (!m) {
          setLiveStaff(null);
          setLiveError('Signed in, but this login is not linked to a staff record. Ask an administrator to link it (docs/SLICE_1_SETUP.md §3).');
          return;
        }
        setLiveStaff(m);
        setLiveError('');
        await loadLiveAll();
      } catch (e) {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : 'Live load failed.');
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const user = useMemo(() => {
    if (LIVE_MODE) return liveStaff ? membershipToStaff(liveStaff) : null;
    return STAFF.find(s => s.id === userId) ?? null;
  }, [liveStaff, userId]);

  const log = (action: string, ref: string, detail: string) => {
    const actor = user?.name ?? 'Demo user';
    const now = new Date();
    const at = now.toLocaleString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    setAudit(a => [{ id: 'A-' + Date.now(), at, actor, action, ref, detail }, ...a].slice(0, 200));
  };

  // Narrow a frontend transaction to the server-accepted draft shape.
  const toDraft = (t: Omit<Txn, 'id' | 'status'>): TxnDraft => ({
    date: t.date,
    businessUnit: t.businessUnit,
    classification: t.classification,
    kind: t.kind,
    item: t.item,
    category: t.category,
    supplier: t.supplier,
    supplierPrice: t.supplierPrice,
    retailPrice: t.retailPrice,
    quantity: t.quantity,
    amount: t.amount,
    accountCode: t.accountCode,
    accountName: t.accountName,
    remarks: t.remarks,
  });

  const refreshLiveTxnsSafe = async () => {
    try {
      setTxns(await listLiveTxns(liveClient()));
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Live refresh failed.');
    }
  };

  /** Persist a system-generated transaction (receipt payable, journal queue). */
  const persistTxn = async (t: Omit<Txn, 'id' | 'status'>): Promise<Txn> => {
    if (!LIVE_MODE) throw new Error('persistTxn is live-only.');
    if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
    const created = await createLiveTxn(liveClient(), toDraft(t), `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    await refreshLiveTxnsSafe();
    return created;
  };

  const value: Store = {
    user,
    login: (id) => setUserId(id),
    logout: () => { setUserId(null); setDemoAuthed(false); },
    demoAuthed,
    unlockDemo: (username, password) => {
      if (!verifyDemoLogin(username, password)) {
        return { ok: false, message: 'Incorrect demo username or password. Check the presentation credentials and try again.' };
      }
      setDemoAuthed(true);
      setUserId(prev => prev ?? 'dani');
      return { ok: true, message: 'Demo access unlocked.' };
    },
    mode: SETUP_ERROR ? 'setup-error' : LIVE_MODE ? 'live' : 'demo',
    liveStaff,
    liveError,
    liveLogin: async (email, password) => {
      if (!LIVE_MODE || !ENV.url || !ENV.anonKey) return { ok: false, message: 'Live backend is not configured.' };
      try {
        const m = await signInLive(ENV.url, ENV.anonKey, email, password);
        setLiveStaff(m);
        setLiveError('');
        await loadLiveAll();
        return { ok: true, message: `Signed in as ${m.name} (${m.role}).` };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sign-in failed.';
        setLiveError(message);
        return { ok: false, message };
      }
    },
    liveLogout: async () => {
      if (LIVE_MODE && ENV.url && ENV.anonKey) await signOutLive(ENV.url, ENV.anonKey);
      setLiveStaff(null);
      setLiveError('');
      setTxns([]);
      setPos([]);
      setInventory([]);
    },
    refreshLiveTxns: async () => {
      if (!LIVE_MODE) return;
      setTxns(await listLiveTxns(liveClient()));
    },
    txns,
    addTxn: async (t) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        const created = await createLiveTxn(liveClient(), toDraft(t), `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await refreshLiveTxnsSafe();
        return created;
      }
      const txn: Txn = { ...t, createdBy: user?.id, id: nextTxnId(txns.map(x => x.id)), status: 'For Accountant Review' };
      setTxns(x => [txn, ...x]);
      const actor = STAFF.find(s => s.name === t.enteredBy)?.name ?? t.enteredBy;
      setAudit(a => [{ id: 'A-' + Date.now(), at: new Date().toLocaleString(), actor, action: 'Created transaction', ref: txn.id, detail: t.item }, ...a]);
      return txn;
    },
    transition: async (id, to, note, actorId) => {
      if (LIVE_MODE) {
        try {
          await transitionLiveTxn(liveClient(), id, to, note);
          await refreshLiveTxnsSafe();
          return { ok: true, message: `${id}: ${to} (live).` };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : 'Live transition failed.' };
        }
      }
      const cur = txns.find(t => t.id === id);
      if (!cur) return { ok: false, message: `Transaction ${id} not found — no change made.` };
      const blocked = guardTransition(cur, to, actorId);
      if (blocked) return { ok: false, message: blocked };
      if (cur.status === to) return { ok: false, message: `${id} is already ${to} — repeated action ignored.` };
      if (!isAllowed(cur.status, to))
        return { ok: false, message: `Cannot move ${id} from ${cur.status} to ${to}. Follow the Entry → Review → Approval → Posting order.` };
      setTxns(x => x.map(t => (t.id === id ? { ...t, status: to, remarks: note ?? t.remarks } : t)));
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
      return { ok: true, message: `${id}: ${labels[to] ?? to}.` };
    },
    reverseTxn: async (id) => {
      if (LIVE_MODE) {
        try {
          const rev = await reverseLiveTxn(liveClient(), id);
          await refreshLiveTxnsSafe();
          return { ok: true, message: `${id} locked as Reversed. Offsetting entry ${rev.id} queued for accountant review (live).` };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : 'Live reversal failed.' };
        }
      }
      const cur = txns.find(t => t.id === id);
      if (!cur) return { ok: false, message: `Transaction ${id} not found — no change made.` };
      if (cur.status !== 'Posted') return { ok: false, message: `Only Posted entries can be reversed (${id} is ${cur.status}).` };
      // The original is locked as Reversed; the offsetting correction is a
      // real queued entry so it passes through review like everything else.
      const rev: Txn = {
        ...cur,
        id: nextTxnId(txns.map(x => x.id)),
        item: `REVERSAL of ${id} — ${cur.item}`,
        status: 'For Accountant Review',
        reversalOf: id,
        createdBy: user?.id,
        enteredBy: user?.name ?? 'Demo user',
        remarks: `Correcting reversal of posted entry ${id}. Original preserved; this reversal needs review before posting.`,
      };
      setTxns(x => [rev, ...x.map(t => (t.id === id ? { ...t, status: 'Reversed' as const } : t))]);
      const actor = user?.name ?? 'Demo user';
      setAudit(a => [
        { id: 'A-' + Date.now(), at: new Date().toLocaleString(), actor, action: 'Reversal recorded', ref: id, detail: `Original locked as Reversed; offsetting entry ${rev.id} queued for review` },
      ...a].slice(0, 200));
      return { ok: true, message: `${id} locked as Reversed. Offsetting entry ${rev.id} queued for accountant review.` };
    },
    inventory,
    adjustInventory: async (id, delta, reason) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await adjustLiveStock(liveClient(), id, delta, reason?.trim() || 'Manual adjustment');
        await loadLiveAll();
        return;
      }
      setInventory(x => x.map(i => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory adjusted', item?.item ?? id, `${delta > 0 ? '+' : ''}${delta} (now ${Math.max(0, (item?.quantity ?? 0) + delta)})${reason ? ' — ' + reason : ''} · demo only`);
    },
    setInventoryQty: async (id, qty, reason) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        const cur = inventory.find(i => i.id === id);
        if (!cur) throw new Error('Inventory item not found.');
        const delta = Math.max(0, qty) - cur.quantity;
        if (delta === 0) return;
        await adjustLiveStock(liveClient(), id, delta, reason?.trim() || 'Quantity set via import');
        await loadLiveAll();
        return;
      }
      setInventory(x => x.map(i => (i.id === id ? { ...i, quantity: Math.max(0, qty) } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory quantity set', item?.item ?? id, `Set to ${Math.max(0, qty)}${reason ? ' — ' + reason : ''} · demo only`);
    },
    addInventoryItem: async (item) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await addLiveItem(liveClient(), {
          businessUnit: item.businessUnit, type: item.type, item: item.item,
          category: item.category, quantity: item.quantity, amount: item.amount,
          supplier: item.supplier, supplierPrice: item.supplierPrice,
          retailPrice: item.retailPrice, reorderLevel: item.reorderLevel,
        }, `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await loadLiveAll();
        return;
      }
      const rec = { ...item, createdBy: user?.id, id: 'INV-' + Date.now() };
      setInventory(x => [rec, ...x]);
      log('Inventory item added (demo import)', rec.item, rec.businessUnit + ' · qty ' + rec.quantity);
    },
    updateInventoryItem: async (id, patch) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await updateLiveItem(liveClient(), id, patch as Record<string, unknown>);
        await loadLiveAll();
        return;
      }
      setInventory(x => x.map(i => (i.id === id ? { ...i, ...patch } : i)));
      const item = inventory.find(i => i.id === id);
      log('Inventory item edited', item?.item ?? id, Object.keys(patch).join(', ') + ' · demo only');
    },
    pos,
    addPO: async (po) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await createLivePO(liveClient(), {
          poNo: po.poNo, date: po.date, supplier: po.supplier,
          businessUnit: po.businessUnit, deliveryDate: po.deliveryDate,
          items: po.items.map(l => ({ item: l.item, quantity: l.quantity, supplierPrice: l.supplierPrice })),
        }, `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await loadLiveAll();
        return;
      }
      const items = po.items.map(l => ({ ...l, receivedQty: l.receivedQty ?? 0 }));
      const total = items.reduce((s, i) => s + i.quantity * i.supplierPrice, 0);
      const rec: PurchaseOrder = { ...po, items, createdBy: user?.id, id: 'PO-' + Date.now(), total };
      setPos(x => [rec, ...x]);
      log('Purchase order created', po.poNo, po.supplier + ' — ' + po.businessUnit);
    },
    sendPO: async (id) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await sendLivePO(liveClient(), id);
        await loadLiveAll();
        return;
      }
      setPos(x => x.map(p => (p.id === id && p.status === 'Draft' ? { ...p, status: 'Sent to Supplier' as const } : p)));
      const po = pos.find(p => p.id === id);
      if (po) log('P.O. sent to supplier', po.poNo, po.supplier + ' · delivery ' + po.deliveryDate);
    },
    cancelPO: async (id) => {
      if (LIVE_MODE) {
        if (!liveStaff) throw new Error('Sign in with a linked staff account first.');
        await cancelLivePO(liveClient(), id);
        await loadLiveAll();
        return;
      }
      setPos(x => x.map(p => {
        if (p.id !== id) return p;
        if (p.status === 'Received' || p.status === 'Cancelled') return p;
        return { ...p, status: 'Cancelled' as const };
      }));
      const po = pos.find(p => p.id === id);
      if (po) log('P.O. cancelled', po.poNo, 'Outstanding lines voided · demo only');
    },
    receivePOLine: async (id, lineIdx, qty) => {
      const po = pos.find(p => p.id === id);
      if (!po) return { ok: false, message: 'Purchase order not found.' };
      const today = new Date().toISOString().slice(0, 10);
      const res = applyReceipt(po, lineIdx, qty, today);
      if ('error' in res) return { ok: false, message: res.error };
      const line = po.items[lineIdx];
      if (LIVE_MODE) {
        // Slice 4: the whole receipt (stock + payable) happens atomically
        // server-side. Demo-created rows carry no database line id and cannot
        // be receipted live — said explicitly, never silently.
        if (!liveStaff) return { ok: false, message: 'Sign in with a linked staff account first.' };
        if (line.lineId == null) {
          return { ok: false, message: 'This order predates the live backend and has no database lines. Create a new live P.O. to receive against it.' };
        }
        try {
          const r = await recordLiveReceipt(
            liveClient(), po.id, line.lineId, res.receivedQty,
            `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          );
          await loadLiveAll();
          if (r.duplicate) {
            return { ok: true, message: 'Receipt already recorded — no double count (live).' };
          }
          return {
            ok: true,
            message: `Received ${res.receivedQty} × ${line.item} — stock updated, payable ${r.payableId ?? ''} queued for accountant review (live).`,
          };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : 'Live receipt failed.' };
        }
      }
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
          createdBy: user?.id,
        };
        setInventory(x => [rec, ...x]);
      }
      const draft = {
        date: today, businessUnit: po.businessUnit, classification: 'Liability' as const,
        kind: 'Journal' as const, item: `Supplier billing — ${po.poNo} (${line.item} × ${res.receivedQty})`,
        category: 'Medical Supplies', supplier: po.supplier,
        supplierPrice: line.supplierPrice, retailPrice: 0, quantity: res.receivedQty,
        amount: res.receivedValue, accountCode: '2000', accountName: 'Accounts Payable',
        enteredBy: user?.name ?? 'Demo user', createdBy: user?.id, status: 'For Accountant Review' as const,
        remarks: `Auto-queued from P.O. receipt ${po.poNo} — awaiting accountant review, not posted`,
      };
      let txnId: string;
      if (LIVE_MODE) {
        try {
          const created = await persistTxn(draft);
          txnId = created.id;
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : 'Live payable queueing failed.' };
        }
      } else {
        const txn: Txn = { ...draft, id: nextTxnId(txns.map(x => x.id)) };
        setTxns(x => [txn, ...x]);
        txnId = txn.id;
      }
      const actor = user?.name ?? 'Demo user';
      setAudit(a => [
        { id: 'A-' + Date.now(), at: new Date().toLocaleString(), actor, action: 'P.O. receipt recorded', ref: po.poNo, detail: `${line.item} × ${res.receivedQty} received; stock updated; ${txnId} queued for review` },
      ...a].slice(0, 200));
      return {
        ok: true,
        message: `Received ${res.receivedQty} × ${line.item} — stock updated, ${txnId} queued for accountant review${res.fullyReceived ? '; order fully received' : ''}.`,
      };
    },
    journal,
    queueJournal: async (id) => {
      const j = journal.find(x => x.id === id);
      if (!j) return { ok: false, message: 'Journal entry not found — no change made.' };
      if (j.status !== 'Draft') return { ok: false, message: `${j.ref} is already ${j.status} — repeated action ignored.` };
      if (j.queuedTxn) return { ok: false, message: `${j.ref} is already queued as ${j.queuedTxn} — duplicate queueing blocked.` };
      // Map the debit side to a transaction classification for review.
      const code = (j.debitAccount.split('—')[0] ?? j.debitAccount.split('-')[0] ?? '').trim();
      const acct = COA.find(c => c.code === code);
      const cls = (acct && ['Expense', 'Revenue', 'Asset', 'Liability'].includes(acct.type) ? acct.type : 'Asset') as Txn['classification'];
      const draft = {
        date: j.date, businessUnit: j.businessUnit, classification: cls, kind: 'Journal' as const,
        item: j.particulars, category: 'Medical Supplies', supplier: '—',
        supplierPrice: 0, retailPrice: 0, quantity: 1, amount: j.amount,
        accountCode: code || '5000', accountName: acct?.name ?? j.debitAccount,
        enteredBy: user?.name ?? 'Demo user', createdBy: user?.id, status: 'For Accountant Review' as const,
        remarks: `Queued from journal draft ${j.ref} — needs accountant review, not posted`,
      };
      let txnId: string;
      if (LIVE_MODE) {
        try {
          txnId = (await persistTxn(draft)).id;
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : 'Live journal queueing failed.' };
        }
      } else {
        const txn: Txn = { ...draft, id: nextTxnId(txns.map(x => x.id)) };
        setTxns(x => [txn, ...x]);
        txnId = txn.id;
      }
      setJournal(x => x.map(xj => (xj.id === id ? { ...xj, queuedTxn: txnId } : xj)));
      log('Journal draft queued for review', j.ref, `Queued as ${txnId}; draft stays unposted until approved`);
      return { ok: true, message: `${j.ref} queued as ${txnId} for accountant review. The draft stays unposted.` };
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
