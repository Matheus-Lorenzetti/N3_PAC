-- =============================================================================
-- Rota calculada de cada motorista e última posição de cada um
--
-- rotas: o app do motorista grava a rota que calculou (OpenRouteService/VROOM),
--   uma linha por motorista por dia, sobrescrita a cada recálculo. O escritório
--   vê no mapa a mesma rota que o motorista vê, e fica o planejado do dia para
--   comparar com o realizado (localizacoes).
-- ultimas_localizacoes: posição mais recente de cada motorista (rastreador).
-- =============================================================================

create table public.rotas (
  motorista_id uuid not null default auth.uid()
    references public.funcionarios (id) on delete cascade,
  data         date not null default (now() at time zone 'America/Sao_Paulo')::date,
  -- ids de servicos na ordem de visita
  ordem        bigint[] not null default '{}',
  -- traçado da rota em [[longitude, latitude], ...] (formato GeoJSON)
  linha        jsonb not null default '[]'::jsonb check (jsonb_typeof(linha) = 'array'),
  distancia_m  real not null default 0 check (distancia_m >= 0),
  duracao_s    real not null default 0 check (duracao_s >= 0),
  calculada_em timestamptz not null default now(),
  primary key (motorista_id, data)
);

comment on table public.rotas is 'Rota otimizada de cada motorista por dia, gravada pelo app a cada recálculo.';

-- Posição mais recente de cada motorista; usa o índice (motorista_id, registrado_em desc)
create view public.ultimas_localizacoes
with (security_invoker = true)
as
select distinct on (l.motorista_id) l.*
from public.localizacoes l
order by l.motorista_id, l.registrado_em desc;

-- -----------------------------------------------------------------------------
-- Permissões e RLS
-- -----------------------------------------------------------------------------
alter table public.rotas enable row level security;

revoke all on public.rotas, public.ultimas_localizacoes from anon;
grant select, insert, update on public.rotas to authenticated;
grant select on public.ultimas_localizacoes to authenticated;

create policy "rotas: motorista vê a sua, escritório vê todas"
  on public.rotas for select to authenticated
  using (motorista_id = (select auth.uid()) or (select private.perfil_atual()) = 'escritorio');

create policy "rotas: motorista grava a própria"
  on public.rotas for insert to authenticated
  with check (
    (select private.perfil_atual()) = 'motorista'
    and motorista_id = (select auth.uid())
  );

create policy "rotas: motorista atualiza a própria"
  on public.rotas for update to authenticated
  using (motorista_id = (select auth.uid()))
  with check (
    (select private.perfil_atual()) = 'motorista'
    and motorista_id = (select auth.uid())
  );

-- Rastreador do escritório acompanha os recálculos ao vivo
alter publication supabase_realtime add table public.rotas;
