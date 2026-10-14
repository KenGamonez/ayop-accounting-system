import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS } from '../data/seed';
import { toCSV, fileName, isValidDate, toNum } from '../data/io';
import { poOutstandingLines } from '../data/ops';
import { download } from '../components/download';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Purchasing() {
  const { pos, addPO, sendPO, cancelPO, receivePOLine, user } = useStore();
  const [form, setForm] = useState({ poNo: 'PO-2026-0190', date: '2026-10-14', supplier: '', businessUnit: 'Central Warehouse', deliveryDate: '2026-10-20', item: '', quantity: '10', supplierPrice: '0' });
  const [show, setShow] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const shownPOs = mineOnly && user ? pos.filter(p => p.createdBy === user.id) : pos;

  const openCount = pos.filter(p => poOutstandingLines(p) > 0 && p.status !== 'Cancelled').length;

  const submit = () => {
    const poNo = form.poNo.trim();
    if (!poNo) return setFormErr('P.O. No. is required.');
    if (pos.some(p => p.poNo.toLowerCase() === poNo.toLowerCase())) return setFormErr(`P.O. No. ${poNo} already exists — use a unique number.`);
    if (!form.supplier.trim()) return setFormErr('Supplier is required.');
    if (!form.item.trim()) return setFormErr('Item is required.');
    if (!isValidDate(form.date)) return setFormErr('Order date is not a readable date.');
    if (!isValidDate(form.deliveryDate)) return setFormErr('Delivery Date is not a readable date.');
    const qty = toNum(form.quantity);
    if (qty === null || !Number.isInteger(qty) || qty <= 0) return setFormErr('Quantity must be a whole number greater than 0.');
    const price = toNum(form.supplierPrice);
    if (price === null || price < 0) return setFormErr('Supplier Price cannot be negative.');
    setFormErr('');
    addPO({
      poNo, date: form.date, supplier: form.supplier.trim(), businessUnit: form.businessUnit,
      deliveryDate: form.deliveryDate, items: [{ item: form.item.trim(), quantity: qty, supplierPrice: price, receivedQty: 0 }],
      received: false, receivedDate: '', status: 'Draft',
    });
    setShow(false);
    setFeedback({ ok: true, text: `${poNo} saved as Draft. Send it to the supplier when ready — receipts are recorded per line.` });
  };

  const receipt = (poId: string, lineIdx: number) => {
    const key = poId + ':' + lineIdx;
    const qty = Number(qtyByLine[key] ?? '');
    const res = receivePOLine(poId, lineIdx, qty);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) setQtyByLine(q => ({ ...q, [key]: '' }));
  };

  return (
    <>
      <PageHead title="Purchasing (P.O.)" sub="Staff workflow: supplier → purchase order → delivery date → receiving → inventory. Receipts update stock and queue a payable for review — they never post directly. Synthetic demo." actions={<button className="btn blue" onClick={() => setShow(s => !s)}>{show ? 'Close' : '+ New P.O.'}</button>} />
      {openCount > 0 && !show && (
        <div className="next-action"><span><strong>Next action:</strong> {openCount} open P.O.{openCount === 1 ? '' : 's'} with outstanding lines — record receipts below. Each receipt updates inventory and queues a payable for accountant review.</span></div>
      )}
      {feedback && <div className={feedback.ok ? 'notice' : 'warn'}>{feedback.text}</div>}
      {show && (
        <div className="card"><h3>New purchase order (saved as Draft)</h3>
          {formErr && <div className="warn">{formErr}</div>}
          <div className="form-grid">
            <label className="f">P.O. No.<input value={form.poNo} onChange={e => setForm({ ...form, poNo: e.target.value })} /></label>
            <label className="f">Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="f">Supplier<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. MedSupply Trading" /></label>
            <label className="f">Business Unit<select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Delivery Date<input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></label>
            <label className="f">Item<input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} /></label>
            <label className="f">Quantity<input type="number" min={1} step={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label>
            <label className="f">Supplier Price<input type="number" min={0} step="any" value={form.supplierPrice} onChange={e => setForm({ ...form, supplierPrice: e.target.value })} /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={submit}>Save P.O. as Draft (demo)</button>
            <span className="small muted">Multi-line orders can be added via the Import Center.</span>
          </div>
        </div>
      )}
      <div className="card">
        <div className="filters no-print">
          <button className="btn ghost small" onClick={() => download(new Blob([toCSV(
            ['P.O. No.', 'Date', 'Supplier', 'Business Unit', 'Delivery Date', 'Item', 'Quantity', 'Received', 'Remaining', 'Supplier Price', 'Status'],
            pos.flatMap(p => p.items.map(it => [p.poNo, p.date, p.supplier, p.businessUnit, p.deliveryDate, it.item, it.quantity, it.receivedQty ?? 0, Math.max(0, it.quantity - (it.receivedQty ?? 0)), it.supplierPrice, p.status] as (string | number)[]))
          )], { type: 'text/csv' }), fileName('purchase-orders', 'csv'))}>Export CSV</button>
          <Link className="btn ghost small" to="/admin/import-export">Import →</Link>
          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> Mine only</label>
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>P.O. No.</th><th>Supplier / Unit</th><th>Delivery Date</th><th>Lines (ordered / received)</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{shownPOs.map(p => (
            <tr key={p.id}>
              <td><strong>{p.poNo}</strong><div className="small muted">{p.date}</div></td>
              <td>{p.supplier}<div className="small muted">{p.businessUnit}</div></td>
              <td>{p.deliveryDate}{p.receivedDate ? <div className="small muted">Last receipt {p.receivedDate}</div> : ''}</td>
              <td>{p.items.map((l, k) => {
                const remaining = Math.max(0, l.quantity - (l.receivedQty ?? 0));
                const key = p.id + ':' + k;
                return (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <div>{l.item} — {l.receivedQty ?? 0} of {l.quantity} received @ ₱{l.supplierPrice.toLocaleString()}</div>
                    {remaining > 0 && (p.status === 'Sent to Supplier' || p.status === 'Partially Received') && (
                      <div className="btn-row no-print" style={{ marginTop: 4 }}>
                        <input type="number" min={1} max={remaining} step={1} placeholder={`Qty (max ${remaining})`} value={qtyByLine[key] ?? ''} onChange={e => setQtyByLine(q => ({ ...q, [key]: e.target.value }))} style={{ width: 130 }} />
                        <button className="btn small" onClick={() => receipt(p.id, k)}>Record receipt</button>
                      </div>
                    )}
                  </div>
                );
              })}</td>
              <td className="num"><Money n={p.total} /></td>
              <td><Pill status={p.status} /></td>
              <td><div className="btn-row no-print">
                {p.status === 'Draft' && <button className="btn small" onClick={() => { sendPO(p.id); setFeedback({ ok: true, text: `${p.poNo} sent to ${p.supplier}. Receipts can now be recorded.` }); }}>Send to supplier</button>}
                {(p.status === 'Draft' || p.status === 'Sent to Supplier' || p.status === 'Partially Received') && (
                  <button className="btn small danger" onClick={() => { if (confirm(`Cancel ${p.poNo}? Outstanding lines will be voided.`)) { cancelPO(p.id); setFeedback({ ok: true, text: `${p.poNo} cancelled.` }); } }}>Cancel</button>
                )}
                {(p.status === 'Received' || p.status === 'Cancelled') && <span className="small muted">Closed</span>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="small muted">Demo only — receipts are stored in this browser, update local stock, and queue payables for review. Nothing here is shared between staff or persisted officially.</p>
      </div>
    </>
  );
}
