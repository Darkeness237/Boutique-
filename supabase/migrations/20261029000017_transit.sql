-- Espace transitaire et administration du transit vers le Cameroun.
--
-- Rôles : « admin » (le gérant) et « forwarder » (un employé d'une société de transit).
-- Un compte reçoit son rôle par invitation : l'admin invite une adresse e-mail ; dès que cette
-- adresse est confirmée (inscription par e-mail ou Google), le rôle est attribué automatiquement.
-- Un transitaire ne voit que les expéditions confiées à sa société ; il ne les modifie qu'à travers
-- des fonctions contrôlées (réception, étapes, documents, messages).
-- Le script peut être relancé.

-- Sociétés de transit ------------------------------------------------------------------------
create table if not exists public.forwarders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  contact_email text check (length(contact_email) <= 254),
  phone text check (length(phone) <= 40),
  warehouse_address text check (length(warehouse_address) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'forwarder')),
  forwarder_id uuid references public.forwarders(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((role = 'forwarder') = (forwarder_id is not null))
);
create index if not exists staff_roles_forwarder_idx on public.staff_roles (forwarder_id);

create table if not exists public.staff_invites (
  email text primary key check (email = lower(email) and length(email) <= 254),
  role text not null check (role in ('admin', 'forwarder')),
  forwarder_id uuid references public.forwarders(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check ((role = 'forwarder') = (forwarder_id is not null))
);
create index if not exists staff_invites_forwarder_idx on public.staff_invites (forwarder_id);

-- Contrôles d'accès (utilisés par les politiques RLS) ----------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_forwarder()
returns uuid language sql stable security definer set search_path = '' as $$
  select forwarder_id from public.staff_roles where user_id = auth.uid() and role = 'forwarder';
$$;

-- Expéditions -----------------------------------------------------------------------------
create sequence if not exists public.shipment_number_seq start 101;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('EXP-' || nextval('public.shipment_number_seq')),
  forwarder_id uuid not null references public.forwarders(id),
  order_id uuid references public.orders(id) on delete set null,
  order_number text check (length(order_number) <= 20),
  customer_name text check (length(customer_name) <= 120),
  customer_city text check (length(customer_city) <= 60),
  contents text not null check (length(contents) between 1 and 2000),
  supplier_tracking text check (length(supplier_tracking) <= 120),
  expected_parcels smallint check (expected_parcels between 1 and 999),
  expected_weight_kg numeric(7,2) check (expected_weight_kg > 0),
  received_parcels smallint check (received_parcels between 0 and 999),
  received_weight_kg numeric(7,2) check (received_weight_kg >= 0),
  received_condition text check (received_condition in ('ok', 'abime', 'incomplet')),
  received_at timestamptz,
  transport_mode text check (transport_mode in ('aerien', 'maritime')),
  awb_number text check (length(awb_number) <= 60),
  carrier text check (length(carrier) <= 80),
  departed_at timestamptz,
  eta date,
  arrived_at timestamptz,
  delivered_at timestamptz,
  status text not null default 'attendu' check (status in (
    'attendu', 'recu', 'en_preparation', 'expedie', 'arrive_cameroun', 'dedouane', 'remis_livreur', 'livre', 'incident')),
  forwarder_activity_at timestamptz,
  admin_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipments_forwarder_idx on public.shipments (forwarder_id, status);
create index if not exists shipments_order_idx on public.shipments (order_id);

-- Fil de l'expédition : changements d'étape, messages, documents ajoutés.
create table if not exists public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in ('statut', 'message', 'document')),
  status text,
  location text check (length(location) <= 120),
  message text check (length(message) <= 2000),
  author uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('admin', 'forwarder')),
  created_at timestamptz not null default now()
);
create index if not exists shipment_events_idx on public.shipment_events (shipment_id, created_at);

create table if not exists public.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in (
    'preuve_export', 'lta', 'facture_transitaire', 'declaration_douane', 'photo_reception', 'bon_livraison', 'autre')),
  storage_path text not null unique,
  filename text not null check (length(filename) <= 200),
  size_bytes integer check (size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploader_role text not null check (uploader_role in ('admin', 'forwarder')),
  created_at timestamptz not null default now()
);
create index if not exists shipment_documents_idx on public.shipment_documents (shipment_id);

create or replace function public.can_access_shipment(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.shipments s where s.id = p_id and s.forwarder_id = public.my_forwarder());
$$;

-- Droits et politiques ----------------------------------------------------------------------
alter table public.forwarders enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipment_documents enable row level security;
revoke all on public.forwarders, public.staff_roles, public.staff_invites, public.shipments,
  public.shipment_events, public.shipment_documents from anon, authenticated;
revoke all on sequence public.shipment_number_seq from anon, authenticated;

grant select, insert, update on public.forwarders to authenticated;
grant select, delete on public.staff_roles to authenticated;
grant select, delete on public.staff_invites to authenticated;
grant select, insert, update on public.shipments to authenticated;
grant usage on sequence public.shipment_number_seq to authenticated;
grant select on public.shipment_events, public.shipment_documents to authenticated;

