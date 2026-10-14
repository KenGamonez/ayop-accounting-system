# Frontend Workflow Specification — Ayop Accounting System (JEM51)

Forensic study of the actual code at `master` HEAD `44656ff` (clean tree).
Companion to `docs/REQUIREMENTS_TO_CODE_MATRIX.md` (module table),
`docs/BACKEND_IMPLEMENTATION_PLAN.md` (architecture), `docs/PROJECT_STATE.md`
(status). No backend exists; everything below is frontend demo behavior
unless a section explicitly says "recommended backend".

Legend: **[verified]** = traced in code with locations cited.
**[intended]** = staff workflow the UI implements. **[recommended]** =
backend behavior to build. **[unresolved]** = needs owner/accountant sign-off.

## 1. Shell: identity, routing, dashboards

- **Demo profiles [verified]**: `Login.tsx:6-49` lists the 7 `STAFF` records
  from `seed.ts:17-24` (joy/CEO, eve/HR, dani/Accounting, jeann/Warehouse,
  jinky/Diagnostics Cashier, mae/Pharmacy, rodel/IT). Clicking a profile
  calls `login(id)`; `AppStore.tsx:70` resolves the live user record each
  render. There is no password, session token, or server check — the login
  screen states this itself.
- **Persistence [verified]**: `AppStore.tsx:43-69` keeps all state in React
  state mirrored to `localStorage` under `jem51-demo-v1` (user, txns,
  inventory, POs, journal, audit). Refresh restores it; `resetDemo`
  (`AppStore.tsx:260`) restores seeds. Per-browser only.
