import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, JournalLine } from '../data/seed';
import { disbursementEntryLines, inDateRange } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from './ui';
import './EntryBook.css';

/**
 * The single book both Transaction > Disbursement and Transaction > Journal
 * render. It owns the shared data source (disbursement transactions + journal
 * entries), the shared filter bar, the shared column set, the print header and
 * the print styles, so both pages stay row-for-row identical. Only the title,
 * the route and the menu differ between the two pages.
 */
export const BOOK_SUB =
  'One shared book — every disbursement and journal entry, with the same filters, columns and print output on both pages. New entries are created from Transaction > New. Nothing posts directly. Synthetic demo.';

interface BookRow {
  key: string;
  viewId: string;
  date: string;
  underDate: string;
  ref: string;
  refBold: boolean;
  particulars: string;
  underParticulars: string;
  unit: string;
  debit: string;
  credit: string;
  amount: number;
  status: string;
  queuedTxn?: string;
  canQueue: boolean;
  /** Journal ref + particulars only — matches the original Journal search. */
  searchText: string;
}

const acctLabel = (l?: JournalLine): string =>
  l && l.accountCode ? (l.accountName ? `${l.accountCode} — ${l.accountName}` : l.accountCode) : '—';

/** ISO yyyy-mm-dd → mm/dd/yyyy for the print header. */
const md = (iso: string): string => {
  const [y, m, d] = (iso || '').split('-');
  return y && m && d ? `${m}/${d}/${y}` : iso;
};

export default function EntryBook({ title, onView }: { title: string; onView: (id: string) => void }) {
  const { txns, journal, queueJournal } = useStore();
  const [unit, setUnit] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // One data source for both pages. The two sets are disjoint by construction
  // (Transaction > New routes Journal entries to addJournal and everything else
  // to addTxn), so no deduplication is needed — the union is just both.
  const rows = useMemo<BookRow[]>(() => {
    const out: BookRow[] = [];

    for (const t of txns) {
      if (t.kind !== 'Disbursement') continue;
      const lines = disbursementEntryLines(t);
      out.push({
        key: `t:${t.id}`,
        viewId: t.id,
        date: t.date,
        underDate: t.id,
        ref: t.controlNo ?? '',
        refBold: false,
        particulars: t.item || '—',
        underParticulars: `Paid to ${t.supplier} · ${t.accountCode} — ${t.accountName}`,
        unit: t.businessUnit,
        debit: acctLabel(lines.find(l => l.debit > 0)),
        credit: acctLabel(lines.find(l => l.credit > 0)),
        amount: t.amount,
        status: t.status,
        canQueue: false,
        // Same rule as the Journal search, on this row's own equivalent fields.
        searchText: ((t.controlNo ?? '') + (t.item || '')).toLowerCase(),
      });
    }

    for (const j of journal) {
      out.push({
        key: `j:${j.id}`,
        viewId: j.id,
        date: j.date,
        underDate: '',
        ref: j.ref,
        refBold: true,
        particulars: j.particulars || '—',
        underParticulars: `Source: ${j.sourceTxn}${j.queuedTxn ? ` · queued as ${j.queuedTxn}` : ''}`,
        unit: j.businessUnit,
        debit: j.debitAccount || '—',
        credit: j.creditAccount || '—',
        amount: j.amount,
        status: j.status,
        queuedTxn: j.queuedTxn,
        canQueue: j.status === 'Draft' && !j.queuedTxn,
        searchText: (j.ref + (j.particulars || '')).toLowerCase(),
      });
    }

    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key.localeCompare(b.key)));
    return out;
  }, [txns, journal]);

  // A reversed range is reported inline and the date filter is not applied.
  const rangeBad = !!(from && to && from > to);
  // Search combines with unit and dates — every active filter must match. The
  // term matches the original Journal search: ref + particulars, case-insensitive.
  const term = search.trim().toLowerCase();
  const visible = rows.filter(
    r => (unit === 'All' || r.unit === unit)
      && (rangeBad || inDateRange(r.date, from, to))
      && (!term || r.searchText.includes(term)),
  );

  const reset = () => { setUnit('All'); setFrom(''); setTo(''); setSearch(''); };

  const queue = async (id: string) => {
    const res = await queueJournal(id);
    setFeedback({ ok: res.ok, text: res.message });
  };

  const period = rangeBad ? 'All dates'
    : from && to ? `${md(from)} to ${md(to)}`
    : from ? `${md(from)} to open`
    : to ? `open to ${md(to)}`
    : 'All dates';

  return (
    <>
      <div className="no-print">
        <PageHead title={title} sub={BOOK_SUB} />
      </div>

      <div className="card entry-book">
        <div className="eb-print">
          <div className="print-company">Ayop Group of Companies — JEM51 Accounting System</div>
          <h2 className="eb-title">{title}</h2>
          <div className="print-meta">Scope: {unit} · Period: {period}{term ? ` · Search: "${search.trim()}"` : ''} · Printed: {new Date().toLocaleString('en-PH')}</div>
          <div className="print-demo">SYNTHETIC DEMONSTRATION DATA — requires accounting validation before production use.</div>
        </div>

        <div className="filters no-print">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <label className="f">Start Date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="f">End Date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <input className="eb-search" placeholder="Search ref / particulars" aria-label="Search ref / particulars" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn ghost small" onClick={reset}>Clear / Reset</button>
          <button className="btn ghost small" onClick={() => window.print()}>🖨 Print</button>
        </div>

        {rangeBad && <div className="warn no-print">Start date must be on or before the end date</div>}
        {feedback && <div className={feedback.ok ? 'notice no-print' : 'warn no-print'}>{feedback.text}</div>}

        {visible.length === 0 ? (
          <div className="notice">No entries match these filters</div>
        ) : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>
              <th>Date</th><th>Ref</th><th>Particulars</th><th>Unit</th>
              <th>Debit account</th><th>Credit account</th>
              <th style={{ textAlign: 'right' }}>Amount</th><th>Status</th>
              <th className="no-print"></th>
            </tr></thead>
            <tbody>{visible.map(r => (
              <tr key={r.key}>
                <td>{r.date}{r.underDate && <div className="small muted">{r.underDate}</div>}</td>
                <td>{r.refBold ? <strong>{r.ref}</strong> : (r.ref || '—')}</td>
                <td>{r.particulars}<div className="small muted">{r.underParticulars}</div></td>
                <td>{r.unit}</td>
                <td>{r.debit}</td>
                <td>{r.credit}</td>
                <td className="num"><Money n={r.amount} /></td>
                <td><Pill status={r.status} /></td>
                <td className="no-print"><div className="btn-row" style={{ gap: 6 }}>
                  <button className="btn small ghost" onClick={() => onView(r.viewId)}>View</button>
                  {r.queuedTxn
                    ? <span className="small muted">Queued as <Link to="/admin/approval">{r.queuedTxn}</Link> — awaiting review</span>
                    : r.canQueue && <button className="btn small" onClick={() => queue(r.viewId)}>Queue for review</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <div className="small muted no-print eb-count">{visible.length} of {rows.length} entries shown</div>
      </div>
    </>
  );
}
