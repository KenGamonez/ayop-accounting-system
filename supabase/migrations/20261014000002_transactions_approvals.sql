-- Slice 2: live transactions + approval chain (Ayop Accounting System).
-- Tables, transition matrix, atomic RPCs, RLS. Repeatable where safe.
-- Writes go ONLY through the RPCs below; no direct INSERT/UPDATE/DELETE
-- policies are granted. Service-role key is never needed by clients.

-- ---------------------------------------------------------------- sequence
create sequence if not exists public.txn_seq;

-- ---------------------------------------------------------------- transactions
create table if not exists public.transactions (
  id text primary key default ('TXN-' || to_char(now(), 'YYYY-') || lpad(nextval('public.txn_seq')::text, 4, '0')),
  date date not null,
  business_unit text not null references public.business_units (name),
  classification text not null check (classification in ('Expense', 'Revenue', 'Asset', 'Liability')),
  kind text not null check (kind in ('Cash In', 'Cash Out', 'Disbursement', 'Journal')),
  item text not null check (char_length(item) > 0),
  category text not null default 'Medical Supplies',
  supplier text not null check (char_length(supplier) > 0),
  supplier_price numeric not null default 0 check (supplier_price >= 0),
  retail_price numeric not null default 0 check (retail_price >= 0),
  quantity integer not null default 1 check (quantity >= 0),
  amount numeric not null check (amount > 0),
  account_code text not null references public.chart_of_accounts (code),
  account_name text not null default '',
  entered_by text not null default '',
  created_by text not null references public.staff (id),
  status text not null default 'For Accountant Review'
    check (status in ('Draft', 'For Accountant Review', 'Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted', 'Rejected', 'Reversed')),
  remarks text not null default '',
  reversal_of text references public.transactions (id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint txn_idem_per_actor unique (created_by, idempotency_key)
);

-- ---------------------------------------------------------------- transitions
create table if not exists public.txn_transitions (
  from_status text not null,
  to_status text not null,
  primary key (from_status, to_status)
);

insert into public.txn_transitions (from_status, to_status) values
  ('Draft', 'For Accountant Review'),
  ('For Accountant Review', 'Accountant Reviewed'),
  ('For Accountant Review', 'Rejected'),
  ('Accountant Reviewed', 'For Owner Approval'),
  ('Accountant Reviewed', 'Rejected'),
  ('For Owner Approval', 'Approved'),
  ('For Owner Approval', 'Rejected'),
  ('Approved', 'Posted'),
  ('Approved', 'Rejected'),
  ('Posted', 'Reversed'),
  ('Rejected', 'For Accountant Review'),
  ('Rejected', 'Draft')
on conflict do nothing;

-- ---------------------------------------------------------------- audit
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_staff_id text references public.staff (id),
  actor_name text not null default '',
  action text not null,
  ref text not null default '',
  detail text not null default ''
);

-- ---------------------------------------------------------------- helpers
create or replace function public.my_staff_id()
returns text language sql stable security definer set search_path = public as $$
  select id from public.staff where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_display_name()
returns text language sql stable security definer set search_path = public as $$
  select name from public.staff where auth_user_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------- RLS
alter table public.transactions enable row level security;
alter table public.txn_transitions enable row level security;
alter table public.audit_events enable row level security;

-- Reads: warehouse role sees only its own rows; every other linked role
-- keeps the consolidated visibility the current UI provides. Unlinked
-- sessions resolve to NULL and see nothing. No write policies: RPCs only.
drop policy if exists "txn_read_scoped" on public.transactions;
create policy "txn_read_scoped" on public.transactions
  for select to authenticated
  using (public.my_role() <> 'Warehouse' or created_by = public.my_staff_id());

drop policy if exists "transitions_read" on public.txn_transitions;
create policy "transitions_read" on public.txn_transitions
  for select to authenticated using (true);

drop policy if exists "audit_read" on public.audit_events;
create policy "audit_read" on public.audit_events
  for select to authenticated using (true);

