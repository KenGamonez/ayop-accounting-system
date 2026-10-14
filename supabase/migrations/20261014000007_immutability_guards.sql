-- Slice 3 hardening (posting still disabled): schema-level immutability.
-- Policy-neutral enforcement ONLY. This migration encodes no debit/credit
-- mapping, no Approve Income treatment, no opening balances, no costing,
-- and no posting path. It reuses the already-approved transition matrix
-- and draft lifecycle. Repeatable; no secrets or seeds.
--
-- Guarantees (enforced for every role, including future privileged paths):
-- 1. transactions: status may change only along txn_transitions pairs.
-- 2. transactions: rows may be deleted only while Draft.
-- 3. journal_entries: status may NEVER change here (posting stays
--    impossible until an approved post_journal migration explicitly
--    relaxes this guard); other columns updatable only while Draft.
-- 4. journal_lines: writable only while the parent entry is Draft.
-- A future approved posting migration must consciously ALTER these
-- triggers — silent posting cannot slip through.

create or replace function public.assert_txn_mutation()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'Draft' then
      raise exception 'LOCKED: only Draft transactions may be deleted (status is %)', old.status;
    end if;
    return old;
  end if;
  if old.status <> new.status
     and not exists (select 1 from public.txn_transitions
                     where from_status = old.status and to_status = new.status) then
    raise exception 'ILLEGAL: cannot move from % to %', old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists txn_immutable on public.transactions;
create trigger txn_immutable
  before update or delete on public.transactions
  for each row execute function public.assert_txn_mutation();

create or replace function public.assert_journal_locked()
returns trigger language plpgsql as $$
declare
  v_status text;
begin
  if TG_TABLE_NAME = 'journal_lines' then
    if TG_OP = 'DELETE' then
      select status into v_status from public.journal_entries where id = old.entry_id;
    else
      select status into v_status from public.journal_entries where id = new.entry_id;
    end if;
    if coalesce(v_status, '') <> 'Draft' then
      raise exception 'LOCKED: journal lines are immutable once the entry leaves Draft (status is %)', coalesce(v_status, 'missing');
    end if;
    return coalesce(new, old);
  end if;
  -- journal_entries
  if TG_OP = 'DELETE' then
    if old.status <> 'Draft' then
      raise exception 'LOCKED: only Draft journal entries may be deleted (status is %)', old.status;
    end if;
    return old;
  end if;
  if old.status <> 'Draft' then
    raise exception 'LOCKED: posted journal entries cannot be edited (status is %)', old.status;
  end if;
  if new.status <> old.status then
    raise exception 'NO_POSTING_PATH: journal status changes are disabled until the approved posting migration';
  end if;
  return new;
end $$;

drop trigger if exists journal_locked on public.journal_entries;
create trigger journal_locked
  before update or delete on public.journal_entries
  for each row execute function public.assert_journal_locked();

drop trigger if exists journal_lines_locked on public.journal_lines;
create trigger journal_lines_locked
  before insert or update or delete on public.journal_lines
  for each row execute function public.assert_journal_locked();
