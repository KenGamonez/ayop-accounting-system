import React from 'react';
import { peso } from '../data/seed';

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="btn-row no-print">{actions}</div>}
    </div>
  );
}

export function Pill({ status }: { status: string }) {
  const cls =
    status === 'Posted' || status === 'Received' || status === 'Approved' ? 'p-posted'
    : status.includes('Review') || status.includes('Approval') || status.includes('Sent') || status.includes('Partial') || status === 'Accountant Reviewed' || status === 'For Owner Approval' ? 'p-review'
    : status === 'Rejected' || status === 'Cancelled' ? 'p-rejected'
    : status === 'Reversed' ? 'p-reversed'
    : status === 'Draft' ? 'p-draft'
    : 'p-default';
  return <span className={'pill ' + cls}>{status}</span>;
}

export function Money({ n }: { n: number }) {
  return <span className="num mono">{peso(n)}</span>;
}

export function WorkflowSteps({ status }: { status: string }) {
  const order = ['Entry', 'Accountant Review', 'Owner Approval', 'Posted'];
  const idx =
    status === 'Draft' || status === 'For Accountant Review' ? 0
    : status === 'Accountant Reviewed' ? 1
    : status === 'For Owner Approval' || status === 'Approved' ? 2
    : status === 'Posted' ? 4
    : status === 'Rejected' ? -1
    : 0;
  if (status === 'Rejected') return <div className="warn">Rejected — returned for correction. Edit details and resubmit for accountant review.</div>;
  if (status === 'Reversed') return <div className="warn">Reversed — original preserved. Correction recorded as an adjustment entry (demo).</div>;
  return (
    <div className="steps">
      {order.map((s, i) => (
        <div key={s} className={'step ' + (idx > i ? 'done' : idx === i ? 'now' : '')}>
          {i + 1}. {s}{idx > i ? ' ✓' : ''}
        </div>
      ))}
    </div>
  );
}
