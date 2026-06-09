-- Bzor Invoice — initial schema
-- Single-user invoicing: clients, contacts, estimates/invoices, line items, payments.

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
create type doc_type as enum ('estimate', 'invoice');
create type doc_status as enum (
  'draft', 'sent', 'approved', 'declined', 'partial', 'paid', 'overdue', 'void'
);
create type bank_info_mode as enum ('none', 'domestic', 'international');
create type discount_type as enum ('amount', 'percent');

-- ── updated_at helper ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Settings (singleton) ───────────────────────────────────────────────────
create table settings (
  id int primary key default 1,
  business_name text not null default '',
  business_address text not null default '',
  business_email text not null default '',
  logo_url text,
  base_currency text not null default 'USD',
  bank_domestic text not null default '',
  bank_international text not null default '',
  default_notes text not null default '',
  default_net_terms int not null default 30,
  invoice_prefix text not null default 'INV',
  estimate_prefix text not null default 'EST',
  invoice_counter int not null default 1,
  estimate_counter int not null default 1,
  number_padding int not null default 4,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

insert into settings (id) values (1) on conflict do nothing;

-- ── Clients ────────────────────────────────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  currency text not null default 'USD',
  default_net_terms int,
  default_notes text not null default '',
  created_at timestamptz not null default now()
);

-- ── Contacts ───────────────────────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  title text not null default '',
  is_primary boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index contacts_client_id_idx on contacts(client_id);

-- ── Documents (estimates + invoices) ───────────────────────────────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  type doc_type not null,
  number text not null,
  status doc_status not null default 'draft',
  client_id uuid not null references clients(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  po_number text not null default '',
  subject text not null default '',
  issue_date date not null default current_date,
  due_date date,
  net_terms int,
  currency text not null default 'USD',
  discount_type discount_type not null default 'amount',
  discount_value numeric(14, 2) not null default 0,
  notes text not null default '',
  bank_info_mode bank_info_mode not null default 'none',
  base_currency text not null default 'USD',
  fx_rate numeric(18, 8) not null default 1,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  source_estimate_id uuid references documents(id) on delete set null,
  share_token uuid not null default gen_random_uuid(),
  approved_at timestamptz,
  declined_at timestamptz,
  sent_at timestamptz,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, number)
);
create index documents_client_id_idx on documents(client_id);
create index documents_type_status_idx on documents(type, status);
create unique index documents_share_token_idx on documents(share_token);
create trigger documents_updated_at before update on documents
  for each row execute function set_updated_at();

-- ── Line items ─────────────────────────────────────────────────────────────
create table line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  position int not null default 0,
  description text not null default '',
  quantity numeric(14, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0
);
create index line_items_document_id_idx on line_items(document_id);

-- ── Payments ───────────────────────────────────────────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references documents(id) on delete cascade,
  date date not null default current_date,
  amount numeric(14, 2) not null,
  method text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index payments_invoice_id_idx on payments(invoice_id);

-- ── Atomic document numbering ──────────────────────────────────────────────
-- Bumps the right counter on settings and returns the formatted number,
-- e.g. INV-0007. Called inside the create-document transaction.
create or replace function next_document_number(p_type doc_type)
returns text language plpgsql as $$
declare
  v_prefix text;
  v_counter int;
  v_pad int;
begin
  select number_padding into v_pad from settings where id = 1;
  if p_type = 'invoice' then
    update settings set invoice_counter = invoice_counter + 1
      where id = 1 returning invoice_prefix, invoice_counter - 1 into v_prefix, v_counter;
  else
    update settings set estimate_counter = estimate_counter + 1
      where id = 1 returning estimate_prefix, estimate_counter - 1 into v_prefix, v_counter;
  end if;
  return v_prefix || '-' || lpad(v_counter::text, v_pad, '0');
end;
$$;

-- ── Public share: read an estimate by token (no auth) ──────────────────────
create or replace function get_shared_document(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_doc documents;
  v_result jsonb;
begin
  select * into v_doc from documents where share_token = p_token;
  if v_doc.id is null then
    return null;
  end if;

  select jsonb_build_object(
    'document', to_jsonb(v_doc) - 'pdf_path',
    'line_items', coalesce(
      (select jsonb_agg(to_jsonb(li) order by li.position)
       from line_items li where li.document_id = v_doc.id), '[]'::jsonb),
    'client', (select to_jsonb(c) from clients c where c.id = v_doc.client_id),
    'business', (select jsonb_build_object(
        'business_name', business_name,
        'business_address', business_address,
        'logo_url', logo_url,
        'bank_domestic', bank_domestic,
        'bank_international', bank_international
      ) from settings where id = 1)
  ) into v_result;

  return v_result;
end;
$$;

-- ── Public share: approve / decline an estimate (no auth) ──────────────────
create or replace function respond_to_estimate(p_token uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_doc documents;
begin
  select * into v_doc from documents where share_token = p_token and type = 'estimate';
  if v_doc.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_doc.status in ('approved', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'already_'  || v_doc.status::text);
  end if;

  if p_approve then
    update documents set status = 'approved', approved_at = now() where id = v_doc.id;
  else
    update documents set status = 'declined', declined_at = now() where id = v_doc.id;
  end if;

  return jsonb_build_object('ok', true, 'status', case when p_approve then 'approved' else 'declined' end);
end;
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Single-user app: any authenticated session (sign-in is allowlisted in the
-- app layer) gets full access. Public share paths go through the SECURITY
-- DEFINER functions above, which are granted to anon below.
alter table settings   enable row level security;
alter table clients    enable row level security;
alter table contacts   enable row level security;
alter table documents  enable row level security;
alter table line_items enable row level security;
alter table payments   enable row level security;

create policy app_all on settings   for all to authenticated using (true) with check (true);
create policy app_all on clients    for all to authenticated using (true) with check (true);
create policy app_all on contacts   for all to authenticated using (true) with check (true);
create policy app_all on documents  for all to authenticated using (true) with check (true);
create policy app_all on line_items for all to authenticated using (true) with check (true);
create policy app_all on payments   for all to authenticated using (true) with check (true);

grant execute on function get_shared_document(uuid) to anon, authenticated;
grant execute on function respond_to_estimate(uuid, boolean) to anon, authenticated;
grant execute on function next_document_number(doc_type) to authenticated;
