import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TxnStatus } from '../data/seed';
import { nextRoleFor } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money, WorkflowSteps } from '../components/ui';

export default function Approval() {
  const { txns, transition, reverseTxn, user } = useStore();
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const queue = txns.filter(t => ['For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved'].includes(t.status));
  const done = txns.filter(t => ['Posted', 'Rejected', 'Reversed'].includes(t.status));

  const act = (id: string, to: TxnStatus) => {
    if (to === 'Rejected' && !note.trim()) {
      setFeedback({ ok: false, text: `Give a rejection reason for ${id} so staff know what to correct — nothing was changed.` });
      return;
    }
    if (to === 'Posted' && !confirm(`Post ${id} to the General Ledger? Posted entries lock and can only be corrected by reversal.`)) return;
    const res = transition(id, to, note.trim() || `${to} by ${user?.name ?? 'demo'} (simulated — no backend enforcement)`);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) setNote('');
  };

  const reverse = (id: string) => {
    if (!confirm(`Record a reversal for posted entry ${id}? The original locks as Reversed and an offsetting entry queues for review.`)) return;
    const res = reverseTxn(id);
    setFeedback({ ok: res.ok, text: res.message });
  };

  return (
    <>
      <PageHead title="Approval" sub="Transaction Entry → Accountant Review → Owner / Management Approval → General Ledger posting. Simulated here with local state; pending items never post." />
      {feedback && <div className={feedback.ok ? 'notice' : 'warn'}>{feedback.text}</div>}
      <div className="card">
        <h3>Approval queue ({queue.length})</h3>
        {queue.length === 0
          ? <div className="notice">Queue is clear — nothing awaiting review. New entries from <Link to="/admin/transaction">Transaction</Link> appear here.</div>
          : <label className="f" style={{ maxWidth: 480, marginBottom: 10 }}>Reviewer note (applies to next action; required when rejecting)<input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Receipts verified against P.O." /></label>}
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID / Progress</th><th>Item / Supplier</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{queue.map(t => (
            <tr key={t.id}>
              <td><strong>{t.id}</strong><div className="small muted">{t.date} · {t.businessUnit} · {t.classification} · by {t.enteredBy}</div><WorkflowSteps status={t.status} />
                <div className="small" style={{ color: '#1e3568' }}><strong>Next:</strong> {nextRoleFor(t.status)}</div></td>
              <td>{t.item}<div className="small muted">Supplier: {t.supplier} · Qty {t.quantity} · Acct {t.accountCode}</div><div className="small muted">{t.remarks}</div></td>
              <td className="num"><Money n={t.amount} /></td>
              <td><Pill status={t.status} /></td>
              <td><div className="btn-row">
                {t.status === 'For Accountant Review' && <button className="btn small" onClick={() => act(t.id, 'Accountant Reviewed')}>Accountant: Mark reviewed</button>}
                {t.status === 'Accountant Reviewed' && <button className="btn small" onClick={() => act(t.id, 'For Owner Approval')}>Forward to owner</button>}
                {t.status === 'For Owner Approval' && <button className="btn small" onClick={() => act(t.id, 'Approved')}>Owner: Approve</button>}
                {t.status === 'Approved' && <button className="btn small blue" onClick={() => act(t.id, 'Posted')}>Post to ledger</button>}
                <button className="btn small danger" onClick={() => act(t.id, 'Rejected')}>Reject / return</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card">
        <h3>Decided ({done.length}) — posted rows are locked; corrections use reversal</h3>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Item</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>{done.map(t => (
            <tr key={t.id}><td>{t.id}</td><td>{t.item}<div className="small muted">{t.remarks}</div></td><td className="num"><Money n={t.amount} /></td><td><Pill status={t.status} /></td>
              <td>{t.status === 'Posted' ? <button className="btn small ghost" onClick={() => reverse(t.id)}>Record reversal</button> : t.status === 'Rejected' ? <button className="btn small ghost" onClick={() => act(t.id, 'For Accountant Review')}>Resubmit</button> : <span className="small muted">Closed</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
