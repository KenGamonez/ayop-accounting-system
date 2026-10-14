import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, INVENTORY_TYPES, ITEM_CATEGORIES, peso } from '../data/seed';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';

export default function Inventory() {
  const { inventory, adjustInventory } = useStore();
  const [unit, setUnit] = useState('All');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  const rows = useMemo(() => inventory.filter(i =>
    (unit === 'All' || i.businessUnit === unit) &&
    (type === 'All' || i.type === type) &&
    (!q || i.item.toLowerCase().includes(q.toLowerCase()))), [inventory, unit, type, q]);
  const totalVal = rows.reduce((s, i) => s + i.amount, 0);
  const low = rows.filter(i => i.quantity <= i.reorderLevel);

  return (
    <>
      <PageHead title="Inventory" sub="Staff fields: Business Unit · Type · Item · Quantity · Amount · Supplier. Types: Laboratory, Pharmacy, Dialysis, Admin. Synthetic demo." />
      {low.length > 0 && <div className="next-action"><span><strong>Next action:</strong> {low.length} item{low.length === 1 ? ' is' : 's are'} at or below reorder — raise a purchase order.</span><Link className="btn small blue" to="/admin/purchasing">Go to Purchasing</Link></div>}
      <div className="grid g4">
        <div className="kpi"><div className="lbl">SKUs shown</div><div className="val">{rows.length}</div></div>
        <div className="kpi"><div className="lbl">Stock value (demo)</div><div className="val">{peso(totalVal)}</div></div>
        <div className="kpi"><div className="lbl">At / below reorder</div><div className="val">{low.length}</div><div className="sub">{low.map(l => l.item).slice(0, 2).join('; ')}</div></div>
        <div className="kpi"><div className="lbl">Categories</div><div className="val" style={{ fontSize: 14 }}>{ITEM_CATEGORIES.join(' · ')}</div></div>
      </div>
      <div className="card">
        <div className="filters">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <select value={type} onChange={e => setType(e.target.value)}><option>All</option>{INVENTORY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Search Item" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Business Unit</th><th>Type</th><th>Item</th><th>Supplier</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Supplier Price</th><th style={{ textAlign: 'right' }}>Retail Price</th><th style={{ textAlign: 'right' }}>Amount</th><th>Adjust</th></tr></thead>
          <tbody>{rows.map(i => (
            <tr key={i.id}>
              <td>{i.businessUnit}</td><td><Pill status={i.type} /></td>
              <td><strong>{i.item}</strong><div className="small muted">{i.category}{i.quantity <= i.reorderLevel ? ' · ⚠ reorder' : ''}</div></td>
              <td>{i.supplier}</td><td className="num">{i.quantity}</td>
              <td className="num"><Money n={i.supplierPrice} /></td><td className="num"><Money n={i.retailPrice} /></td><td className="num"><Money n={i.amount} /></td>
              <td><div className="btn-row"><button className="btn small ghost" onClick={() => adjustInventory(i.id, 1)}>+1</button><button className="btn small ghost" onClick={() => adjustInventory(i.id, -1)}>−1</button></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
