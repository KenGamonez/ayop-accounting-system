# Requirements-to-Code Matrix — Ayop Accounting System (JEM51)

Evidence at HEAD `44656ff`. Status values: **implemented** (demo-complete),
**partial** (works with demo limits), **missing** (backend needed),
**unresolved** (needs owner/accountant decision). "Auth" below is demo
presentation only — no server enforcement exists anywhere.

| # | Staff / business requirement | Current frontend behavior | Source components / functions | Validation + authorization today | Persistence today | Backend capability required | Accounting / security risks | Tests needed | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Staff sign-in, 7 identities | Click-to-enter profiles, active account drives UI | `Login.tsx:6-49`, `AppStore.tsx:70`, `seed.ts:17-24` | None (self-declared) | `localStorage jem51-demo-v1` | Supabase Auth + `staff` table, 7 provisioned accounts | Impersonation trivial | Auth + session tests | missing |
| 2 | JeAnn warehouse workspace isolation | Warehouse dashboard/nav/routes; rest full | `access.ts:8-77`, `Layout.tsx`, `Overview.tsx`, `WarehouseDashboard.tsx` | UI + route guards only | localStorage userId | RLS policies mirroring `canVisit`/`navFor` | Hidden links ≠ security | RLS per-role tests | partial |
| 3 | Transaction entry (Disbursement/Journal kinds) | Guided forms, units, classifications, COA account | `Transactions.tsx`, `Disbursement.tsx`, `seed.ts:7,27-43` | Inline + `validateDisbursement` (`ops.ts:192`); open to all signed-in | localStorage | `transactions` table + create RPC | Unvalidated/server-bypass writes | Field + RLS tests | partial |
| 4 | Legacy Cash In/Out compatibility | Read-only history, routes, reports preserved | `CashPages.tsx`, seed kinds, `TRANSACTION_KINDS` selector limit | Selectors limited; records intact | localStorage | Preserve kind values in schema | Misclassification on migration | Kind-compat tests | implemented |
| 5 | Accountant review step | Mark-reviewed moves queue forward | `Approval.tsx:62`, `transition` (`AppStore.tsx:94`), `isAllowed` (`ops.ts:104`) | Privileged roles only (UI) + order guard | localStorage | Status RPC + role check + row lock | Skipped review | Transition tests | partial |
| 6 | Owner approval + posting | Approve → Post to GL, posted locks | `Approval.tsx:64-65`, `transition`, `countsAsPosted` (`ops.ts:88`) | Privileged UI + guards; repeats rejected | localStorage | Atomic `post_entry` RPC creating balanced lines | Double posting races | Concurrency tests | partial |
| 7 | No self-approval/posting | Creator blocked from own approve/post | `guardTransition` (`ops.ts:169`), wired at `AppStore.tsx:97` | UI hidden + store block (demo) | localStorage | Server-side actor-vs-creator check | Collusion still possible off-system | Guard tests | partial |
| 8 | Rejection with reason + resubmission | Reason required; originator resubmits | `Approval.tsx`, `canResubmit` (`ops.ts:159`) | UI + order guard | localStorage | Same RPC path + reason mandatory | Silent drops | Flow tests | partial |
| 9 | Reversal of posted entries | Lock original + linked offsetting queued entry | `reverseTxn` (`AppStore.tsx:115`), `signedAmount` (`finance.ts:35`) | Posted-only, privileged UI | localStorage | Reversal RPC, negation preserved | Editing posted history | Reversal accounting tests | partial |
| 10 | Guided journal, balanced Dr=Cr | Multi-line form, live totals, blocked if unbalanced | `Journal.tsx`, `validateJournal`/`journalTotals` (`ops.ts:233-242`) | Client-side only | localStorage draft | `journal_entries`+`lines` + balance CHECK | Unbalanced books | Balance-constraint tests | partial |
| 11 | Journal → review → GL | Drafts queue as review txns, never direct-post | `queueJournal` (`AppStore.tsx:230`), duplicate-queue block | UI + order guard | localStorage | Queue RPC + classification mapping review | Bypass posting | Flow tests | partial |
| 12 | Chart of Accounts | 17-code list, lookup, labels, GL picker source | `seed.ts` COA, `getAccount`/`accountOptions`/`accountLabel` (`finance.ts:211-231`) | COA membership checks | Static seed | `chart_of_accounts` table + seed migration | Code drift | Seed-parity tests | partial |
| 13 | "Approve Income" account | Absent; flagged, never invented | Selftest COA absence check | — | — | Add only on confirmed code+class | Misclassification | Presence test on confirm | unresolved |
| 14 | General Ledger | Account-first, running balances, opening, unit scope, print | `accountLedger` (`finance.ts:264`), `Accounting.tsx` GL tab | Posted-only, COA-driven | Derived | Query over posted lines | Single-sided demo semantics | Balance tests | partial |
| 15 | Trial Balance | Per-account Dr/Cr, totals, honest difference flag | `trialBalance` (`finance.ts:54`), `Reports.tsx` | Posted-only | Derived | Query over posted lines | Demo imbalance expected | Totals tests | partial |
| 16 | Income & Expense | Revenue/expense lines, ITEM CODE = `accountCode`, net | `incomeSummary` (`finance.ts:79`), `Reports.tsx` | Posted-only | Derived | Same query | Code/description mismatch | Mapping tests | partial |
| 17 | Financial Condition / Balance Sheet | Asset/liability groups; equity codes + distinct Net Income | `conditionSummary`/`balanceSheet` (`finance.ts:136-181`) | Posted-only; no manufactured equity | Derived | Same queries; equity postings model | Forced-balance temptation | Section tests | partial |
| 18 | Cash Flow | Explicit Cash In/Out kinds only; disclosed exclusions | `cashFlow` (`finance.ts:105`), `Reports.tsx` | Posted-only | Derived | Settlement-method modeling (later) | Overstated cash | Inclusion tests | partial |
| 19 | Month-End Close | 8 scoped checks, TB states, fingerprint-invalidated ack | `computeClose` (`close.ts:54`), `CloseChecklist.tsx` | Advisory only | Ack in localStorage | Close-ack table; real period lock later | False "closed" confidence | Checklist tests | partial |
| 20 | PO lifecycle + partial receiving | Draft→Sent→Partial→Received, capped lines, cancel | `Purchasing.tsx`, `applyReceipt`/`derivePOStatus` (`ops.ts:27-44`), `AppStore.tsx:160-227` | Field + cap validation; receiving open to warehouse+ | localStorage | PO/line/receipt tables, immutable receipts | Double counting | Cap/idempotency tests | partial |
| 21 | Receipt → stock + payable | Stock qty/value update + review-queued AP txn, atomic in UI | `receivePOLine` (`AppStore.tsx:181`) | Never posts directly | localStorage | Single server transaction | Half-applied receipts | Atomicity tests | partial |
| 22 | Inventory add/edit/adjust | Validated add, non-qty edit, logged adjusts | `Inventory.tsx`, `AppStore.tsx:139-156` | Rules + audit log (mutable) | localStorage | Items + append-only `stock_moves` | Silent qty edits | Move-ledger tests | partial |
| 23 | Inventory costing | Running totals only | `Inventory.tsx`, seed amounts | None | localStorage | costing policy + method | Wrong valuation | Costing tests | unresolved |
| 24 | Suppliers/payables directory | Import-managed list; AP grouped awaiting/posted | `ImportExport.tsx`, `Accounting.tsx` payable tables | Import validation | localStorage | `suppliers` table | Duplicate suppliers | Dedup tests | partial |
| 25 | Import/export + Sheets | Wizard, mapping, validation, dup resolution, error CSV, templates, published-CSV fetch | `ImportExport.tsx`, `io.ts:45-391` | Client rules; no private-sheet access | History localStorage | Server mirror validation; private Sheets later | Bad data ingress | Round-trip tests | partial |
| 26 | Audit trail | Capped list of actor/action/ref/detail | `AppStore.tsx` log calls, Accounting audit tab | Writable store | localStorage (200 cap) | Append-only table, no UPDATE/DELETE | Silent rewrite | Tamper tests | partial |
| 27 | Print/PDF reports | Shared print styles, mastheads, statements | `styles.css` print, `PrintHead` (`Reports.tsx`) | — | — | Unchanged (client-side) | — | Visual checks | implemented |
| 28 | Business units + consolidation | 9 units, per-unit views, All-units rollups | `seed.ts:27-37`, `{unit,from,to}` scopes (`finance.ts:11`) | Scope filters | Static + local | `business_units` table | Unit leakage | Scope tests | partial |
| 29 | Creator attribution + My submissions | `createdBy` IDs, ID-based filters, dashboard card | `seed.ts`, `AppStore.tsx`, `ownRecords` (`ops.ts:153`), `Overview.tsx` | UI-level | localStorage | `created_by → staff` FK | Attribution spoofing | Attribution tests | partial |
| 30 | Closed periods | None — checklist is advisory | `close.ts`, `CloseChecklist.tsx` | None | localStorage ack | Period-lock policy + enforcement | Backdated postings | Lock tests | unresolved |

## Prioritized missing / incomplete capabilities

1. **Auth + RLS foundation** (blocks everything server-side): Supabase project, Auth accounts, staff/units/COA tables, read policies.
2. **Transactional postings**: transition RPC with locks, double-entry lines + balance CHECK, reversal RPC.
3. **Receiving atomicity**: receipt + stock move + payable in one transaction; immutable receipt rows.
4. **Audit + close integrity**: append-only audit, close acks, then real period locks.
5. **Data ingress safety**: server-side import validation mirroring `io.ts`.
6. **Policy confirmations** (owner/accountant): Approve Income code/class, costing method, role narrowing, staff emails, closed-period rules, revenue/settlement timing — required before the workflows that depend on them, not before Slice 1.