drop policy if exists "admin : sociétés" on public.forwarders;
create policy "admin : sociétés" on public.forwarders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "transitaire : sa société" on public.forwarders;
create policy "transitaire : sa société" on public.forwarders for select to authenticated
  using (id = public.my_forwarder());

drop policy if exists "rôles : soi-même ou admin" on public.staff_roles;
create policy "rôles : soi-même ou admin" on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "rôles : retrait par l'admin" on public.staff_roles;
create policy "rôles : retrait par l'admin" on public.staff_roles for delete to authenticated
  using (public.is_admin() and user_id <> (select auth.uid()));

drop policy if exists "invitations : admin" on public.staff_invites;
create policy "invitations : admin" on public.staff_invites for select to authenticated using (public.is_admin());
drop policy if exists "invitations : suppression admin" on public.staff_invites;
create policy "invitations : suppression admin" on public.staff_invites for delete to authenticated using (public.is_admin());

drop policy if exists "expéditions : admin" on public.shipments;
create policy "expéditions : admin" on public.shipments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "expéditions : transitaire" on public.shipments;
create policy "expéditions : transitaire" on public.shipments for select to authenticated
  using (forwarder_id = public.my_forwarder());

drop policy if exists "fil : accès à l'expédition" on public.shipment_events;
create policy "fil : accès à l'expédition" on public.shipment_events for select to authenticated
  using (public.can_access_shipment(shipment_id));
drop policy if exists "documents : accès à l'expédition" on public.shipment_documents;
create policy "documents : accès à l'expédition" on public.shipment_documents for select to authenticated
  using (public.can_access_shipment(shipment_id));

-- Invitations ------------------------------------------------------------------------------
create or replace function private.apply_staff_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inv public.staff_invites;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  select * into inv from public.staff_invites where email = lower(new.email) and accepted_at is null;
  if found then
    insert into public.staff_roles (user_id, role, forwarder_id) values (new.id, inv.role, inv.forwarder_id)
    on conflict (user_id) do update set role = excluded.role, forwarder_id = excluded.forwarder_id;
    update public.staff_invites set accepted_at = now() where email = inv.email;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_staff_invite on auth.users;
create trigger on_auth_user_staff_invite after insert or update of email_confirmed_at on auth.users
  for each row execute function private.apply_staff_invite();

