-- Galerie de photos officielles (Open Icecat) : plusieurs vues par produit, en plus de la photo principale.
-- Le script peut être relancé.

alter table public.products add column if not exists images text[] not null default '{}';
alter table public.products add column if not exists gallery_checked_at timestamptz;
grant select (images) on public.products to anon, authenticated;

-- Produits dont la galerie reste à chercher (ceux qui ont déjà une photo Icecat, en stock d'abord).
create or replace function public.gallery_todo(p_token text, p_limit integer)
returns table(ean text) language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_import_token(p_token);
  return query
    select p.ean from public.products p
    where p.active and p.ean is not null and p.media_source = 'icecat' and p.gallery_checked_at is null
    order by p.in_stock desc, p.id
    limit least(greatest(p_limit, 1), 5000);
end;
$$;

-- Enregistre les galeries : seules les adresses d'images Icecat sont acceptées, 8 au maximum par produit.
create or replace function public.import_gallery(p_token text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform private.assert_import_token(p_token);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'lot invalide (500 lignes maximum)';
  end if;

  update public.products p set
    images = coalesce((
      select array_agg(u order by i) from (
        select u, i from jsonb_array_elements_text(case when jsonb_typeof(r.images) = 'array' then r.images else '[]'::jsonb end)
          with ordinality as t(u, i)
        where u ~ '^https://images\.icecat\.biz/[A-Za-z0-9/_.-]+$'
        limit 8
      ) s
    ), '{}'),
    gallery_checked_at = now()
  from jsonb_to_recordset(p_rows) as r(ean text, images jsonb)
  where p.ean = r.ean;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.gallery_todo(text, integer) from public;
revoke all on function public.import_gallery(text, jsonb) from public;
grant execute on function public.gallery_todo(text, integer) to anon, authenticated;
grant execute on function public.import_gallery(text, jsonb) to anon, authenticated;
