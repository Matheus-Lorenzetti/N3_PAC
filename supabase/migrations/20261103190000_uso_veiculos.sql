-- =============================================================================
-- Troca de veículo: o motorista entra com placa + nome
--
-- veiculos.motorista_id continua sendo o vínculo ATUAL (1 motorista por veículo).
-- uso_veiculos guarda o histórico: quem esteve com qual veículo e quando.
-- assumir_veiculo(placa) é chamada pelo app logo após o login do motorista.
-- =============================================================================

create table public.uso_veiculos (
  id           bigint generated always as identity primary key,
  veiculo_id   bigint not null references public.veiculos (id) on delete cascade,
  motorista_id uuid not null references public.funcionarios (id) on delete cascade,
  inicio       timestamptz not null default now(),
  fim          timestamptz,
  constraint uso_veiculos_periodo check (fim is null or fim >= inicio)
);

comment on table public.uso_veiculos is 'Histórico de quem usou cada veículo; fim nulo = em uso agora.';

create index uso_veiculos_veiculo_idx   on public.uso_veiculos (veiculo_id, inicio desc);
create index uso_veiculos_motorista_idx on public.uso_veiculos (motorista_id, inicio desc);
-- No máximo um uso em aberto por veículo e por motorista
create unique index uso_veiculos_um_aberto_por_veiculo   on public.uso_veiculos (veiculo_id)   where fim is null;
create unique index uso_veiculos_um_aberto_por_motorista on public.uso_veiculos (motorista_id) where fim is null;

-- Vínculos que já existem viram o primeiro registro do histórico
insert into public.uso_veiculos (veiculo_id, motorista_id)
select v.id, v.motorista_id from public.veiculos v where v.motorista_id is not null;

alter table public.uso_veiculos enable row level security;
revoke all on public.uso_veiculos from anon;
grant select on public.uso_veiculos to authenticated;

create policy "uso_veiculos: motorista vê o seu, escritório vê todos"
  on public.uso_veiculos for select to authenticated
  using (motorista_id = (select auth.uid()) or (select private.perfil_atual()) = 'escritorio');

-- -----------------------------------------------------------------------------
-- O motorista logado assume o veículo da placa digitada.
-- SECURITY DEFINER: precisa mexer no vínculo de outro motorista (que deixa o
-- veículo), o que a RLS de veiculos não permite ao motorista. As checagens
-- abaixo limitam o que a função faz.
-- -----------------------------------------------------------------------------
create or replace function public.assumir_veiculo(p_placa text)
returns public.veiculos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motorista uuid := (select auth.uid());
  v_veiculo   public.veiculos;
begin
  if private.perfil_atual() is distinct from 'motorista' then
    raise exception 'Só motoristas assumem veículos';
  end if;

  select * into v_veiculo
  from public.veiculos
  where placa = upper(regexp_replace(p_placa, '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'Placa não cadastrada';
  end if;

  -- Já está com ele: nada muda
  if v_veiculo.motorista_id = v_motorista then
    return v_veiculo;
  end if;

  -- Encerra o uso em aberto do veículo e o do motorista (carro anterior)
  update public.uso_veiculos
     set fim = now()
   where fim is null
     and (veiculo_id = v_veiculo.id or motorista_id = v_motorista);

  -- Solta o carro anterior do motorista e assume o novo
  update public.veiculos set motorista_id = null where motorista_id = v_motorista;
  update public.veiculos set motorista_id = v_motorista where id = v_veiculo.id
  returning * into v_veiculo;

  insert into public.uso_veiculos (veiculo_id, motorista_id)
  values (v_veiculo.id, v_motorista);

  return v_veiculo;
end;
$$;

revoke all on function public.assumir_veiculo(text) from public, anon;
grant execute on function public.assumir_veiculo(text) to authenticated;
