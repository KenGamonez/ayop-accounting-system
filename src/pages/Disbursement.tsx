import React, { useState } from 'react';
import { peso } from '../data/seed';
import { disbursementEntryLines } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill } from '../components/ui';
import VoucherPrint, { voucherTitleFor } from '../components/VoucherPrint';
import EntryBook from '../components/EntryBook';

export default function Disbursement() {
  const { txns } = useStore();
  const [viewId, setViewId] = useState<string | null>(null);

  // Read-only view of one saved disbursement. Selecting a record only renders
  // it — no store write, so its status and financial values never change.
  const viewTxn = viewId ? txns.find(t => t.id === viewId && t.kind === 'Disbursement') ?? null : null;
  const viewLines = viewTxn ? disbursementEntryLines(viewTxn) : [];
  const viewTotalDr = viewLines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const viewTotalCr = viewLines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const viewControlNo = viewTxn ? (viewTxn.controlNo ?? viewTxn.id) : '';

  if (viewTxn) {
    return (
      <>
        <div className="no-print">
          <PageHead
            title="Disbursement entry"
            sub={`Saved record ${viewTxn.id} — read-only. Viewing or printing never changes it.`}
            actions={<button className="btn" onClick={() => setViewId(null)}>Back to list</button>}
          />
          <div className="card">
            <h3>Disbursement {viewTxn.id} <Pill status={viewTxn.status} /></h3>
            <div className="form-grid">
              <div><div className="small muted">Date</div><div>{viewTxn.date}</div></div>
              <div><div className="small muted">Business Unit</div><div>{viewTxn.businessUnit}</div></div>
              <div><div className="small muted">Transaction Type</div><div>{viewTxn.kind}</div></div>
              <div><div className="small muted">Control No.</div><div className="mono">{viewControlNo}</div></div>
              <div className="full"><div className="small muted">Particulars</div><div>{viewTxn.item || '—'}</div></div>
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
              <span className="small muted">Prints as {voucherTitleFor(viewTxn.kind)} using the saved control number and lines.</span>
            </div>
          </div>
        </div>
        <div className="print-only">
          <VoucherPrint
            controlNo={viewControlNo}
            date={viewTxn.date}
            businessUnit={viewTxn.businessUnit}
            transactionType={viewTxn.kind}
            particulars={viewTxn.item}
            lines={viewLines}
            signatories={viewTxn.signatories ?? { preparedBy: '', postedBy: '', approvedBy: '', auditedBy: '' }}
            recordNo={viewTxn.id}
            status={viewTxn.status}
          />
        </div>
      </>
    );
  }

  return <EntryBook title="Disbursement" onView={setViewId} />;
}
