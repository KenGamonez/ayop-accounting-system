import React from 'react';
import { COA, peso, type JournalLine } from '../data/seed';

/** Printed voucher title by transaction type; unknown types keep their own name. */
export const VOUCHER_TITLES: Record<string, string> = {
  Disbursement: 'DISBURSEMENT VOUCHER',
  Journal: 'JOURNAL VOUCHER',
};

export function voucherTitleFor(type: string): string {
  return VOUCHER_TITLES[type] ?? (type ? `${type.toUpperCase()} VOUCHER` : 'TRANSACTION VOUCHER');
}

/**
 * A Disbursement and a Journal are the same saved-record shape in this app;
 * the type always comes from the saved record (Disbursement.kind / the Journal
 * entry), never from the page or whichever tab is open.
 */
export function isDisbursementType(type: string): boolean {
  return type === 'Disbursement';
}

export interface VoucherSignatories {
  preparedBy: string;
  postedBy: string;
  approvedBy: string;
  auditedBy: string;
}

export interface VoucherPrintProps {
  controlNo: string;
  date: string;
  businessUnit: string;
  transactionType: string;
  particulars: string;
  lines: JournalLine[];
  signatories: VoucherSignatories;
  /** Saved record reference/id, shown as Record No. when present. */
  recordNo?: string;
  /** Saved record status, shown when present. */
  status?: string;
  /** Extra record note carried by the View (e.g. a queued journal), when present. */
  note?: string;
}

function accountLabel(line: JournalLine): string {
  const name = line.accountName || COA.find(c => c.code === line.accountCode)?.name || '';
  return line.accountCode ? `${line.accountCode} — ${name}` : '—';
}

/**
 * The printable voucher. It opens with the centered company letterhead (printed
 * exactly once) and then mirrors the saved-record View fields (type, control
 * no., particulars, date, business unit, record no., status, the debit/credit
 * lines and totals), a balance line for both types, and the four signatories.
 * Screen-hidden via `.print-only`; the `.voucher*` print CSS lays it out. It
 * renders only the data handed to it.
 */
export default function VoucherPrint({
  controlNo,
  date,
  businessUnit,
  transactionType,
  particulars,
  lines,
  signatories,
  recordNo,
  status,
  note,
}: VoucherPrintProps) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const balanced = totalDebit === totalCredit;

  return (
    <div className="voucher">
      <header className="voucher-header">
        <div className="voucher-system">JEMS accounting System</div>
        <div className="voucher-company">AYOP GROUP OF COMPANIES</div>
        <div className="voucher-address">JEM Bldg. , Medina St. Carmen-Annex, Ozamiz City, Misamis Occidental</div>
      </header>

      <section className="voucher-top">
        <div className="voucher-field">
          <span className="voucher-field-label">Transaction Type</span>
          <span className="voucher-field-value">{transactionType}</span>
        </div>
        <div className="voucher-field">
          <span className="voucher-field-label">Control No.</span>
          <span className="voucher-field-value">{controlNo || '—'}</span>
        </div>
        <div className="voucher-field voucher-field-full">
          <span className="voucher-field-label">Particulars</span>
          <span className="voucher-field-value">{particulars || '—'}</span>
        </div>
      </section>

      <section className="voucher-details">
        <div className="voucher-field">
          <span className="voucher-field-label">Date</span>
          <span className="voucher-field-value">{date || '—'}</span>
        </div>
        <div className="voucher-field">
          <span className="voucher-field-label">Business Unit</span>
          <span className="voucher-field-value">{businessUnit}</span>
        </div>
        {recordNo && (
          <div className="voucher-field">
            <span className="voucher-field-label">Record No.</span>
            <span className="voucher-field-value">{recordNo}</span>
          </div>
        )}
        {status && (
          <div className="voucher-field">
            <span className="voucher-field-label">Status</span>
            <span className="voucher-field-value">{status}</span>
          </div>
        )}
      </section>

      <table className="voucher-table">
        <thead>
          <tr>
            <th>Account Title</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{accountLabel(l)}</td>
              <td className="num">{l.debit > 0 ? peso(l.debit) : '—'}</td>
              <td className="num">{l.credit > 0 ? peso(l.credit) : '—'}</td>
            </tr>
          ))}
          <tr className="voucher-total-row">
            <td>TOTAL</td>
            <td className="num">{peso(totalDebit)}</td>
            <td className="num">{peso(totalCredit)}</td>
          </tr>
        </tbody>
      </table>

      {balanced ? (
        <div className="voucher-status voucher-balanced">
          Balanced — Total Debit: {peso(totalDebit)} equals Total Credit: {peso(totalCredit)}.
        </div>
      ) : (
        <div className="voucher-status voucher-imbalance">
          Imbalance — Total Debit {peso(totalDebit)} does not equal Total Credit {peso(totalCredit)} (difference {peso(Math.abs(totalDebit - totalCredit))}).
        </div>
      )}

      {note && <div className="voucher-note">{note}</div>}

      <section className="voucher-signatures">
        <div className="voucher-sig">
          <div className="voucher-sig-line"></div>
          <div className="voucher-sig-role">Prepared &amp; Checked By</div>
          <div className="voucher-sig-name">{signatories.preparedBy}</div>
        </div>
        <div className="voucher-sig">
          <div className="voucher-sig-line"></div>
          <div className="voucher-sig-role">Posted By</div>
          <div className="voucher-sig-name">{signatories.postedBy}</div>
        </div>
        <div className="voucher-sig">
          <div className="voucher-sig-line"></div>
          <div className="voucher-sig-role">Approved By</div>
          <div className="voucher-sig-name">{signatories.approvedBy}</div>
        </div>
      </section>
      <section className="voucher-signatures voucher-signatures-audited">
        <div className="voucher-sig">
          <div className="voucher-sig-line"></div>
          <div className="voucher-sig-role">Audited By</div>
          <div className="voucher-sig-name">{signatories.auditedBy}</div>
        </div>
      </section>
    </div>
  );
}
