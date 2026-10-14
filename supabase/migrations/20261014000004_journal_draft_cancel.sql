-- Slice 3 preparation, continued: cancel a journal Draft.
-- Policy-neutral lifecycle management ONLY: drafts are unposted working
-- papers, so voiding one encodes no debit/credit mapping, no Approve
-- Income treatment, no opening balances, and no posting. The audit row
-- preserves the trace. Repeatable; no secrets or seeds.

-- Cancels an unposted journal draft and its lines. Allowed for the
-- draft's creator or Accounting/CEO roles (mirrors the demo resubmit
-- convention). Posted or reversed entries are never touched here.
create or replace function public.cancel_journal_draft(p_entry_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_role text := public.my_role();
  v_cur public.journal_entries%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_cur from public.journal_entries where id = p_entry_id for update;
  if not found then
    raise exception 'NOT_FOUND: journal draft does not exist';
  end if;
  if v_cur.status <> 'Draft' then
    raise exception 'NOT_DRAFT: only unposted drafts can be cancelled (status is %)', v_cur.status;
  end if;
  if v_cur.created_by <> v_actor and coalesce(v_role, '') not in ('Accounting', 'CEO') then
    raise exception 'FORBIDDEN: only the creator or Accounting/CEO may cancel a draft';
  end if;
  delete from public.journal_lines where entry_id = v_cur.id;
  delete from public.journal_entries where id = v_cur.id;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''),
            'Journal draft cancelled', v_cur.ref,
            left(coalesce(v_cur.particulars, ''), 200));
end $$;

revoke all on function public.cancel_journal_draft(bigint) from public, anon;
grant execute on function public.cancel_journal_draft(bigint) to authenticated;
