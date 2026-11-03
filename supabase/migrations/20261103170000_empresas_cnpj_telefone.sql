-- CNPJ e telefone das empresas (importação da planilha de clientes)
-- CNPJ único: permite reimportar sem duplicar e casar com os robôs/SSW depois.

alter table public.empresas
  add column cnpj     text unique check (cnpj ~ '^[0-9]{14}$'),
  add column telefone text;

comment on column public.empresas.cnpj is 'Somente dígitos (14). Opcional; a sede e empresas de teste podem não ter.';
