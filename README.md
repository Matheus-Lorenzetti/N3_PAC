# 🚚 Sistema Inteligente de Kanban para Gerenciamento Logístico

> Projeto acadêmico da disciplina **Projeto Aplicado de Curso (PAC) - N3** (Católica SC), feito para a **Transmas Encomendas e Transportes LTDA**. Junta o quadro Kanban a recursos de inteligência operacional: rota otimizada, agrupamento por região com k-means, rastreamento em tempo real e detecção de gargalos.

**Site no ar:** https://n3-pac.vercel.app

---

## 📋 Sobre o projeto

Muitas transportadoras ainda controlam coletas, entregas e motoristas com planilhas e telefone. Isso gera atrasos, falhas de comunicação e pouca visão do que está acontecendo na rua.

O sistema centraliza essas informações em uma aplicação web com dois perfis:

- **Escritório** (computador): lança coletas, acompanha o Kanban e o Dashboard e vê os veículos ao vivo no mapa.
- **Motorista** (celular Android, no navegador): recebe as coletas na hora, segue a rota otimizada e envia a posição pelo GPS.

Regras de negócio principais:

- A rota sempre começa e termina na sede da Transmas.
- O motorista não recusa coleta: ele decide se adiciona à rota agora. O que não for adicionado entra sozinho na rota do dia seguinte.
- **Atraso** é o que ficou pendente do dia anterior.
- Tudo é **gratuito**: serviços e APIs sem custo.

---

## ⚙️ Funcionalidades

### 📱 App do motorista

| Função | Como funciona |
| --- | --- |
| Login por placa + nome | Um campo só aceita e-mail (escritório) ou placa (motorista). O login registra quem está com cada veículo |
| Rota otimizada | Mapa em tela cheia com a melhor ordem das paradas (OpenRouteService/VROOM), saindo de onde o motorista está e voltando para a sede |
| Nova coleta "estilo Uber" | A coleta lançada pelo escritório aparece em menos de 1 s, com som e vibração. O motorista toca em "Adicionar à rota" ou "Agora não" |
| Recálculo automático | A rota é refeita quando ele aceita uma coleta, adiciona uma entrega ou conclui uma parada |
| Ordem manual | Setas para mudar a ordem das paradas; "Usar rota sugerida" volta à otimizada. Coleta nova entra no lugar em que menos alonga o caminho |
| Tirar da rota | A parada volta para pendente e entra sozinha na rota de amanhã |
| Acompanhamento em tempo real | O trecho percorrido some da linha. Se o motorista sair mais de 300 m do caminho, o traçado é refeito de onde ele está |
| Navegar | O botão abre o Waze com voz e alertas, enquanto o app continua mandando o GPS |
| GPS e tela ligada | Posição enviada a cada 15 s ou 50 m; a tela não apaga enquanto o app está aberto |

### 🖥️ Escritório

| Tela | O que faz |
| --- | --- |
| **Dashboard** | Coletas e entregas em rota, realizadas hoje e pendentes do dia anterior; lista de atrasados; resumo por motorista e por região, com tempo médio de atendimento e alerta de gargalo |
| **Kanban** | Colunas Aguardando → Pendente → Em rota → Realizada, com arrastar e soltar. Mostra o motivo das pendentes e tem lixeira para excluir. Cada mudança fica no histórico |
| **Mapa** | Veículos ao vivo com a rota e as paradas de cada um. O escritório pode **recalcular** a rota ou **arrastar** as paradas para definir a ordem, e o celular do motorista passa a seguir essa ordem na hora |
| **Lançar coleta** | Escolhe a empresa e o sistema **sugere o motorista**: primeiro quem já está na mesma região, depois quem está mais perto pelo GPS, depois quem tem menos carga |
| **Regiões** | Agrupa as empresas por região com **k-means** (k de 2 a 8), com gráfico do cotovelo e coeficiente de silhueta para escolher o número de regiões |
| **Empresas** | Cadastro com CNPJ e telefone. O CEP preenche o endereço (ViaCEP) e o endereço vira coordenadas ao salvar (Nominatim) |

O Dashboard e o Kanban têm o mesmo **filtro por cidade e placa**.

### 🤖 Inteligência operacional