-- Invite une adresse (et attribue le rôle tout de suite si le compte existe déjà).
create or replace function public.admin_invite(p_email text, p_role text, p_forwarder uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'adresse invalide'; end if;
  if p_role not in ('admin', 'forwarder') then raise exception 'rôle invalide'; end if;
  insert into public.staff_invites (email, role, forwarder_id, accepted_at)
  values (v_email, p_role, case when p_role = 'forwarder' then p_forwarder end, null)
  on conflict (email) do update set role = excluded.role, forwarder_id = excluded.forwarder_id, accepted_at = null;
  select id into v_user from auth.users where lower(email) = v_email and email_confirmed_at is not null;
  if v_user is not null then
    insert into public.staff_roles (user_id, role, forwarder_id)
    values (v_user, p_role, case when p_role = 'forwarder' then p_forwarder end)
    on conflict (user_id) do update set role = excluded.role, forwarder_id = excluded.forwarder_id;
    update public.staff_invites set accepted_at = now() where email = v_email;
    return 'actif';
  end if;
  return 'invite';
end;
$$;

-- Comptes rattachés à chaque société (pour l'admin) avec leur e-mail.
create or replace function public.admin_staff()
returns table (user_id uuid, email text, role text, forwarder_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.user_id, u.email::text, r.role, r.forwarder_id, r.created_at
  from public.staff_roles r join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at;
$$;

-- Actions sur une expédition ------------------------------------------------------------------
create or replace function private.actor_role(p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_admin() then return 'admin'; end if;
  if exists (select 1 from public.shipments where id = p_id and forwarder_id = public.my_forwarder()) then
    return 'forwarder';
  end if;
  raise exception 'expédition introuvable' using errcode = '42501';
end;
$$;

-- Réception à l'entrepôt d'Île-de-France.
create or replace function public.shipment_receive(p_id uuid, p_parcels integer, p_weight numeric,
  p_condition text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := private.actor_role(p_id);
begin
  if p_condition not in ('ok', 'abime', 'incomplet') then raise exception 'état invalide'; end if;
  update public.shipments set
    status = case when status = 'attendu' then 'recu' else status end,
    received_parcels = p_parcels, received_weight_kg = p_weight, received_condition = p_condition,
    received_at = coalesce(received_at, now()), updated_at = now(),
    forwarder_activity_at = case when v_role = 'forwarder' then now() else forwarder_activity_at end
  where id = p_id;
  insert into public.shipment_events (shipment_id, kind, status, location, message, author, author_role)
  values (p_id, 'statut', 'recu', 'Entrepôt Île-de-France',
    concat_ws(' · ', p_parcels || ' colis', p_weight || ' kg',
      case p_condition when 'ok' then 'en bon état' when 'abime' then 'colis abîmé' else 'incomplet' end,
      nullif(left(btrim(p_note), 1500), '')),
    auth.uid(), v_role);
end;
$$;

-- Étape d'acheminement (et informations de transport associées).
create or replace function public.shipment_step(p_id uuid, p_status text, p_location text, p_note text,
  p_mode text, p_awb text, p_carrier text, p_eta date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := private.actor_role(p_id);
begin
  if p_status not in ('en_preparation', 'expedie', 'arrive_cameroun', 'dedouane', 'remis_livreur', 'livre', 'incident')
    and not (v_role = 'admin' and p_status in ('attendu', 'recu')) then
    raise exception 'étape invalide';
  end if;
  update public.shipments set
    status = p_status,
    transport_mode = coalesce(nullif(p_mode, ''), transport_mode),
    awb_number = coalesce(nullif(left(btrim(p_awb), 60), ''), awb_number),
    carrier = coalesce(nullif(left(btrim(p_carrier), 80), ''), carrier),
    eta = coalesce(p_eta, eta),
    departed_at = case when p_status = 'expedie' then coalesce(departed_at, now()) else departed_at end,
    arrived_at = case when p_status = 'arrive_cameroun' then coalesce(arrived_at, now()) else arrived_at end,
    delivered_at = case when p_status = 'livre' then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now(),
    forwarder_activity_at = case when v_role = 'forwarder' then now() else forwarder_activity_at end
  where id = p_id;
  insert into public.shipment_events (shipment_id, kind, status, location, message, author, author_role)
  values (p_id, 'statut', p_status, nullif(left(btrim(p_location), 120), ''), nullif(left(btrim(p_note), 2000), ''),
    auth.uid(), v_role);
end;
$$;

create or replace function public.shipment_message(p_id uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := private.actor_role(p_id);
begin
  if length(btrim(coalesce(p_message, ''))) = 0 then raise exception 'message vide'; end if;
  insert into public.shipment_events (shipment_id, kind, message, author, author_role)
  values (p_id, 'message', left(btrim(p_message), 2000), auth.uid(), v_role);
  if v_role = 'forwarder' then
    update public.shipments set forwarder_activity_at = now() where id = p_id;
  end if;
end;
$$;

-- Enregistre un document déjà déposé dans le stockage (dossier de l'expédition).
create or replace function public.shipment_add_document(p_id uuid, p_kind text, p_path text, p_filename text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.actor_role(p_id);
  v_size integer;
begin
  if p_path !~ ('^' || p_id::text || '/[0-9a-f-]{36}\.[a-z0-9]{2,5}$') then raise exception 'chemin invalide'; end if;
  select (metadata->>'size')::integer into v_size from storage.objects where bucket_id = 'transit' and name = p_path;
  if not found then raise exception 'fichier introuvable'; end if;
  insert into public.shipment_documents (shipment_id, kind, storage_path, filename, size_bytes, uploaded_by, uploader_role)
  values (p_id, p_kind, p_path, left(p_filename, 200), v_size, auth.uid(), v_role);
  insert into public.shipment_events (shipment_id, kind, message, author, author_role)
  values (p_id, 'document', p_kind || ' : ' || left(p_filename, 200), auth.uid(), v_role);
  if v_role = 'forwarder' then
    update public.shipments set forwarder_activity_at = now() where id = p_id;
  end if;
end;
$$;

revoke execute on function public.admin_invite(text, text, uuid), public.admin_staff(),
  public.shipment_receive(uuid, integer, numeric, text, text),
  public.shipment_step(uuid, text, text, text, text, text, text, date),
  public.shipment_message(uuid, text), public.shipment_add_document(uuid, text, text, text),
  public.is_admin(), public.my_forwarder(), public.can_access_shipment(uuid) from public, anon;
grant execute on function public.admin_invite(text, text, uuid), public.admin_staff(),
  public.shipment_receive(uuid, integer, numeric, text, text),
  public.shipment_step(uuid, text, text, text, text, text, text, date),
  public.shipment_message(uuid, text), public.shipment_add_document(uuid, text, text, text),
  public.is_admin(), public.my_forwarder(), public.can_access_shipment(uuid) to authenticated;
revoke execute on function private.actor_role(uuid), private.apply_staff_invite() from public, anon, authenticated;

-- Stockage privé des documents : un dossier par expédition, 15 Mo maximum par fichier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transit', 'transit', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_transit_path(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/' and public.can_access_shipment(split_part(p_name, '/', 1)::uuid);
$$;
revoke execute on function public.can_access_transit_path(text) from public, anon;
grant execute on function public.can_access_transit_path(text) to authenticated;

drop policy if exists "transit : lecture" on storage.objects;
create policy "transit : lecture" on storage.objects for select to authenticated
  using (bucket_id = 'transit' and public.can_access_transit_path(name));
drop policy if exists "transit : dépôt" on storage.objects;
create policy "transit : dépôt" on storage.objects for insert to authenticated
  with check (bucket_id = 'transit' and public.can_access_transit_path(name));