-- ---------------------------------------------------------------- RPCs
create or replace function public.create_transaction(p jsonb, p_idem text default null)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_row public.transactions%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if (p->>'date') is null or (p->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'BAD_DATE: transaction date must be YYYY-MM-DD';
  end if;
  if not exists (select 1 from public.business_units where name = p->>'business_unit') then
    raise exception 'BAD_UNIT: unknown business unit';
  end if;
  if coalesce(p->>'classification', '') not in ('Expense', 'Revenue', 'Asset', 'Liability') then
    raise exception 'BAD_CLASS: invalid classification';
  end if;
  if coalesce(p->>'kind', '') not in ('Cash In', 'Cash Out', 'Disbursement', 'Journal') then
    raise exception 'BAD_KIND: invalid transaction kind';
  end if;
  if coalesce(nullif(btrim(p->>'item'), ''), '') = '' then
    raise exception 'BAD_ITEM: particulars/item is required';
  end if;
  if coalesce(nullif(btrim(p->>'supplier'), ''), '') = '' then
    raise exception 'BAD_SUPPLIER: supplier is required';
  end if;
  if not exists (select 1 from public.chart_of_accounts where code = p->>'account_code') then
    raise exception 'BAD_ACCOUNT: unknown account code';
  end if;
  if coalesce((p->>'amount')::numeric, 0) <= 0 then
    raise exception 'BAD_AMOUNT: amount must be greater than zero';
  end if;

  insert into public.transactions
    (date, business_unit, classification, kind, item, category, supplier,
     supplier_price, retail_price, quantity, amount, account_code, account_name,
     entered_by, created_by, status, remarks, idempotency_key)
  values
    ((p->>'date')::date, p->>'business_unit', p->>'classification', p->>'kind',
     btrim(p->>'item'), coalesce(p->>'category', 'Medical Supplies'),
     btrim(p->>'supplier'),
     coalesce((p->>'supplier_price')::numeric, 0),
     coalesce((p->>'retail_price')::numeric, 0),
     coalesce((p->>'quantity')::int, 1),
     (p->>'amount')::numeric, p->>'account_code',
     coalesce(p->>'account_name', ''),
     coalesce(public.my_display_name(), ''), v_actor,
     'For Accountant Review', coalesce(p->>'remarks', ''), nullif(p_idem, ''))
  on conflict (created_by, idempotency_key) do nothing
  returning * into v_row;

  if not found then
    select * into v_row from public.transactions
      where created_by = v_actor and idempotency_key = nullif(p_idem, '');
  end if;

  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Created transaction', v_row.id, left(coalesce(p->>'item', ''), 200));
  return v_row;
end $$;

create or replace function public.transition_transaction(p_id text, p_to text, p_note text default null)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_cur public.transactions%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_cur from public.transactions where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: transaction does not exist';
  end if;
  if v_cur.status = p_to then
    raise exception 'REPEAT: already %', p_to;
  end if;
  if not exists (select 1 from public.txn_transitions where from_status = v_cur.status and to_status = p_to) then
    raise exception 'ILLEGAL: cannot move from % to %', v_cur.status, p_to;
  end if;
  if v_cur.created_by = v_actor
     and p_to in ('Accountant Reviewed', 'For Owner Approval', 'Approved', 'Posted') then
    raise exception 'SELF_APPROVAL: creators cannot approve or post their own entries';
  end if;
  if p_to = 'Rejected' and coalesce(nullif(btrim(p_note), ''), '') = '' then
    raise exception 'NO_REASON: rejection requires a written reason';
  end if;
  update public.transactions
    set status = p_to, remarks = coalesce(p_note, remarks), updated_at = now()
    where id = p_id returning * into v_cur;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Status: ' || p_to, p_id, left(coalesce(p_note, ''), 200));
  return v_cur;
end $$;

create or replace function public.reverse_transaction(p_id text, p_reason text default null)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_name text := coalesce(public.my_display_name(), '');
  v_cur public.transactions%rowtype;
  v_rev public.transactions%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_cur from public.transactions where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: transaction does not exist';
  end if;
  if v_cur.status <> 'Posted' then
    raise exception 'NOT_POSTED: only posted entries can be reversed';
  end if;
  update public.transactions set status = 'Reversed', updated_at = now() where id = p_id;
  insert into public.transactions
    (date, business_unit, classification, kind, item, category, supplier,
     supplier_price, retail_price, quantity, amount, account_code, account_name,
     entered_by, created_by, status, remarks, reversal_of)
  values
    (current_date, v_cur.business_unit, v_cur.classification, v_cur.kind,
     'REVERSAL of ' || p_id || ' — ' || v_cur.item, v_cur.category, v_cur.supplier,
     v_cur.supplier_price, v_cur.retail_price, v_cur.quantity, v_cur.amount,
     v_cur.account_code, v_cur.account_name, v_name, v_actor,
     'For Accountant Review',
     coalesce(nullif(btrim(p_reason), ''), 'Correcting reversal; original preserved.'),
     p_id)
  returning * into v_rev;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, v_name, 'Reversal recorded', p_id, 'offsetting entry ' || v_rev.id || ' queued for review');
  return v_rev;
end $$;

-- Least privilege: RPCs executable by signed-in users only.
revoke all on function public.my_staff_id() from public, anon;
revoke all on function public.my_role() from public, anon;
revoke all on function public.my_display_name() from public, anon;
revoke all on function public.create_transaction(jsonb, text) from public, anon;
revoke all on function public.transition_transaction(text, text, text) from public, anon;
revoke all on function public.reverse_transaction(text, text) from public, anon;
grant execute on function public.my_staff_id() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_display_name() to authenticated;
grant execute on function public.create_transaction(jsonb, text) to authenticated;
grant execute on function public.transition_transaction(text, text, text) to authenticated;
grant execute on function public.reverse_transaction(text, text) to authenticated;
