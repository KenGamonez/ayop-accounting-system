-- Slice 1: reference-data foundation for Ayop Accounting System (JEM51).
-- Business units, staff membership/role mapping, chart of accounts.
-- No passwords, emails, secrets, or financial history are seeded here.
-- Repeatable: all statements are IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------- units
create table if not exists public.business_units (
  name text primary key,
  created_at timestamptz not null default now()
);

insert into public.business_units (name) values
  ('Diagnostic Center'),
  ('Dialysis Center'),
  ('Pharmacy'),
  ('Halo Enterprises Wholesale'),
  ('Doc’J Boxing Gym'),
  ('Animal Bite Center'),
  ('PhilHealth Gamot'),
  ('PhilHealth Yakap/Konsulta'),
  ('Central Warehouse')
on conflict (name) do nothing;

-- ---------------------------------------------------------------- staff
-- Canonical staff IDs match the frontend demo (joy, eve, dani, jeann,
-- jinky, mae, rodel) so creator attribution survives the migration.
-- auth_user_id is linked by an administrator AFTER real Auth accounts are
-- provisioned; it stays NULL until then and nothing fabricates it.
-- Staff org units (e.g. Management, Accounting) are NOT the 9 reporting
-- business units, so this column intentionally has no foreign key.
create table if not exists public.staff (
  id text primary key,
  auth_user_id uuid unique,
  name text not null,
  role text not null,
  business_unit text not null,
  initials text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.staff (id, name, role, business_unit, initials) values
  ('joy',   'Joy Ayop',      'CEO',                 'Management',        'JA'),
  ('eve',   'Eve Rasonable', 'HR',                  'Management',        'ER'),
  ('dani',  'Daniflor Calago','Accounting',         'Accounting',        'DC'),
  ('jeann', 'Jeann',         'Warehouse',           'Central Warehouse', 'JN'),
  ('jinky', 'Jinky',         'Diagnostics Cashier', 'Diagnostic Center', 'JK'),
  ('mae',   'Mae Sherylou',  'Pharmacy',            'Pharmacy',          'MS'),
  ('rodel', 'Rodel',         'IT',                  'Management',        'RD')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- chart
create table if not exists public.chart_of_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
  created_at timestamptz not null default now()
);

insert into public.chart_of_accounts (code, name, type) values
  ('1000', 'Cash on Hand',               'Asset'),
  ('1010', 'Cash in Bank',               'Asset'),
  ('1100', 'Pharmacy Inventory',         'Asset'),
  ('1110', 'Laboratory Inventory',       'Asset'),
  ('1120', 'Dialysis Inventory',         'Asset'),
  ('1200', 'Accounts Receivable',        'Asset'),
  ('1500', 'Medical Equipment',          'Asset'),
  ('2000', 'Accounts Payable',           'Liability'),
  ('2100', 'Accrued Expenses',           'Liability'),
  ('3000', 'Owner''s Equity',            'Equity'),
  ('4000', 'Service Revenue — Diagnostics', 'Revenue'),
  ('4100', 'Pharmacy Sales',             'Revenue'),
  ('4200', 'Dialysis Revenue',           'Revenue'),
  ('5000', 'Medical Supplies Expense',   'Expense'),
  ('5100', 'Office Supplies Expense',    'Expense'),
  ('5200', 'Salaries & Wages',           'Expense'),
  ('5300', 'Utilities Expense',          'Expense')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- RLS
-- Reference data (units, chart) is non-sensitive — the same codes already
-- ship inside the frontend bundle — so signed-in AND anonymous clients may
-- read it. The staff directory requires an authenticated session; nothing
-- here is writable from the API (no INSERT/UPDATE/DELETE policies).
alter table public.business_units enable row level security;
alter table public.staff enable row level security;
alter table public.chart_of_accounts enable row level security;

drop policy if exists "units_read_all" on public.business_units;
create policy "units_read_all" on public.business_units
  for select to anon, authenticated using (true);

drop policy if exists "coa_read_all" on public.chart_of_accounts;
create policy "coa_read_all" on public.chart_of_accounts
  for select to anon, authenticated using (true);

drop policy if exists "staff_read_authenticated" on public.staff;
create policy "staff_read_authenticated" on public.staff
  for select to authenticated using (true);
