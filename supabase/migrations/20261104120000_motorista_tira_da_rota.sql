-- Motorista pode tirar uma parada da rota (em_rota -> pendente), sem motivo.
-- (A limpeza de aceito_em abaixo foi desfeita em 20261104130000.)
-- Ela volta a aguardar e, se não for adicionada de novo hoje, vira pendente
-- do dia anterior e entra sozinha na rota de amanhã (iniciar_rota).
-- Continua proibido: concluída voltar, ou o motorista mudar outros campos.
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

  -- Tirou da rota: o aceite deixa de valer
  if tg_op = 'UPDATE' and old.status = 'em_rota' and new.status = 'pendente' then
    new.aceito_em := null;
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
