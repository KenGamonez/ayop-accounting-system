import React, { useMemo, useState } from 'react';
import { BUSINESS_UNITS, CLASSIFICATIONS, COA, ITEM_CATEGORIES } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money, WorkflowSteps } from '../components/ui';

export default function Transactions() {
  const { txns, addTxn, transition, user } = useStore();
  const [fUnit, setFUnit] = useState('All');
  const [fClass, setFClass] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: '2026-10-14', businessUnit: 'Diagnostic Center', classification: 'Expense' as string, kind: 'Disbursement' as string, item: '', category: 'Medical Supplies', supplier: '', supplierPrice: 0, retailPrice: 0, quantity: 1, amount: 0, accountCode: '5000', accountName: 'Medical Supplies Expense', remarks: '' });

  const filtered = useMemo(() => txns.filter(t =>
    (fUnit === 'All' || t.businessUnit === fUnit) &&
    (fClass === 'All' || t.classification === fClass) &&
    (fStatus === 'All' || t.status === fStatus) &&
    (!q || (t.item + t.supplier + t.id).toLowerCase().includes(q.toLowerCase()))
  ), [txns, fUnit, fClass, fStatus, q]);

  const submit = () => {
    if (!form.item.trim() || !form.supplier.trim()) { alert('Item and Supplier are required (staff terminology).'); return; }
    const amount = form.amount || form.supplierPrice * form.quantity;
    addTxn({ ...form, classification: form.classification as never, kind: form.kind as never, amount, enteredBy: user?.name ?? 'Demo user' });
    setShow(false);
    setForm(f => ({ ...f, item: '', supplier: '', amount: 0, remarks: '' }));
  };

  return (
    <>
      <PageHead title="Transaction" sub="Transaction Entry — first step of the staff workflow. Uses Item (not Description) and Supplier (not Counterpart). New entries go to Accountant Review; they are not posted." actions={<button className="btn blue" onClick={() => setShow(s => !s)}>{show ? 'Close entry form' : '+ New transaction'}</button>} />
      <div className="next-action no-print"><span><strong>Next action:</strong> {show ? 'fill in Item, Supplier, and Amount, then submit for Accountant Review.' : 'open the entry form, or resubmit a rejected row below.'}</span>{!show && <button className="btn small blue" onClick={() => setShow(true)}>Start an entry</button>}</div>
      {show && (
        <div className="card">
          <h3>New transaction entry</h3>
          <WorkflowSteps status="Draft" />
          <div className="form-grid">
            <label className="f">Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="f">Business Unit<select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Classification<select value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })}>{CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Transaction kind<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option>Disbursement</option><option>Cash In</option><option>Cash Out</option><option>Journal</option></select></label>
            <label className="f">Item (not Description)<input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. CBC reagent kit, 10 boxes" /></label>
            <label className="f">Item category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{ITEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Supplier (not Counterpart)<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. MedSupply Trading" /></label>
            <label className="f">Supplier Price<input type="number" value={form.supplierPrice} onChange={e => setForm({ ...form, supplierPrice: Number(e.target.value) })} /></label>
            <label className="f">Retail Price<input type="number" value={form.retailPrice} onChange={e => setForm({ ...form, retailPrice: Number(e.target.value) })} /></label>
            <label className="f">Quantity<input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
            <label className="f">Amount (₱)<input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Leave 0 to compute from Supplier Price × Qty" /></label>
            <label className="f">Account<select value={form.accountCode} onChange={e => { const a = COA.find(c => c.code === e.target.value); setForm({ ...form, accountCode: e.target.value, accountName: a?.name ?? '' }); }}>{COA.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select></label>
            <label className="f full">Remarks<textarea rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Receipt / OR / SI reference" /></label>
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
              <td>{t.status === 'Draft' || t.status === 'Rejected' ? <button className="btn small ghost" onClick={() => transition(t.id, 'For Accountant Review')}>Resubmit</button> : <span className="small muted">In queue</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
