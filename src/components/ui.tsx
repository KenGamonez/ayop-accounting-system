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

/**
 * Display-only status label (UI simplification; underlying TxnStatus values
 * are unchanged). Review-stage states collapse to "For Review" and the
 * owner stage reads "For Approval". Exact status is kept in the title
 * tooltip so reviewers always see the true workflow value.
 */
export function displayStatus(status: string): string {
  if (status === 'For Accountant Review' || status === 'Accountant Reviewed') return 'For Review';
  if (status === 'For Owner Approval') return 'For Approval';
  return status;
}

export function Pill({ status }: { status: string }) {
  const cls =
    status === 'Posted' || status === 'Received' || status === 'Approved' ? 'p-posted'
    : status.includes('Review') || status.includes('Approval') || status.includes('Sent') || status.includes('Partial') || status === 'Accountant Reviewed' || status === 'For Owner Approval' ? 'p-review'
    : status === 'Rejected' || status === 'Cancelled' ? 'p-rejected'
    : status === 'Reversed' ? 'p-reversed'
    : status === 'Draft' ? 'p-draft'
    : 'p-default';
  const label = displayStatus(status);
  const simplified = label !== status;
  return <span className={'pill ' + cls} title={simplified ? status : undefined}>{label}</span>;
}

export function Money({ n }: { n: number }) {
  return <span className="num mono">{peso(n)}</span>;
}

/**
 * Presentation-only workflow stepper for the existing chain:
 * New Entry → Accountant Review → Submit for Review → Approval,
 * then General Ledger posting as a separate locked outcome.
 * Status values, transitions, and permissions are untouched — this only
 * relabels the visual steps. Posted is shown as a terminal state, never
 * implied before the posting action runs.
 */
export function WorkflowSteps({ status }: { status: string }) {
  const order = ['New Entry', 'Accountant Review', 'Submit for Review', 'Approval'];
  const idx =
    status === 'Draft' ? 0
    : status === 'For Accountant Review' ? 1
    : status === 'Accountant Reviewed' ? 2
    : status === 'For Owner Approval' || status === 'Approved' ? 3
    : status === 'Posted' ? 4
    : status === 'Rejected' ? -1
    : 0;
  if (status === 'Rejected') return <div className="warn">Rejected — returned for correction. Edit details and resubmit for accountant review.</div>;
  if (status === 'Reversed') return <div className="warn">Reversed — original preserved. Correction recorded as an adjustment entry (demo).</div>;
  if (status === 'Posted') return <div className="notice" style={{ marginBottom: 0 }}>Posted to the General Ledger — locked; corrections use reversal.</div>;
  return (
    <div className="steps" aria-label={`Workflow progress: ${status}`}>
      {order.map((s, i) => (
        <div key={s} className={'step ' + (idx > i ? 'done' : idx === i ? 'now' : '')} title={i === 2 ? 'Accountant Reviewed → For Owner Approval' : undefined}>
          {i + 1}. {s}{idx > i ? ' ✓' : ''}
        </div>
      ))}
    </div>
  );
}
