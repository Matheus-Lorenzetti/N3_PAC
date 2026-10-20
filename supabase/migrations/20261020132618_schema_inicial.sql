-- =============================================================================
-- Schema inicial — Sistema Inteligente de Kanban para Gerenciamento Logístico
-- Transmas Encomendas e Transportes LTDA
--
-- Base: decisões da conversa de 12/10/2026 (docs/conversas-tcc.md)
--   - Perfis: motorista (app web no celular) e escritorio (desktop)
--   - Motorista <-> veículo: relação fixa 1:1
--   - Serviço = coleta ou entrega, sempre para empresa cadastrada
--   - Status: pendente | em_rota | realizada (falha/cancelada ficam para depois)
--   - Atraso = o que ficou do dia anterior (não há janela de horário)
--   - Rota sempre começa e termina na sede da Transmas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.perfil_funcionario as enum ('motorista', 'escritorio');
create type public.tipo_servico       as enum ('coleta', 'entrega');
create type public.status_servico     as enum ('pendente', 'em_rota', 'realizada');

-- Schema não exposto pela API, para funções auxiliares de segurança
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- funcionarios: um registro por usuário do Supabase Auth
-- -----------------------------------------------------------------------------
create table public.funcionarios (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  perfil    public.perfil_funcionario not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.funcionarios is 'Usuários do sistema (motoristas e escritório), vinculados ao Supabase Auth.';

-- -----------------------------------------------------------------------------
-- veiculos: placa + motorista fixo (1:1)
-- -----------------------------------------------------------------------------
create table public.veiculos (
  id           bigint generated always as identity primary key,
  -- Aceita o padrão antigo (ABC1234) e o Mercosul (ABC1D23)
  placa        text not null unique check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  modelo       text,
  motorista_id uuid unique references public.funcionarios (id) on delete set null,
  criado_em    timestamptz not null default now()
);

comment on column public.veiculos.motorista_id is 'Relação fixa 1:1: cada motorista tem no máximo um veículo e vice-versa (unique).';

-- -----------------------------------------------------------------------------
-- empresas: clientes atendidos + a sede da Transmas (início/fim de toda rota)
-- -----------------------------------------------------------------------------
create table public.empresas (
  id        bigint generated always as identity primary key,
  nome      text not null check (length(trim(nome)) > 0),
  endereco  text not null,               -- logradouro, número e complemento
  bairro    text,
  cidade    text not null,
  uf        char(2) not null check (uf ~ '^[A-Z]{2}$'),
  cep       text check (cep ~ '^[0-9]{8}$'),
  -- Geocodificado uma única vez e armazenado, para não chamar a API a cada rota
  latitude  double precision check (latitude  between -90  and 90),
  longitude double precision check (longitude between -180 and 180),
  eh_sede   boolean not null default false,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint empresas_coordenadas_completas
    check ((latitude is null) = (longitude is null))
);

-- Só pode existir uma sede
create unique index empresas_uma_sede_idx on public.empresas (eh_sede) where eh_sede;

comment on column public.empresas.eh_sede is 'Sede da Transmas: ponto de partida e de chegada de todas as rotas.';

-- -----------------------------------------------------------------------------
-- servicos: coletas e entregas
--
-- Ciclo de vida:
--   coleta lançada pelo escritório -> pendente (motorista é notificado)
--   motorista adiciona à rota      -> em_rota  (aceito_em)
--   motorista conclui              -> realizada (concluido_em)
--   entregas: o motorista seleciona as empresas antes de sair -> já entram em_rota
--   não concluído até o fim do dia -> continua aberto com data_servico < hoje
--     = "pendente do dia anterior" (atraso); entra na rota do dia seguinte
-- -----------------------------------------------------------------------------
create table public.servicos (
  id           bigint generated always as identity primary key,
  tipo         public.tipo_servico not null,
  empresa_id   bigint not null references public.empresas (id),
  motorista_id uuid not null references public.funcionarios (id),
  status       public.status_servico not null default 'pendente',
  -- Dia (horário de Brasília) a que o serviço pertence; base do cálculo de atraso
  data_servico date not null default (now() at time zone 'America/Sao_Paulo')::date,
  observacao   text,
  criado_por   uuid references public.funcionarios (id) on delete set null default auth.uid(),
  criado_em    timestamptz not null default now(),
  aceito_em    timestamptz,
  concluido_em timestamptz,
  constraint servicos_em_rota_tem_aceite
    check (status = 'pendente' or aceito_em is not null),
  constraint servicos_realizada_tem_conclusao
    check ((status = 'realizada') = (concluido_em is not null))
);

create index servicos_motorista_status_idx on public.servicos (motorista_id, status);
create index servicos_empresa_id_idx       on public.servicos (empresa_id);
create index servicos_criado_por_idx       on public.servicos (criado_por);
-- Painel e rotas consultam quase sempre os serviços ainda abertos
create index servicos_abertos_idx on public.servicos (data_servico)
  where status <> 'realizada';

-- -----------------------------------------------------------------------------
-- servico_eventos: histórico de mudanças de status (Kanban e tempo por etapa)
-- Preenchido só por trigger; ninguém escreve direto.
-- -----------------------------------------------------------------------------
create table public.servico_eventos (
  id              bigint generated always as identity primary key,
  servico_id      bigint not null references public.servicos (id) on delete cascade,
  status_anterior public.status_servico,   -- null na criação
  status_novo     public.status_servico not null,
  alterado_por    uuid references public.funcionarios (id) on delete set null,
  alterado_em     timestamptz not null default now()
);

create index servico_eventos_servico_idx      on public.servico_eventos (servico_id, alterado_em);
create index servico_eventos_alterado_por_idx on public.servico_eventos (alterado_por);

-- -----------------------------------------------------------------------------
-- localizacoes: posição do motorista ao longo do tempo (rastreador)
-- -----------------------------------------------------------------------------
create table public.localizacoes (
  id            bigint generated always as identity primary key,
  motorista_id  uuid not null references public.funcionarios (id) on delete cascade default auth.uid(),
  latitude      double precision not null check (latitude  between -90  and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  precisao_m    real check (precisao_m >= 0),
  velocidade_ms real check (velocidade_ms >= 0),
  registrado_em timestamptz not null default now()
);

-- Última posição de cada motorista e trajeto do dia
create index localizacoes_motorista_tempo_idx on public.localizacoes (motorista_id, registrado_em desc);

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------

-- Perfil do usuário logado. SECURITY DEFINER para ler funcionarios sem cair
-- na própria RLS (evita recursão). Fica no schema private, fora da API.
create or replace function private.perfil_atual()
returns public.perfil_funcionario
language sql
stable
security definer
set search_path = ''
as $$
  select f.perfil
  from public.funcionarios f
  where f.id = (select auth.uid())
    and f.ativo;
$$;

revoke all on function private.perfil_atual() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.perfil_atual() to authenticated;

-- Preenche aceito_em/concluido_em e impede que o motorista altere o que não deve
create or replace function private.servicos_antes_gravar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil public.perfil_funcionario := private.perfil_atual();
begin
  if tg_op = 'UPDATE' and v_perfil = 'motorista' then
    -- Motorista só muda o status, e só para frente (não recusa nem cancela)
    if (new.tipo, new.empresa_id, new.motorista_id, new.data_servico, new.criado_por, new.criado_em)
       is distinct from
       (old.tipo, old.empresa_id, old.motorista_id, old.data_servico, old.criado_por, old.criado_em) then
      raise exception 'Motorista só pode alterar o status do serviço';
    end if;
    if new.status < old.status then
      raise exception 'Status não pode voltar de % para %', old.status, new.status;
    end if;
  end if;

  if new.status in ('em_rota', 'realizada') and new.aceito_em is null then
    new.aceito_em := now();
  end if;
  if new.status = 'realizada' and new.concluido_em is null then
    new.concluido_em := now();
  end if;

  return new;
end;
$$;

revoke all on function private.servicos_antes_gravar() from public, anon, authenticated;

create trigger servicos_antes_gravar
  before insert or update on public.servicos
  for each row execute function private.servicos_antes_gravar();

-- Registra o histórico. SECURITY DEFINER porque servico_eventos não aceita
-- escrita de usuários; a função só grava o que o próprio trigger recebe.
create or replace function private.servicos_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.servico_eventos (servico_id, status_anterior, status_novo, alterado_por)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      (select auth.uid())
    );
  end if;
  return null;
end;
$$;

revoke all on function private.servicos_registrar_evento() from public, anon, authenticated;

create trigger servicos_registrar_evento
  after insert or update of status on public.servicos
  for each row execute function private.servicos_registrar_evento();

-- Chamada pelo app quando o motorista começa o percurso: tudo o que ficou
-- pendente de dias anteriores entra na rota automaticamente, sem seleção.
-- SECURITY INVOKER: a RLS garante que só os serviços do próprio motorista mudam.
create or replace function public.iniciar_rota()
returns setof public.servicos
language sql
security invoker
set search_path = ''
as $$
  update public.servicos
     set status = 'em_rota'
   where motorista_id = (select auth.uid())
     and status = 'pendente'
     and data_servico < (now() at time zone 'America/Sao_Paulo')::date
  returning *;
$$;

revoke all on function public.iniciar_rota() from public, anon;
grant execute on function public.iniciar_rota() to authenticated;

-- -----------------------------------------------------------------------------
-- View: situação de cada serviço para o dashboard e o Kanban
--   aguardando = pendente lançado hoje (motorista ainda não adicionou à rota)
--   pendente   = ficou do dia anterior e ainda não entrou na rota
--   em_rota    = na rota do motorista
--   realizada  = concluído
--   atrasado   = indicador separado (vale para qualquer situação)
-- security_invoker: respeita a RLS de quem consulta
-- -----------------------------------------------------------------------------
create view public.servicos_situacao
with (security_invoker = true)
as
select
  s.*,
  case
    when s.status <> 'pendente' then s.status::text
    when s.data_servico < (now() at time zone 'America/Sao_Paulo')::date then 'pendente'
    else 'aguardando'
  end as situacao,
  -- Atrasado: concluído depois do dia previsto, ou ainda aberto de dia anterior
  coalesce((s.concluido_em at time zone 'America/Sao_Paulo')::date,
           (now() at time zone 'America/Sao_Paulo')::date) > s.data_servico as atrasado
from public.servicos s;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.funcionarios    enable row level security;
alter table public.veiculos        enable row level security;
alter table public.empresas        enable row level security;
alter table public.servicos        enable row level security;
alter table public.servico_eventos enable row level security;
alter table public.localizacoes    enable row level security;

-- Nada é público: só usuários logados acessam
revoke all on public.funcionarios, public.veiculos, public.empresas, public.servicos,
              public.servico_eventos, public.localizacoes, public.servicos_situacao
  from anon;

grant select, insert, update, delete on public.funcionarios, public.veiculos, public.empresas
  to authenticated;
grant select, insert, update, delete on public.servicos to authenticated;
grant select on public.servico_eventos, public.servicos_situacao to authenticated;
grant select, insert on public.localizacoes to authenticated;

-- funcionarios -----------------------------------------------------------------
create policy "funcionarios: ver a si mesmo ou escritório vê todos"
  on public.funcionarios for select to authenticated
  using (id = (select auth.uid()) or (select private.perfil_atual()) = 'escritorio');

create policy "funcionarios: escritório cadastra"
  on public.funcionarios for insert to authenticated
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "funcionarios: escritório altera"
  on public.funcionarios for update to authenticated
  using ((select private.perfil_atual()) = 'escritorio')
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "funcionarios: escritório remove"
  on public.funcionarios for delete to authenticated
  using ((select private.perfil_atual()) = 'escritorio');

-- veiculos ---------------------------------------------------------------------
create policy "veiculos: motorista vê o seu, escritório vê todos"
  on public.veiculos for select to authenticated
  using (motorista_id = (select auth.uid()) or (select private.perfil_atual()) = 'escritorio');

create policy "veiculos: escritório cadastra"
  on public.veiculos for insert to authenticated
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "veiculos: escritório altera"
  on public.veiculos for update to authenticated
  using ((select private.perfil_atual()) = 'escritorio')
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "veiculos: escritório remove"
  on public.veiculos for delete to authenticated
  using ((select private.perfil_atual()) = 'escritorio');

-- empresas ---------------------------------------------------------------------
-- Motorista precisa buscar empresas para montar as entregas e a rota
create policy "empresas: funcionários ativos consultam"
  on public.empresas for select to authenticated
  using ((select private.perfil_atual()) is not null);

create policy "empresas: escritório cadastra"
  on public.empresas for insert to authenticated
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "empresas: escritório altera"
  on public.empresas for update to authenticated
  using ((select private.perfil_atual()) = 'escritorio')
  with check ((select private.perfil_atual()) = 'escritorio');

create policy "empresas: escritório remove"
  on public.empresas for delete to authenticated
  using ((select private.perfil_atual()) = 'escritorio');

-- servicos ---------------------------------------------------------------------
create policy "servicos: motorista vê os seus, escritório vê todos"
  on public.servicos for select to authenticated
  using (
    ((select private.perfil_atual()) = 'motorista' and motorista_id = (select auth.uid()))
    or (select private.perfil_atual()) = 'escritorio'
  );

-- Escritório lança coletas/entregas para qualquer motorista;
-- motorista só registra as próprias entregas (seleção antes de sair)
create policy "servicos: escritório lança, motorista registra suas entregas"
  on public.servicos for insert to authenticated
  with check (
    (select private.perfil_atual()) = 'escritorio'
    or ((select private.perfil_atual()) = 'motorista'
        and motorista_id = (select auth.uid())
        and tipo = 'entrega')
  );

-- O que o motorista pode mudar é limitado pelo trigger servicos_antes_gravar
create policy "servicos: motorista atualiza os seus, escritório todos"
  on public.servicos for update to authenticated
  using (
    ((select private.perfil_atual()) = 'motorista' and motorista_id = (select auth.uid()))
    or (select private.perfil_atual()) = 'escritorio'
  )
  with check (
    ((select private.perfil_atual()) = 'motorista' and motorista_id = (select auth.uid()))
    or (select private.perfil_atual()) = 'escritorio'
  );

create policy "servicos: escritório remove"
  on public.servicos for delete to authenticated
  using ((select private.perfil_atual()) = 'escritorio');

-- servico_eventos (somente leitura; escrito pelo trigger) -----------------------
create policy "servico_eventos: segue a visibilidade do serviço"
  on public.servico_eventos for select to authenticated
  using (
    (select private.perfil_atual()) = 'escritorio'
    or exists (
      select 1 from public.servicos s
      where s.id = servico_eventos.servico_id and s.motorista_id = (select auth.uid())
    )
  );

-- localizacoes -----------------------------------------------------------------
create policy "localizacoes: motorista vê as suas, escritório vê todas"
  on public.localizacoes for select to authenticated
  using (motorista_id = (select auth.uid()) or (select private.perfil_atual()) = 'escritorio');

create policy "localizacoes: motorista envia a própria posição"
  on public.localizacoes for insert to authenticated
  with check (
    (select private.perfil_atual()) = 'motorista'
    and motorista_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Realtime: notificação de coleta no app do motorista e rastreador ao vivo
-- (as mensagens respeitam a RLS de quem está inscrito)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.servicos, public.localizacoes;
