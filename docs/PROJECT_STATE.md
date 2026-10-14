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