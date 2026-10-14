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

## Backend capabilities actually verified: NONE

No `supabase/` dir, migrations, RPCs, edge functions, env vars, or server
client in the repo. Persistence is per-browser `localStorage`
(`jem51-demo-v1`). Login is click-to-enter profiles, no passwords. The only
Supabase project in the org is the unrelated **Bislig Hub** app. All
permissions are presentation-only.

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

**Slice 1 — Supabase project + Auth + reference read path.**
Acceptance criteria: (1) new project provisioned (NOT Bislig Hub);
(2) `staff`/`business_units`/`chart_of_accounts` tables + seed migration
applied; (3) RLS read policies verified per role; (4) 7 Auth accounts
provisioned; (5) frontend demo/live switch reads live COA + units with a
visible mode badge; (6) `tsc` + build + selftests green; (7) no service
key in code; (8) docs updated, commit pushed, preview verified. Do not
start until the owner acknowledges the plan.

## Progress log

- 2026-10-14 — Phase 0: verified baseline `06846ea` (clean tree, live
  production route responds); confirmed zero backend footprint; recorded
  Bislig Hub as unrelated; wrote backend plan + this state file. Next:
  Slice 1 on owner acknowledgement.
- 2026-10-14 — Forensic study (pre-backend): traced all routes, store
  operations, finance builders, guards, and import/export against the code
  at `44656ff`; produced `docs/FRONTEND_WORKFLOW_SPEC.md` (workflows,
  accounting model, backend operation contracts) and
  `docs/REQUIREMENTS_TO_CODE_MATRIX.md` (30-row evidence matrix). No app
  code changed. Confirmed: single-sided demo model, presentation-only
  permissions, advisory close, no costing method, no settlement modeling.
  Next: Slice 1 on owner acknowledgement (unchanged).
