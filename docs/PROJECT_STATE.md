# Project State — Ayop Accounting System (JEM51)

Handoff document for developer, OpenCode, and ChatGPT. Updated at the end
of every implementation slice. Facts verified this phase are marked
[verified]; inherited reports are marked [inherited].

## Verified baseline (Phase 0, 2026-10-14)

- Branch: `master`; HEAD: `06846ea` ("cash flow report from explicit cash
  kinds"); working tree clean; remote `origin`
  `https://github.com/KenGamonez/ayop-accounting-system.git`, in sync
  [verified].
- Production `https://ayop-accounting-system.vercel.app/admin` responds
  [verified this phase via route fetch].
- Last app change [inherited]: commit `06846ea` (Cash Flow report, Scope
  Note removal), deployed via GitHub → Vercel pipeline per prior turn.

## Completed frontend capabilities [verified in code]

Vite + React 18 + TS + react-router + xlsx; SPA rewrite on Vercel.
Role-aware routing/nav (`access.ts`), warehouse isolation for `jeann`,
creator-ID attribution (`createdBy`), approval chain with self-approval
guards, disbursement entry + date search, guided balanced journal form,
PO lifecycle with capped partial receiving, inventory add/edit with audit,
import/export center (templates, mapping, validation, error reports),
COA/GL (account-first, running balances)/TB/Income-Expense/Financial
Condition/Balance Sheet/Cash Flow statements with print styles, month-end
close checklist, bank-rec worksheet, audit-trail preview. Pure logic under
`src/data/` covered by `scripts/selftest.ts` (107 checks), `tsc`, prod build.

## Backend capabilities actually verified (Slice 2, 2026-10-14)

Reference foundation (Slice 1) plus: `transactions`, `txn_transitions`
(12 pairs mirroring the frontend matrix), `audit_events` tables; atomic
RPCs `create_transaction`, `transition_transaction`, `reverse_transaction`
(all SECURITY DEFINER, EXECUTE to authenticated only — verified in
catalog); SELECT-only RLS (`txn_read_scoped`: warehouse sees own rows,
other linked roles consolidated; transitions/audit readable; zero direct
write policies). Live transactions table holds 0 rows (no fake data).
Frontend: `src/data/live.ts` adapter (session → membership, whitelisted
payloads, RPC wrappers), live email/password login, store delegation for
add/transition/reverse/receipt-queue/journal-queue with explicit Slice-2
demo scoping notes, mode badge. Verified locally: `tsc`, build, selftests
117/117, preview routes. NOT verified: end-to-end live authorization —
0 of 7 staff Auth accounts linked (owner action pending), so live paths
are code-complete but unexercised against real sessions. Production has no
backend env vars and stays in Demo mode.

## Standing decisions and blockers

- PROVISIONING BLOCKER (unchanged): 7 staff Auth accounts + `auth_user_id`
  linking per `docs/SLICE_1_SETUP.md` §3. Until verified, no live
  activation anywhere.

## Standing decisions and blockers

- Frontend-only demo guards must never be described as secure authorization.
- 9 exact business units, 7 staff IDs, staff terminology preserved.
- Out of scope: BIR, payroll, backend until this plan is acknowledged.
- Open owner questions: "Approve Income" code + classification; inventory
  costing (average vs FIFO); role narrowing for HR/cashier/pharmacy;
  staff emails for Auth; closed-period policy; revenue/settlement timing.

## Gate-1 readiness checklist (posting stays disabled until all pass)

Authoritative detail: `docs/GATE_1_DECISIONS.md` (all treatments PENDING).

- [ ] **D1 — Debit/credit mapping** per classification and kind: no approved table exists; nothing implemented.
- [ ] **D2 — “Approve Income”** code + classification + treatment: account absent from chart; nothing invented.
- [ ] **D3 — Opening balances + historical records**: no approved figures or cutover policy; nothing posted.
- [ ] **D4 — Costing + recognition timing**: no chosen basis; receiving tracks running totals only.
- [ ] **P1 — Staff provisioning**: 0/7 linked at last check; steps in `docs/SLICE_1_SETUP.md` §3 (real addresses required, none invented here).
- [x] **Technical prerequisites already complete**: balanced-journal store, balance trigger (proven firing, 0 rows persisted), draft submit/cancel RPCs, scoped RLS, idempotency, audit trail, demo/live boundary, production in Demo.
- [ ] **Unlock evidence**: recorded D1–D4 approvals, verified 7/7 linkage (or documented alternative scope), green posting-invariant tests, live authenticated authorization checks, rollback plan.

Completed work that must not be repeated: journal store + balance enforcement, draft/cancel RPCs, all Slice 1/2/4/5 migrations and their verifications, demo login + role switcher, import pipeline.

## Work completed in this phase (Phase 0)

Read-only study; no backend implemented, no database touched, no app code
changed. Produced `docs/BACKEND_IMPLEMENTATION_PLAN.md` (architecture:
new dedicated Supabase project, 6-slice sequence, schema, RLS matrix,
invariants, tests, backup) and this state file.

## Exactly one next task

**Slice 3 — Double-entry core** (requires Slice 1 staff provisioning
verified complete first, so live authorization can finally be exercised
end-to-end). Acceptance: `journal_entries` + `journal_lines` with balance
CHECK; atomic `post_entry` RPC; GL/TB/statements sourced from posted
lines; accountant-approved mapping from the single-sided demo model;
migration + RLS + concurrency tests green; docs updated. Do not start
until provisioning (`docs/SLICE_1_SETUP.md` §3) is verified complete.

## Progress log

- 2026-10-14 — Phase 0: verified baseline `06846ea` (clean tree, live
  production route responds); confirmed zero backend footprint; recorded
  Bislig Hub as unrelated; wrote backend plan + this state file. Next:
  Slice 1 on owner acknowledgement.
- 2026-10-14 — Forensic study (pre-backend): traced all routes, store
  operations, finance builders, guards, and import/export against the code
  at `44656ff`; produced `docs/FRONTEND_WORKFLOW_SPEC.md` (workflows,
  accounting model, backend operation contracts) and
  `docs/REQUIREMENTS_TO_CODE_MATRIX.md` (30-row evidence table). No app
  code changed. Confirmed: single-sided demo model, presentation-only
  permissions, advisory close, no costing method, no settlement modeling.
- 2026-10-14 — Slice 1 (backend foundation): created dedicated Supabase
  project `ayop-accounting-system` (`tgokmcupkxvgsniljqpf`,
  ap-southeast-1); applied versioned migration (9 units, 7 staff unlinked,
  17 COA lines, RLS + read-only policies — verified live: anon reads
  units/COA, staff directory denied unauthenticated, no transactions
  table); added demo/live boundary (`src/data/backend.ts`), Settings
  backend card, live COA reads; selftests 111/111. Staff Auth provisioning
  + linking remains an owner action (`docs/SLICE_1_SETUP.md`). Production
  has no backend env vars and stays in Demo. Next: Slice 2 (transactions
  + approval chain) after provisioning is confirmed.
- 2026-10-14 � Slice 2 (live transactions + approvals): Gate 0 confirmed HEAD 213fb9e clean, project tgokmcupkxvgsniljqpf, 0/7 staff linked (blocker stands). Applied versioned migration 20261014000002 (transactions + 12-pair matrix + append-only audit + 3 atomic RPCs + scoped RLS, EXECUTE authenticated-only � all catalog-verified; live transactions table holds 0 rows). Built live adapter (src/data/live.ts: session?membership, whitelisted payloads, RPC wrappers), live email login, async store delegation for add/transition/reverse/receipt/journal-queue with explicit Slice-2 demo scoping, mode badge. Selftests 117/117, tsc + build green. e2e live authorization NOT verified (no linked sessions exist). Production stays Demo (no env vars). Next: Slice 3 after provisioning is confirmed.
- 2026-10-14 � Slice 3 preparation (blocked at decision boundary): Gate 0 re-verified HEAD f085f34 clean, project tgokmcupkxvgsniljqpf, 0/7 staff linked; Gate-1 mapping/Approve-Income/opening/costing decisions still open, so NO posting path was built. Applied versioned migration 20261014000003 (journal_entries + journal_lines, single-side-per-line CHECKs, deferrable balance constraint trigger, scoped SELECT-only RLS, submit_journal_draft RPC with structural validation + idempotency, authenticated-only EXECUTE). Remotely verified: trigger rejects unbalanced inserts atomically (UNBALANCED error, 0 rows persisted), RLS on, grants correct, no direct-write policies. Selftests 119/119. Production untouched in behavior (no frontend changes). Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-14 � Presentation-ready demo access: DEMO PRESENTATION login (public credentials ayop-demo / jem51-demo, demo-only, session persisted, logout clears) replacing click-to-enter; topbar role switcher across all 7 canonical profiles with live identity/nav/restriction updates; Guard requires demo auth; bundle-verified new UI present and old bypass strings absent. Selftests 121/121, tsc + build green. Production stays Demo; live paths untouched. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-14 � Slice 3 prep, continued (still blocked at decision boundary): gates re-verified (HEAD 87b8c5b clean, 0/7 linked, Gate-1 mapping/Approve-Income/opening/costing open � NO posting built). Added versioned migration 20261014000004 (cancel_journal_draft: creator-or-Accounting/CEO void of unposted drafts with audit; no mapping/policy encoded). Remotely verified: clean body, authenticated-only grant, anon call denied (42501), 0 rows persisted. Selftests 122/122. Production behavior unchanged (Demo). Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-14 � Slice 4 (inventory + purchasing backend): gates re-verified (HEAD df9ccde clean, 0/7 linked, Gate-1 costing/recognition open � NO journal postings built). Applied migration 20261014000005 (suppliers, POs + lines, immutable receipts, inventory + unique unit/item, append-only stock moves, SELECT-only RLS, 7 RPCs incl. atomic record_receipt with caps/idempotency/payable-row � never journals; EXECUTE authenticated-only). Remotely verified: RLS on, grants correct, anon RPC/insert denied, reads leak nothing, all tables empty. Frontend live delegation for PO/inventory/receipt actions with explicit scoping; demo paths unchanged. Selftests 128/128, tsc + build green. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-14 � Slice 5 (safe import pipeline): gates re-verified (HEAD 2e19210 clean, 0/7 linked, Gate-1 open). Applied migration 20261014000006 (upsert_supplier RPC, authenticated-only grant, verified anon-denied, suppliers table empty). Live imports now persist via RPCs for transactions (review-queued only), inventory, POs (Draft), suppliers (idempotent upsert); opening balances blocked live with explicit message. Retries reuse deterministic row keys (importIdemKey). Demo behavior unchanged. Selftests 130/130, tsc + build green. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-14 � Gate-1 readiness (no posting): verified HEAD ffe0c2c clean and 0/7 linkage; created docs/GATE_1_DECISIONS.md with D1�D4 + P1 all PENDING/blank (no treatments recommended or selected); added readiness checklist to this file. No app code, migrations, env, or production changes. Next: owner/accountant fills GATE_1_DECISIONS.md, then Slice 3 posting. (Released as 1c308a3; pipeline deployed Ready Production, login route verified.)
- 2026-10-14 � Slice 3 hardening (posting still disabled): gates re-verified (HEAD 0d32c8c clean, Gate-1 PENDING, 0/7 linked). Applied migration 20261014000007 (txn status-matrix + draft-only-delete triggers; journal status-frozen + draft-only row guards). Remotely proven live: illegal Draft?Posted rejected, non-draft delete rejected, journal status change rejected with NO_POSTING_PATH, legal transitions pass, all probe rows removed (0 rows in txns/journals/lines/audit). Selftests 131/131, tsc clean. Production Demo, behavior unchanged. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — UI-only refresh (no backend, no accounting-logic change): (1) sidebar Transaction shows `New` only (All-Transactions list stays on the same /admin/transaction route, no separate link); `Type & Classification` hidden from the sidebar, route /admin/transaction-types kept registered for compatibility; (2) approval display simplified — review stages read `For Review`, owner stage reads `For Approval` (exact TxnStatus kept in tooltips/details), plus a 4-stage New Entry → Accountant Review → Submit for Review → Approval overview strip; transitions, permissions, and posting behavior untouched; (3) General Ledger account selector is now searchable (code/name) and expandable — 1010 Cash in Bank expands to the 7 supplied UI-only subaccounts (1010-1…1010-7); parent reuses the existing ledger filter, children show an explicit unconfigured state with no fabricated balances. No COA/supabase/migration/RPC/RLS/calculation/auth/env change (diff: Layout, ui, access-nav, Accounting, Approval, styles + selftest expectations only). Verified: tsc clean, selftests 133/133, vite build green. Released as d3bc88d, pushed master 044e1c6..d3bc88d; production https://ayop-accounting-system.vercel.app serves the new bundle (index.html asset hashes match local dist build) and stays in Demo mode with posting safeguards intact. Note: unrelated pre-existing WIP was stashed untouched as `pre-ui-changes-wip` (not committed). Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — GL bank-subaccount hover fix (UI-only; corrects the prior click-to-expand that never opened on hover): root cause — the submenu had no pointer handlers at all (children gated on `expanded1010`/search match) and 1010 sat at the bottom of the scrollable list. Fix — always-visible cash pair row places `1000 Cash on Hand` beside `1010 Cash in Bank`; hovering/focusing 1010 opens an absolutely-positioned flyout with all 7 supplied UI-only children (1010-1…1010-7), rendered outside the scrollable list so no ancestor clips it (z-index 60), flush top placement (no pointer gap), 0.14s open/close transition; parent stays selectable, each bank row selects via the existing pick path into the existing unconfigured state (no fabricated data); tap chevron for touch, focus/blur + Escape for keyboard. Ledger math, COA, supabase, migrations, auth, Demo mode untouched (diff: Accounting.tsx, styles.css, selftest static guard only; zero changes under supabase/ src/data/ src/store). Verified: tsc clean, selftests 134/134, vite build green. Released as a016dd3, pushed master 5110571..a016dd3. Hover interaction verified by code inspection + static selftest guard (handlers/structure present) — NOT by live pointer testing in a browser; live GL check limited to route/bundle fetch. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — GL selector refinement (UI-only): removed the dedicated boxed `1000 Cash on Hand` control (account stays in COA/ledger/search — still selectable via the search list); `1010 Cash in Bank` is now the single dedicated bank control with a persistent `7 subaccounts ▾` affordance and hover flyout (prior hover/tap/keyboard/Escape/ARIA behavior preserved); helper copy shortened to `Choose a bank subaccount.`; search-list `1010` row no longer carries mechanics text. All codes, 7 subaccounts, selection/filtering, unit/period filters, and posted-only rule unchanged. Diff: Accounting.tsx, styles.css, selftest regression guard only (net −3 lines; zero changes under supabase/ src/data/ src/store). Verified: tsc clean, selftests 134/134, vite build green. Released as 8e377dd, pushed master 79c5442..8e377dd; production serves the new bundle (index-DH5IsRdh.js / index-ClcU4CK1.css match local dist) and the live bundle was confirmed to contain `gl-bankpick` + `Choose a bank subaccount.` with zero `gl-cashpair` refs; live GL route responds. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — Transaction Equity option + sidebar contrast + five bank subaccounts (UI + classification-option scope only): (1) `Equity` added to the shared `Classification`/`CLASSIFICATIONS` source, so the New Transaction Entry form, its filter, the type list, and import validation all accept it with zero per-form changes; no account code or posting/double-entry mapping invented; finance code untouched (Equity flows through existing generic paths; income/condition groupings select Revenue/Expense and Asset/Liability only, TB/GL credit-side else-branch unchanged). LIMITATIONS: live Supabase `transactions` CHECK + `create_transaction` whitelist still accept only the original four (migration `20261014000002`), so Equity submits work in Demo (current production mode) but would be rejected live with BAD_CLASS until a future owner-approved migration — not done here per constraints; Gate-1 D1 mapping still pending. (2) Sidebar contrast root cause: router-appended `.active` on the Transaction parent combined navy text (`.nav a.active`) with the dark active-parent background (a later equal-specificity rule overrode only the background). Fixed in CSS only — parents keep light `#dbe3f5` text on the dark sidebar like the other parent labels. (3) `New` submenu active state changed from white block to the restrained hover-family highlight (translucent bg + white bold text), keeping a clear current-page mark. (4) GL: removed UI-only `1010-6`/`1010-7`; the five retained children (1010-1…1010-5) and their behavior are unchanged; parent `1010` remains selectable as the total account through the untouched `getAccount`/`accountLedger` filter — proven by test with a posted 1010-coded txn. REPORTED LIMITATION (no fabrication): children are unmapped UI-only options, so the parent ledger shows only transactions actually coded `1010`; it is not a true consolidated total of the named banks, and no aggregation was invented. Routes, roles, workflow, filters, posted-only rule, hover/touch/keyboard/Escape/ARIA all preserved. Diff: seed.ts (option only), Accounting.tsx (drop 2 children, `5 subaccounts`), styles.css (sidebar rules), selftest guards only. Verified: tsc clean, selftests 138/138, vite build green. Released as 00572ca, pushed master 264be0d..00572ca; production serves the new bundle (index-BLkmWQDZ.js / index-Ci0-EFOT.css match local dist) — live bundle confirmed to contain the Equity classification array, `5 subaccounts`, `1010-5`, zero `1010-6`/`1010-7` refs, the new parent-active and restrained sub-active CSS, and the intact flyout; live `/admin` and `/admin/accounting?tab=gl` routes respond. Code/bundle verified; no physical browser hover/click testing performed. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — Cash in Bank six-choice dropdown + 2200 Accrued Income (UI + shared-catalog scope only): (1) dedicated bank pill relabeled `1010 — Cash in Bank` → `Cash in Bank` (display only; code stays `1010`); its flyout now holds exactly six ordered choices via new `bankDropdownChoices()` helper — parent `1010 — Cash in Bank` first (selectable through the untouched `pick`→`getAccount`→`accountLedger` path, no consolidation invented), then `1010-1 — LBP SPPDC`, `1010-2 — LBP JEM Pharmacy`, `1010-3 — CIB PSB`, `1010-4 — CIB SB`, `1010-5 — CIB RCBC` (labels de-hyphenated per spec; `1010-6`/`1010-7` removal preserved). (2) Whole-pill hover on both selectors: bank wrapper already opened from anywhere on the pill (kept); main search row now opens its list on hover and auto-closes only on leaving the combined selector region while the input is idle (focused typing never closes it); Escape closes the list; flush flyout placement (no hover gap) and all touch/keyboard/focus/ARIA behavior preserved. No new borders, controls, or height. (3) `2200 Accrued Income` (Asset-typed per its nature; no posting rule invented) added to the shared `seed.ts` COA — traced paths confirm automatic availability in Disbursement → Record Disbursement → Account, Transactions/Journal selects + validation, GL lookup/options, Chart tab, and COA export, with all prior accounts/records intact. LIVE-MODE LIMITATION (reported, not changed): live COA comes from Supabase `chart_of_accounts` (17 seeded rows, no 2200) and `transactions.account_code` is an FK to it, so Live mode would neither list 2200 nor accept it (`create_transaction` also whitelists codes) — a future owner-authorized migration/seed is required; production is Demo so current behavior is unaffected. Diff: Accounting.tsx, seed.ts (one COA row), selftest guards only — no migrations, schema, RPCs, store, finance, auth, styles, or unrelated pages. Verified: tsc clean, selftests 141/141, vite build green. Released as 3245bd0, pushed master 9aefd6f..3245bd0; production serves the new bundle (index-BZmX3Bb9.js matches local dist; CSS hash unchanged as expected) — live bundle confirmed to contain `Accrued Income`/`2200`, `LBP JEM Pharmacy`, `CIB RCBC`, zero `1010-6`/`1010-7`/old-hyphen-label refs; live `/admin` and `/admin/accounting?tab=gl` routes respond. Code/bundle verified; no physical browser hover/click testing performed. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.
- 2026-10-15 — New-entry form redesign with conditional bank sub-account (frontend-only, same route): entry form rebuilt in place as an 8-field grid (Date, Business Unit, Account Title, Transaction Kind, Counterparty, Cash in Bank Sub-account, Amount, Particulars) plus a compact Additional item details section preserving Item/Classification/Category/prices/quantity, so the save payload, approval flow, amount/date/kind behavior, and role gating are unchanged; labels renamed Supplier→Counterparty and Remarks→Particulars per stakeholder sketch (stored fields `supplier`/`remarks` untouched). Sub-account rule via pure tested helpers (`coerceBankSub`, `bankSubError`) reusing the exact five approved `CASH_IN_BANK_CHILDREN` (now exported from Accounting.tsx): required (inline alert message, submit blocked) when Account Title is `1010`, disabled with None otherwise, cleared on account switch and after submit, required again if switched back; children stay UI-only, COA untouched. Payload isolation: `bankSub` is destructured out before `addTxn` — the API contract is unchanged and nothing pretends the sub-account was saved; an on-screen note states backend persistence is pending. Styles reuse existing tokens (`.field-hint`, disabled select, subhead); responsive stacking via the existing grid collapse. BACKEND STILL REQUIRED: persist the sub-account — needs a `Txn`/store field, `toDbPayload` + `create_transaction` support, and (live) a migration; the live `transactions` table has no sub-account column today. Diff: Transactions.tsx, Accounting.tsx (export + 2 pure helpers), styles.css (4 lines), selftest (2 new checks) — no routes, schema, RPCs, store, finance, auth, or unrelated screens. Verified: tsc clean, selftests 143/143, vite build green. Released as 777aab6, pushed master 63d5ee4..777aab6; production serves the new bundle (index-C8skzL_d.js / index-abL8hbwv.css match local dist) — live bundle confirmed to contain the new form labels and pending-backend note; live `/admin/transaction` and `/admin/accounting?tab=gl` routes respond. Code/bundle verified; no physical browser form-fill testing performed. Production stays Demo. Next: Slice 3 posting ONLY after Gate-1 approvals + provisioning.