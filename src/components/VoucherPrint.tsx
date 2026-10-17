import React from 'react';
import { COA, peso, type JournalLine } from '../data/seed';

/** Company identity printed on every voucher: the name exactly once, then the
 *  registered address directly beneath it. */
export const COMPANY_NAME = 'AYOP GROUP OF COMPANIES';
export const COMPANY_ADDRESS = 'JEM Bldg., Medina St. Carmen-Annex, Ozamiz City - Misamis Occidental';
export const SYSTEM_NAME = 'JEM51 Accounting System';

/** Printed voucher title by transaction type; unknown types keep their own name. */
export const VOUCHER_TITLES: Record<string, string> = {
  Disbursement: 'DISBURSEMENT VOUCHER',
  Journal: 'JOURNAL VOUCHER',
};

export function voucherTitleFor(type: string): string {
  return VOUCHER_TITLES[type] ?? (type ? `${type.toUpperCase()} VOUCHER` : 'TRANSACTION VOUCHER');
}

/**
 * A Disbursement prints a payment-style voucher (payee, payment account,
 * amount) rather than the journal debit/credit presentation. The type always
 * comes from the saved record, never from the page or whichever tab is open.
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
  title: string;
  date: string;
  businessUnit: string;
  transactionType: string;
  particulars: string;
  lines: JournalLine[];
  signatories: VoucherSignatories;
  footer: string;
  /** Disbursement only: payee/supplier and payment account, when recorded. */
  payee?: string;
  paymentAccount?: string;
  /** Disbursement only: the payment amount printed as the voucher total. */
  amount?: number;
}

function accountLabel(line: JournalLine): string {
  const name = line.accountName || COA.find(c => c.code === line.accountCode)?.name || '';
  return line.accountCode ? `${line.accountCode} — ${name}` : '—';
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
  payee,
  paymentAccount,
  amount,
}: VoucherPrintProps) {
  const disbursement = isDisbursementType(transactionType);
  const totalDebit = lines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const balanced = totalDebit === totalCredit;
  const chargedLines = lines.filter(l => l.debit > 0);
  const payableAmount = amount ?? totalDebit;

  return (
    <div className="voucher">
      <header className="voucher-head">
        <div className="voucher-company">{COMPANY_NAME}</div>
        <div className="voucher-address">{COMPANY_ADDRESS}</div>
        <div className="voucher-system">{SYSTEM_NAME}</div>
        <div className="voucher-title">{title}</div>
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
        <div className="voucher-field">
          <span className="voucher-field-label">Control No.</span>
          <span className="voucher-field-value">{controlNo || '—'}</span>
        </div>
        {disbursement && payee && (
          <div className="voucher-field">
            <span className="voucher-field-label">Payee / Supplier</span>
            <span className="voucher-field-value">{payee}</span>
          </div>
        )}
        {disbursement && paymentAccount && (
          <div className="voucher-field">
            <span className="voucher-field-label">Payment Account</span>
            <span className="voucher-field-value">{paymentAccount}</span>
          </div>
        )}
        <div className="voucher-field voucher-field-full">
          <span className="voucher-field-label">Particulars</span>
          <span className="voucher-field-value">{particulars || '—'}</span>
        </div>
      </section>

      {disbursement ? (
        <table className="voucher-table">
          <thead>
            <tr>
              <th>Account Charged</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {chargedLines.length > 0 ? (
              chargedLines.map((l, i) => (
                <tr key={i}>
                  <td>{accountLabel(l)}</td>
                  <td className="num">{peso(l.debit)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>{paymentAccount || '—'}</td>
                <td className="num">{peso(payableAmount)}</td>
              </tr>
            )}
            <tr className="voucher-total-row">
              <td>TOTAL</td>
              <td className="num">{peso(payableAmount)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <>
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
              Total Debit {peso(totalDebit)} equals Total Credit {peso(totalCredit)}.
            </div>
          ) : (
            <div className="voucher-status voucher-imbalance">
              Imbalance — Total Debit {peso(totalDebit)} does not equal Total Credit {peso(totalCredit)} (difference {peso(Math.abs(totalDebit - totalCredit))}).
            </div>
          )}
        </>
      )}

      {disbursement ? (
        <section className="voucher-signatures">
          <div className="voucher-sig">
            <div className="voucher-sig-line"></div>
            <div className="voucher-sig-role">Prepared By</div>
            <div className="voucher-sig-name">{signatories.preparedBy}</div>
          </div>
          <div className="voucher-sig">
            <div className="voucher-sig-line"></div>
            <div className="voucher-sig-role">Approved By</div>
            <div className="voucher-sig-name">{signatories.approvedBy}</div>
          </div>
          <div className="voucher-sig">
            <div className="voucher-sig-line"></div>
            <div className="voucher-sig-role">Paid / Received By</div>
            <div className="voucher-sig-name"></div>
          </div>
        </section>
      ) : (
        <>
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
        </>
      )}

      <div className="voucher-foot">{footer}</div>
    </div>
  );
}
