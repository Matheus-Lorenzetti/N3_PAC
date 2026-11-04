-- Parada que o motorista tirou da rota aparece como "pendente" já no mesmo dia
-- (antes ficava "aguardando", que é só o que ele ainda não aceitou).
-- Marca: status pendente com aceito_em preenchido. O Kanban do escritório limpa
-- aceito_em ao mover para aguardando/pendente, então só a retirada deixa a marca.
-- Ela não volta para a rota hoje: iniciar_rota só pega dias anteriores.

-- Trigger: tirar da rota deixa de limpar aceito_em
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
    -- Motorista só muda o status: para frente, ou tirando da rota
    if (new.tipo, new.empresa_id, new.motorista_id, new.data_servico, new.criado_por, new.criado_em)
       is distinct from
       (old.tipo, old.empresa_id, old.motorista_id, old.data_servico, old.criado_por, old.criado_em) then
      raise exception 'Motorista só pode alterar o status do serviço';
    end if;
    if new.status < old.status
       and not (old.status = 'em_rota' and new.status = 'pendente') then
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

-- View: mesmas colunas; só muda a regra de "pendente"
create or replace view public.servicos_situacao
with (security_invoker = true)
as
select
  s.*,
  case
    when s.status <> 'pendente' then s.status::text
    when s.data_servico < (now() at time zone 'America/Sao_Paulo')::date then 'pendente'
    -- Aceita e depois tirada da rota pelo motorista
    when s.aceito_em is not null then 'pendente'
    else 'aguardando'
  end as situacao,
  -- Atrasado: concluído depois do dia previsto, ou ainda aberto de dia anterior
  coalesce((s.concluido_em at time zone 'America/Sao_Paulo')::date,
           (now() at time zone 'America/Sao_Paulo')::date) > s.data_servico as atrasado
from public.servicos s;
