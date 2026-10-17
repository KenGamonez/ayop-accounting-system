import React, { useState, useMemo } from 'react';
import { COA, BUSINESS_UNITS, TRANSACTION_KINDS, peso } from '../data/seed';

export interface AccountEntry {
  id: string;
  accountTitle: string;
  credit: string;
  debit: string;
}

interface TransactionEntryFormProps {
  onSubmit: (data: TransactionFormData) => void;
  onCancel: () => void;
  onPrint: () => void;
}

export interface TransactionFormData {
  date: string;
  businessUnit: string;
  transactionType: string;
  particulars: string;
  entries: AccountEntry[];
  signatories: {
    preparedBy: string;
    postedBy: string;
    approvedBy: string;
    auditedBy: string;
  };
}

const initialEntries: AccountEntry[] = [
  { id: '1', accountTitle: '', credit: '', debit: '' },
  { id: '2', accountTitle: '', credit: '', debit: '' },
  { id: '3', accountTitle: '', credit: '', debit: '' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function formatNumber(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse a money string to a non-negative number (blank/invalid -> 0). */
function toNumber(value: string): number {
  const parsed = parseFloat(value.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/** Keep digits and at most one decimal point while typing. */
function sanitizeAmount(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

export default function TransactionEntryForm({
  onSubmit,
  onCancel,
  onPrint,
}: TransactionEntryFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    date: new Date().toISOString().split('T')[0],
    businessUnit: 'Diagnostic Center',
    transactionType: 'Disbursement',
    particulars: '',
    entries: initialEntries.map(e => ({ ...e })),
    signatories: {
      preparedBy: '',
      postedBy: '',
      approvedBy: '',
      auditedBy: '',
    },
  });

  const totals = useMemo(() => {
    const totalCredit = round2(formData.entries.reduce((sum, e) => sum + toNumber(e.credit), 0));
    const totalDebit = round2(formData.entries.reduce((sum, e) => sum + toNumber(e.debit), 0));
    return { totalCredit, totalDebit, isBalanced: totalCredit === totalDebit && totalCredit > 0 };
  }, [formData.entries]);

  const updateEntry = (id: string, field: 'accountTitle' | 'credit' | 'debit', value: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map(e => {
        if (e.id !== id) return e;
        if (field === 'accountTitle') return { ...e, accountTitle: value };
        if (field === 'credit') return { ...e, credit: sanitizeAmount(value) };
        return { ...e, debit: sanitizeAmount(value) };
      }),
    }));
  };

  const addEntry = () => {
    const newId = String(Date.now());
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, { id: newId, accountTitle: '', credit: '', debit: '' }],
    }));
  };

  const removeEntry = (id: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="txn-new-entry">
      <div className="txn-header">
        <h2>NEW TRANSACTION (NEW ENTRY)</h2>
      </div>

      <form onSubmit={handleSubmit} className="txn-form">
        {/* Section A: Transaction Details */}
        <section className="txn-section">
          <h3 className="section-title">A. Transaction Details</h3>
          <div className="form-row">
            <label className="f">
              Date
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </label>
            <label className="f">
              Business Unit
              <select
                value={formData.businessUnit}
                onChange={e => setFormData({ ...formData, businessUnit: e.target.value })}
                required
              >
                {BUSINESS_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="f">
              Transaction Type
              <select
                value={formData.transactionType}
                onChange={e => setFormData({ ...formData, transactionType: e.target.value })}
                required
              >
                {TRANSACTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Section B: Particulars */}
        <section className="txn-section">
          <h3 className="section-title">B. Particulars</h3>
          <div className="form-row">
            <label className="f full">
              Particulars
              <textarea
                rows={3}
                value={formData.particulars}
                onChange={e => setFormData({ ...formData, particulars: e.target.value })}
                placeholder="Enter transaction description..."
                required
              />
            </label>
          </div>
        </section>

        {/* Section C: Account Entries */}
        <section className="txn-section">
          <h3 className="section-title">C. Account Entries</h3>
          <div className="entries-grid">
            <div className="entries-header">
              <div className="entry-col entry-col-title">Account Title</div>
              <div className="entry-col entry-col-amount">Credit</div>
              <div className="entry-col entry-col-amount">Debit</div>
              <div className="entry-col entry-col-action"></div>
            </div>
            {formData.entries.map((entry, index) => (
              <div key={entry.id} className="entry-row">
                <div className="entry-col entry-col-title">
                  <select
                    value={entry.accountTitle}
                    onChange={e => updateEntry(entry.id, 'accountTitle', e.target.value)}
                    className="account-select"
                  >
                    <option value="">Select Account</option>
                    {COA.map(acc => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} — {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="entry-col entry-col-amount">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entry.credit}
                    onChange={e => updateEntry(entry.id, 'credit', e.target.value)}
                    placeholder="0.00"
                    className="amount-input"
                    aria-label="Credit amount"
                    onBlur={() => {
                      const n = toNumber(entry.credit);
                      updateEntry(entry.id, 'credit', n > 0 ? formatNumber(n) : '');
                    }}
                  />
                </div>
                <div className="entry-col entry-col-amount">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entry.debit}
                    onChange={e => updateEntry(entry.id, 'debit', e.target.value)}
                    placeholder="0.00"
                    className="amount-input"
                    aria-label="Debit amount"
                    onBlur={() => {
                      const n = toNumber(entry.debit);
                      updateEntry(entry.id, 'debit', n > 0 ? formatNumber(n) : '');
                    }}
                  />
                </div>
                <div className="entry-col entry-col-action">
                  <button
                    type="button"
                    className="btn ghost small btn-remove"
                    onClick={() => formData.entries.length > 1 && removeEntry(entry.id)}
                    disabled={formData.entries.length <= 1}
                    aria-label="Remove entry"
                  >
                    −
                  </button>
                </div>
              </div>
            ))}
            <div className="entry-row entry-row-total">
              <div className="entry-col entry-col-title">Total</div>
              <div className="entry-col entry-col-amount">{peso(totals.totalCredit)}</div>
              <div className="entry-col entry-col-amount">{peso(totals.totalDebit)}</div>
              <div className="entry-col entry-col-action"></div>
            </div>
          </div>
          <div className="entries-actions">
            <button type="button" className="btn ghost small" onClick={addEntry}>
              + Add Entry
            </button>
          </div>
        </section>

        {/* Section D: Totals */}
        <section className="txn-section">
          <h3 className="section-title">D. Totals</h3>
          <div className="totals-grid">
            <div className={`total-box ${totals.totalCredit > totals.totalDebit ? 'imbalance' : ''}`}>
              <div className="total-label">Total Credit</div>
              <div className="total-amount">{peso(totals.totalCredit)}</div>
            </div>
            <div className={`total-box ${totals.totalDebit > totals.totalCredit ? 'imbalance' : ''}`}>
              <div className="total-label">Total Debit</div>
              <div className="total-amount">{peso(totals.totalDebit)}</div>
            </div>
          </div>
          {totals.totalCredit !== totals.totalDebit && (
            <div className="imbalance-warning">
              ⚠ Imbalance: Credit ({peso(totals.totalCredit)}) ≠ Debit ({peso(totals.totalDebit)})
              Difference: {peso(Math.abs(totals.totalCredit - totals.totalDebit))}
            </div>
          )}
          {totals.isBalanced && (
            <div className="balanced-indicator">
              ✓ Balanced — Credit and Debit totals match ({peso(totals.totalCredit)})
            </div>
          )}
        </section>

        {/* Section E: Signatories */}
        <section className="txn-section">
          <h3 className="section-title">E. Signatories</h3>
          <div className="signatories-grid">
            <div className="signatory-block">
              <input
                type="text"
                className="sig-input"
                value={formData.signatories.preparedBy}
                onChange={e => setFormData({ ...formData, signatories: { ...formData.signatories, preparedBy: e.target.value } })}
                placeholder="Name / Signature"
                aria-label="Prepared and checked by"
              />
              <div className="sig-caption">Prepared & Checked By</div>
            </div>
            <div className="signatory-block">
              <input
                type="text"
                className="sig-input"
                value={formData.signatories.postedBy}
                onChange={e => setFormData({ ...formData, signatories: { ...formData.signatories, postedBy: e.target.value } })}
                placeholder="Name / Signature"
                aria-label="Posted by"
              />
              <div className="sig-caption">Posted By</div>
            </div>
            <div className="signatory-block">
              <input
                type="text"
                className="sig-input"
                value={formData.signatories.approvedBy}
                onChange={e => setFormData({ ...formData, signatories: { ...formData.signatories, approvedBy: e.target.value } })}
                placeholder="Name / Signature"
                aria-label="Approved by"
              />
              <div className="sig-caption">Approved By</div>
            </div>
          </div>
          <div className="signatory-block signatory-audited">
            <div className="sig-caption">Audited By:</div>
            <input
              type="text"
              className="sig-input"
              value={formData.signatories.auditedBy}
              onChange={e => setFormData({ ...formData, signatories: { ...formData.signatories, auditedBy: e.target.value } })}
              placeholder="Name / Signature"
              aria-label="Audited by"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="txn-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn ghost" onClick={onPrint}>
            Print Transaction
          </button>
          <button type="submit" className="btn blue">
            Submit for Review
          </button>
        </div>
      </form>

      {/* Printable version (hidden on screen, shown in print) */}
      <div className="print-only">
        <div className="print-header">
          <div className="print-company">Ayop Group of Companies — JEM51 Accounting System</div>
          <h1>NEW TRANSACTION (NEW ENTRY)</h1>
          <div className="print-meta">
            DRAFT — not submitted, not posted. Values shown exactly as entered on screen.
          </div>
          <div className="print-demo">SYNTHETIC DEMONSTRATION DATA — requires accounting validation before production use.</div>
        </div>
        <div className="print-body">
          <table className="print-table">
            <tbody>
              <tr><td><strong>Date</strong></td><td>{formData.date || '—'}</td></tr>
              <tr><td><strong>Business Unit</strong></td><td>{formData.businessUnit}</td></tr>
              <tr><td><strong>Transaction Type</strong></td><td>{formData.transactionType}</td></tr>
              <tr><td><strong>Particulars</strong></td><td>{formData.particulars || '—'}</td></tr>
            </tbody>
          </table>
          <table className="print-table entries-table">
            <thead>
              <tr>
                <th>Account Title</th>
                <th className="num">Credit</th>
                <th className="num">Debit</th>
              </tr>
            </thead>
            <tbody>
              {formData.entries.map(entry => {
                const acct = COA.find(c => c.code === entry.accountTitle);
                const credit = toNumber(entry.credit);
                const debit = toNumber(entry.debit);
                return (
                  <tr key={entry.id}>
                    <td>{entry.accountTitle ? `${entry.accountTitle} — ${acct?.name ?? ''}` : '—'}</td>
                    <td className="num">{credit > 0 ? peso(credit) : '—'}</td>
                    <td className="num">{debit > 0 ? peso(debit) : '—'}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td className="num"><strong>{peso(totals.totalCredit)}</strong></td>
                <td className="num"><strong>{peso(totals.totalDebit)}</strong></td>
              </tr>
            </tbody>
          </table>
          {totals.totalCredit !== totals.totalDebit && (
            <div className="print-imbalance">
              ⚠ Imbalance: Credit ({peso(totals.totalCredit)}) ≠ Debit ({peso(totals.totalDebit)})
            </div>
          )}
          <div className="signatories-print">
            <div className="sig-row">
              <div className="sig-field">
                <div className="sig-name">{formData.signatories.preparedBy}</div>
                <div className="sig-line"></div>
                <div className="sig-label">Prepared & Checked By</div>
              </div>
              <div className="sig-field">
                <div className="sig-name">{formData.signatories.postedBy}</div>
                <div className="sig-line"></div>
                <div className="sig-label">Posted By</div>
              </div>
              <div className="sig-field">
                <div className="sig-name">{formData.signatories.approvedBy}</div>
                <div className="sig-line"></div>
                <div className="sig-label">Approved By</div>
              </div>
            </div>
            <div className="sig-row sig-row-audited">
              <div className="sig-field sig-field-audited">
                <div className="sig-name">{formData.signatories.auditedBy}</div>
                <div className="sig-line"></div>
                <div className="sig-label">Audited By</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}