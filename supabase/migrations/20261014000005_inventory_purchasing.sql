-- Slice 4: inventory + purchasing backend (Ayop Accounting System).
-- Operational records and stock-receipt lifecycle ONLY. Deliberately
-- absent (pending owner/accountant decisions): journal postings from
-- receiving, FIFO/average costing, recognition timing, debit/credit
-- mappings. Receiving creates a review-queued PAYABLE TRANSACTION ROW,
-- never a journal entry. Repeatable where safe; no secrets or seeds.

-- ---------------------------------------------------------------- suppliers
create table if not exists public.suppliers (
  name text primary key,
  contact text not null default '',
  phone text not null default '',
  address text not null default '',
  terms text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- purchase orders
create table if not exists public.purchase_orders (
  id text primary key default ('PO-' || to_char(now(), 'YYYY-') || lpad(nextval('public.txn_seq')::text, 4, '0')),
  po_no text not null unique check (char_length(btrim(po_no)) > 0),
  date date not null,
  supplier text not null check (char_length(btrim(supplier)) > 0),
  business_unit text not null references public.business_units (name),
  delivery_date date not null,
  total numeric not null default 0 check (total >= 0),
  received boolean not null default false,
  received_date date,
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent to Supplier', 'Partially Received', 'Received', 'Cancelled')),
  created_by text not null references public.staff (id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint po_idem_per_actor unique (created_by, idempotency_key)
);

create table if not exists public.po_lines (
  id bigint generated always as identity primary key,
  po_id text not null references public.purchase_orders (id) on delete cascade,
  item text not null check (char_length(btrim(item)) > 0),
  quantity integer not null check (quantity > 0),
  supplier_price numeric not null check (supplier_price >= 0),
  received_qty integer not null default 0 check (received_qty >= 0)
);

-- Immutable receipt history: rows are only ever inserted, never updated.
create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  po_id text not null references public.purchase_orders (id) on delete cascade,
  line_id bigint not null references public.po_lines (id) on delete cascade,
  qty integer not null check (qty > 0),
  received_date date not null default current_date,
  created_by text not null references public.staff (id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint receipt_idem_per_actor unique (created_by, idempotency_key)
);

-- ---------------------------------------------------------------- inventory
create table if not exists public.inventory_items (
  id text primary key default ('INV-' || extract(epoch from now())::bigint::text),
  business_unit text not null references public.business_units (name),
  type text not null check (type in ('Laboratory', 'Pharmacy', 'Dialysis', 'Admin')),
  item text not null check (char_length(btrim(item)) > 0),
  category text not null default 'Medical Supplies',
  quantity integer not null default 0 check (quantity >= 0),
  amount numeric not null default 0,
  supplier text not null default '',
  supplier_price numeric not null default 0 check (supplier_price >= 0),
  retail_price numeric not null default 0 check (retail_price >= 0),
  reorder_level integer not null default 10 check (reorder_level >= 0),
  created_by text references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_unit_item_unique unique (business_unit, item)
);

-- Append-only stock movement ledger: quantity is derived from moves.
create table if not exists public.stock_moves (
  id bigint generated always as identity primary key,
  item_id text not null references public.inventory_items (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  actor_staff_id text references public.staff (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
-- Operational consolidated views stay readable to linked roles (as in the
-- demo UI); warehouse isolation of accounting screens is unchanged.
-- No direct-write policies anywhere: all writes go through the RPCs below.
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_lines enable row level security;
alter table public.receipts enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_moves enable row level security;

drop policy if exists "suppliers_read" on public.suppliers;
create policy "suppliers_read" on public.suppliers for select to authenticated using (true);

drop policy if exists "pos_read" on public.purchase_orders;
create policy "pos_read" on public.purchase_orders for select to authenticated using (true);

drop policy if exists "polines_read" on public.po_lines;
create policy "polines_read" on public.po_lines for select to authenticated using (true);

drop policy if exists "receipts_read" on public.receipts;
create policy "receipts_read" on public.receipts for select to authenticated using (true);

drop policy if exists "inv_read" on public.inventory_items;
create policy "inv_read" on public.inventory_items for select to authenticated using (true);

drop policy if exists "moves_read" on public.stock_moves;
create policy "moves_read" on public.stock_moves for select to authenticated using (true);
-- ---------------------------------------------------------------- RPCs
-- All writes require a linked staff identity; role checks use the server
-- membership record, never client claims. Operational writes are open to
-- any linked staff (matching current demo behavior); approval-family
-- actions stay gated in the transaction RPCs from Slice 2.

create or replace function public.create_purchase_order(p jsonb, p_idem text default null)
returns public.purchase_orders
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_po public.purchase_orders%rowtype;
  v_line jsonb;
  v_total numeric := 0;
  v_n integer := 0;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if coalesce(nullif(btrim(p->>'po_no'), ''), '') = '' then
    raise exception 'BAD_PONO: P.O. number is required';
  end if;
  if exists (select 1 from public.purchase_orders where lower(po_no) = lower(btrim(p->>'po_no'))) then
    raise exception 'DUP_PONO: P.O. number already exists';
  end if;
  if (p->>'date') is null or (p->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'BAD_DATE: order date must be YYYY-MM-DD';
  end if;
  if (p->>'delivery_date') is null or (p->>'delivery_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'BAD_DELIVERY: delivery date must be YYYY-MM-DD';
  end if;
  if coalesce(nullif(btrim(p->>'supplier'), ''), '') = '' then
    raise exception 'BAD_SUPPLIER: supplier is required';
  end if;
  if not exists (select 1 from public.business_units where name = p->>'business_unit') then
    raise exception 'BAD_UNIT: unknown business unit';
  end if;
  if coalesce(jsonb_array_length(p->'items'), 0) < 1 then
    raise exception 'NO_LINES: at least one order line is required';
  end if;
  for v_line in select * from jsonb_array_elements(p->'items') loop
    if coalesce(nullif(btrim(v_line->>'item'), ''), '') = '' then
      raise exception 'BAD_ITEM: every line needs an item name';
    end if;
    if coalesce((v_line->>'quantity')::int, 0) <= 0 then
      raise exception 'BAD_QTY: line quantities must be whole numbers greater than 0';
    end if;
    if coalesce((v_line->>'supplier_price')::numeric, -1) < 0 then
      raise exception 'BAD_PRICE: line prices cannot be negative';
    end if;
    v_total := v_total + (v_line->>'quantity')::int * (v_line->>'supplier_price')::numeric;
    v_n := v_n + 1;
  end loop;

  insert into public.purchase_orders
    (po_no, date, supplier, business_unit, delivery_date, total, status, created_by, idempotency_key)
  values
    (btrim(p->>'po_no'), (p->>'date')::date, btrim(p->>'supplier'), p->>'business_unit',
     (p->>'delivery_date')::date, v_total, 'Draft', v_actor, nullif(p_idem, ''))
  on conflict (created_by, idempotency_key) do nothing
  returning * into v_po;

  if not found then
    select * into v_po from public.purchase_orders
      where created_by = v_actor and idempotency_key = nullif(p_idem, '');
    return v_po;
  end if;

  insert into public.po_lines (po_id, item, quantity, supplier_price)
    select v_po.id, btrim(l->>'item'), (l->>'quantity')::int, (l->>'supplier_price')::numeric
      from jsonb_array_elements(p->'items') as l;

  insert into public.suppliers (name) values (btrim(p->>'supplier'))
  on conflict (name) do nothing;

  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Purchase order created',
            v_po.po_no, v_n || ' line(s), total ' || v_total::text);
  return v_po;
end $$;

create or replace function public.send_purchase_order(p_id text)
returns public.purchase_orders
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_po public.purchase_orders%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_po from public.purchase_orders where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: purchase order does not exist';
  end if;
  if v_po.status <> 'Draft' then
    raise exception 'BAD_STATE: only Draft orders can be sent (status is %)', v_po.status;
  end if;
  update public.purchase_orders set status = 'Sent to Supplier', updated_at = now()
    where id = p_id returning * into v_po;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'P.O. sent to supplier', v_po.po_no, v_po.supplier);
  return v_po;
end $$;

create or replace function public.cancel_purchase_order(p_id text)
returns public.purchase_orders
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_po public.purchase_orders%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_po from public.purchase_orders where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: purchase order does not exist';
  end if;
  if v_po.status in ('Received', 'Cancelled') then
    raise exception 'BAD_STATE: closed orders cannot be cancelled (status is %)', v_po.status;
  end if;
  update public.purchase_orders set status = 'Cancelled', updated_at = now()
    where id = p_id returning * into v_po;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'P.O. cancelled', v_po.po_no, 'Outstanding lines voided');
  return v_po;
end $$;

create or replace function public.record_receipt(p_po_id text, p_line_id bigint, p_qty int, p_idem text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_name text := coalesce(public.my_display_name(), '');
  v_po public.purchase_orders%rowtype;
  v_line public.po_lines%rowtype;
  v_remaining int;
  v_value numeric;
  v_ord int; v_got int;
  v_item public.inventory_items%rowtype;
  v_pay public.transactions%rowtype;
  v_existing bigint;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'BAD_QTY: receipt quantity must be a whole number greater than 0';
  end if;
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'NOT_FOUND: purchase order does not exist';
  end if;
  if v_po.status = 'Cancelled' then
    raise exception 'BAD_STATE: order is cancelled - no receipts allowed';
  end if;
  if v_po.status = 'Draft' then
    raise exception 'BAD_STATE: send the order to the supplier before recording a receipt';
  end if;
  if v_po.status = 'Received' then
    raise exception 'BAD_STATE: order is already fully received';
  end if;
  select * into v_line from public.po_lines where id = p_line_id and po_id = p_po_id for update;
  if not found then
    raise exception 'NOT_FOUND: order line does not exist';
  end if;
  v_remaining := v_line.quantity - v_line.received_qty;
  if v_remaining <= 0 then
    raise exception 'NO_REMAINING: line is already fully received';
  end if;
  if p_qty > v_remaining then
    raise exception 'OVER_RECEIPT: only % still outstanding - % would double-count stock', v_remaining, p_qty;
  end if;

  -- Idempotent retry: same actor + key returns the prior outcome, no double count.
  if nullif(p_idem, '') is not null then
    select id into v_existing from public.receipts
      where created_by = v_actor and idempotency_key = nullif(p_idem, '');
    if found then
      return jsonb_build_object('duplicate', true, 'po_status', v_po.status);
    end if;
  end if;

  insert into public.receipts (po_id, line_id, qty, created_by, idempotency_key)
    values (p_po_id, p_line_id, p_qty, v_actor, nullif(p_idem, ''));

  update public.po_lines set received_qty = received_qty + p_qty where id = p_line_id;

  select coalesce(sum(quantity), 0), coalesce(sum(received_qty), 0)
    into v_ord, v_got from public.po_lines where po_id = p_po_id;
  if v_got >= v_ord and v_ord > 0 then
    update public.purchase_orders set status = 'Received', received = true, received_date = current_date, updated_at = now() where id = p_po_id;
    v_po.status := 'Received';
  elsif v_got > 0 then
    update public.purchase_orders set status = 'Partially Received', received_date = current_date, updated_at = now() where id = p_po_id;
    v_po.status := 'Partially Received';
  end if;

  -- Stock: match Item + Unit, else create the SKU. Amount tracks running
  -- total only; costing method is an open owner decision, not encoded here.
  v_value := p_qty * v_line.supplier_price;
  select * into v_item from public.inventory_items
    where business_unit = v_po.business_unit and lower(item) = lower(v_line.item)
    for update;
  if not found then
    insert into public.inventory_items
      (business_unit, type, item, category, quantity, amount, supplier,
       supplier_price, retail_price, reorder_level, created_by)
    values
      (v_po.business_unit,
       case v_po.business_unit
         when 'Pharmacy' then 'Pharmacy'
         when 'PhilHealth Gamot' then 'Pharmacy'
         when 'Diagnostic Center' then 'Laboratory'
         when 'Animal Bite Center' then 'Laboratory'
         when 'PhilHealth Yakap/Konsulta' then 'Laboratory'
         when 'Dialysis Center' then 'Dialysis'
         else 'Admin' end,
       v_line.item, 'Medical Supplies', p_qty, v_value, v_po.supplier,
       v_line.supplier_price, 0, 10, v_actor)
    returning * into v_item;
  else
    update public.inventory_items
      set quantity = quantity + p_qty, amount = amount + v_value, updated_at = now()
      where id = v_item.id returning * into v_item;
  end if;
  insert into public.stock_moves (item_id, delta, reason, actor_staff_id)
    values (v_item.id, p_qty, 'P.O. receipt ' || v_po.po_no, v_actor);

  -- Payable recognition as a review-queued transaction row. This is an
  -- operational record, NOT a posted journal entry: posting journals
  -- remains blocked until Gate-1 accounting decisions are approved.
  insert into public.transactions
    (date, business_unit, classification, kind,
     item, category, supplier, supplier_price, retail_price, quantity, amount,
     account_code, account_name, entered_by, created_by, status, remarks)
  values
    (current_date, v_po.business_unit, 'Liability', 'Journal',
     'Supplier billing - ' || v_po.po_no || ' (' || v_line.item || ' x' || p_qty || ')',
     'Medical Supplies', v_po.supplier, v_line.supplier_price, 0, p_qty, v_value,
     '2000', 'Accounts Payable', v_name, v_actor, 'For Accountant Review',
     'Auto-queued from P.O. receipt ' || v_po.po_no || ' - awaiting accountant review, not posted')
  returning * into v_pay;

  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, v_name, 'P.O. receipt recorded', v_po.po_no,
            v_line.item || ' x' || p_qty || ' received; stock updated; ' || v_pay.id || ' queued for review');
  return jsonb_build_object('duplicate', false, 'po_status', v_po.status, 'payable_id', v_pay.id);
end $$;

create or replace function public.add_inventory_item(p jsonb, p_idem text default null)
returns public.inventory_items
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_item public.inventory_items%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if not exists (select 1 from public.business_units where name = p->>'business_unit') then
    raise exception 'BAD_UNIT: unknown business unit';
  end if;
  if coalesce(p->>'type', '') not in ('Laboratory', 'Pharmacy', 'Dialysis', 'Admin') then
    raise exception 'BAD_TYPE: invalid inventory type';
  end if;
  if coalesce(nullif(btrim(p->>'item'), ''), '') = '' then
    raise exception 'BAD_ITEM: item name is required';
  end if;
  if coalesce((p->>'quantity')::int, -1) < 0 then
    raise exception 'BAD_QTY: quantity must be a whole number, zero or more';
  end if;
  if coalesce((p->>'supplier_price')::numeric, -1) < 0 or coalesce((p->>'retail_price')::numeric, -1) < 0 then
    raise exception 'BAD_PRICE: prices cannot be negative';
  end if;
  insert into public.inventory_items
    (business_unit, type, item, category, quantity, amount, supplier,
     supplier_price, retail_price, reorder_level, created_by)
  values
    (p->>'business_unit', p->>'type', btrim(p->>'item'),
     coalesce(p->>'category', 'Medical Supplies'),
     coalesce((p->>'quantity')::int, 0),
     coalesce((p->>'amount')::numeric, 0),
     coalesce(btrim(p->>'supplier'), ''),
     coalesce((p->>'supplier_price')::numeric, 0),
     coalesce((p->>'retail_price')::numeric, 0),
     coalesce((p->>'reorder_level')::int, 10), v_actor)
  on conflict (business_unit, item) do nothing
  returning * into v_item;
  if not found then
    raise exception 'DUPLICATE: that item already exists in this business unit';
  end if;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Inventory item added', v_item.id,
            v_item.item || ' x' || v_item.quantity);
  return v_item;
end $$;

create or replace function public.adjust_stock(p_item_id text, p_delta int, p_reason text)
returns public.inventory_items
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_item public.inventory_items%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  if coalesce(p_delta, 0) = 0 then
    raise exception 'BAD_DELTA: adjustment cannot be zero';
  end if;
  if coalesce(nullif(btrim(p_reason), ''), '') = '' then
    raise exception 'NO_REASON: a reason is required for every adjustment';
  end if;
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'NOT_FOUND: inventory item does not exist';
  end if;
  if v_item.quantity + p_delta < 0 then
    raise exception 'NEGATIVE_STOCK: adjustment would take quantity below zero';
  end if;
  update public.inventory_items
    set quantity = quantity + p_delta, updated_at = now()
    where id = p_item_id returning * into v_item;
  insert into public.stock_moves (item_id, delta, reason, actor_staff_id)
    values (p_item_id, p_delta, btrim(p_reason), v_actor);
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Inventory adjusted',
            v_item.item, (case when p_delta > 0 then '+' else '' end) || p_delta || ' - ' || btrim(p_reason));
  return v_item;
end $$;

create or replace function public.update_inventory_item(p_id text, p jsonb)
returns public.inventory_items
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.my_staff_id();
  v_item public.inventory_items%rowtype;
begin
  if v_actor is null then
    raise exception 'NOT_LINKED: signed-in account has no linked staff record';
  end if;
  select * into v_item from public.inventory_items where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: inventory item does not exist';
  end if;
  -- Quantity is never directly writable: adjustments and receipts only.
  if p ? 'quantity' then
    raise exception 'LOCKED_FIELD: quantity changes only through adjustments or receipts';
  end if;
  update public.inventory_items set
    type = case when coalesce(p->>'type', '') in ('Laboratory', 'Pharmacy', 'Dialysis', 'Admin') then p->>'type' else type end,
    category = case when coalesce(nullif(btrim(p->>'category'), ''), '') <> '' then btrim(p->>'category') else category end,
    supplier = case when p ? 'supplier' then btrim(p->>'supplier') else supplier end,
    supplier_price = case when p ? 'supplier_price' and (p->>'supplier_price')::numeric >= 0 then (p->>'supplier_price')::numeric else supplier_price end,
    retail_price = case when p ? 'retail_price' and (p->>'retail_price')::numeric >= 0 then (p->>'retail_price')::numeric else retail_price end,
    reorder_level = case when p ? 'reorder_level' and (p->>'reorder_level')::int >= 0 then (p->>'reorder_level')::int else reorder_level end,
    updated_at = now()
  where id = p_id returning * into v_item;
  insert into public.audit_events (actor_staff_id, actor_name, action, ref, detail)
    values (v_actor, coalesce(public.my_display_name(), ''), 'Inventory item edited', v_item.item, 'non-quantity fields');
  return v_item;
end $$;

revoke all on function public.create_purchase_order(jsonb, text) from public, anon;
revoke all on function public.send_purchase_order(text) from public, anon;
revoke all on function public.cancel_purchase_order(text) from public, anon;
revoke all on function public.record_receipt(text, bigint, int, text) from public, anon;
revoke all on function public.add_inventory_item(jsonb, text) from public, anon;
revoke all on function public.adjust_stock(text, int, text) from public, anon;
revoke all on function public.update_inventory_item(text, jsonb) from public, anon;
grant execute on function public.create_purchase_order(jsonb, text) to authenticated;
grant execute on function public.send_purchase_order(text) to authenticated;
grant execute on function public.cancel_purchase_order(text) to authenticated;
grant execute on function public.record_receipt(text, bigint, int, text) to authenticated;
grant execute on function public.add_inventory_item(jsonb, text) to authenticated;
grant execute on function public.adjust_stock(text, int, text) to authenticated;
grant execute on function public.update_inventory_item(text, jsonb) to authenticated;
