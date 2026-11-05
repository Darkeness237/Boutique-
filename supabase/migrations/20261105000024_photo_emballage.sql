-- Photo de l'emballage d'origine : repérée dans la galerie Icecat (scripts/emballage-icecat.mjs) et placée
-- juste après la photo principale. Le script peut être relancé.

alter table public.products add column if not exists packaging_checked_at timestamptz;
alter table public.products add column if not exists has_packaging_photo boolean not null default false;

create or replace function public.packaging_todo(p_token text, p_limit integer)
returns table(ean text, images text[]) language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_import_token(p_token);
  return query
    select p.ean, p.images from public.products p
    where p.active and cardinality(p.images) >= 2 and p.packaging_checked_at is null
    order by p.in_stock desc, p.promote desc, p.id
    limit least(greatest(p_limit, 1), 1000);
end;
$$;

create or replace function public.import_packaging(p_token text, p_rows jsonb)
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
    ), p.images),
    has_packaging_photo = coalesce(r.has_packaging, false),
    packaging_checked_at = now()
  from jsonb_to_recordset(p_rows) as r(ean text, images jsonb, has_packaging boolean)
  where p.ean = r.ean;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.packaging_todo(text, integer) from public;
revoke all on function public.import_packaging(text, jsonb) from public;
grant execute on function public.packaging_todo(text, integer) to anon, authenticated;
grant execute on function public.import_packaging(text, jsonb) to anon, authenticated;
