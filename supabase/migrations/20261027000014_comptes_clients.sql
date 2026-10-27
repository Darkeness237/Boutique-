-- Comptes clients (e-mail et mot de passe, ou Google) et adresse de livraison.
-- Chaque client ne lit et ne modifie que son propre profil et ses propres commandes (RLS).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (length(first_name) <= 60),
  last_name text check (length(last_name) <= 60),
  phone text check (phone ~ '^\+?[0-9 .()-]{6,20}$'),
  country text not null default 'fr' check (country in ('fr', 'cm')),
  address_line1 text check (length(address_line1) <= 120),
  address_line2 text check (length(address_line2) <= 120),
  postal_code text check (length(postal_code) <= 10),
  city text check (length(city) <= 60),
  -- Au Cameroun, la ville de livraison est une zone desservie par le livreur.
  cm_zone text references public.cm_delivery_zones(slug),
  -- Consentement marketing (RGPD) : la date sert de preuve.
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_cm_zone_idx on public.profiles (cm_zone);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, country, address_line1, address_line2, postal_code, city, cm_zone,
              marketing_opt_in) on public.profiles to authenticated;
create policy "profil lisible par son titulaire" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profil modifiable par son titulaire" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function private.profiles_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  end if;
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.profiles_touch();

-- Crée le profil à l'inscription. Les champs de livraison transitent par les métadonnées de
-- l'inscription puis en sont retirés, pour ne pas les garder dans le jeton de session.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  d jsonb := coalesce(m->'livraison', '{}'::jsonb);
  v_country text := case when d->>'country' = 'cm' then 'cm' else 'fr' end;
  v_phone text := nullif(btrim(d->>'phone'), '');
  v_zone text := nullif(d->>'cm_zone', '');
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 .()-]{6,20}$' then
    v_phone := null;
  end if;
  if v_zone is not null and not exists (select 1 from public.cm_delivery_zones z where z.slug = v_zone) then
    v_zone := null;
  end if;

  insert into public.profiles (id, first_name, last_name, phone, country, address_line1, address_line2,
                               postal_code, city, cm_zone, marketing_opt_in, marketing_opt_in_at)
  values (
    new.id,
    left(nullif(btrim(coalesce(m->>'first_name', m->>'given_name')), ''), 60),
    left(nullif(btrim(coalesce(d->>'last_name', m->>'family_name')), ''), 60),
    v_phone,
    v_country,
    left(nullif(btrim(d->>'address_line1'), ''), 120),
    left(nullif(btrim(d->>'address_line2'), ''), 120),
    left(nullif(btrim(d->>'postal_code'), ''), 10),
    left(nullif(btrim(d->>'city'), ''), 60),
    case when v_country = 'cm' then v_zone end,
    coalesce((m->>'newsletter')::boolean, false),
    case when coalesce((m->>'newsletter')::boolean, false) then now() end
  );

  if m ? 'livraison' then
    update auth.users set raw_user_meta_data = m - 'livraison' where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Commandes rattachées au compte (facultatif : on peut commander sans compte).
alter table public.orders add column user_id uuid references auth.users(id) on delete set null;
create index orders_user_idx on public.orders (user_id, created_at desc);

grant select (id, number, market, status, currency, subtotal, shipping, total, tracking, created_at, user_id)
  on public.orders to authenticated;
grant select (order_id, product_id, name, qty, unit_price) on public.order_items to authenticated;
create policy "commandes lisibles par leur client" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "lignes lisibles par leur client" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- Le webhook transmet l'identifiant du compte connecté au moment du paiement, s'il y en avait un.
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
  v_user uuid;
begin
  perform private.assert_service_token(p_token, 'orders');

  select number into v_number from public.orders where stripe_session_id = p_order->>'stripe_session_id';
  if v_number is not null then
    return v_number;
  end if;

  if p_order->>'user_id' ~ '^[0-9a-f-]{36}$' then
    select id into v_user from auth.users where id = (p_order->>'user_id')::uuid;
  end if;

  insert into public.orders (market, supplier_vat, currency, subtotal, shipping, total, email, customer_name,
                             phone, shipping_address, stripe_session_id, stripe_payment_intent, user_id)
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
          p_order->>'stripe_payment_intent',
          v_user)
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

-- Droit à l'effacement (RGPD) : supprime le compte et le profil. Les commandes restent pour la
-- comptabilité (obligation de conservation) mais ne sont plus rattachées à personne.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'non connecté' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