- **Role routing [verified]**: `access.ts:8-14` maps role → `warehouse`
  (only role `Warehouse`, i.e. JeAnn) or `full` (everyone else).
  `access.ts:50-54` allow-lists warehouse paths (dashboard, transaction/*,
  disbursement, journal, approval, inventory, purchasing, settings);
  `Layout.tsx` redirects anything else to `/admin` with a restricted notice.
  Query strings cannot bypass because the path decides. `access.ts:74-77`
  filters the sidebar the same way. Accounting sidebar is dropdown-only
  (`Layout.tsx`, `dropdownOnly` flag); Transaction keeps its behavior.
- **Dashboards [verified]**: `Overview.tsx` branches on the live role —
  warehouse accounts render `WarehouseDashboard.tsx` (own submissions,
  receiving tasks, low stock, approval tracking; zero financial panels),
  everyone else gets KPIs + consolidated views. No stale content on switch
  because everything derives from the store per render.
- **Creator attribution [verified]**: `Txn`/`PurchaseOrder`/`InventoryItem`
  carry optional `createdBy` staff ID (`seed.ts:60-64,67-79,88-100`);
  all store creators stamp `user?.id`; old saves migrate once via
  `staffIdForName` (`AppStore.tsx:55`, `ops.ts:134`); lists filter with
  `ownRecords` by ID, never by name (`ops.ts:153`).

## 2. Transaction lifecycle (core money workflow)

- **Initiators [verified]**: any signed-in demo user via `Transactions.tsx`
  (New Entry), `Disbursement.tsx` (guided payment form), `Journal.tsx`
  (guided journal form), `Purchasing.tsx` (receipts auto-queue payables),
  `ImportExport.tsx` (spreadsheet import).
- **Fields [verified]**: date*, business unit (9 exact, `seed.ts:27-37`),
  classification (Expense/Revenue/Asset/Liability, `seed.ts:39`), kind —
  new entries offer only `TRANSACTION_KINDS = ['Disbursement','Journal']`
  (`seed.ts:7`); historical Cash In/Out records and routes are preserved
  read-only. Item (never "Description"), supplier (never "Counterpart"),
  category (3), supplier/retail price, quantity, amount, COA account,
  remarks. Disbursement form requires date/particulars/supplier/account/
  positive amount (`ops.ts:192-207`); journal form requires date/reason/unit
  plus ≥2 valid lines with matched Dr=Cr (`ops.ts:242+`).
- **Validation [verified]**: inline form errors, `validateDisbursement`,
  `validateJournal`/`journalTotals`, import `validateRows` (`io.ts:196`)
  with duplicate detection (`dupKey`, `io.ts:359`) and error-CSV export.
  Nothing validates server-side — there is no server.
- **Record created [verified]**: `addTxn` (`AppStore.tsx:87-90`) always
  starts at `For Accountant Review` with a collision-free ID (`nextTxnId`,
  `ops.ts:122`) and an audit row. Imports, receipts, and journal queues
  use the same path, so nothing bypasses review.
- **Transitions [verified]**: `ALLOWED_TRANSITIONS` (`ops.ts:93`) encodes
  Draft → Review → Accountant Reviewed → Owner Approval → Approved →
  Posted, with Rejected loops and Posted → Reversed only. `transition`
  (`AppStore.tsx:94-113`) rejects unknown IDs, repeats, illegal jumps, and
  — via `guardTransition` (`ops.ts:169`) — creators approving/posting their
  own entries. UI buttons render only for Accounting/CEO roles
  (`canActOnApprovals`, `ops.ts:145`; `Approval.tsx:62-67`); creators may
  only resubmit their own rejected work (`canResubmit`, `ops.ts:159`).
- **Downstream [verified]**: only `Posted` rows feed `postedIn`
  (`finance.ts:26`) → GL/TB/statements/exports/close checklist. Pending,
  rejected, reversed rows are excluded everywhere by construction.
- **Failure paths [verified]**: invalid transitions return messages, no
  state change; double-posting blocked by status checks; refresh loses
  nothing (localStorage); `resetDemo` restores seeds (demo-only danger:
  wipes local work).

## 3. Rejection and reversal lifecycles

- **Rejection → resubmission [verified]**: privileged Reject requires a
  written reason (`Approval.tsx`); `Rejected → For Accountant Review/Draft`
  is legal; originator resubmits from Approval or Transactions.
- **Posted → reversal [verified]**: `reverseTxn` (`AppStore.tsx:115-135`)
  locks the original as `Reversed` and creates a linked offsetting entry
  (`reversalOf`) queued for review under the reverser's ID; finance counts
  it negative (`signedAmount`, `finance.ts:35`). Posted rows cannot be
  edited/deleted in any UI.

## 4. Purchasing → receiving → inventory → payable

- **PO lifecycle [verified]**: `addPO` (validated number/dates/qty/price,
  duplicate numbers rejected) → Draft → `sendPO` → `Sent to Supplier` →
  per-line `receivePOLine` with capped quantities (`applyReceipt`,
  `ops.ts:44` blocks over-receipts, repeats, draft/cancelled receipts) →
  Partially Received → Received; `cancelPO` voids outstanding lines.
  Statuses derive from line math (`derivePOStatus`, `ops.ts:27`).
- **Receipt effects [verified]** (`AppStore.tsx:181-227`): one store update
  adds received qty (matching Item+Unit) or creates the SKU, adds stock
  value, **and** queues a Liability/AP payable transaction at
  `For Accountant Review` — never posts. Repeat receipts cannot double
  count because caps are computed from stored `receivedQty`.
- **Inventory [verified]**: view/filter, validated add (duplicate Item+Unit
  blocked), edit of non-quantity fields, qty changes only via Adjust
  buttons or receipts — every change audit-logged (`AppStore.tsx:139-156`).
  Amount is a running total; **no costing method exists [unresolved]**.
- **Distribution**: stock transfer appears only as a demo journal
  transaction (seed TXN-2026-0046); no transfer workflow exists.

## 5. Journal and ledger integrity

- **Model [verified]**: `JournalEntry` (`seed.ts:102-114`) carries one
  debit account + one credit account + amount, plus optional multi-line
  breakdown from the guided form. Drafts never post directly; `queueJournal`
  (`AppStore.tsx:230-251`) maps the debit side to a classification and
  creates a review-queued transaction; duplicate queueing blocked.
- **Single-sided gap [verified]**: ordinary transactions carry ONE
  `accountCode` with the side derived from classification. Entry balance is
  enforced only in the guided journal form. Trial Balance honesty banners
  and the close checklist acknowledge demo imbalance.
  **[recommended]**: backend `journal_lines` with a balance CHECK; every
  posting creates balanced lines.
- **GL [verified]**: `accountLedger` (`finance.ts:264`) — COA-driven
  account picker, normal-side running balances, opening from pre-period
  posted entries, unit scope, posted-only, reversals offset.

## 6. Reports (all trace to `finance.ts` + `postedIn`)

| Report | Source fn | Notes |
|---|---|---|
| Trial Balance | `trialBalance` (`finance.ts:54`) | per-account Dr/Cr, totals, honest difference, balanced flag |
| Income & Expense | `incomeSummary` (`finance.ts:79`) | ITEM CODE column = row `accountCode`, description via `accountLabel` from COA |
| Financial Condition | `conditionSummary` (`finance.ts:181`) | assets/liabilities grouped, no manufactured equity |
| Balance Sheet | `balanceSheet` (`finance.ts:136`) | + Equity-type-code balances + distinct Net Income line; code authoritative on conflicts |
| Cash Flow | `cashFlow` (`finance.ts:105`) | only explicit Cash In/Out kinds; Disbursement/Journal excluded with disclosed count |
| Month-End Close | `computeClose` (`close.ts:54`) | 8 scoped checks, TB nodata/balanced/out, fingerprint-invalidated ack |
| Exports | `toCSV`/xlsx (`io.ts:376`, `ImportExport.tsx`) | same posted-only builders |

Period/unit filters are uniform `{unit, from, to}` scopes; print uses
shared print styles + mastheads. Bank reconciliation is a manual worksheet;
opening balances in GL are derived, not true brought-forward balances.

## 7. Import/export

`ImportExport.tsx` wizard (type → file/Sheets-CSV → sheet pick → auto-map →
validate → error report → confirm → history) over `DATA_TYPES`
(`io.ts:45`: transactions, inventory, suppliers, purchase_orders,
opening_balances). All imports land as review-queued drafts; opening
balances additionally require balanced Dr=Cr. Suppliers persist to a
localStorage directory; history to localStorage. Google Sheets is
published-CSV fetch only — no OAuth, no private-sheet access.

## 8. Settings, units, audit

Settings shows session/role info (presentation only); Business Units page
shows per-unit views; consolidated reporting lives on Overview/Reports.
Audit trail is a capped (200) localStorage list — readable but rewritable,
so **[recommended]** append-only server table with no UPDATE/DELETE grants.

## 9. Backend operation contracts (to implement, not yet code)

| Operation | Inputs | Outputs | Actors | Validation | Atomic effects | Idempotency/concurrency | Audit |
|---|---|---|---|---|---|---|---|
| signup/login/provision | email, staff ID, role, unit | session, profile | admin/owner | existing IDs only | user + staff link | idempotent provisioning | account.created |
| create transaction | full Txn fields | draft/review-queued txn | any active staff | field rules (`validate*`), COA + unit exist | txn + audit row | client idempotency key | txn.created |
| review/approve/post/reject/resubmit | txn id, note | new status | Accounting/CEO per step; never creator for approve/post | `isAllowed` + `guardTransition` server-side | status + audit, row lock on post | locked `post_entry` RPC; repeats rejected | per-step events |
| reverse posted | txn id, reason | locked original + queued offset | Accounting/CEO | must be Posted | both rows + audit, one transaction | single RPC | reversal.recorded |
| guided journal submit | date/reason/unit/lines | draft entry + lines | any staff | `validateJournal` balance | entry + lines + audit | draft idempotent | journal.created |
| queue journal | draft id | review txn | any staff | draft + unqueued | txn + link + audit | duplicate-queue block | journal.queued |
| PO create/send/cancel | header + lines | PO | warehouse+ | field rules, unique number | PO + lines + audit | unique poNo | po.* |
| record receipt | PO, line, qty | updated PO/stock/payable | warehouse+ | cap at outstanding | receipt + stock move + payable txn, one transaction | immutable receipt rows | receipt.recorded |
| inventory add/edit/adjust | fields/delta + reason | updated item | warehouse+ | rules, no direct qty write | item or stock move + audit | moves append-only | inventory.* |
| reference reads | — | units/COA/staff directory | any signed-in | — | none | cacheable | — |
| close ack | unit/period/fingerprint | ack record | Accounting/CEO | fingerprint match | upsert ack | unique(unit, period) | close.acknowledged |
| import batch | validated rows | queued drafts + error report | Accounting+ | server mirror of `io.ts` rules | drafts + audit | batch id, no silent drops | import.completed |
| report queries | scope | computed statements | per role scope | scope valid | read-only | — | — |

## 10. Findings and open issues

- **Verified sound**: single posted definition, reversal negation, capped
  receipts, transition/self-approval guards, ID-based attribution,
  role-isolated UI, honest imbalance/zero states, import error discipline.
- **Demo gaps the backend must close**: true double-entry, server auth +
  RLS, closed periods, append-only audit, concurrency locks, inventory
  costing, settlement method for Cash Flow, distribution workflow.
- **Unresolved (owner/accountant)**: "Approve Income" code + classification;
  average vs FIFO costing; HR/cashier/pharmacy narrowing; staff emails;
  closed-period policy; revenue/settlement recognition timing.
