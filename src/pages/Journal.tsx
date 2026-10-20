import React, { useState } from 'react';
import { peso } from '../data/seed';
import { journalEntryLines } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill } from '../components/ui';
import VoucherPrint, { voucherTitleFor } from '../components/VoucherPrint';
import EntryBook from '../components/EntryBook';

export default function Journal() {
  const { journal } = useStore();
  const [viewId, setViewId] = useState<string | null>(null);

  // Read-only view of one saved journal entry — renders only, never mutates.
  const viewEntry = viewId ? journal.find(j => j.id === viewId) ?? null : null;
  const viewLines = viewEntry ? journalEntryLines(viewEntry) : [];
  const viewTotalDr = viewLines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const viewTotalCr = viewLines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const viewControlNo = viewEntry ? (viewEntry.controlNo ?? viewEntry.ref) : '';

  if (viewEntry) {
    return (
      <>
        <div className="no-print">
          <PageHead
            title="Journal entry"
            sub={`Saved record ${viewEntry.ref} — read-only. Viewing or printing never changes it.`}
            actions={<button className="btn" onClick={() => setViewId(null)}>Back to list</button>}
          />
          <div className="card">
            <h3>Journal {viewEntry.ref} <Pill status={viewEntry.status} /></h3>
            <div className="form-grid">
              <div><div className="small muted">Date</div><div>{viewEntry.date}</div></div>
              <div><div className="small muted">Business Unit</div><div>{viewEntry.businessUnit}</div></div>
              <div><div className="small muted">Transaction Type</div><div>Journal</div></div>
              <div><div className="small muted">Control No.</div><div className="mono">{viewControlNo}</div></div>
              <div className="full"><div className="small muted">Particulars</div><div>{viewEntry.particulars || '—'}</div></div>
            </div>
            <div className="tbl-wrap" style={{ marginTop: 12 }}><table className="tbl">
              <thead><tr><th>Account Title</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
              <tbody>
                {viewLines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.accountCode ? `${l.accountCode} — ${l.accountName}` : '—'}</td>
                    <td className="num">{l.debit > 0 ? peso(l.debit) : '—'}</td>
                    <td className="num">{l.credit > 0 ? peso(l.credit) : '—'}</td>
                  </tr>
                ))}
                <tr className="total-row"><td><strong>Total</strong></td><td className="num"><strong>{peso(viewTotalDr)}</strong></td><td className="num"><strong>{peso(viewTotalCr)}</strong></td></tr>
              </tbody>
            </table></div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn blue" onClick={() => window.print()}>Print voucher</button>
              <button className="btn ghost" onClick={() => setViewId(null)}>Back to list</button>
              <span className="small muted">Prints as {voucherTitleFor('Journal')} using the saved control number and lines.</span>
            </div>
            {viewEntry.queuedTxn && <div className="small muted" style={{ marginTop: 8 }}>Queued as {viewEntry.queuedTxn} — awaiting review.</div>}
          </div>
        </div>
        <div className="print-only">
          <VoucherPrint
            controlNo={viewControlNo}
            date={viewEntry.date}
            businessUnit={viewEntry.businessUnit}
            transactionType="Journal"
            particulars={viewEntry.particulars}
            lines={viewLines}
            signatories={viewEntry.signatories ?? { preparedBy: '', postedBy: '', approvedBy: '', auditedBy: '' }}
            recordNo={viewEntry.ref}
            status={viewEntry.status}
            note={viewEntry.queuedTxn ? `Queued as ${viewEntry.queuedTxn} — awaiting review.` : undefined}
          />
        </div>
      </>
    );
  }

  return <EntryBook title="Journal" onView={setViewId} />;
}
