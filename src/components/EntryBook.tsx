import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, JournalEntry, peso } from '../data/seed';
import { inDateRange } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from './ui';
import './EntryBook.css';

/**
 * The single book both Transaction > Disbursement and Transaction > Journal
 * render. Both pages show the same Journal content — the shared data source
 * (journal entries), the shared filter bar, the "Drafts awaiting review" and
 * "All entries" cards, the shared column set, the print header and the print
 * styles. Only the title text, the route and the print-header title differ
 * between the two pages.
 */
interface BookRow {
  entry: JournalEntry;
  /** ref + particulars, lower-cased — the original Journal search fields. */
  searchText: string;
}

/** ISO yyyy-mm-dd → mm/dd/yyyy for the print header. */
const md = (iso: string): string => {
  const [y, m, d] = (iso || '').split('-');
  return y && m && d ? `${m}/${d}/${y}` : iso;
};

export default function EntryBook({ title, onView }: { title: string; onView: (id: string) => void }) {
  const { journal, queueJournal } = useStore();
  const [unit, setUnit] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ref, setRef] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // One data source for both pages: the journal entries. Unit and the two
  // dates filter every row; the counts below reflect the filtered results.
  const rows = useMemo<BookRow[]>(
    () => journal.map(j => ({ entry: j, searchText: (j.ref + j.particulars).toLowerCase() })),
    [journal],
  );

  // A reversed range is reported inline and the date filter is not applied.
  const rangeBad = !!(from && to && from > to);
  const inScope = (r: BookRow) =>
    (unit === 'All' || r.entry.businessUnit === unit)
    && (rangeBad || inDateRange(r.entry.date, from, to));

  const term = ref.trim().toLowerCase();
  // Same simple contains matching as the original Journal page, case-insensitive.
  const visible = rows.filter(r => inScope(r) && (!term || r.searchText.includes(term)));
  const drafts = visible.filter(r => r.entry.status === 'Draft');

  const reset = () => { setUnit('All'); setFrom(''); setTo(''); setRef(''); };

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
        <PageHead title={title} />
      </div>

      <div className="entry-book">
        <div className="filters no-print">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <label className="f">Start Date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="f">End Date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <button className="btn ghost small" onClick={reset}>Clear / Reset</button>
          <button className="btn ghost small" onClick={() => window.print()}>🖨 Print</button>
        </div>
        {rangeBad && <div className="warn no-print">Start date must be on or before the end date</div>}
        {feedback && <div className={feedback.ok ? 'notice no-print' : 'warn no-print'}>{feedback.text}</div>}

        <div className="eb-print">
          <div className="print-company">Ayop Group of Companies — JEM51 Accounting System</div>
          <h2 className="eb-title">{title}</h2>
          <div className="print-meta">Scope: {unit} · Period: {period}{term ? ` · Search: "${ref.trim()}"` : ''} · Printed: {new Date().toLocaleString('en-PH')}</div>
          <div className="print-demo">SYNTHETIC DEMONSTRATION DATA — requires accounting validation before production use.</div>
        </div>

        <div className="card">
          <h3>Drafts awaiting review ({drafts.length})</h3>
          {drafts.length === 0
            ? <p className="small muted">No drafts. Manual entries, opening-balance imports, and adjustments appear here for review.</p>
            : <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th className="no-print"></th></tr></thead>
              <tbody>{drafts.map(r => (
                <tr key={r.entry.id}><td>{r.entry.date}</td><td><strong>{r.entry.ref}</strong><div className="small muted">{r.entry.businessUnit}</div></td>
                  <td>{r.entry.particulars}<div className="small muted">Source: {r.entry.sourceTxn}</div>
                    {r.entry.lines && <div className="small muted">{r.entry.lines.map((l, k) => <div key={k}>{l.accountCode} — {l.accountName}: Dr {peso(l.debit)} / Cr {peso(l.credit)}</div>)}</div>}</td>
                  <td>{r.entry.debitAccount}</td><td>{r.entry.creditAccount}</td><td className="num"><Money n={r.entry.amount} /></td>
                  <td className="no-print"><div className="btn-row" style={{ gap: 6 }}>
                    <button className="btn small ghost" onClick={() => onView(r.entry.id)}>View</button>
                    {r.entry.queuedTxn
                      ? <span className="small muted">Queued as <Link to="/admin/approval">{r.entry.queuedTxn}</Link> — awaiting review</span>
                      : <button className="btn small" onClick={() => queue(r.entry.id)}>Queue for review</button>}
                  </div></td></tr>
              ))}</tbody></table></div>}
        </div>

        <div className="card">
          <h3>All entries ({visible.length})</h3>
          <div className="filters no-print"><input placeholder="Search ref / particulars" value={ref} onChange={e => setRef(e.target.value)} style={{ minWidth: 240 }} /></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th className="no-print"></th></tr></thead>
            <tbody>{visible.map(r => (
              <tr key={r.entry.id}><td>{r.entry.date}</td><td><strong>{r.entry.ref}</strong><div className="small muted">{r.entry.businessUnit}</div></td>
                <td>{r.entry.particulars}<div className="small muted">Source: {r.entry.sourceTxn}{r.entry.queuedTxn ? ` · queued as ${r.entry.queuedTxn}` : ''}</div></td>
                <td>{r.entry.debitAccount}</td><td>{r.entry.creditAccount}</td><td className="num"><Money n={r.entry.amount} /></td>
                <td><Pill status={r.entry.status} /></td>
                <td className="no-print"><button className="btn small ghost" onClick={() => onView(r.entry.id)}>View</button></td></tr>
            ))}</tbody>
          </table></div>
          {visible.length === 0 && <div className="notice">No entries match these filters</div>}
        </div>
      </div>
    </>
  );
}
