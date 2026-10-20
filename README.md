# 🚚 Sistema Inteligente de Kanban para Gerenciamento Logístico

> Projeto acadêmico desenvolvido para a disciplina **Projeto Aplicado de Curso (PAC) - N3**, com foco na otimização de operações logísticas através da metodologia Kanban integrada a recursos de inteligência operacional.

---

## 📋 Sobre o Projeto

O setor logístico enfrenta desafios relacionados à organização de processos, controle de coletas, gerenciamento de veículos e comunicação entre equipes. Muitas empresas ainda utilizam planilhas e métodos manuais, o que pode causar atrasos, falhas operacionais e baixa produtividade.

Este projeto propõe o desenvolvimento de um sistema inteligente capaz de centralizar informações logísticas, melhorar o acompanhamento das operações e auxiliar na tomada de decisões através de automações e recursos inteligentes.

---

## 🎯 Objetivos

### Objetivo Geral

Desenvolver um sistema inteligente de gerenciamento logístico utilizando a metodologia Kanban para melhorar o controle operacional da empresa Transmas Encomendas e Transportes LTDA.

### Objetivos Específicos

* ✅ Cadastro de coletas
* ✅ Gerenciamento de veículos e motoristas
* ✅ Quadro Kanban para acompanhamento das atividades
* ✅ Otimização de rotas
* ✅ Agrupamento de coletas por região
* ✅ Alertas automáticos
* ✅ Relatórios analíticos
* ✅ Monitoramento em tempo real
* ✅ Priorização automática de tarefas

---

## ⚙️ Funcionalidades

### 📦 Gestão Operacional

* Cadastro de coletas
* Controle de veículos
* Controle de motoristas
* Comunicação entre usuários
* Quadro Kanban

### 🗺️ Otimização Logística

* Cálculo de rotas eficientes
* Agrupamento automático por região
* Previsão de atrasos
* Detecção de gargalos

### 📊 Relatórios e Indicadores

* Tempo médio por etapa
* Taxa de atrasos
* Produtividade por veículo
* Relatórios gerenciais

### 🤖 Inteligência Operacional

* Sugestão automática de priorização
* Recomendação de veículo ideal
* Identificação de fluxos acima do tempo esperado
* Apoio à tomada de decisão

---

## 🏗️ Arquitetura

O sistema segue uma arquitetura em três camadas:

```text
Apresentação
      ↓
Regras de Negócio
      ↓
Banco de Dados
```

### Camada de Apresentação

Interface web/mobile para interação dos usuários.

### Camada de Negócio

Processamento das regras logísticas, automações e inteligência operacional.

### Camada de Dados

Armazenamento de usuários, veículos, coletas, rotas e indicadores.

---

## 💻 Tecnologias

Tudo gratuito.

| Camada         | Tecnologia                                                        |
| -------------- | ----------------------------------------------------------------- |
| Frontend       | React (PWA), shadcn/ui, react-hook-form + zod                     |
| Backend        | Supabase: Auth por perfil, Realtime e Edge Functions              |
| Banco de Dados | PostgreSQL (Supabase)                                             |
| Mapas e rotas  | MapLibre + tiles gratuitos, OpenRouteService (otimização VROOM)   |

---

## 📁 Estrutura do Projeto

```text
N3_PAC/
├── docs/                   # Documentação técnica
│   └── setup.md            # Como configurar o ambiente do zero
├── supabase/               # Banco de dados
│   ├── migrations/         # Schema versionado (tabelas, RLS, funções)
│   ├── seed.sql            # Dados de exemplo para o banco local
│   └── config.toml         # Configuração do Supabase local
├── .claude/skills/         # Skills do Claude Code usadas no projeto
├── .vscode/                # Extensões recomendadas do VS Code
├── .mcp.json               # Servidores MCP (shadcn)
└── package.json            # Scripts do projeto (npm run db:*)
```

Próximas pastas, conforme o desenvolvimento avançar:

| Pasta                       | Para quê                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `src/features/motorista/`   | App do motorista: rota do dia, aceite de coletas, GPS          |
| `src/features/escritorio/`  | Dashboard, rastreador, lançar coleta, Kanban, cadastro de empresas |
| `src/components/ui/`        | Componentes do shadcn/ui                                       |
| `src/lib/`                  | Cliente do Supabase e chamadas ao OpenRouteService             |
| `supabase/functions/`       | Edge Functions (cálculo e recálculo de rotas)                  |

---

## ▶️ Como rodar

```powershell
npm install
npm run db:start   # sobe o banco local (precisa do Docker Desktop aberto)
npm run db:reset   # aplica as migrations e o seed
```

Passo a passo completo em [docs/setup.md](docs/setup.md).

---

## 🚀 Diferenciais

O projeto busca unir recursos que normalmente são encontrados separadamente em diferentes sistemas:

* Kanban para gestão visual
* Otimização inteligente de rotas
* Detecção automática de gargalos
* Monitoramento em tempo real
* Alertas automáticos
* Apoio inteligente à tomada de decisão

---

## 📈 Resultados Esperados

* Redução de atrasos operacionais
* Melhoria da comunicação entre equipes
* Aumento da produtividade
* Melhor aproveitamento da frota
* Maior controle das coletas
* Redução de erros manuais
* Tomada de decisão mais eficiente

---

## 🎓 Informações Acadêmicas

**Disciplina:** Projeto Aplicado de Curso (PAC)
**Instituição:** Católica SC
**Autor:** Matheus Lorenzetti
**Ano:** 2026

---

## 📄 Licença

Projeto desenvolvido exclusivamente para fins acadêmicos.
