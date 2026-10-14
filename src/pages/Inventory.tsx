import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, INVENTORY_TYPES, ITEM_CATEGORIES, InventoryItem, peso } from '../data/seed';
import { toCSV, fileName, toNum } from '../data/io';
import { download } from '../components/download';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

const blank = { businessUnit: 'Pharmacy', type: 'Pharmacy', item: '', category: 'Medical Supplies', quantity: '0', supplier: '', supplierPrice: '0', retailPrice: '0', reorderLevel: '10' };

export default function Inventory() {
  const { inventory, adjustInventory, addInventoryItem, updateInventoryItem, user } = useStore();
  const [unit, setUnit] = useState('All');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState(blank);
  const [addErr, setAddErr] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ type: '', category: '', supplier: '', supplierPrice: '', retailPrice: '', reorderLevel: '' });
  const [note, setNote] = useState('');

  const rows = useMemo(() => inventory.filter(i =>
    (unit === 'All' || i.businessUnit === unit) &&
    (type === 'All' || i.type === type) &&
    (!q || i.item.toLowerCase().includes(q.toLowerCase()))), [inventory, unit, type, q]);
  const totalVal = rows.reduce((s, i) => s + i.amount, 0);
  const low = rows.filter(i => i.quantity <= i.reorderLevel);

  const submitAdd = () => {
    if (!add.item.trim()) return setAddErr('Item is required.');
    if (!add.supplier.trim()) return setAddErr('Supplier is required.');
    const qty = toNum(add.quantity);
    if (qty === null || !Number.isInteger(qty) || qty < 0) return setAddErr('Quantity must be a whole number ≥ 0.');
    const sp = toNum(add.supplierPrice) ?? -1, rp = toNum(add.retailPrice) ?? -1, rl = toNum(add.reorderLevel) ?? -1;
    if (sp < 0 || rp < 0) return setAddErr('Prices cannot be negative.');
    if (rl < 0 || !Number.isInteger(rl)) return setAddErr('Reorder Level must be a whole number ≥ 0.');
    if (inventory.some(i => i.businessUnit === add.businessUnit && i.item.toLowerCase() === add.item.trim().toLowerCase()))
      return setAddErr('That Item already exists in this Business Unit — edit it below or receive a P.O. instead of duplicating.');
    setAddErr('');
    addInventoryItem({
      businessUnit: add.businessUnit, type: add.type, item: add.item.trim(),
      category: add.category, quantity: qty, amount: sp * qty, supplier: add.supplier.trim(),
      supplierPrice: sp, retailPrice: rp, reorderLevel: rl,
    });
    setAdd(blank); setShowAdd(false);
    setNote(`Added “${add.item.trim()}” (${add.businessUnit}) — demo entry, visible above.`);
  };

  const startEdit = (i: InventoryItem) => {
    setEditing(i.id);
    setEdit({ type: i.type, category: i.category, supplier: i.supplier, supplierPrice: String(i.supplierPrice), retailPrice: String(i.retailPrice), reorderLevel: String(i.reorderLevel) });
  };
  const saveEdit = (id: string) => {
    const sp = toNum(edit.supplierPrice), rp = toNum(edit.retailPrice), rl = toNum(edit.reorderLevel);
    if (!edit.supplier.trim()) return setNote('Supplier cannot be empty — edit discarded.');
    if (sp === null || sp < 0 || rp === null || rp < 0) return setNote('Prices cannot be negative — edit discarded.');
    if (rl === null || !Number.isInteger(rl) || rl < 0) return setNote('Reorder Level must be a whole number ≥ 0 — edit discarded.');
    updateInventoryItem(id, { type: edit.type, category: edit.category, supplier: edit.supplier.trim(), supplierPrice: sp, retailPrice: rp, reorderLevel: rl });
    setEditing(null);
    setNote('Item updated. Quantity is intentionally not editable here — use Adjust or P.O. receiving so every change is logged.');
  };

  return (
    <>
      <PageHead title="Inventory" sub="Staff fields: Business Unit · Type · Item · Quantity · Amount · Supplier. Types: Laboratory, Pharmacy, Dialysis, Admin. Synthetic demo." actions={<button className="btn blue" onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Close' : '+ Add item'}</button>} />
      {note && <div className="notice">{note}</div>}
      {low.length > 0 && <div className="next-action"><span><strong>Next action:</strong> {low.length} item{low.length === 1 ? ' is' : 's are'} at or below reorder — raise a purchase order.</span><Link className="btn small blue" to="/admin/purchasing">Go to Purchasing</Link></div>}
      <div className="grid g4">
        <div className="kpi"><div className="lbl">SKUs shown</div><div className="val">{rows.length}</div></div>
        <div className="kpi"><div className="lbl">Stock value (demo)</div><div className="val">{peso(totalVal)}</div></div>
        <div className="kpi"><div className="lbl">At / below reorder</div><div className="val">{low.length}</div><div className="sub">{low.map(l => l.item).slice(0, 2).join('; ')}</div></div>
        <div className="kpi"><div className="lbl">Categories</div><div className="val" style={{ fontSize: 14 }}>{ITEM_CATEGORIES.join(' · ')}</div></div>
      </div>
      {showAdd && (
        <div className="card"><h3>Add inventory item (demo entry)</h3>
          {addErr && <div className="warn">{addErr}</div>}
          <div className="form-grid">
            <label className="f">Business Unit<select value={add.businessUnit} onChange={e => setAdd({ ...add, businessUnit: e.target.value })}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="f">Type<select value={add.type} onChange={e => setAdd({ ...add, type: e.target.value })}>{INVENTORY_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label className="f">Item<input value={add.item} onChange={e => setAdd({ ...add, item: e.target.value })} placeholder="e.g. Paracetamol 500mg, 100s" /></label>
            <label className="f">Category<select value={add.category} onChange={e => setAdd({ ...add, category: e.target.value })}>{ITEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Quantity<input type="number" min={0} step={1} value={add.quantity} onChange={e => setAdd({ ...add, quantity: e.target.value })} /></label>
            <label className="f">Supplier<input value={add.supplier} onChange={e => setAdd({ ...add, supplier: e.target.value })} /></label>
            <label className="f">Supplier Price<input type="number" min={0} step="any" value={add.supplierPrice} onChange={e => setAdd({ ...add, supplierPrice: e.target.value })} /></label>
            <label className="f">Retail Price<input type="number" min={0} step="any" value={add.retailPrice} onChange={e => setAdd({ ...add, retailPrice: e.target.value })} /></label>
            <label className="f">Reorder Level<input type="number" min={0} step={1} value={add.reorderLevel} onChange={e => setAdd({ ...add, reorderLevel: e.target.value })} /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}><button className="btn" onClick={submitAdd}>Add item (demo)</button></div>
        </div>
      )}
      <div className="card">
        <div className="filters">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <select value={type} onChange={e => setType(e.target.value)}><option>All</option>{INVENTORY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Search Item" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn ghost small" onClick={() => download(new Blob([toCSV(
            ['Business Unit', 'Type', 'Item', 'Category', 'Quantity', 'Supplier', 'Supplier Price', 'Retail Price', 'Amount'],
            rows.map(i => [i.businessUnit, i.type, i.item, i.category, i.quantity, i.supplier, i.supplierPrice, i.retailPrice, i.amount])
          )], { type: 'text/csv' }), fileName('inventory', 'csv'))}>Export CSV ({rows.length})</button>
          <Link className="btn ghost small" to="/admin/import-export">Import →</Link>
        </div>
        {rows.length === 0 ? (
          <div className="notice">No items match these filters. <button className="btn small ghost" onClick={() => { setUnit('All'); setType('All'); setQ(''); }}>Clear filters</button> <button className="btn small ghost" onClick={() => setShowAdd(true)}>Add an item</button></div>
        ) : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Business Unit</th><th>Type</th><th>Item</th><th>Supplier</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Supplier Price</th><th style={{ textAlign: 'right' }}>Retail Price</th><th style={{ textAlign: 'right' }}>Amount</th><th>Adjust / Edit</th></tr></thead>
          <tbody>{rows.map(i => (
            <tr key={i.id}>
              <td>{i.businessUnit}</td>
              <td>{editing === i.id
                ? <select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })}>{INVENTORY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                : <Pill status={i.type} />}</td>
              <td><strong>{i.item}</strong><div className="small muted">{editing === i.id
                ? <select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}>{ITEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                : <>{i.category}</>}{i.quantity <= i.reorderLevel ? ' · ⚠ reorder' : ''}</div></td>
              <td>{editing === i.id
                ? <input value={edit.supplier} onChange={e => setEdit({ ...edit, supplier: e.target.value })} style={{ width: 140 }} />
                : i.supplier}</td>
              <td className="num">{i.quantity}<div className="small muted">via Adjust / P.O.</div></td>
              <td className="num">{editing === i.id
                ? <input type="number" min={0} value={edit.supplierPrice} onChange={e => setEdit({ ...edit, supplierPrice: e.target.value })} style={{ width: 90 }} />
                : <Money n={i.supplierPrice} />}</td>
              <td className="num">{editing === i.id
                ? <input type="number" min={0} value={edit.retailPrice} onChange={e => setEdit({ ...edit, retailPrice: e.target.value })} style={{ width: 90 }} />
                : <Money n={i.retailPrice} />}</td>
              <td className="num"><Money n={i.amount} /></td>
              <td>{editing === i.id ? (
                <div className="btn-row">
                  <button className="btn small" onClick={() => saveEdit(i.id)}>Save</button>
                  <button className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <div className="btn-row">
                  <button className="btn small ghost" onClick={() => { adjustInventory(i.id, 1, `manual +1 by ${user?.name ?? 'demo'}`); }}>+1</button>
                  <button className="btn small ghost" onClick={() => { adjustInventory(i.id, -1, `manual −1 by ${user?.name ?? 'demo'}`); }}>−1</button>
                  <button className="btn small ghost" onClick={() => startEdit(i)}>Edit</button>
                </div>
              )}</td>
            </tr>
          ))}</tbody>
        </table></div>
        )}
        <p className="small muted">Quantity changes only through Adjust buttons or P.O. receiving, and every change is written to the audit trail. Demo data lives in this browser only.</p>
      </div>
    </>
  );
}
