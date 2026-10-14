# Backend Implementation Plan — Ayop Accounting System (JEM51)

Status: Phase 0 roadmap. Frontend remains the Vite + React demo at
`KenGamonez/ayop-accounting-system` (baseline `06846ea`, verified live).
No backend code, migration, or database change exists yet — this document
is the plan, not a completion claim.

## 1. Recommended architecture (with evidence)

**Recommendation: a NEW, dedicated Supabase project for Ayop Accounting —
PostgreSQL + Supabase Auth + Row-Level Security + SQL migrations + one
atomic posting RPC. Keep the existing React frontend; add
`@supabase/supabase-js` behind a demo/live mode switch.**

Evidence grounded in this repo:

- The only Supabase project in the organization is **Bislig Hub**
  (`epsxgqoqfrwymktjvujs`, active, Postgres 17) — an unrelated application.
  Reusing its database would mix accounting records with another app's data,
  complicate RLS, and widen blast radius. A new project in the same
  organization keeps billing consolidated with full data isolation.
- The repo contains **zero** backend code: no `supabase/` directory, no
  migrations, no RPCs, no edge functions, no `VITE_*`/`SUPABASE_*` env usage,
  no server client dependency (`package.json`: react, react-dom,
  react-router-dom, xlsx only). Persistence today is `localStorage` under key
  `jem51-demo-v1` (`AppStore.tsx`), per-browser andSQLite-free — there is no
  multi-user truth, so every approval/posting control is presentation-only.
- The accounting rules already exist as **pure, tested logic**:
  `src/data/finance.ts` (`postedIn`, `signedAmount`, `trialBalance`,
  `incomeSummary`, `conditionSummary`, `balanceSheet`, `cashFlow`,
  `accountLedger`), `src/data/ops.ts` (transitions, guards, receipt math),
  `src/data/access.ts` (role policy), `src/data/close.ts`,
  `src/data/io.ts` (import validation). `scripts/selftest.ts` holds 107
  checks. The backend must **re-encode these invariants in SQL/RLS/RPC**,
  not replace them — the frontend keeps them for instant UX, the server is
  the authority.
- The demo login (`Login.tsx`) is click-to-enter staff profiles with no
  password. Real identity therefore requires Supabase Auth with provisioned
  accounts for the 7 existing staff IDs.

Alternatives considered and rejected:

- **Firebase/Firestore**: no real SQL constraints or double-entry
  enforcement; accounting invariants would live in app code again.
- **Custom Node/Express API**: viable but slower and higher-ops; duplicates
  what Supabase provides (Auth, RLS, migrations, preview branches).
- **localStorage forever**: fails the mission — no shared truth, no
  concurrent-user safety, no audit durability.

## 2. Implementation sequence (dependency-aware, one slice at a time)

1. **Slice 1 — Project + Auth + reference read path.** Provision project,
   `staff`/`business_units`/`chart_of_accounts` tables + seed migration, RLS
   read policies, 7 Auth accounts, frontend demo/live switch reading COA and
   units live. (Detailed acceptance criteria in `PROJECT_STATE.md`.)
2. **Slice 2 — Transactions + approval chain.** `transactions` table,
   status enum, `created_by`, server transition RPC with creator/self-approval
   guards and row locking; RLS per role; frontend writes through RPC.
3. **Slice 3 — Double-entry core.** `journal_entries` + `journal_lines`
   with `CHECK(sum debit)=sum(credit)`, atomic `post_entry` RPC, reversal
   entries referencing originals; GL/TB/I&E/position/cash-flow computed from
   posted lines only.
4. **Slice 4 — Purchasing/inventory/payables.** `suppliers`,
   `purchase_orders` + `po_lines` + `receipts` (partial, capped, no double
   count), `inventory_items` + `stock_moves`, receipt→stock→payable as one
   server transaction.
5. **Slice 5 — Audit, close, import/export.** Append-only `audit_events`,
   close acknowledgements, server-side import validation mirroring `io.ts`
   rules, exports from live data.
6. **Slice 6 — Hardening + cutover.** RLS matrix tests, concurrency tests,
   backup/restore drill, demo→live cutover, docs update.

## 3. Database entities and relationships

- `staff(id pk, auth_user_id unique, name, role, business_unit, initials,
  active)` — IDs must match existing frontend IDs (`joy`, `eve`, `dani`,
  `jeann`, `jinky`, `mae`, `rodel`) so `createdBy` attribution survives.
