-- =============================================================================
-- O escritório também monta a rota do motorista pelo rastreador: recalcula a
-- rota otimizada ou arrasta as paradas para definir a ordem. O app do motorista
-- recebe pelo Realtime e passa a seguir essa rota.
-- =============================================================================

alter table public.rotas
  add column origem text not null default 'motorista'
    check (origem in ('motorista', 'escritorio')),
  add column manual boolean not null default false;

comment on column public.rotas.origem is 'Quem gravou a última versão da rota: o app do motorista ou o escritório (rastreador).';
comment on column public.rotas.manual is 'true = ordem escolhida à mão (o app só traça, não reotimiza); false = otimizada.';

create policy "rotas: escritório grava"
  on public.rotas for insert to authenticated
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "rotas: escritório atualiza"
  on public.rotas for update to authenticated
  using ((select private.perfil_atual()) = 'escritorio')
  with check ((select private.perfil_atual()) = 'escritorio');
