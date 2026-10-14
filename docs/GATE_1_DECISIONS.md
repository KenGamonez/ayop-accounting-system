# Gate-1 Decision Register — Slice 3 Posting Authorization

Posting stays **disabled** until every item below is explicitly approved and
recorded here. Nothing in this file approves, recommends, or selects an
accounting treatment — all treatments are PENDING until the owner/accountant
fills them in. Do not implement posting rules from guesses.

How to approve: the owner/accountant fills **Decision**, **Decided by**,
**Date**, and **Evidence** for an item, then a developer records the
corresponding migration/test/docs change in a follow-up commit.

## D1 — Classification-to-account debit/credit mapping

- **Question:** For each supported transaction classification
  (Expense, Revenue, Asset, Liability) and transaction kind
  (Cash In, Cash Out, Disbursement, Journal), which exact Chart of Accounts
  codes are debited and which are credited when the entry posts?
- **Why it blocks:** `post_journal` cannot be written without this table;
  any assumed mapping would corrupt the ledger.
- **Status:** PENDING
- **Decision:** *(blank — awaiting owner/accountant)*
- **Decided by:** *(blank)*
- **Date:** *(blank)*
- **Evidence:** *(blank — e.g. signed memo, meeting reference)*

## D2 — “Approve Income” account code and treatment

- **Question:** What is the exact COA code for “Approve Income,” what is
  its classification, and how must income awaiting approval be treated
  before and after approval?
- **Why it blocks:** The account does not exist in the chart; inventing a
  code or classification is prohibited.
- **Status:** PENDING
- **Decision:** *(blank — awaiting owner/accountant)*
- **Decided by:** *(blank)*
- **Date:** *(blank)*
- **Evidence:** *(blank)*

## D3 — Opening balances and historical posted records

- **Question:** What are the approved opening balances (per account, with
  sources), and how must existing demo/posted historical records be treated
  at cutover — migrated, restated, or left as demo-only history?
- **Why it blocks:** Posting opening balances without approved figures
  would manufacture equity and balances.
- **Status:** PENDING
- **Decision:** *(blank — awaiting owner/accountant)*
- **Decided by:** *(blank)*
- **Date:** *(blank)*
- **Evidence:** *(blank)*

## D4 — Inventory costing and recognition timing

- **Question:** Which inventory costing basis applies (the open alternatives
  are average cost vs FIFO — neither is selected here), and when are
  inventory, expense, and Accounts Payable recognized (on order, on
  receipt, on approval, or on payment)?
- **Why it blocks:** Receiving currently updates running totals only;
  posting cost-of-goods or payable journals requires the chosen basis and
  timing.
- **Status:** PENDING
- **Decision:** *(blank — awaiting owner/accountant)*
- **Decided by:** *(blank)*
- **Date:** *(blank)*
- **Evidence:** *(blank)*

Open alternatives are listed above only so the approver can see the full
question — their presence here is not a recommendation.

## P1 — Staff provisioning and membership verification (prerequisite)

Not an accounting decision, but posting cannot be exercised without it.
Follow `docs/SLICE_1_SETUP.md` §3 exactly (dashboard user creation with
real addresses — none are invented here — plus per-user `auth_user_id`
linking SQL). Verification query:

```sql
select id, (auth_user_id is not null) as linked from public.staff order by 1;
```

- **Status:** PENDING — 0 of 7 linked at last check.
- **Verified by:** *(blank)*
- **Date:** *(blank)*

## Unlock evidence required before posting is implemented

1. D1–D4 recorded above with approver, date, and evidence.
2. P1 verified: 7/7 linked (or an explicitly approved and documented
   alternative access scope recorded here).
3. Posting invariant tests green (balanced/unbalanced, invalid accounts,
   self-approval, idempotent retry, rollback).
4. Authenticated authorization checks demonstrated with linked sessions
   (never anon, never demo profiles).
5. Safe rollback plan recorded (fix-forward migration; no production data
   at risk — live financial tables hold 0 rows).
6. Production remains in Demo mode until a separately verified, explicitly
   authorized live cutover is documented.
