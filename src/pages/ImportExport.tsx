import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_UNITS, COA, peso } from '../data/seed';
import {
  DATA_TYPES, DataType, autoMap, validateRows, dupKey, toCSV, fileName,
  sheetsToCsvUrl, ValidatedRow,
} from '../data/io';
import { sumByClass, trialBalance } from '../data/finance';
import { useStore } from '../store/AppStore';
import { PageHead, Pill } from '../components/ui';
import { download } from '../components/download';

type Xlsx = typeof import('xlsx');
async function xlsxLib(): Promise<Xlsx> { return await import('xlsx'); }

interface HistoryEntry {
  at: string; type: string; file: string; valid: number; warnings: number;
  errors: number; duplicates: number; skipped: number; imported: number;
}
const HIST_KEY = 'jem51-demo-v1:imports';
const SUP_KEY = 'jem51-demo-v1:suppliers';
function loadHist(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]'); } catch { return []; }
}
export function loadSuppliers(fallback: string[]): { supplier: string; contact: string; phone: string; address: string; terms: string }[] {
  try {
    const raw = localStorage.getItem(SUP_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return fallback.map(s => ({ supplier: s, contact: '', phone: '', address: '', terms: '' }));
}

const STEPS = ['Data type', 'Get file', 'Map columns', 'Review', 'Confirm', 'Done'];

export default function ImportExport() {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  return (
    <>
      <PageHead title="Import & Export Center" sub="Move Excel and Google Sheets data in and out. Browser-side only — demo imports preview integration and never persist official records." />
      <div className="btn-row no-print" style={{ marginBottom: 12 }}>
        <button className={'btn small ' + (tab === 'import' ? '' : 'ghost')} onClick={() => setTab('import')}>Import wizard</button>
        <button className={'btn small ' + (tab === 'export' ? '' : 'ghost')} onClick={() => setTab('export')}>Export center</button>
      </div>
      {tab === 'import' ? <ImportWizard /> : <ExportCenter />}
    </>
  );
}

// ============================== IMPORT ==============================

function ImportWizard() {
  const store = useStore();
  const [type, setType] = useState<DataType>('transactions');
  const [step, setStep] = useState(0);
  const [fileName_, setFileName_] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [gsUrl, setGsUrl] = useState('');
  const [loading, setLoading] = useState('');
  const [problem, setProblem] = useState('');
  const [dupMode, setDupMode] = useState<'skip' | 'queue'>('skip');
  const [invMode, setInvMode] = useState<'skip' | 'add' | 'update'>('skip');
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<HistoryEntry | null>(null);
  const [hist, setHist] = useState<HistoryEntry[]>(loadHist);

  const def = DATA_TYPES.find(d => d.id === type)!;

  const existingKeys = useMemo(() => {
    const s = new Set<string>();
    if (type === 'transactions') store.txns.forEach(t => { const k = dupKey(type, { date: t.date, businessUnit: t.businessUnit, item: t.item, supplier: t.supplier, amount: t.amount }); if (k) s.add(k); });
    if (type === 'inventory') store.inventory.forEach(i => { const k = dupKey(type, { businessUnit: i.businessUnit, item: i.item }); if (k) s.add(k); });
    if (type === 'suppliers') loadSuppliers([]).forEach(x => { const k = dupKey(type, x); if (k) s.add(k); });
    if (type === 'purchase_orders') store.pos.forEach(p => p.items.forEach(it => { const k = dupKey(type, { poNo: p.poNo, item: it.item, quantity: it.quantity }); if (k) s.add(k); }));
    if (type === 'opening_balances') store.journal.forEach(j => { if (j.sourceTxn === 'OPENING') s.add('ob-imported'); });
    return s;
  }, [type, store.txns, store.inventory, store.pos, store.journal]);

  const validated: ValidatedRow[] = useMemo(
    () => (step >= 3 && rawRows.length ? validateRows(type, rawRows, mapping, existingKeys) : []),
    [step, rawRows, mapping, existingKeys, type],
  );
  const nValid = validated.filter(r => r.errors.length === 0 && !r.duplicateOf).length;
  const nDup = validated.filter(r => r.errors.length === 0 && r.duplicateOf).length;
  const nErr = validated.filter(r => r.errors.length > 0).length;
  const nWarn = validated.filter(r => r.warnings.length > 0).length;
  const obTotals = useMemo(() => {
    if (type !== 'opening_balances') return null;
    let dr = 0, cr = 0;
    validated.forEach(r => { if (r.errors.length === 0) { dr += (r.data.debit as number) ?? 0; cr += (r.data.credit as number) ?? 0; } });
    return { dr, cr, balanced: Math.abs(dr - cr) < 0.005 };
  }, [validated, type]);

  const resetFile = () => { setSheets([]); setSheet(''); setHeaders([]); setRawRows([]); setMapping({}); setProblem(''); setResult(null); setAck(false); };

  const ingestWorkbook = async (wb: import('xlsx').WorkBook, name: string) => {
    setSheets(wb.SheetNames);
    setFileName_(name);
    const first = wb.SheetNames[0];
    setSheet(first);
    loadSheet(wb, first);
  };

  // workbook kept in a ref-like state via closure: re-read from stored binary
  const [binStore, setBinStore] = useState<{ data: ArrayBuffer | string; kind: 'array' | 'string' } | null>(null);
  const loadSheet = async (wb: import('xlsx').WorkBook, name: string) => {
    const XLSX = await xlsxLib();
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });
    const headRow = (aoa[0] ?? []).map(h => String(h ?? '').trim());
    if (!headRow.some(h => h)) { setProblem('The selected sheet has no header row. Pick another sheet or check the file.'); return; }
    const objs = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
    setHeaders(headRow);
    setRawRows(objs);
    setMapping(autoMap(headRow, def.fields));
    setProblem('');
    setStep(2);
  };

  const pickSheet = async (name: string) => {
    if (!binStore) return;
    setLoading('Reading sheet…');
    try {
      const XLSX = await xlsxLib();
      const wb = XLSX.read(binStore.data as never, { type: binStore.kind, cellDates: true });
      setSheet(name);
      await loadSheet(wb, name);
    } catch { setProblem('Could not read that sheet. Try another sheet or re-upload the file.'); }
    setLoading('');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    resetFile();
    setLoading('Reading file…');
    try {
      const XLSX = await xlsxLib();
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      if (!wb.SheetNames.length) { setProblem('No worksheets found in that file.'); return; }
      setBinStore({ data: buf, kind: 'array' });
      setStep(1);
      await ingestWorkbook(wb, f.name);
      if (wb.SheetNames.length > 1) setStep(1);
    } catch { setProblem('Could not parse that file. Use .xlsx, .xls, or .csv — or paste a Google Sheets CSV link below.'); }
    setLoading('');
  };

  const onSheetsFetch = async () => {
    resetFile();
    const csvUrl = sheetsToCsvUrl(gsUrl);
    if (!csvUrl) {
      setProblem('That link is not a usable CSV address. Open the sheet and use File → Download → Excel/CSV, or copy a “Publish to web (CSV)” / export?format=csv link. Private sheets cannot be read without sharing — the file-upload fallback always works.');
      return;
    }
    setLoading('Fetching published sheet…');
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const XLSX = await xlsxLib();
      const wb = XLSX.read(text, { type: 'string' });
      setBinStore({ data: text, kind: 'string' });
      setStep(1);
      await ingestWorkbook(wb, 'google-sheet.csv');
    } catch {
      setProblem('Could not fetch that sheet (it may be private, unshared, or offline). Share it as “Anyone with the link”, publish as CSV, or download it and upload the file instead.');
    }
    setLoading('');
  };

  const downloadTemplate = async (fmt: 'xlsx' | 'csv') => {
    const XLSX = await xlsxLib();
    const labels = def.fields.map(f => f.label + (f.required ? ' *' : ''));
    const sample: Record<string, unknown> = {};
    def.fields.forEach(f => { sample[f.label + (f.required ? ' *' : '')] = (def.templateRow[f.label] ?? '') as unknown; });
    const ws = XLSX.utils.json_to_sheet([sample]);
    XLSX.utils.sheet_add_aoa(ws, [labels], { origin: 'A1' });
    ws['!cols'] = labels.map(() => ({ wch: 22 }));
    if (fmt === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      download(new Blob([csv], { type: 'text/csv' }), fileName(`template-${type}`, 'csv'));
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, def.label.slice(0, 28));
      XLSX.writeFile(wb, fileName(`template-${type}`, 'xlsx'));
    }
  };

  const downloadErrors = () => {
    const rows: (string | number)[][] = [];
    validated.forEach(r => {
      r.errors.forEach(e => rows.push([e.row, e.field, e.message]));
      if (r.duplicateOf) rows.push([r.index + 2, 'Duplicate', r.duplicateOf + ' (resolution: ' + (type === 'inventory' ? invMode : dupMode) + ')']);
    });
    const csv = toCSV(['Spreadsheet row', 'Field', 'Issue'], rows.length ? rows : [['—', '—', 'No errors — all rows valid']]);
    download(new Blob([csv], { type: 'text/csv' }), fileName(`import-errors-${type}`, 'csv'));
  };

  const canConfirm = nValid + (dupMode === 'queue' || type === 'inventory' ? nDup : 0) > 0
    && (type !== 'opening_balances' || obTotals?.balanced)
    && ack;

  const confirm = async () => {
    const at = new Date().toLocaleString('en-PH');
    let imported = 0, skipped = nErr;
    let firstError = '';
    const me = store.user?.name ?? 'Demo user';
    if (type === 'transactions') {
      for (const r of validated) {
        if (r.errors.length) continue;
        if (r.duplicateOf && dupMode === 'skip') { skipped++; continue; }
        const d = r.data;
        try {
          await store.addTxn({
            date: d.date as string, businessUnit: d.businessUnit as string,
            classification: d.classification as never, kind: d.kind as never,
            item: String(d.item), category: d.category as string, supplier: String(d.supplier),
            supplierPrice: d.supplierPrice as number, retailPrice: d.retailPrice as number,
            quantity: d.quantity as number, amount: d.amount as number,
            accountCode: '5000', accountName: 'Medical Supplies Expense',
            enteredBy: me, remarks: `Demo import from ${fileName_} — awaiting accountant review`,
          });
          imported++;
        } catch (e) {
          skipped++;
          if (!firstError) firstError = e instanceof Error ? e.message : 'Row failed to save.';
        }
      }
      if (firstError) setProblem(`Some rows could not be saved and were skipped (not silently dropped): ${firstError}`);
    }
    if (type === 'inventory') {
      for (const r of validated) {
        if (r.errors.length) continue;
        const d = r.data;
        try {
          const match = store.inventory.find(i => i.businessUnit === d.businessUnit && String(i.item).toLowerCase() === String(d.item).toLowerCase());
          if (match && invMode === 'skip') { skipped++; continue; }
          if (match && invMode === 'update') { await store.setInventoryQty(match.id, d.quantity as number); imported++; continue; }
          await store.addInventoryItem({
            businessUnit: d.businessUnit as string, type: d.type as string, item: String(d.item),
            category: d.category as string, quantity: d.quantity as number, amount: d.amount as number,
            supplier: String(d.supplier), supplierPrice: d.supplierPrice as number,
            retailPrice: d.retailPrice as number, reorderLevel: d.reorderLevel as number,
          });
          imported++;
        } catch (e) {
          skipped++;
          if (!firstError) firstError = e instanceof Error ? e.message : 'Row failed to save.';
        }
      }
      if (firstError) setProblem(`Some rows could not be saved and were skipped (not silently dropped): ${firstError}`);
    }
    if (type === 'suppliers') {
      const cur = loadSuppliers([]);
      const names = new Set(cur.map(s => s.supplier.toLowerCase()));
      const next = [...cur];
      validated.forEach(r => {
        if (r.errors.length) return;
        const d = r.data;
        if (names.has(String(d.supplier).toLowerCase())) { skipped++; return; }
        names.add(String(d.supplier).toLowerCase());
        next.push({ supplier: String(d.supplier), contact: String(d.contact ?? ''), phone: String(d.phone ?? ''), address: String(d.address ?? ''), terms: String(d.terms ?? '') });
        imported++;
      });
      try { localStorage.setItem(SUP_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      store.log('Supplier directory updated (demo import)', fileName_, `${imported} added, ${skipped} skipped.`);
    }
    if (type === 'purchase_orders') {
      const groups = new Map<string, ValidatedRow[]>();
      validated.forEach(r => {
        if (r.errors.length) return;
        if (r.duplicateOf && dupMode === 'skip') { skipped++; return; }
        const k = String(r.data.poNo);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      });
      for (const rows of groups.values()) {
        const d0 = rows[0].data;
        try {
          await store.addPO({
            poNo: String(d0.poNo), date: d0.date as string, supplier: String(d0.supplier),
            businessUnit: d0.businessUnit as string, deliveryDate: d0.deliveryDate as string,
            items: rows.map(r => ({ item: String(r.data.item), quantity: r.data.quantity as number, supplierPrice: r.data.supplierPrice as number, receivedQty: 0 })),
            received: false, receivedDate: '', status: 'Draft',
          });
          imported += rows.length;
        } catch (e) {
          skipped += rows.length;
          if (!firstError) firstError = e instanceof Error ? e.message : 'Order failed to save.';
        }
      }
      if (firstError) setProblem(`Some rows could not be saved and were skipped (not silently dropped): ${firstError}`);
    }
    if (type === 'opening_balances') {
      const ref = 'OB-' + new Date().toISOString().slice(0, 10);
      validated.forEach(r => {
        if (r.errors.length) return;
        const d = r.data;
        const dr = (d.debit as number) ?? 0;
        const acct = `${d.accountCode} — ${COA.find(c => c.code === d.accountCode)?.name ?? ''}`;
        store.addJournal({
          date: d.date as string, ref,
          particulars: `OPENING BALANCE (demo, controlled import) — ${d.particulars}. Correct accounts before posting.`,
          businessUnit: d.businessUnit as string,
          debitAccount: dr > 0 ? acct : '3999 — Opening Balance Offset (demo)',
          creditAccount: dr > 0 ? '3999 — Opening Balance Offset (demo)' : acct,
          amount: dr > 0 ? dr : ((d.credit as number) ?? 0),
          status: 'Draft', sourceTxn: 'OPENING',
        });
        imported++;
      });
    }
    const entry: HistoryEntry = {
      at, type: def.label, file: fileName_, valid: nValid, warnings: nWarn,
      errors: nErr, duplicates: nDup, skipped, imported,
    };
    const next = [entry, ...hist].slice(0, 30);
    setHist(next);
    try { localStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setResult(entry);
    setStep(5);
  };

  const missingRequired = def.fields.filter(f => f.required && !mapping[f.key]);

  return (
    <>
      <div className="steps" style={{ marginBottom: 14 }}>
        {STEPS.map((s, i) => (
          <div key={s} className={'step ' + (step > i ? 'done' : step === i ? 'now' : '')}>{i + 1}. {s}</div>
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <h3>1 · Choose what to import</h3>
          <div className="grid g3">
            {DATA_TYPES.map(d => (
              <div key={d.id} className="kpi" style={{ borderColor: type === d.id ? '#2563eb' : undefined }}>
                <div style={{ fontWeight: 700, color: '#14234a' }}>{d.label} {d.controlled && <span className="pill p-review">Controlled</span>}</div>
                <div className="sub">{d.short}</div>
                <p className="small muted">{d.description}</p>
                <div className="btn-row">
                  <button className={'btn small ' + (type === d.id ? '' : 'ghost')} onClick={() => { setType(d.id); resetFile(); }}>Select</button>
                  <button className="btn small ghost" onClick={() => { setType(d.id); downloadTemplate('xlsx'); }}>Template .xlsx</button>
                  <button className="btn small ghost" onClick={() => { setType(d.id); downloadTemplate('csv'); }}>.csv</button>
                </div>
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(1)}>Continue →</button>
            <span className="small muted">Columns marked * in the template are required.</span>
          </div>
        </div>
      )}

      {step >= 1 && (
        <div className="card">
          <h3>2 · Get the file — {def.label}</h3>
          <div className="form-grid">
            <label className="f">Upload Excel or CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={e => onFile(e.target.files?.[0])} /></label>
            <label className="f full">…or paste a Google Sheets CSV link<input value={gsUrl} onChange={e => setGsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/export?format=csv" /></label>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={onSheetsFetch} disabled={!gsUrl.trim() || !!loading}>Fetch published sheet</button>
            {loading && <span className="small muted">{loading}</span>}
          </div>
          <div className="notice" style={{ marginTop: 10 }}>
            <strong>From Google Sheets:</strong> easiest is File → Download → Microsoft Excel (.xlsx), then upload above.
            Alternatively use File → Share → Publish to web (CSV) and paste that link here.
            Private or unshared sheets cannot be read — the upload fallback always works. Direct account connection is a future integration and is not offered here.
          </div>
          {problem && <div className="warn">{problem}</div>}
          {sheets.length > 1 && (
            <label className="f" style={{ maxWidth: 360 }}>Worksheet ({sheets.length} found — choose the data sheet)
              <select value={sheet} onChange={e => pickSheet(e.target.value)}>{sheets.map(s => <option key={s}>{s}</option>)}</select>
            </label>
          )}
          {rawRows.length > 0 && (
            <p className="small muted">File <strong>{fileName_}</strong> · sheet <strong>{sheet}</strong> · {rawRows.length} data rows detected. First rows:</p>
          )}
          {rawRows.length > 0 && (
            <div className="tbl-wrap"><table className="tbl"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{rawRows.slice(0, 5).map((r, i) => <tr key={i}>{headers.map(h => <td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={() => setStep(0)}>← Back</button>
            <button className="btn small" disabled={!rawRows.length} onClick={() => setStep(2)}>Continue to mapping →</button>
          </div>
        </div>
      )}

      {step >= 2 && rawRows.length > 0 && (
        <div className="card">
          <h3>3 · Map columns to {def.label} fields</h3>
          <p className="small muted">Suggestions are automatic — correct any row, or Skip optional columns. Required fields must all be mapped.</p>
          {missingRequired.length > 0 && <div className="warn">Still unmapped (required): {missingRequired.map(f => f.label).join(', ')}</div>}
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Destination field</th><th>Source column</th><th>Hint</th></tr></thead>
            <tbody>{def.fields.map(f => (
              <tr key={f.key}>
                <td><strong>{f.label}</strong> {f.required ? <span className="pill p-review">Required</span> : <span className="pill p-draft">Optional</span>}</td>
                <td><select value={mapping[f.key] ?? ''} onChange={e => setMapping(m => { const n = { ...m }; if (!e.target.value) delete n[f.key]; else n[f.key] = e.target.value; return n; })}>
                  <option value="">{f.required ? '— choose column —' : '— skip —'}</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select></td>
                <td className="small muted">{f.hint}</td>
              </tr>
            ))}</tbody></table></div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={() => setStep(1)}>← Back</button>
            <button className="btn small" disabled={missingRequired.length > 0} onClick={() => setStep(3)}>Validate rows →</button>
          </div>
        </div>
      )}

      {step >= 3 && validated.length > 0 && (
        <div className="card">
          <h3>4 · Review validation</h3>
          <div className="grid g4">
            <div className="kpi"><div className="lbl">Valid rows</div><div className="val">{nValid}</div></div>
            <div className="kpi"><div className="lbl">With warnings</div><div className="val">{nWarn}</div></div>
            <div className="kpi"><div className="lbl">Duplicates</div><div className="val">{nDup}</div></div>
            <div className="kpi"><div className="lbl">With errors</div><div className="val">{nErr}</div></div>
          </div>
          {type === 'opening_balances' && obTotals && (
            <div className={obTotals.balanced ? 'notice' : 'warn'} style={{ marginTop: 10 }}>
              Debits {peso(obTotals.dr)} · Credits {peso(obTotals.cr)} — {obTotals.balanced ? 'balanced ✓, may proceed.' : 'NOT balanced. This controlled import is blocked until debits equal credits.'}
            </div>
          )}
          {type === 'inventory' ? (
            <label className="f" style={{ maxWidth: 420, margin: '10px 0' }}>Duplicate resolution (Item + Business Unit already exists)
              <select value={invMode} onChange={e => setInvMode(e.target.value as never)}>
                <option value="skip">Skip duplicates (keep existing — recommended)</option>
                <option value="update">Update quantity to imported value</option>
                <option value="add">Add as separate new items</option>
              </select></label>
          ) : (
            <label className="f" style={{ maxWidth: 420, margin: '10px 0' }}>Duplicate resolution
              <select value={dupMode} onChange={e => setDupMode(e.target.value as never)}>
                <option value="skip">Skip duplicates (recommended — nothing overwritten)</option>
                <option value="queue">Queue anyway for accountant review</option>
              </select></label>
          )}
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Row</th><th>Summary</th><th>Issues</th></tr></thead>
            <tbody>{validated.slice(0, 60).map(r => (
              <tr key={r.index}>
                <td>{r.index + 2}</td>
                <td className="small">{summarize(type, r)}<div><Pill status={r.errors.length ? 'Has errors' : r.duplicateOf ? 'Duplicate' : r.warnings.length ? 'Valid with warnings' : 'Valid'} /></div></td>
                <td className="small">{r.errors.map((e, k) => <div key={k} style={{ color: '#b42318' }}>• {e.field}: {e.message}</div>)}
                  {r.warnings.map((w, k) => <div key={'w' + k} style={{ color: '#9a6b12' }}>• {w}</div>)}
                  {r.duplicateOf && <div style={{ color: '#9a6b12' }}>• {r.duplicateOf}</div>}</td>
              </tr>
            ))}</tbody></table></div>
          {validated.length > 60 && <p className="small muted">Showing first 60 of {validated.length} rows. The error report below covers all rows.</p>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={downloadErrors}>Download error report (CSV)</button>
            <button className="btn ghost small" onClick={() => setStep(2)}>← Back to mapping</button>
            <button className="btn small" disabled={nValid === 0 && (type === 'inventory' ? true : dupMode === 'skip')} onClick={() => setStep(4)}>Continue to confirm →</button>
          </div>
        </div>
      )}

      {step >= 4 && !result && (
        <div className="card">
          <h3>5 · Confirm demo import</h3>
          <div className="tbl-wrap"><table className="tbl"><tbody>
            <tr><td>Data type / file</td><td><strong>{def.label}</strong> · {fileName_}</td></tr>
            <tr><td>Rows to import</td><td><strong>{nValid + ((type === 'inventory' ? invMode !== 'skip' : dupMode === 'queue') ? nDup : 0)}</strong> (errors excluded and listed in the error report — nothing discarded silently)</td></tr>
            <tr><td>What happens next</td><td>{type === 'transactions' ? 'Entries queue as “For Accountant Review”. Approval and posting rules still apply.' : type === 'opening_balances' ? 'Draft journal lines for accountant validation — never posted directly.' : type === 'purchase_orders' ? 'Draft purchase orders awaiting receiving.' : type === 'inventory' ? 'Inventory updated per your duplicate choice above.' : 'Supplier directory updated (new names added, existing kept).'}</td></tr>
          </tbody></table></div>
          <label className="small" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
            I understand this is a frontend demo import — it previews integration, queues records for review, and does not persist official business records.
          </label>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={() => setStep(3)}>← Back</button>
            <button className="btn" disabled={!canConfirm} onClick={confirm}>
              {type === 'opening_balances' && !obTotals?.balanced ? 'Blocked — unbalanced' : 'Run demo import'}
            </button>
          </div>
        </div>
      )}

      {step === 5 && result && (
        <div className="card">
          <h3>Demo import complete</h3>
          <div className="grid g4">
            <div className="kpi"><div className="lbl">Imported / queued</div><div className="val">{result.imported}</div></div>
            <div className="kpi"><div className="lbl">Skipped / errors</div><div className="val">{result.skipped}</div></div>
            <div className="kpi"><div className="lbl">Duplicates seen</div><div className="val">{result.duplicates}</div></div>
            <div className="kpi"><div className="lbl">Warnings</div><div className="val">{result.warnings}</div></div>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            {(type === 'transactions' || type === 'opening_balances') && <Link className="btn small" to="/admin/approval">Open approval queue →</Link>}
            {type === 'inventory' && <Link className="btn small" to="/admin/inventory">View inventory →</Link>}
            {type === 'purchase_orders' && <Link className="btn small" to="/admin/purchasing">View purchase orders →</Link>}
            <button className="btn ghost small" onClick={() => { setStep(0); resetFile(); }}>Start another import</button>
          </div>
          <h3 style={{ marginTop: 14 }}>Import history (this browser)</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>When</th><th>Type / file</th><th>Imported</th><th>Skipped</th><th>Errors</th></tr></thead>
            <tbody>{hist.map((h, i) => <tr key={i}><td>{h.at}</td><td>{h.type}<div className="small muted">{h.file}</div></td><td>{h.imported}</td><td>{h.skipped}</td><td>{h.errors}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </>
  );
}

function summarize(type: DataType, r: ValidatedRow): string {
  const d = r.data;
  if (type === 'transactions') return `${d.item ?? '—'} · ${d.supplier ?? '—'} · ${d.amount !== undefined ? peso(d.amount as number) : '—'}`;
  if (type === 'inventory') return `${d.item ?? '—'} · ${d.businessUnit ?? '—'} · qty ${d.quantity ?? '—'}`;
  if (type === 'suppliers') return `${d.supplier ?? '—'}`;
  if (type === 'purchase_orders') return `${d.poNo ?? '—'} · ${d.item ?? '—'} × ${d.quantity ?? '—'}`;
  return `${d.accountCode ?? '—'} · Dr ${d.debit ?? 0} / Cr ${d.credit ?? 0}`;
}

// ============================== EXPORT ==============================

function ExportCenter() {
  const store = useStore();
  const [unit, setUnit] = useState('All units');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const [msg, setMsg] = useState('');

  const say = (m: string) => setMsg(m);

  const csvOut = (name: string, headers: string[], rows: (string | number)[][]) => {
    download(new Blob([toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' }), name);
    say(`Downloaded ${name} — ${rows.length} rows of demo data (synthetic, not official records).`);
  };
  const xlsxOut = async (name: string, sheet: string, objs: Record<string, unknown>[]) => {
    const XLSX = await xlsxLib();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objs.length ? objs : [{ Note: 'No rows for current filters' }]), sheet.slice(0, 28));
    XLSX.writeFile(wb, name);
    say(`Downloaded ${name} — ${objs.length} rows of demo data (synthetic, not official records).`);
  };

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const txns = store.txns.filter(t => (unit === 'All units' || t.businessUnit === unit) && inRange(t.date));
  const txnHeaders = ['ID', 'Date', 'Business Unit', 'Classification', 'Kind', 'Item', 'Category', 'Supplier', 'Supplier Price', 'Retail Price', 'Quantity', 'Amount', 'Status', 'Entered By'];
  const txnObjs = () => txns.map(t => ({ ID: t.id, Date: t.date, 'Business Unit': t.businessUnit, Classification: t.classification, Kind: t.kind, Item: t.item, Category: t.category, Supplier: t.supplier, 'Supplier Price': t.supplierPrice, 'Retail Price': t.retailPrice, Quantity: t.quantity, Amount: t.amount, Status: t.status, 'Entered By': t.enteredBy }));
  const txnRows = () => txns.map(t => [t.id, t.date, t.businessUnit, t.classification, t.kind, t.item, t.category, t.supplier, t.supplierPrice, t.retailPrice, t.quantity, t.amount, t.status, t.enteredBy]);

  const inv = store.inventory.filter(i => unit === 'All units' || i.businessUnit === unit);
  const invHeaders = ['Business Unit', 'Type', 'Item', 'Category', 'Quantity', 'Supplier', 'Supplier Price', 'Retail Price', 'Amount', 'Reorder Level'];
  const invObjs = () => inv.map(i => ({ 'Business Unit': i.businessUnit, Type: i.type, Item: i.item, Category: i.category, Quantity: i.quantity, Supplier: i.supplier, 'Supplier Price': i.supplierPrice, 'Retail Price': i.retailPrice, Amount: i.amount, 'Reorder Level': i.reorderLevel }));
  const invRows = () => inv.map(i => [i.businessUnit, i.type, i.item, i.category, i.quantity, i.supplier, i.supplierPrice, i.retailPrice, i.amount, i.reorderLevel]);

  const poObjs = () => store.pos.flatMap(p => p.items.map(it => ({ 'P.O. No.': p.poNo, Date: p.date, Supplier: p.supplier, 'Business Unit': p.businessUnit, 'Delivery Date': p.deliveryDate, Item: it.item, Quantity: it.quantity, 'Supplier Price': it.supplierPrice, 'Line Total': it.quantity * it.supplierPrice, Status: p.status })));

  const tb = useMemo(() => {
    const r = trialBalance(store.txns, { unit, from, to });
    return r.lines.map(l => ({ Account: l.account, Debit: l.debit, Credit: l.credit }));
  }, [store.txns, unit, from, to]);

  const cards: { title: string; desc: string; count: string; csv: () => void; xlsx: () => void }[] = [
    { title: 'Transactions', desc: 'Filtered demo transactions with statuses.', count: `${txns.length} rows`, csv: () => csvOut(fileName('transactions', 'csv', unit), txnHeaders, txnRows()), xlsx: () => xlsxOut(fileName('transactions', 'xlsx', unit), 'Transactions', txnObjs()) },
    { title: 'Inventory', desc: 'Stock list with supplier and retail prices.', count: `${inv.length} rows`, csv: () => csvOut(fileName('inventory', 'csv', unit), invHeaders, invRows()), xlsx: () => xlsxOut(fileName('inventory', 'xlsx', unit), 'Inventory', invObjs()) },
    { title: 'Purchase Orders', desc: 'Orders flattened to one row per line.', count: `${poObjs().length} lines`, csv: () => csvOut(fileName('purchase-orders', 'csv'), ['P.O. No.', 'Date', 'Supplier', 'Business Unit', 'Delivery Date', 'Item', 'Quantity', 'Supplier Price', 'Line Total', 'Status'], poObjs().map(o => [o['P.O. No.'], o.Date, o.Supplier, o['Business Unit'], o['Delivery Date'], o.Item, o.Quantity, o['Supplier Price'], o['Line Total'], o.Status])), xlsx: () => xlsxOut(fileName('purchase-orders', 'xlsx'), 'PurchaseOrders', poObjs()) },
    { title: 'Suppliers', desc: 'Supplier directory (demo).', count: `${loadSuppliers([]).length} rows`, csv: () => { const s = loadSuppliers([]); csvOut(fileName('suppliers', 'csv'), ['Supplier', 'Contact Person', 'Phone', 'Address', 'Terms'], s.map(x => [x.supplier, x.contact, x.phone, x.address, x.terms])); }, xlsx: () => xlsxOut(fileName('suppliers', 'xlsx'), 'Suppliers', loadSuppliers([])) },
    { title: 'Trial Balance', desc: 'Posted balances for the selected unit and dates.', count: `${tb.length} accounts`, csv: () => csvOut(fileName('trial-balance', 'csv', unit), ['Account', 'Debit', 'Credit'], tb.map(r => [r.Account, r.Debit, r.Credit])), xlsx: () => xlsxOut(fileName('trial-balance', 'xlsx', unit), 'TrialBalance', tb) },
    { title: 'Chart of Accounts', desc: 'Reference account structure (demo).', count: `${COA.length} accounts`, csv: () => csvOut(fileName('chart-of-accounts', 'csv'), ['Code', 'Name', 'Type'], COA.map(a => [a.code, a.name, a.type])), xlsx: () => xlsxOut(fileName('chart-of-accounts', 'xlsx'), 'ChartOfAccounts', COA) },
    { title: 'Business Units', desc: 'Reference list with posted demo performance.', count: '9 units', csv: () => csvOut(fileName('business-units', 'csv'), ['Business Unit', 'Posted Revenue', 'Posted Expenses'], BUSINESS_UNITS.map(u => [u, sumByClass(store.txns, { unit: u, from, to }, 'Revenue'), sumByClass(store.txns, { unit: u, from, to }, 'Expense')])), xlsx: () => xlsxOut(fileName('business-units', 'xlsx'), 'BusinessUnits', BUSINESS_UNITS.map(u => ({ 'Business Unit': u }))) },
    { title: 'Journal Entries', desc: 'Draft and posted journal lines.', count: `${store.journal.length} rows`, csv: () => csvOut(fileName('journal', 'csv'), ['Date', 'Ref', 'Particulars', 'Business Unit', 'Debit Account', 'Credit Account', 'Amount', 'Status'], store.journal.map(j => [j.date, j.ref, j.particulars, j.businessUnit, j.debitAccount, j.creditAccount, j.amount, j.status])), xlsx: () => xlsxOut(fileName('journal', 'xlsx'), 'Journal', store.journal.map(j => ({ Date: j.date, Ref: j.ref, Particulars: j.particulars, 'Business Unit': j.businessUnit, 'Debit Account': j.debitAccount, 'Credit Account': j.creditAccount, Amount: j.amount, Status: j.status }))) },
  ];

  return (
    <>
      <div className="notice">Exports reflect the current demo data and filters. Filenames include the date{unit !== 'All units' ? ' and business unit' : ''}. Synthetic data — not official financial results.</div>
      <div className="card">
        <div className="filters">
          <select value={unit} onChange={e => setUnit(e.target.value)}><option>All units</option>{BUSINESS_UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <Link className="btn ghost small" to="/admin/reports">Printable reports →</Link>
        </div>
        {msg && <div className="notice">{msg}</div>}
        <div className="grid g2">
          {cards.map(c => (
            <div key={c.title} className="kpi">
              <div style={{ fontWeight: 700, color: '#14234a' }}>{c.title} <span className="small muted">· {c.count}</span></div>
              <div className="sub">{c.desc}</div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn small ghost" onClick={c.csv}>Download CSV</button>
                <button className="btn small ghost" onClick={c.xlsx}>Download Excel</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
