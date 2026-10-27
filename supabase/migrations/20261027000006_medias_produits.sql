-- Photos et caractéristiques produits (source : Open Icecat, contenu fourni par les fabricants).
alter table public.products add column if not exists media_checked_at timestamptz;
alter table public.products add column if not exists media_source text;
grant select (media_source) on public.products to anon, authenticated;

-- EAN des produits à enrichir (les EAN ne sont pas exposés publiquement).
create or replace function public.media_todo(p_token text, p_limit integer, p_in_stock_first boolean default true)
returns table (ean text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_import_token(p_token);
  return query
    select p.ean from public.products p
    where p.active and p.media_checked_at is null
    order by case when p_in_stock_first then p.in_stock end desc nulls last, p.id
    limit least(greatest(p_limit, 1), 5000);
end;
$$;

-- Enregistre les médias trouvés. Seules les URL du CDN d'Icecat sont acceptées.
create or replace function public.import_media(p_token text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform private.assert_import_token(p_token);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'lot invalide (500 lignes maximum)';
  end if;

  update public.products p set
    image_url = case when r.image_url ~ '^https://images\.icecat\.biz/[A-Za-z0-9/_.-]+$' then r.image_url end,
    specs = case when jsonb_typeof(r.specs) = 'array' and jsonb_array_length(r.specs) <= 40 then r.specs else '{}'::jsonb end,
    media_source = case when r.image_url is not null or jsonb_typeof(r.specs) = 'array' then 'icecat' end,
    media_checked_at = now()
  from jsonb_to_recordset(p_rows) as r(ean text, image_url text, specs jsonb)
  where p.ean = r.ean;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.media_todo(text, integer, boolean), public.import_media(text, jsonb) from public;
grant execute on function public.media_todo(text, integer, boolean), public.import_media(text, jsonb) to anon, authenticated;
