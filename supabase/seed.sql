-- =============================================================================
-- Dados iniciais para desenvolvimento local (supabase db reset)
-- Empresas fictícias, apenas para teste. Não usar em produção.
-- =============================================================================

-- Sede da Transmas: início e fim de todas as rotas.
-- Coordenadas: posição conferida pelo Matheus no mapa do app (03/11/2026), prédio da sede.
insert into public.empresas (nome, endereco, bairro, cidade, uf, cep, latitude, longitude, eh_sede)
values ('Transmas Encomendas e Transportes LTDA (Sede)', 'Rua Carlos Blank, 194', 'Vila Lalau',
        'Jaraguá do Sul', 'SC', '89256100', -26.480260, -49.067570, true);

-- Nomes fictícios em ruas reais de Jaraguá do Sul, sem coordenadas:
-- servem para testar a geocodificação pela tela de cadastro.
insert into public.empresas (nome, endereco, bairro, cidade, uf) values
  ('Empresa Teste A', 'Rua Reinoldo Rau, 100',                'Centro',               'Jaraguá do Sul', 'SC'),
  ('Empresa Teste B', 'Rua Walter Marquardt, 1000',           'Barra do Rio Molha',   'Jaraguá do Sul', 'SC'),
  ('Empresa Teste C', 'Rua Bernardo Dornbusch, 500',          'Baependi',             'Jaraguá do Sul', 'SC');

-- -----------------------------------------------------------------------------
-- Usuários de teste (senha: teste123)
--   motorista@teste.local  -> perfil motorista, veículo ABC1D23
--   escritorio@teste.local -> perfil escritorio
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('teste123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('3b230c89-b797-413f-90e3-599a5e5c9052'::uuid, 'motorista@teste.local'),
  ('963ff937-7cea-41be-82b9-ffeb58993aba'::uuid, 'escritorio@teste.local')
) as u (id, email);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email like '%@teste.local';

insert into public.funcionarios (id, nome, perfil) values
  ('3b230c89-b797-413f-90e3-599a5e5c9052', 'Motorista Teste',  'motorista'),
  ('963ff937-7cea-41be-82b9-ffeb58993aba', 'Escritório Teste', 'escritorio');

insert into public.veiculos (placa, modelo, motorista_id)
values ('ABC1D23', 'Veículo Teste', '3b230c89-b797-413f-90e3-599a5e5c9052');
