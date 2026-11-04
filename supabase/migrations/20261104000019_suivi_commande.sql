-- Suivi de commande sans compte : numéro + e-mail de la commande. Ne renvoie que l'état (aucune adresse,
-- aucun montant détaillé) et rien du tout si l'un des deux ne correspond pas.
create or replace function public.order_track(p_number text, p_email text)
returns table (number text, status text, market text, created_at timestamptz, tracking text,
               shipment_status text, shipment_eta date)
language sql stable security definer set search_path = '' as $$
  select o.number, o.status, o.market, o.created_at, o.tracking, s.status, s.eta
  from public.orders o
  left join lateral (
    select sh.status, sh.eta from public.shipments sh where sh.order_id = o.id order by sh.created_at desc limit 1
  ) s on true
  where upper(btrim(p_number)) ~ '^SIL-[0-9]{1,9}$'
    and o.number = upper(btrim(p_number))
    and lower(o.email) = lower(btrim(p_email));
$$;
revoke execute on function public.order_track(text, text) from public;
grant execute on function public.order_track(text, text) to anon, authenticated;
