-- =============================================================================
-- Dados iniciais para desenvolvimento local (supabase db reset)
-- Empresas fictícias, apenas para teste. Não usar em produção.
-- =============================================================================

-- Sede da Transmas: início e fim de todas as rotas.
-- Coordenadas: OpenStreetMap (Photon), trecho da Rua Carlos Blank com CEP 89256-100.
insert into public.empresas (nome, endereco, bairro, cidade, uf, cep, latitude, longitude, eh_sede)
values ('Transmas Encomendas e Transportes LTDA (Sede)', 'Rua Carlos Blank, 194', 'Vila Lalau',
        'Jaraguá do Sul', 'SC', '89256100', -26.481665, -49.066976, true);

insert into public.empresas (nome, endereco, bairro, cidade, uf) values
  ('Empresa Teste A', 'Rua Exemplo, 100', 'Centro', 'Cidade Teste', 'SC'),
  ('Empresa Teste B', 'Rua Exemplo, 200', 'Centro', 'Cidade Teste', 'SC'),
  ('Empresa Teste C', 'Rua Exemplo, 300', 'Bairro Novo', 'Cidade Teste', 'SC');

-- Funcionários e veículo dependem de usuários no Supabase Auth.
-- Crie os usuários pelo Studio (Authentication > Users) e depois rode, trocando os UUIDs:
--
-- insert into public.funcionarios (id, nome, perfil) values
--   ('<uuid-do-motorista>',  'Motorista Teste',  'motorista'),
--   ('<uuid-do-escritorio>', 'Escritório Teste', 'escritorio');
--
-- insert into public.veiculos (placa, modelo, motorista_id)
-- values ('ABC1D23', 'Veículo Teste', '<uuid-do-motorista>');
