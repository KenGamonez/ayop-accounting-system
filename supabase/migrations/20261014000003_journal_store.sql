-- Slice 3 preparation: balanced-journal store (Ayop Accounting System).
-- Policy-neutral groundwork ONLY: tables, balance enforcement, draft
-- submission, RLS. Deliberately absent (pending owner/accountant
-- decisions): debit/credit mapping per classification, Approve Income
-- treatment, opening balances, posting/approval of journals, closed
-- periods, inventory costing. No posting path is created here.
-- Repeatable where safe; no secrets, passwords, or financial seeds.

-- ---------------------------------------------------------------- entries
create table if not exists public.journal_entries (
  id bigint generated always as identity primary key,
  ref text not null unique,
  date date not null,
  business_unit text not null references public.business_units (name),
  particulars text not null check (char_length(particulars) > 0),
  source text not null default 'MANUAL',
  status text not null default 'Draft'
    check (status in ('Draft', 'Posted', 'Reversed')),
  created_by text not null references public.staff (id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_idem_per_actor unique (created_by, idempotency_key)
);

-- ---------------------------------------------------------------- lines
create table if not exists public.journal_lines (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.journal_entries (id) on delete cascade,
  account_code text not null references public.chart_of_accounts (code),
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  -- One side per line: standard bookkeeping shape, no policy involved.
  check (debit = 0 or credit = 0)
);

-- Balance enforcement at the database level: total debits must equal total
-- credits per entry whenever its lines change. Fires for drafts and posted
-- entries alike, so no unbalanced journal can persist regardless of caller.
create or replace function public.enforce_journal_balance()
returns trigger language plpgsql as $$
declare
  v_dr numeric; v_cr numeric;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_dr, v_cr
    from public.journal_lines
    where entry_id = coalesce(new.entry_id, old.entry_id);
  if abs(v_dr - v_cr) >= 0.005 then
    raise exception 'UNBALANCED: debits % must equal credits %', v_dr, v_cr;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists journal_balance_check on public.journal_lines;
create constraint trigger journal_balance_check
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.enforce_journal_balance();

-- ---------------------------------------------------------------- RLS
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

-- Same visibility rule as transactions: warehouse sees own rows, other
-- linked roles keep consolidated visibility, unlinked sessions see nothing.
-- No direct-write policies: drafts go through the RPC below.
drop policy if exists "journal_read_scoped" on public.journal_entries;
create policy "journal_read_scoped" on public.journal_entries
  for select to authenticated
  using (public.my_role() <> 'Warehouse' or created_by = public.my_staff_id());

drop policy if exists "journal_lines_read_scoped" on public.journal_lines;
create policy "journal_lines_read_scoped" on public.journal_lines
  for select to authenticated
  using (exists (
    select 1 from public.journal_entries e
    where e.id = journal_lines.entry_id
      and (public.my_role() <> 'Warehouse' or e.created_by = public.my_staff_id())
  ));

-- ---------------------------------------------------------------- draft RPC
-- Creates a balanced Draft journal only. Validates structure, accounts,
-- and single-side/balance rules with friendly errors; the database trigger
-- remains the final authority. Posting is NOT implemented here.
create or replace function public.submit_journal_draft(p_entry jsonb, p_lines jsonb, p_idem text default null)
returns public.journal_entries
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_entry public.journal_entries%rowtype;
  v_ref text;
  v_dr numeric := 0;
  v_cr numeric := 0;
  v_line jsonb;
  v_d numeric; v_c numeric;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if (p_entry->>'date') is null or (p_entry->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'BAD_DATE: entry date must be YYYY-MM-DD';
  end if;
  if not exists (select 1 from public.business_units where name = p_entry->>'business_unit') then
    raise exception 'BAD_UNIT: unknown business unit';
  end if;
  if coalesce(nullif(btrim(p_entry->>'particulars'), ''), '') = '' then
    raise exception 'BAD_PARTICULARS: a reason is required';
  end if;
  if coalesce(jsonb_array_length(p_lines), 0) < 2 then
    raise exception 'TOO_FEW_LINES: at least two lines are required';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if not exists (select 1 from public.chart_of_accounts where code = v_line->>'account_code') then
      raise exception 'BAD_ACCOUNT: unknown account code %', v_line->>'account_code';
    end if;
    v_d := coalesce((v_line->>'debit')::numeric, 0);
    v_c := coalesce((v_line->>'credit')::numeric, 0);
    if v_d < 0 or v_c < 0 then
      raise exception 'NEGATIVE: line amounts cannot be negative';
    end if;
    if v_d > 0 and v_c > 0 then
      raise exception 'BOTH_SIDES: put the amount in debit or credit, not both';
    end if;
    if v_d = 0 and v_c = 0 then
      raise exception 'ZERO_LINE: every line needs a debit or credit amount';
    end if;
    v_dr := v_dr + v_d;
    v_cr := v_cr + v_c;
  end loop;
  if v_dr <= 0 then
    raise exception 'NO_DEBIT: at least one debit amount is required';
  end if;
  if abs(v_dr - v_cr) >= 0.005 then
    raise exception 'UNBALANCED: debits % must equal credits %', v_dr, v_cr;
  end if;

  v_ref := 'JV-' || to_char((p_entry->>'date')::date, 'YYYYMMDD') || '-' ||
           lpad(nextval('public.txn_seq')::text, 3, '0');

  insert into public.journal_entries
    (ref, date, business_unit, particulars, source, status, created_by, idempotency_key)
  values
    (v_ref, (p_entry->>'date')::date, p_entry->>'business_unit',
     btrim(p_entry->>'particulars'), coalesce(p_entry->>'source', 'MANUAL'),
     'Draft', v_actor, nullif(p_idem, ''))
  on conflict (created_by, idempotency_key) do nothing
  returning * into v_entry;

  if not found then
    select * into v_entry from public.journal_entries
      where created_by = v_actor and idempotency_key = nullif(p_idem, '');
    return v_entry;
  end if;

  insert into public.journal_lines (entry_id, account_code, debit, credit)
    select v_entry.id, l->>'account_code',
           coalesce((l->>'debit')::numeric, 0), coalesce((l->>'credit')::numeric, 0)
      from jsonb_array_elements(p_lines) as l;

  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Journal draft created',
            v_ref, left(coalesce(p_entry->>'particulars', ''), 200));
  return v_entry;
end $$;

revoke all on function public.enforce_journal_balance() from public, anon;
revoke all on function public.submit_journal_draft(jsonb, jsonb, text) from public, anon;
grant execute on function public.submit_journal_draft(jsonb, jsonb, text) to authenticated;