- `business_units(name pk)` — the 9 exact units; referenced everywhere.
- `chart_of_accounts(code pk, name, type)` — seeded from current COA;
  "Approve Income" stays absent until the client confirms code +
  classification (open question, see §8).
- `transactions(...)` — mirrors the frontend `Txn` shape plus
  `created_by → staff`, status enum, `reversal_of → transactions`,
  ` Ricevubusiness-unit checks, timestamps, `updated_by`.
- `journal_entries(id, date, ref unique, particulars, business_unit,
  source, status, created_by)` + `journal_lines(entry_id, account_code,
  debit, credit)` with a balance CHECK.
- `suppliers`, `purchase_orders` + `po_lines(qty, received_qty)` +
  `receipts` (each receipt immutable once recorded).
- `inventory_items` + `stock_moves(item, delta, reason, actor)` — quantity
  derived from moves; direct qty writes forbidden.
- `audit_events(id, at default now(), actor, action, ref, detail)` —
  INSERT-only (no UPDATE/DELETE grants).
- `close_acks(unit, period, fingerprint, by, at)` with unique(unit, period).

## 4. Security model and role/permission matrix

Auth: Supabase Auth (email + password, one account per staff ID; passwords
set out-of-band, never in code). Frontend holds only the publishable URL +
anon key; RLS enforces everything.

| Capability | CEO (joy) | Accounting (dani) | Warehouse (jeann) | Other roles* |
|---|---|---|---|---|
| View own dashboard/workspace | ✓ | ✓ | ✓ (warehouse only) | ✓ current scope |
| Create txn / PO / inventory / journal / import | ✓ | ✓ | ✓ (own records) | as today |
| Accountant review / reject | ✓ | ✓ | — | — |
| Owner approve / post / reverse | ✓ (owner) | post only via approval chain | — | — |
| Read consolidated records | ✓ | ✓ | own only (plus stock/PO ops views) | as today |
| Read financial statements | ✓ | ✓ | — (request via accounting) | as today |
| Approve/post own entry | — (server-blocked for all) | — | — | — |

\* HR, Diagnostics Cashier, Pharmacy, IT keep current demo scope; tighten
only if the owner asks. Warehouse route/nav restrictions from
`src/data/access.ts` become RLS policies, not just hidden links. Service-role
key lives only in Supabase dashboard/Edge Functions — never in frontend code
or the repo.

## 5. Accounting invariants and transaction boundaries

Enforced in Postgres (constraints + RPC), mirrored from the tested frontend
rules — never frontend-only:

- Only `status = 'Posted'` rows feed GL/TB/statements (`postedIn`).
- Journal balance: `CHECK` that debit and credit totals match per entry.
- Legal status transitions only (`ALLOWED_TRANSITIONS`); creator cannot
  approve/post own entry (`guardTransition`); `post_entry` takes a row lock
  so concurrent approvals cannot double-post.
- Reversals: original locked as Reversed + offsetting entry (`reversalOf`),
  counted negative (`signedAmount`) — never edit/delete posted rows.
- No silent overwrites: receipt quantities capped at outstanding
  (`applyReceipt`); stock changes only via `stock_moves`.
- Equity section only from Equity-type codes; Net Income = revenue −
  expenses, never merged into equity accounts.
- Cash Flow counts only explicit Cash In/Out kinds (documented demo
  limitation until settlement method is modeled).
- Close checklist is advisory; real closed-period protection (block postings
  into locked periods except by privileged reopening with audit) arrives in
  Slice 5/6.

## 6. Migration and demo-data strategy

- Greenfield migrations in `supabase/migrations/` (project has none today);
  every change reviewed locally via Supabase CLI before touching the shared
  project. Fix-forward rollbacks, never history rewrites.
- Seed migration: 9 units, full COA, 7 staff roles (no passwords in seed).
  Synthetic demo transactions stay in the frontend demo dataset; do **not**
  seed fake financial history as real records.
- Frontend runs dual-mode: demo (localStorage, current behavior, default
  until cutover) vs live (Supabase). A single config switch + status badge
  keeps all completed frontend work usable throughout the migration.

## 7. Test, deployment, backup, recovery

- Keep and extend `scripts/selftest.ts` for pure logic; add `vitest` for the
  data-access layer and SQL-level tests for constraints, RLS policies per
  role, double-posting races, and reversal accounting.
- Validate locally (Supabase CLI + `tsc` + build + selftests) before any
  shared-project change; use Supabase preview branches per milestone.
- Deploy frontend through the existing GitHub → Vercel pipeline only after
  green checks; verify live routes per release.
- Backup: scheduled `pg_dump` + Supabase point-in-time recovery (plan
  dependent); rollback = fix-forward migration; document restore drill in
  Slice 6.

## 8. Risks, open decisions, next slice

- **Risks**: double-entry remodel changes TB semantics (demo TB is
  single-sided — accountants must sign off the mapping); concurrent
  approval races; RLS misconfiguration leaking units; audit-table
  tampering if grants are wrong; scope creep into BIR/payroll (out of
  scope — must stay out).
- **Needs owner input**: (1) "Approve Income" account code +
  classification (open since the COA milestone); (2) inventory costing
  method (average vs FIFO — frontend tracks running totals only);
  (3) whether HR/cashier/pharmacy roles need narrowing; (4) real staff
  email addresses for Auth provisioning; (5) closed-period policy.
- **Assumptions to confirm with the accounting owner**: revenue/expense
  recognition timing, settlement-method modeling for a true Cash Flow,
  opening-balance sources for cutover.
- **Next slice**: Slice 1 per `PROJECT_STATE.md` — do not start it until
  the owner acknowledges this plan.

## 9. Forensic-study addendum (2026-10-14)

Pre-backend code trace at 44656ff produced docs/FRONTEND_WORKFLOW_SPEC.md (operation contracts, accounting-model gaps) and docs/REQUIREMENTS_TO_CODE_MATRIX.md (30-row evidence table). Key confirmations feeding the slices above: single-sided demo postings, presentation-only permissions, advisory close, no costing method, cash flow limited to explicit Cash In/Out kinds. No app code changed by the study.
## 10. Slice 1 implementation record (2026-10-14)

Project yop-accounting-system (	gokmcupkxvgsniljqpf, ap-southeast-1) created; supabase/migrations/20261014000001_reference_foundation.sql applied and verified (9 units, 7 staff unlinked, 17 COA, RLS on, read-only policies; anon reads units/COA, staff denied unauthenticated). Frontend: src/data/backend.ts boundary, Settings backend card, live COA reads, production env untouched (Demo). Remaining owner work: 7 Auth accounts + uth_user_id linking per docs/SLICE_1_SETUP.md. Next: Slice 2 per PROJECT_STATE.md.
## 11. Slice 2 implementation record (2026-10-14)

Migration 20261014000002 applied and catalog-verified (transactions + transition matrix + audit + create/transition/reverse RPCs, scoped RLS, authenticated-only EXECUTE; 0 live rows). Frontend live adapter, live login, and async store delegation implemented with demo behavior byte-identical by default. Provisioning (0/7 linked) still blocks e2e verification and any live activation. Next: Slice 3 per PROJECT_STATE.md.
## 12. Slice 3 preparation record � stopped at decision boundary (2026-10-14)

Migration 20261014000003 applied and remotely verified (journal_entries + journal_lines, single-side-per-line CHECKs, deferrable balance trigger proven firing with 0 rows persisted, scoped SELECT-only RLS, submit_journal_draft RPC, authenticated-only EXECUTE). NO posting path, NO debit/credit mapping, NO Approve Income treatment, NO opening balances: Gate-1 decisions and 0/7 staff linkage both still open. Posting work resumes only after explicit approvals + provisioning.
## 13. Slice 3 prep, continued (2026-10-14)

Draft-cancellation lifecycle only (migration 20261014000004, verified: grants, anon denial, 0 rows). Posting, mapping, Approve Income, opening balances, and costing remain blocked on Gate-1 + provisioning. Next: Slice 3 posting per PROJECT_STATE.md.
## 14. Slice 4 implementation record (2026-10-14)

Migration 20261014000005 applied and verified (6 ops tables, receipt/move ledgers, 7 RPCs, SELECT-only RLS, authenticated-only EXECUTE; all tables empty). Receiving is atomic (stock + payable transaction row, never a journal). Frontend delegates PO/inventory/receipt actions live with demo behavior unchanged. Provisioning (0/7) and Gate-1 still block e2e + posting. Next: Slice 3 per PROJECT_STATE.md.
## 15. Slice 5 implementation record (2026-10-14)

Migration 20261014000006 applied and verified (upsert_supplier, authenticated-only EXECUTE, anon denied, no direct-write policies). Live import routing with deterministic idempotency keys; OB blocked live. Provisioning (0/7) and Gate-1 still block e2e + posting. Next: Slice 3 per PROJECT_STATE.md.