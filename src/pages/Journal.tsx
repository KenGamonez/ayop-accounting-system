import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Journal() {
  const { journal, queueJournal } = useStore();
  const [ref, setRef] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = journal.filter(j => !ref || (j.ref + j.particulars).toLowerCase().includes(ref.toLowerCase()));
  const drafts = rows.filter(j => j.status === 'Draft');

  const queue = (id: string) => {
    const res = queueJournal(id);
    setFeedback({ ok: res.ok, text: res.message });
  };

  return (
    <>
      <PageHead title="Journal" sub="Double-entry journal preview. Drafts never post directly — they queue for accountant review like every other entry. Corrections use reversals, not edits of posted rows." />
      <div className="notice">Demo rule: <strong>Draft</strong> journal rows queue for review; <strong>Posted</strong> rows are locked. Only posted transactions feed the General Ledger and statements.</div>
      {feedback && <div className={feedback.ok ? 'notice' : 'warn'}>{feedback.text}</div>}
      <div className="card">
        <h3>Drafts awaiting review ({drafts.length})</h3>
        {drafts.length === 0
          ? <p className="small muted">No drafts. Opening-balance imports and adjustments appear here for review.</p>
          : <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
            <tbody>{drafts.map(j => (
              <tr key={j.id}><td>{j.date}</td><td><strong>{j.ref}</strong><div className="small muted">{j.businessUnit}</div></td>
                <td>{j.particulars}<div className="small muted">Source: {j.sourceTxn}</div></td>
                <td>{j.debitAccount}</td><td>{j.creditAccount}</td><td className="num"><Money n={j.amount} /></td>
                <td>{j.queuedTxn
                  ? <span className="small muted">Queued as <Link to="/admin/approval">{j.queuedTxn}</Link> — awaiting review</span>
                  : <button className="btn small" onClick={() => queue(j.id)}>Queue for review</button>}</td></tr>
            ))}</tbody></table></div>}
      </div>
      <div className="card">
        <h3>All entries ({rows.length})</h3>
        <div className="filters"><input placeholder="Search ref / particulars" value={ref} onChange={e => setRef(e.target.value)} style={{ minWidth: 240 }} /></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
          <tbody>{rows.map(j => (
            <tr key={j.id}><td>{j.date}</td><td><strong>{j.ref}</strong><div className="small muted">{j.businessUnit}</div></td>
              <td>{j.particulars}<div className="small muted">Source: {j.sourceTxn}{j.queuedTxn ? ` · queued as ${j.queuedTxn}` : ''}</div></td>
              <td>{j.debitAccount}</td><td>{j.creditAccount}</td><td className="num"><Money n={j.amount} /></td>
              <td><Pill status={j.status} /></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
