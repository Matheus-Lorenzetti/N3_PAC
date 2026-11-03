-- =============================================================================
-- Regiões de atendimento (agrupamento de empresas por k-means)
--
-- O k-means roda no navegador do escritório (src/lib/kmeans.ts); ao salvar,
-- aplicar_regioes() troca as regiões e o vínculo de cada empresa numa transação.
-- =============================================================================

create table public.regioes (
  id        bigint generated always as identity primary key,
  nome      text not null check (length(trim(nome)) > 0),
  cor       text not null check (cor ~ '^#[0-9a-fA-F]{6}$'),
  -- Centro do grupo (centróide do k-means)
  latitude  double precision not null check (latitude  between -90  and 90),
  longitude double precision not null check (longitude between -180 and 180),
  criado_em timestamptz not null default now()
);

comment on table public.regioes is 'Regiões geradas pelo k-means sobre as coordenadas das empresas.';

alter table public.empresas
  add column regiao_id bigint references public.regioes (id) on delete set null;

create index empresas_regiao_id_idx on public.empresas (regiao_id);

alter table public.regioes enable row level security;
revoke all on public.regioes from anon;
grant select, insert, update, delete on public.regioes to authenticated;

create policy "regioes: funcionários ativos consultam"
  on public.regioes for select to authenticated
  using ((select private.perfil_atual()) is not null);

create policy "regioes: escritório cadastra"
  on public.regioes for insert to authenticated
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "regioes: escritório altera"
  on public.regioes for update to authenticated
  using ((select private.perfil_atual()) = 'escritorio')
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "regioes: escritório remove"
  on public.regioes for delete to authenticated
  using ((select private.perfil_atual()) = 'escritorio');

-- -----------------------------------------------------------------------------
-- Substitui todas as regiões de uma vez.
-- p_regioes: [{ "nome", "cor", "latitude", "longitude", "empresas": [ids] }]
-- SECURITY INVOKER: a RLS garante que só o escritório consegue gravar.
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_regioes(p_regioes jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_regiao jsonb;
  v_id     bigint;
  v_total  integer := 0;
begin
  if private.perfil_atual() is distinct from 'escritorio' then
    raise exception 'Só o escritório define as regiões';
  end if;

  -- on delete set null limpa o vínculo das empresas
  delete from public.regioes where true;

  for v_regiao in select * from jsonb_array_elements(p_regioes)
  loop
    insert into public.regioes (nome, cor, latitude, longitude)
    values (
      v_regiao ->> 'nome',
      v_regiao ->> 'cor',
      (v_regiao ->> 'latitude')::double precision,
      (v_regiao ->> 'longitude')::double precision
    )
    returning id into v_id;

    update public.empresas
       set regiao_id = v_id
     where id in (select (jsonb_array_elements_text(v_regiao -> 'empresas'))::bigint);
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.aplicar_regioes(jsonb) from public, anon;
grant execute on function public.aplicar_regioes(jsonb) to authenticated;
