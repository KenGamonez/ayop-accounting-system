# Slice 1 Setup — Backend Foundation (reference data + auth groundwork)

Slice 1 delivers: dedicated Supabase project, reference tables + seed +
RLS, demo/live mode boundary, live reference reads. Transactions,
approvals, and postings remain demo-only until Slice 2.

## 1. What already exists (no action needed)

- Supabase project **`ayop-accounting-system`**
  (`tgokmcupkxvgsniljqpf`, region `ap-southeast-1`, org
  `kennygmonez@gmail.com's Org`). Do NOT use the Bislig Hub project.
- Migration `supabase/migrations/20261014000001_reference_foundation.sql`
  applied: `business_units` (9), `staff` (7, all `auth_user_id` NULL),
  `chart_of_accounts` (17), RLS on, read-only SELECT policies.
- Frontend reads the file above as the version-controlled source of truth;
  the same SQL was applied remotely.

## 2. Local live verification (developer, secrets stay local)

1. Create `.env.local` in the project root (gitignored — never commit it):
   `VITE_AYOP_BACKEND=live`, `VITE_SUPABASE_URL=https://<ref>.supabase.co`,
   `VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>`. Use only the
   **publishable/anon** key — never the service-role key.
2. Run the app (`npm run dev`) and open **Settings → Backend connection**:
   expect Mode Live, 9 units, 17 chart lines, 0 of 7 staff linked.
3. Open **Accounting → Chart of Accounts**: expect the live 17-line table.
   With the env vars absent, the app stays in Demo with zero behavior change.

## 3. Remaining owner action: provision + link the 7 staff accounts

No emails are invented here — use each staff member's real address.

1. In the Supabase dashboard for project `ayop-accounting-system`, open
   **Authentication → Users → Add user → Create new user** for each of the
   7 staff members (real email + a password shared out-of-band).
2. Still in the dashboard, open **SQL Editor** and link each login to its
   canonical staff ID (repeat per user, replacing both values):
   `update public.staff set auth_user_id = (select id from auth.users
   where email = 'REAL-EMAIL-HERE') where id = 'STAFF-ID-HERE';`
   Canonical IDs: `joy`, `eve`, `dani`, `jeann`, `jinky`, `mae`, `rodel`.
3. Verify: `select id, (auth_user_id is not null) as linked from
   public.staff order by 1;` — all 7 rows must show `linked = true`.
4. Re-check Settings → Backend connection: staff line must read 7 of 7.

Until step 3 is done, live sign-in resolves no membership and the app
correctly reports 0 linked accounts. Transaction writes stay demo-only
regardless (Slice 2).

## 4. Production stance

Vercel has **no** `VITE_*` variables set, so production stays in Demo mode.
Do NOT set live variables on production until staff provisioning (above)
and Slice 2 writes are complete and verified.
