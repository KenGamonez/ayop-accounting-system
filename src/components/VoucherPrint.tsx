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

export interface VoucherSignatories {
  preparedBy: string;
  postedBy: string;
  approvedBy: string;
  auditedBy: string;
}

export interface VoucherPrintProps {
  controlNo: string;
  title: string;
  date: string;
  businessUnit: string;
  transactionType: string;
  particulars: string;
  lines: JournalLine[];
  signatories: VoucherSignatories;
  footer: string;
}

/**
 * The single printable voucher used by the New Entry form and by the saved
 * Disbursement/Journal detail views. Screen-hidden via `.print-only`; the
 * existing `.voucher*` print CSS lays it out. It renders only the data handed
 * to it — no amount is derived beyond the passed lines' own debit/credit.
 */
export default function VoucherPrint({
  controlNo,
  title,
  date,
  businessUnit,
  transactionType,
  particulars,
  lines,
  signatories,
  footer,
}: VoucherPrintProps) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const balanced = totalDebit === totalCredit;

  return (
    <div className="voucher">
      <header className="voucher-head">
        <div>
          <div className="voucher-company">AYOP GROUP OF COMPANIES</div>
          <div className="voucher-system">JEM51 Accounting System</div>
          <div className="voucher-title">{title}</div>
        </div>
        <div className="voucher-control">
          <div className="voucher-control-label">Control No.</div>
          <div className="voucher-control-value">{controlNo}</div>
        </div>
      </header>

      <section className="voucher-details">
        <div className="voucher-field">
          <span className="voucher-field-label">Date</span>
          <span className="voucher-field-value">{date || '—'}</span>
        </div>
        <div className="voucher-field">
          <span className="voucher-field-label">Business Unit</span>
          <span className="voucher-field-value">{businessUnit}</span>
        </div>
        <div className="voucher-field">
          <span className="voucher-field-label">Transaction Type</span>
          <span className="voucher-field-value">{transactionType}</span>
        </div>
        <div className="voucher-field voucher-field-full">
          <span className="voucher-field-label">Particulars</span>
          <span className="voucher-field-value">{particulars || '—'}</span>
        </div>
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
          {lines.map((l, i) => {
            const name = l.accountName || COA.find(c => c.code === l.accountCode)?.name || '';
            const label = l.accountCode ? `${l.accountCode} — ${name}` : '—';
            return (
              <tr key={i}>
                <td>{label}</td>
                <td className="num">{l.debit > 0 ? peso(l.debit) : '—'}</td>
                <td className="num">{l.credit > 0 ? peso(l.credit) : '—'}</td>
              </tr>
            );
          })}
          <tr className="voucher-total-row">
            <td>TOTAL</td>
            <td className="num">{peso(totalDebit)}</td>
            <td className="num">{peso(totalCredit)}</td>
          </tr>
        </tbody>
      </table>

      {balanced ? (
        <div className="voucher-status voucher-balanced">
          Total Debit {peso(totalDebit)} equals Total Credit {peso(totalCredit)}.
        </div>
      ) : (
        <div className="voucher-status voucher-imbalance">
          Imbalance — Total Debit {peso(totalDebit)} does not equal Total Credit {peso(totalCredit)} (difference {peso(Math.abs(totalDebit - totalCredit))}).
        </div>
      )}

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

      <div className="voucher-foot">{footer}</div>
    </div>
  );
}