- **Otimização de rotas:** o problema de roteamento de veículos é resolvido pelo otimizador VROOM, pela API gratuita do OpenRouteService.
- **Agrupamento por região:** k-means implementado do zero (`src/lib/kmeans.ts`), com inicialização k-means++, reinícios e semente fixa. É aprendizado não supervisionado e não precisa de histórico.
- **Detecção de gargalo:** alerta quando uma região concentra 40% ou mais dos atrasos ou dos serviços abertos.
- **Sugestão de motorista:** usa a região do k-means, a distância pelo GPS e a carga de cada motorista.

---

## 🏗️ Arquitetura

Três camadas, sem servidor próprio:

```text
Apresentação   React no navegador (Vercel): telas, mapas e k-means
      ↓ REST e Realtime
Negócio        Supabase: Auth, RLS por perfil, gatilhos e funções SQL,
               Edge Function otimizar-rota (guarda a chave do OpenRouteService)
      ↓
Dados          PostgreSQL no Supabase
```

---

## 💻 Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Base UI), react-hook-form + zod, React Router |
| Backend | Supabase: Auth, Realtime, Row Level Security e Edge Functions |
| Banco de dados | PostgreSQL (Supabase) |
| Mapas | MapLibre GL JS + OpenFreeMap |
| Rotas | OpenRouteService: otimização (VROOM) e traçado (Directions) |
| Endereços | ViaCEP (CEP) e Nominatim/OpenStreetMap (coordenadas) |
| Hospedagem | Vercel (site) + Supabase (banco e função) |

---

## 📁 Estrutura do projeto

```text
N3_PAC/
├── src/
│   ├── app/                    # Rotas e proteção por perfil
│   ├── components/ui/          # Componentes do shadcn/ui
│   ├── features/
│   │   ├── auth/               # Login e sessão
│   │   ├── motorista/          # App do motorista: mapa, rota, GPS, alerta de coleta
│   │   └── escritorio/
│   │       ├── dashboard/      # Cards, atrasados e indicadores por região
│   │       ├── kanban/         # Quadro com arrastar e soltar
│   │       ├── mapa/           # Veículos ao vivo e definição da rota
│   │       ├── coletas/        # Lançar coleta e sugestão de motorista
│   │       ├── regioes/        # k-means, cotovelo e mapa das regiões
│   │       ├── empresas/       # Cadastro de empresas
│   │       └── servicos/       # Dados do dia e filtro (Dashboard e Kanban)
│   └── lib/                    # Supabase, OpenRouteService, mapas, k-means, endereços
├── supabase/
│   ├── migrations/             # Schema versionado (tabelas, RLS, funções)
│   ├── functions/otimizar-rota # Edge Function das rotas
│   ├── seed.sql                # Sede e dados de teste do banco local
│   └── config.toml             # Configuração do Supabase local
├── docs/setup.md               # Como configurar o ambiente do zero
├── .claude/skills/             # Skills do Claude Code usadas no projeto
└── package.json                # Scripts (npm run dev, db:*)
```

---

## ▶️ Como rodar

```powershell
npm install
npm run db:start   # sobe o banco local (precisa do Docker Desktop aberto)
npm run db:reset   # aplica as migrations e o seed
npm run dev        # abre o site em http://localhost:5173
```

Passo a passo completo, com as variáveis de ambiente, em [docs/setup.md](docs/setup.md).

---

## 🔮 Trabalhos futuros

- Previsão de atrasos com um modelo que aprende com o histórico das rotas
- Sugerir a ordem que cada motorista costuma fazer, a partir do histórico
- Horário de funcionamento das empresas e urgência das coletas
- Status de falha e cancelamento
- Importação de empresas por CSV
- Mensagens entre escritório e motorista
- App Android (Capacitor) para o GPS com a tela desligada
- Integração com os robôs e o sistema SSW da Transmas

---

## 🎓 Informações acadêmicas

**Disciplina:** Projeto Aplicado de Curso (PAC) - N3
**Instituição:** Católica SC
**Autor:** Matheus Lorenzetti
**Ano:** 2026

---

## 📄 Licença

Projeto desenvolvido exclusivamente para fins acadêmicos.
