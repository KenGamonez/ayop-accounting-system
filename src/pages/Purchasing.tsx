import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS } from '../data/seed';
import { toCSV, fileName } from '../data/io';
import { download } from '../components/download';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Purchasing() {
  const { pos, addPO, receivePO } = useStore();
  const [form, setForm] = useState({ poNo: 'PO-2026-0190', date: '2026-10-14', supplier: '', businessUnit: 'Central Warehouse', deliveryDate: '2026-10-20', item: '', quantity: 1, supplierPrice: 0 });
  const [show, setShow] = useState(false);

  const submit = () => {
    if (!form.supplier.trim() || !form.item.trim()) { alert('Supplier and Item are required.'); return; }
    addPO({ poNo: form.poNo, date: form.date, supplier: form.supplier, businessUnit: form.businessUnit, deliveryDate: form.deliveryDate, items: [{ item: form.item, quantity: form.quantity, supplierPrice: form.supplierPrice }], received: false, receivedDate: '', status: 'Draft' });
    setShow(false);
  };

  return (
    <>
      <PageHead title="Purchasing (P.O.)" sub="Staff workflow: supplier → purchase order → delivery date → receiving → inventory. Synthetic demo." actions={<button className="btn blue" onClick={() => setShow(s => !s)}>{show ? 'Close' : '+ New P.O.'}</button>} />
      {pos.filter(p => !p.received && p.status !== 'Cancelled').length > 0 && !show && (
        <div className="next-action"><span><strong>Next action:</strong> {pos.filter(p => !p.received && p.status !== 'Cancelled').length} open P.O.{pos.filter(p => !p.received && p.status !== 'Cancelled').length === 1 ? '' : 's'} awaiting delivery — confirm receipt below to update inventory.</span></div>
      )}
      {show && (
        <div className="card"><h3>New purchase order</h3>
          <div className="form-grid">
            <label className="f">P.O. No.<input value={form.poNo} onChange={e => setForm({ ...form, poNo: e.target.value })} /></label>
            <label className="f">Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="f">Supplier<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. MedSupply Trading" /></label>
            <label className="f">Business Unit<select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Delivery Date<input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></label>
            <label className="f">Item<input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} /></label>
            <label className="f">Quantity<input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
            <label className="f">Supplier Price<input type="number" value={form.supplierPrice} onChange={e => setForm({ ...form, supplierPrice: Number(e.target.value) })} /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}><button className="btn" onClick={submit}>Save P.O. (demo)</button></div>
        </div>
      )}
      <div className="card">
        <div className="filters no-print">
          <button className="btn ghost small" onClick={() => download(new Blob([toCSV(
            ['P.O. No.', 'Date', 'Supplier', 'Business Unit', 'Delivery Date', 'Item', 'Quantity', 'Supplier Price', 'Line Total', 'Status'],
            pos.flatMap(p => p.items.map(it => [p.poNo, p.date, p.supplier, p.businessUnit, p.deliveryDate, it.item, it.quantity, it.supplierPrice, it.quantity * it.supplierPrice, p.status] as (string | number)[]))
          )], { type: 'text/csv' }), fileName('purchase-orders', 'csv'))}>Export CSV</button>
          <Link className="btn ghost small" to="/admin/import-export">Import →</Link>
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>P.O. No.</th><th>Supplier / Unit</th><th>Delivery Date</th><th>Items</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>{pos.map(p => (
            <tr key={p.id}><td><strong>{p.poNo}</strong><div className="small muted">{p.date}</div></td>
              <td>{p.supplier}<div className="small muted">{p.businessUnit}</div></td>
              <td>{p.deliveryDate}{p.receivedDate ? <div className="small muted">Received {p.receivedDate}</div> : ''}</td>
              <td>{p.items.map((i, k) => <div key={k}>{i.item} × {i.quantity} @ ₱{i.supplierPrice.toLocaleString()}</div>)}</td>
              <td className="num"><Money n={p.total} /></td><td><Pill status={p.status} /></td>
              <td>{!p.received && p.status !== 'Cancelled' ? <button className="btn small" onClick={() => receivePO(p.id)}>Mark received</button> : <span className="small muted">Closed</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
