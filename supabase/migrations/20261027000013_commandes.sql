-- Commandes payées (Stripe en France, Mobile Money au Cameroun plus tard).
-- Aucune lecture ni écriture publique : seule la fonction appelée par le webhook Stripe, protégée
-- par un jeton de service, enregistre une commande. Le client ne voit que le résumé de la sienne.

create extension if not exists pgcrypto with schema extensions;

-- Jetons de service (empreinte SHA-256 seulement), chacun limité à un usage.
create table private.service_tokens (
  token_hash text primary key,
  scope text not null check (scope in ('orders')),
  created_at timestamptz not null default now()
);

create or replace function private.assert_service_token(p_token text, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) < 32 or not exists (
    select 1 from private.service_tokens
    where scope = p_scope and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception 'jeton de service invalide' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function private.assert_service_token(text, text) from public, anon, authenticated;

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('SIL-' || nextval('public.order_number_seq')),
  market text not null check (market in ('fr', 'cm')),
  status text not null default 'payee'
    check (status in ('payee', 'commandee_fournisseur', 'expediee', 'livree', 'annulee', 'remboursee')),
  -- France : achat fournisseur avec TVA ; Cameroun : achat hors TVA à l'export.
  supplier_vat text not null check (supplier_vat in ('ttc', 'ht_export')),
  currency text not null check (currency in ('eur', 'xaf')),
  subtotal integer not null check (subtotal >= 0),
  shipping integer not null check (shipping >= 0),
  total integer not null check (total >= 0),
  email text not null check (length(email) <= 254),
  customer_name text check (length(customer_name) <= 200),
  phone text check (length(phone) <= 40),
  shipping_address jsonb not null default '{}'::jsonb,
  stripe_session_id text unique check (stripe_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  stripe_payment_intent text,
  tracking text,
  created_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id),
  ean text,
  name text not null,
  qty integer not null check (qty between 1 and 10),
  unit_price integer not null check (unit_price >= 0),
  -- Offre fournisseur retenue au moment de la commande (pour le bon de commande).
  supplier_id text,
  supplier_sku text,
  supplier_cost_cents integer
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- Enregistre une commande payée. Idempotent : Stripe peut renvoyer le même événement plusieurs fois.
create or replace function public.record_paid_order(p_token text, p_order jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_number text;
  v_market text := p_order->>'market';
begin
  perform private.assert_service_token(p_token, 'orders');

  select number into v_number from public.orders where stripe_session_id = p_order->>'stripe_session_id';
  if v_number is not null then
    return v_number;
  end if;

  insert into public.orders (market, supplier_vat, currency, subtotal, shipping, total, email, customer_name,
                             phone, shipping_address, stripe_session_id, stripe_payment_intent)
  values (v_market,
          case when v_market = 'cm' then 'ht_export' else 'ttc' end,
          p_order->>'currency',
          (p_order->>'subtotal')::integer,
          (p_order->>'shipping')::integer,
          (p_order->>'total')::integer,
          p_order->>'email',
          left(p_order->>'customer_name', 200),
          left(p_order->>'phone', 40),
          coalesce(p_order->'shipping_address', '{}'::jsonb),
          p_order->>'stripe_session_id',
          p_order->>'stripe_payment_intent')
  returning id, number into v_id, v_number;

  insert into public.order_items (order_id, product_id, ean, name, qty, unit_price, supplier_id, supplier_sku,
                                  supplier_cost_cents)
  select v_id, p.id, p.ean, left(i.name, 300), i.qty, i.unit_price, best.supplier_id, best.supplier_sku,
         best.cost_cents
  from jsonb_to_recordset(p_order->'items') as i(product_id bigint, name text, qty integer, unit_price integer)
  left join public.products p on p.id = i.product_id
  left join lateral (
    select o.supplier_id, o.supplier_sku, o.cost_cents
    from public.supplier_offers o
    where o.ean = p.ean and o.status = 'ok'
    order by o.in_stock desc, o.cost_cents asc
    limit 1
  ) best on true;

  return v_number;
end;
$$;

-- Résumé affiché sur la page de remerciement (aucune donnée personnelle).
create or replace function public.order_summary(p_session_id text)
returns table (number text, status text, currency text, total integer, items jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select o.number, o.status, o.currency, o.total,
         (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty)) from public.order_items i where i.order_id = o.id)
  from public.orders o
  where p_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$' and o.stripe_session_id = p_session_id;
$$;

revoke execute on function public.record_paid_order(text, jsonb), public.order_summary(text) from public;
grant execute on function public.record_paid_order(text, jsonb), public.order_summary(text) to anon, authenticated;

-- Bons de commande à passer au fournisseur (consultation par le gérant, jamais publique).
create or replace view private.purchase_orders as
select o.number, o.created_at, o.market, o.supplier_vat, o.customer_name, o.phone, o.shipping_address,
       i.supplier_id, i.supplier_sku, i.ean, i.name, i.qty
from public.orders o
join public.order_items i on i.order_id = o.id
where o.status = 'payee'
order by o.created_at;
