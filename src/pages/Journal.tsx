import React, { useState } from 'react';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Journal() {
  const { journal, postJournal } = useStore();
  const [ref, setRef] = useState('');
  const rows = journal.filter(j => !ref || (j.ref + j.particulars).toLowerCase().includes(ref.toLowerCase()));
  return (
    <>
      <PageHead title="Journal" sub="Double-entry journal preview. Draft entries do not affect the ledger until posted. Corrections use reversals, not edits of posted rows." />
      <div className="notice">Demo rule: <strong>Posted</strong> journal rows are protected from ordinary edits. To correct, record a reversal entry.</div>
      <div className="card">
        <div className="filters"><input placeholder="Search ref / particulars" value={ref} onChange={e => setRef(e.target.value)} style={{ minWidth: 240 }} /></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map(j => (
            <tr key={j.id}><td>{j.date}</td><td><strong>{j.ref}</strong><div className="small muted">{j.businessUnit}</div></td>
              <td>{j.particulars}<div className="small muted">Source: {j.sourceTxn}</div></td>
              <td>{j.debitAccount}</td><td>{j.creditAccount}</td><td className="num"><Money n={j.amount} /></td>
              <td><Pill status={j.status} /></td>
              <td>{j.status === 'Draft' ? <button className="btn small" onClick={() => postJournal(j.id)}>Post</button> : <span className="small muted">Locked</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
