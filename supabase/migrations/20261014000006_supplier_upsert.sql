-- Slice 5: supplier directory writes (Ayop Accounting System).
-- Suppliers are reference data curated by staff; this RPC lets imports and
-- forms save them without direct table writes. No financial effect, no
-- mapping opinions, no seeds. Repeatable; no secrets.

-- Upsert one supplier by name. Provided contact fields overwrite stored
-- values; omitted fields keep existing values. Never deletes.
create or replace function public.upsert_supplier(p jsonb)
returns public.suppliers
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_name text := btrim(coalesce(p->>'name', ''));
  v_row public.suppliers%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if v_name = '' then
    raise exception 'BAD_SUPPLIER: supplier name is required';
  end if;
  insert into public.suppliers (name, contact, phone, address, terms)
  values (
    v_name,
    coalesce(btrim(p->>'contact'), ''),
    coalesce(btrim(p->>'phone'), ''),
    coalesce(btrim(p->>'address'), ''),
    coalesce(btrim(p->>'terms'), '')
  )
  on conflict (name) do update set
    contact = case when coalesce(btrim(excluded.contact), '') <> '' then excluded.contact else public.suppliers.contact end,
    phone = case when coalesce(btrim(excluded.phone), '') <> '' then excluded.phone else public.suppliers.phone end,
    address = case when coalesce(btrim(excluded.address), '') <> '' then excluded.address else public.suppliers.address end,
    terms = case when coalesce(btrim(excluded.terms), '') <> '' then excluded.terms else public.suppliers.terms end
  returning * into v_row;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Supplier saved', v_name, 'directory upsert');
  return v_row;
end $$;

revoke all on function public.upsert_supplier(jsonb) from public, anon;
grant execute on function public.upsert_supplier(jsonb) to authenticated;
