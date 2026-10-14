import React from 'react';
import { Link } from 'react-router-dom';
import { CLASSIFICATIONS, ITEM_CATEGORIES, TRANSACTION_KINDS } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead } from '../components/ui';

const KIND_META: Record<string, { desc: string; to: string }> = {
  Disbursement: { desc: 'Payments to suppliers and operating pay-outs. Requires Supplier, Item, and receipt reference.', to: '/admin/disbursement' },
  Journal: { desc: 'Non-cash adjustments, transfers, and corrections. Posts only after approval.', to: '/admin/journal' },
};

// Selectable types only — historical Cash In / Cash Out records are preserved
// in data but no longer offered as choices.
const KINDS = TRANSACTION_KINDS.map(name => ({ name, ...KIND_META[name] }));

export default function TransactionTypes() {
  const { txns } = useStore();
  const count = (k: string) => txns.filter(t => t.kind === k).length;
  return (
    <>
      <PageHead title="Transaction Types" sub="Available types for new entries. Historical Cash In / Cash Out records are preserved in data and reports but are no longer selectable." />
      <div className="grid g2">
        {KINDS.map(k => (
          <div className="card" key={k.name}>
            <h3>{k.name} · {count(k.name)} entries (demo)</h3>
            <p className="small muted">{k.desc}</p>
            <Link className="btn small ghost" to={k.to}>Open {k.name} →</Link>
          </div>
        ))}
      </div>
      <div className="grid g2">
        <div className="card"><h3>Classifications</h3>{CLASSIFICATIONS.map(c => <div key={c} style={{ padding: '6px 0', borderBottom: '1px solid #eef1f7' }}><strong>{c}</strong><span className="small muted"> — {txns.filter(t => t.classification === c).length} entries</span></div>)}</div>
        <div className="card"><h3>Item categories</h3>{ITEM_CATEGORIES.map(c => <div key={c} style={{ padding: '6px 0', borderBottom: '1px solid #eef1f7' }}><strong>{c}</strong><span className="small muted"> — uses Supplier Price & Retail Price where applicable</span></div>)}</div>
      </div>
    </>
  );
}
