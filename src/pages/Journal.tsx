import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, COA, peso } from '../data/seed';
import { journalEntryLines, journalTotals, validateJournal, JournalLineInput } from '../data/ops';
import { useStore } from '../store/AppStore';
import { PageHead, Pill, Money } from '../components/ui';
import VoucherPrint, { voucherTitleFor } from '../components/VoucherPrint';

const newLine = (): JournalLineInput => ({ accountCode: '', debit: null, credit: null });

export default function Journal() {
  const { journal, queueJournal, addJournal, user } = useStore();
  const [ref, setRef] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [particulars, setParticulars] = useState('');
  const [unit, setUnit] = useState('Diagnostic Center');
  const [lines, setLines] = useState<JournalLineInput[]>([newLine(), newLine()]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [viewId, setViewId] = useState<string | null>(null);
  // Guards against a second save while the first is still being queued.
  const savingRef = useRef(false);
  const rows = journal.filter(j => !ref || (j.ref + j.particulars).toLowerCase().includes(ref.toLowerCase()));
  const drafts = rows.filter(j => j.status === 'Draft');
  const totals = journalTotals(lines);

  // Read-only view of one saved journal entry — renders only, never mutates.
  const viewEntry = viewId ? journal.find(j => j.id === viewId) ?? null : null;
  const viewLines = viewEntry ? journalEntryLines(viewEntry) : [];
  const viewTotalDr = viewLines.reduce((s, l) => s + (l.debit > 0 ? l.debit : 0), 0);
  const viewTotalCr = viewLines.reduce((s, l) => s + (l.credit > 0 ? l.credit : 0), 0);
  const viewControlNo = viewEntry ? (viewEntry.controlNo ?? viewEntry.ref) : '';

  const queue = async (id: string) => {
    const res = await queueJournal(id);
    setFeedback({ ok: res.ok, text: res.message });
  };

  const setLine = (i: number, patch: Partial<JournalLineInput>) =>
    setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const submit = () => {
    if (savingRef.current) return;
    const v = validateJournal({ date, particulars, businessUnit: unit, lines });
    setErrs(v);
    if (Object.keys(v).length) return;
    savingRef.current = true;
    try {
      const usable = lines.filter(l => l.accountCode && ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0));
      const firstDr = usable.find(l => (l.debit ?? 0) > 0)!;
      const firstCr = usable.find(l => (l.credit ?? 0) > 0)!;
      const drAcct = COA.find(c => c.code === firstDr.accountCode)!;
      const crAcct = COA.find(c => c.code === firstCr.accountCode)!;
      const refNo = 'JV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(journal.length + 1).padStart(3, '0');
      addJournal({
        date, ref: refNo, particulars: particulars.trim(), businessUnit: unit,
        debitAccount: `${drAcct.code} — ${drAcct.name}`,
        creditAccount: usable.length === 2 ? `${crAcct.code} — ${crAcct.name}` : `Multiple (${usable.length} lines)`,
        amount: totals.debit, status: 'Draft', sourceTxn: 'MANUAL',
        lines: usable.map(l => {
          const a = COA.find(c => c.code === l.accountCode)!;
          return { accountCode: a.code, accountName: a.name, debit: l.debit ?? 0, credit: l.credit ?? 0 };
        }),
      });
      setFeedback({ ok: true, text: `${refNo} saved as a Draft. Queue it for review below — it will not post until approved.` });
      setParticulars(''); setLines([newLine(), newLine()]); setErrs({}); setShow(false);
    } finally {
      savingRef.current = false;
    }
  };

  if (viewEntry) {
    return (
      <>
        <div className="no-print">
          <PageHead
            title="Journal entry"
            sub={`Saved record ${viewEntry.ref} — read-only. Viewing or printing never changes it.`}
            actions={<button className="btn" onClick={() => setViewId(null)}>Back to list</button>}
          />
          <div className="card">
            <h3>Journal {viewEntry.ref} <Pill status={viewEntry.status} /></h3>
            <div className="form-grid">
              <div><div className="small muted">Date</div><div>{viewEntry.date}</div></div>
              <div><div className="small muted">Business Unit</div><div>{viewEntry.businessUnit}</div></div>
              <div><div className="small muted">Transaction Type</div><div>Journal</div></div>
              <div><div className="small muted">Control No.</div><div className="mono">{viewControlNo}</div></div>
              <div className="full"><div className="small muted">Particulars</div><div>{viewEntry.particulars || '—'}</div></div>
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
              <span className="small muted">Prints as {voucherTitleFor('Journal')} using the saved control number and lines.</span>
            </div>
            {viewEntry.queuedTxn && <div className="small muted" style={{ marginTop: 8 }}>Queued as {viewEntry.queuedTxn} — awaiting review.</div>}
          </div>
        </div>
        <div className="print-only">
          <VoucherPrint
            controlNo={viewControlNo}
            date={viewEntry.date}
            businessUnit={viewEntry.businessUnit}
            transactionType="Journal"
            particulars={viewEntry.particulars}
            lines={viewLines}
            signatories={viewEntry.signatories ?? { preparedBy: '', postedBy: '', approvedBy: '', auditedBy: '' }}
            recordNo={viewEntry.ref}
            status={viewEntry.status}
            note={viewEntry.queuedTxn ? `Queued as ${viewEntry.queuedTxn} — awaiting review.` : undefined}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Journal" sub="Record adjustments the other screens can't express. Drafts never post directly — they queue for accountant review like every other entry." actions={<button className="btn blue" onClick={() => { setShow(s => !s); setErrs({}); }}>{show ? 'Close entry form' : '+ New journal entry'}</button>} />
      <div className="notice"><strong>What is a journal entry?</strong> A note that moves an amount from one account to another — for corrections and adjustments, not daily sales or payments (use Transaction or Disbursement for those). List what leaves an account under <strong>Debit</strong> and what arrives under <strong>Credit</strong>; the two totals must match exactly.</div>
      {feedback && <div className={feedback.ok ? 'notice' : 'warn'}>{feedback.text}</div>}
      {show && (
        <div className="card"><h3>New journal entry — Draft (never posts directly)</h3>
          <div className="form-grid">
            <label className="f">1 · Entry date<input type="date" value={date} onChange={e => setDate(e.target.value)} />{errs.date && <span className="small" style={{ color: '#b42318' }}>{errs.date}</span>}</label>
            <label className="f">3 · Business Unit<select value={unit} onChange={e => setUnit(e.target.value)}>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>{errs.businessUnit && <span className="small" style={{ color: '#b42318' }}>{errs.businessUnit}</span>}</label>
            <label className="f full">2 · Particulars — what and why?<input value={particulars} onChange={e => setParticulars(e.target.value)} placeholder="e.g. Correct October bond-paper charge to Office Supplies Expense" />{errs.particulars && <span className="small" style={{ color: '#b42318' }}>{errs.particulars}</span>}</label>
          </div>
          <h3 style={{ marginTop: 12 }}>4 · Journal lines {errs.lines && <span className="small" style={{ color: '#b42318' }}>{errs.lines}</span>}</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Account (from chart)</th><th style={{ textAlign: 'right' }}>Debit (leaves)</th><th style={{ textAlign: 'right' }}>Credit (arrives)</th><th></th></tr></thead>
            <tbody>{lines.map((l, i) => (
              <tr key={i}>
                <td><select value={l.accountCode} onChange={e => setLine(i, { accountCode: e.target.value })}>
                  <option value="">— choose account —</option>{COA.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>{errs[`line${i}`] && <div className="small" style={{ color: '#b42318' }}>{errs[`line${i}`]}</div>}</td>
                <td className="num"><input type="number" min={0} step="any" value={l.debit ?? ''} onChange={e => setLine(i, { debit: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 120, textAlign: 'right' }} /></td>
                <td className="num"><input type="number" min={0} step="any" value={l.credit ?? ''} onChange={e => setLine(i, { credit: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 120, textAlign: 'right' }} /></td>
                <td><button className="btn small danger" disabled={lines.length <= 2} onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}>Remove</button></td>
              </tr>
            ))}
              <tr className="total-row"><td><strong>Totals (must match)</strong></td><td className="num"><strong>{peso(totals.debit)}</strong></td><td className="num"><strong>{peso(totals.credit)}</strong></td><td className="num small">Diff: {peso(Math.abs(totals.diff))}</td></tr>
            </tbody></table></div>
          {errs.totals && <div className="warn">{errs.totals}</div>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={() => setLines(ls => [...ls, newLine()])}>+ Add line</button>
            <button className="btn" onClick={submit}>Save as Draft</button>
            <span className="small muted">Entered by {user?.name ?? 'demo'} · goes to review, never auto-posts.</span>
          </div>
        </div>
      )}
      <div className="card">
        <h3>Drafts awaiting review ({drafts.length})</h3>
        {drafts.length === 0
          ? <p className="small muted">No drafts. Manual entries, opening-balance imports, and adjustments appear here for review.</p>
          : <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
            <tbody>{drafts.map(j => (
              <tr key={j.id}><td>{j.date}</td><td><strong>{j.ref}</strong><div className="small muted">{j.businessUnit}</div></td>
                <td>{j.particulars}<div className="small muted">Source: {j.sourceTxn}</div>
                  {j.lines && <div className="small muted">{j.lines.map((l, k) => <div key={k}>{l.accountCode} — {l.accountName}: Dr {peso(l.debit)} / Cr {peso(l.credit)}</div>)}</div>}</td>
                <td>{j.debitAccount}</td><td>{j.creditAccount}</td><td className="num"><Money n={j.amount} /></td>
                <td><div className="btn-row" style={{ gap: 6 }}>
                  <button className="btn small ghost" onClick={() => setViewId(j.id)}>View</button>
                  {j.queuedTxn
                    ? <span className="small muted">Queued as <Link to="/admin/approval">{j.queuedTxn}</Link> — awaiting review</span>
                    : <button className="btn small" onClick={() => queue(j.id)}>Queue for review</button>}
                </div></td></tr>
            ))}</tbody></table></div>}
      </div>
      <div className="card">
        <h3>All entries ({rows.length})</h3>
        <div className="filters"><input placeholder="Search ref / particulars" value={ref} onChange={e => setRef(e.target.value)} style={{ minWidth: 240 }} /></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th>Debit account</th><th>Credit account</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map(j => (
            <tr key={j.id}><td>{j.date}</td><td><strong>{j.ref}</strong><div className="small muted">{j.businessUnit}</div></td>
              <td>{j.particulars}<div className="small muted">Source: {j.sourceTxn}{j.queuedTxn ? ` · queued as ${j.queuedTxn}` : ''}</div></td>
              <td>{j.debitAccount}</td><td>{j.creditAccount}</td><td className="num"><Money n={j.amount} /></td>
              <td><Pill status={j.status} /></td>
              <td><button className="btn small ghost" onClick={() => setViewId(j.id)}>View</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
