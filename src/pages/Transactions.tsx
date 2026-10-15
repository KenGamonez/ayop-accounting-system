import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, CLASSIFICATIONS, COA, ITEM_CATEGORIES, TRANSACTION_KINDS } from '../data/seed';
import { canResubmit } from '../data/ops';
import { roleKindFor } from '../data/access';
import { toCSV, fileName } from '../data/io';
import { download } from '../components/download';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money, WorkflowSteps } from '../components/ui';
import { CASH_IN_BANK_CHILDREN, coerceBankSub, bankSubError } from './Accounting';

export default function Transactions() {
  const { txns, addTxn, transition, user } = useStore();
  const [fUnit, setFUnit] = useState('All');
  const [fClass, setFClass] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [q, setQ] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [show, setShow] = useState(false);
  // bankSub is frontend-only entry state (see submit): the current save
  // payload has no sub-account field, so it is kept isolated and never
  // merged into the record until backend support exists.
  const [form, setForm] = useState({ date: '2026-10-14', businessUnit: 'Diagnostic Center', classification: 'Expense' as string, kind: 'Disbursement' as string, item: '', category: 'Medical Supplies', supplier: '', supplierPrice: 0, retailPrice: 0, quantity: 1, amount: 0, accountCode: '5000', accountName: 'Medical Supplies Expense', bankSub: '', remarks: '' });
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => txns.filter(t =>
    (fUnit === 'All' || t.businessUnit === fUnit) &&
    (fClass === 'All' || t.classification === fClass) &&
    (fStatus === 'All' || t.status === fStatus) &&
    (!mineOnly || !user || t.createdBy === user.id) &&
    (!q || (t.item + t.supplier + t.id).toLowerCase().includes(q.toLowerCase()))
  ), [txns, fUnit, fClass, fStatus, q, mineOnly, user]);

  const submit = async () => {
    if (!form.item.trim() || !form.supplier.trim()) { alert('Item and Counterparty are required.'); return; }
    const subErr = bankSubError(form.accountCode, form.bankSub);
    if (subErr) { setFormError(subErr); return; }
    const amount = form.amount || form.supplierPrice * form.quantity;
    // Frontend-only isolation: bankSub is intentionally excluded from the
    // record — the save payload (Txn) has no sub-account field yet. Backend
    // integration to persist it remains pending; nothing here changes the
    // API contract or pretends the sub-account was saved.
    const { bankSub: _notPersisted, ...rest } = form;
    void _notPersisted;
    try {
      await addTxn({ ...rest, classification: form.classification as never, kind: form.kind as never, amount, enteredBy: user?.name ?? 'Demo user' });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save the transaction.');
      return;
    }
    setShow(false);
    setFormError('');
    setForm(f => ({ ...f, item: '', supplier: '', amount: 0, bankSub: '', remarks: '' }));
  };

  const pickAccount = (code: string) => {
    const a = COA.find(c => c.code === code);
    setForm(f => ({ ...f, accountCode: code, accountName: a?.name ?? '', bankSub: coerceBankSub(code, f.bankSub) }));
    setFormError('');
  };

  return (
    <>
      <PageHead title="Transaction" sub="Transaction Entry — first step of the staff workflow. Uses Item (not Description) and Supplier (not Counterpart). New entries go to Accountant Review; they are not posted." actions={<button className="btn blue" onClick={() => setShow(s => !s)}>{show ? 'Close entry form' : '+ New transaction'}</button>} />
      <div className="next-action no-print"><span><strong>Next action:</strong> {show ? 'fill in Item, Supplier, and Amount, then submit for Accountant Review.' : 'open the entry form, or resubmit a rejected row below.'}</span>{!show && <button className="btn small blue" onClick={() => setShow(true)}>Start an entry</button>}</div>
      {show && (
        <div className="card txn-entry">
          <h3>New transaction entry</h3>
          <WorkflowSteps status="Draft" />
          {formError && <div className="warn" role="alert">{formError}</div>}
          <div className="form-grid">
            <label className="f">Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="f">Business Unit<select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Account Title<select value={form.accountCode} onChange={e => pickAccount(e.target.value)}>{COA.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select></label>
            {roleKindFor(user?.role ?? '') !== 'warehouse' && (
              <label className="f">Transaction Kind<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{TRANSACTION_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
            )}
            <label className="f">Counterparty<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. MedSupply Trading" /></label>
            <label className="f">Cash in Bank Sub-account
              <select value={form.bankSub} disabled={form.accountCode !== '1010'} onChange={e => { setForm({ ...form, bankSub: e.target.value }); setFormError(''); }} aria-describedby="banksub-hint">
                <option value="">— None —</option>
                {CASH_IN_BANK_CHILDREN.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
              <span className="field-hint" id="banksub-hint">{form.accountCode === '1010'
                ? 'Required for Cash in Bank — choose where the money sits.'
                : 'Only used with 1010 — Cash in Bank.'}</span>
              {form.accountCode === '1010' && <span className="field-hint">Screen only for now — the sub-account is not yet sent with the entry (backend pending); the entry submits coded 1010 — Cash in Bank.</span>}
            </label>
            <label className="f">Amount (₱)<input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Leave 0 to compute from Supplier Price × Qty" /></label>
            <label className="f full">Particulars<textarea rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Receipt / OR / SI reference" /></label>
          </div>
          <h4 className="txn-subhead">Additional item details</h4>
          <div className="form-grid">
            <label className="f">Item<input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. CBC reagent kit, 10 boxes" /></label>
            <label className="f">Classification<select value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })}>{CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Item category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{ITEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Supplier Price<input type="number" value={form.supplierPrice} onChange={e => setForm({ ...form, supplierPrice: Number(e.target.value) })} /></label>
            <label className="f">Retail Price<input type="number" value={form.retailPrice} onChange={e => setForm({ ...form, retailPrice: Number(e.target.value) })} /></label>
            <label className="f">Quantity<input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={submit}>Submit for Accountant Review</button>
            <span className="small muted">Demo: entry is saved locally and queued — nothing is posted yet.</span>
          </div>
        </div>
      )}
      <div className="card">
        <div className="filters">
          <select value={fUnit} onChange={e => setFUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <select value={fClass} onChange={e => setFClass(e.target.value)}><option>All</option>{CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}</select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)}><option>All</option>{['Draft', 'For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted', 'Rejected', 'Reversed'].map(s => <option key={s}>{s}</option>)}</select>
          <input placeholder="Search Item / Supplier / ID" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 220 }} />
          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> Mine only</label>
          <button className="btn ghost small" onClick={() => download(new Blob([toCSV(
            ['ID', 'Date', 'Business Unit', 'Classification', 'Kind', 'Item', 'Category', 'Supplier', 'Supplier Price', 'Retail Price', 'Quantity', 'Amount', 'Status'],
            filtered.map(t => [t.id, t.date, t.businessUnit, t.classification, t.kind, t.item, t.category, t.supplier, t.supplierPrice, t.retailPrice, t.quantity, t.amount, t.status])
          )], { type: 'text/csv' }), fileName('transactions', 'csv'))}>Export CSV ({filtered.length})</button>
          <Link className="btn ghost small" to="/admin/import-export">Import →</Link>
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID / Date</th><th>Item / Supplier</th><th>Unit</th><th>Class</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th>Next step</th></tr></thead>
          <tbody>{filtered.map(t => (
            <tr key={t.id}>
              <td><strong>{t.id}</strong><div className="small muted">{t.date} · {t.kind}</div></td>
              <td>{t.item}<div className="small muted">Supplier: {t.supplier} · {t.category}</div></td>
              <td>{t.businessUnit}</td><td>{t.classification}</td>
              <td><Pill status={t.status} /></td>
              <td className="num"><Money n={t.amount} /></td>
              <td>{t.status === 'Draft' || t.status === 'Rejected' ? (canResubmit(user?.role ?? '', user?.id, t) ? <button className="btn small ghost" onClick={async () => { const r = await transition(t.id, 'For Accountant Review', undefined, user?.id); if (!r.ok) alert(r.message); }}>Resubmit</button> : <span className="small muted">Originator resubmits</span>) : <span className="small muted">In queue</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
