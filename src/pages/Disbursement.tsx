import React, { useMemo, useRef, useState } from 'react';
import { BUSINESS_UNITS, COA, peso } from '../data/seed';
import { dateRangeError, disbursementEntryLines, inDateRange, validateDisbursement } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';
import VoucherPrint, { voucherTitleFor } from '../components/VoucherPrint';

export default function Disbursement() {
  const { txns, addTxn, user } = useStore();
  const [unit, setUnit] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), businessUnit: 'Diagnostic Center', particulars: '', supplier: '', accountCode: '5000', amount: '' });
  const [errs, setErrs] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  // Guards against a second save while the first is still persisting.
  const savingRef = useRef(false);

  const rangeErr = dateRangeError(from, to);
  const rows = useMemo(() => txns.filter(t =>
    t.kind === 'Disbursement'
    && (unit === 'All' || t.businessUnit === unit)
    && (rangeErr ? true : inDateRange(t.date, from, to))
  ), [txns, unit, from, to, rangeErr]);

  // Read-only view of one saved disbursement. Selecting a record only renders
  // it — no store write, so its status and financial values never change.
  const viewTxn = viewId ? txns.find(t => t.id === viewId && t.kind === 'Disbursement') ?? null : null;
  const viewLines = viewTxn ? disbursementEntryLines(viewTxn) : [];
  const viewTotalDr = viewLines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const viewTotalCr = viewLines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const viewControlNo = viewTxn ? (viewTxn.controlNo ?? viewTxn.id) : '';

  const submit = async () => {
    if (savingRef.current) return;
    const amount = form.amount.trim() === '' ? null : Number(form.amount);
    const v = validateDisbursement({
      date: form.date, businessUnit: form.businessUnit, particulars: form.particulars,
      supplier: form.supplier, accountCode: form.accountCode, amount,
    });
    setErrs(v);
    if (v.length) { setSaved(''); return; }
    const acct = COA.find(c => c.code === form.accountCode);
    savingRef.current = true;
    try {
      const txn = await addTxn({
        date: form.date, businessUnit: form.businessUnit, classification: 'Expense', kind: 'Disbursement',
        item: form.particulars.trim(), category: 'Medical Supplies', supplier: form.supplier.trim(),
        supplierPrice: amount ?? 0, retailPrice: 0, quantity: 1, amount: amount ?? 0,
        accountCode: form.accountCode, accountName: acct?.name ?? '',
        enteredBy: user?.name ?? 'Demo user',
        remarks: `Disbursement entry — queued for accountant review, not posted`,
      });
      setSaved(`${txn.id} saved and queued for accountant review. It will not post until approved.`);
    } catch (e) {
      setSaved('');
      setErrs([e instanceof Error ? e.message : 'Could not save the disbursement.']);
      return;
    } finally {
      savingRef.current = false;
    }
    setForm(f => ({ ...f, particulars: '', supplier: '', amount: '' }));
    setShow(false);
  };

  const reset = () => { setUnit('All'); setFrom(''); setTo(''); };

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

  return (
    <>
      <PageHead title="Disbursement" sub="Record cash payments and find past disbursements. New entries queue for review — nothing posts directly. Synthetic demo." actions={<button className="btn blue" onClick={() => { setShow(s => !s); setErrs([]); }}>{show ? 'Close entry form' : '+ Record disbursement'}</button>} />
      {saved && <div className="notice">{saved}</div>}
      {show && (
        <div className="card"><h3>Record a disbursement</h3>
          {errs.length > 0 && <div className="warn">{errs.map((e, i) => <div key={i}>• {e}</div>)}</div>}
          <div className="form-grid">
            <label className="f">Date (required)<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="f">Business Unit<select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Account (payment details)<select value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value })}>{COA.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select></label>
            <label className="f">Amount in ₱ (required, more than 0)<input type="number" min={0} step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 2500" /></label>
            <label className="f">Supplier — who was paid? (required)<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. MedSupply Trading" /></label>
            <label className="f full">Particulars — what was this payment for? (required)<input value={form.particulars} onChange={e => setForm({ ...form, particulars: e.target.value })} placeholder="e.g. Surgical gloves, 20 boxes (SI #5521)" /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={submit}>Save for review</button>
            <span className="small muted">Goes to accountant review → owner approval → posting, with audit logging.</span>
          </div>
        </div>
      )}
      <div className="card">
        <div className="filters">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <label className="f">Start Date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="f">End Date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <button className="btn ghost small" onClick={reset}>Clear / Reset</button>
        </div>
        {rangeErr && <div className="warn">{rangeErr} Showing all dates until fixed.</div>}
        {rows.length === 0 ? (
          <div className="notice">No disbursements match this search. Try widening the dates or <button className="btn small ghost" onClick={reset}>reset the filters</button>.</div>
        ) : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Particulars / Payment details</th><th>Unit</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
            <tbody>{rows.map(t => (
              <tr key={t.id}><td>{t.date}<div className="small muted">{t.id}</div></td>
                <td>{t.item}<div className="small muted">Paid to {t.supplier} · {t.accountCode} — {t.accountName}</div></td>
                <td>{t.businessUnit}</td><td><Pill status={t.status} /></td><td className="num"><Money n={t.amount} /></td>
                <td><button className="btn small ghost" onClick={() => setViewId(t.id)}>View</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
