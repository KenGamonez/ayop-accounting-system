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

## Backend capabilities actually verified (Slice 1, 2026-10-14)

Dedicated project `ayop-accounting-system` with reference tables, seeds,
and RLS (verified live). Demo/live boundary + live reference reads in
`src/data/backend.ts` (verified locally; production intentionally Demo).
No transaction writes, no Auth accounts yet — owner provisioning pending.

## Standing decisions and blockers

## Standing decisions and blockers

- Frontend-only demo guards must never be described as secure authorization.
- 9 exact business units, 7 staff IDs, staff terminology preserved.
- Out of scope: BIR, payroll, backend until this plan is acknowledged.
- Open owner questions: "Approve Income" code + classification; inventory
  costing (average vs FIFO); role narrowing for HR/cashier/pharmacy;
  staff emails for Auth; closed-period policy; revenue/settlement timing.

## Work completed in this phase (Phase 0)

Read-only study; no backend implemented, no database touched, no app code
changed. Produced `docs/BACKEND_IMPLEMENTATION_PLAN.md` (architecture:
new dedicated Supabase project, 6-slice sequence, schema, RLS matrix,
invariants, tests, backup) and this state file.

## Exactly one next task

**Slice 2 — Transactions + approval chain on the live backend**
(requires Slice 1 staff provisioning confirmed first). Acceptance: server
transition RPC with creator/self-approval guards + row locking; RLS per
role; frontend writes through RPC with demo fallback intact; concurrency
and guard tests green; docs updated. Do not start until provisioning
(`docs/SLICE_1_SETUP.md` §3) is verified complete.

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
