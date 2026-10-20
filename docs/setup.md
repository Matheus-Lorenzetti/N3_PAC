# 🛠️ Como configurar o projeto em outro computador

Tudo pelo terminal. Use o **PowerShell** (Windows).

---

## 1. Programas

```powershell
winget install Git.Git OpenJS.NodeJS.LTS Microsoft.VisualStudioCode Docker.DockerDesktop
```

> O Docker Desktop precisa do WSL2 e da virtualização ligada na BIOS. Ele roda o banco de dados local (passo 6).

⚠️ **Feche e abra o terminal de novo** depois disso (para os comandos `git`, `node` e `code` funcionarem).

Instalar o Claude Code no terminal (necessário para os plugins):

```powershell
npm install -g @anthropic-ai/claude-code
```

---

## 2. Baixar o projeto

```powershell
git clone https://github.com/Matheus-Lorenzetti/N3_PAC.git
cd N3_PAC
npm install
```

Na primeira vez que fizer `git push`, o navegador abre pedindo login no GitHub. É só autorizar.

---

## 3. Extensões do VS Code

Copie e cole tudo de uma vez:

```powershell
code --install-extension anthropic.claude-code
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dbaeumer.vscode-eslint
code --install-extension eamodio.gitlens
code --install-extension mtxr.sqltools
code --install-extension pomdtr.excalidraw-editor
code --install-extension rangav.vscode-thunder-client
code --install-extension rvest.vs-code-prettier-eslint
code --install-extension sinclair.react-developer-tools
code --install-extension supabase.vscode-supabase-extension
code --install-extension upstash.context7-mcp
code --install-extension usernamehw.errorlens
code --install-extension vijaynirmal.playwright-mcp-relay
code --install-extension willasm.obsidian-md-vsc
code --install-extension yoavbls.pretty-ts-errors
```

> Alternativa: ao abrir a pasta no VS Code, ele mostra um aviso **"Instalar extensões recomendadas"** (lista em `.vscode/extensions.json`). É só clicar.

---

## 4. Plugins do Claude Code (Caveman e Obsidian)

Os plugins **não vão junto com o git**. Instale pelo terminal, dentro da pasta do projeto:

```powershell
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman --scope project

claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills --scope project
```

> Se der erro, faça pelo chat do Claude Code: `/plugin marketplace add JuliusBrussee/caveman` e `/plugin install caveman@caveman` (mesma coisa para o Obsidian).

O **Caveman** começa desligado (configurado no `.caveman.json`). Para ligar, use `/caveman` no chat.

---

## 5. Skills e MCP

✅ **Não precisa fazer nada.**

- **Skills**: já vêm no repositório (`.claude/skills/`). Se alguma sumir: `npx skills experimental_install`
- **MCP do shadcn**: já configurado no `.mcp.json`. Ao abrir o Claude Code a primeira vez, ele pergunta se pode usar o servidor **shadcn** → **aceitar**. Para conferir: `/mcp` no chat.

---

## 6. Banco de dados local (Supabase)

O banco roda **no seu computador**, sem criar conta no Supabase. Antes, abra o **Docker Desktop** e espere ele ficar pronto.

```powershell
npm run db:start    # sobe o banco (a 1ª vez baixa as imagens e demora)
npm run db:reset    # recria o banco do zero: aplica supabase/migrations + supabase/seed.sql
npm run db:status   # mostra as URLs e as chaves locais
npm run db:stop     # desliga
```

- **Studio** (painel visual do banco): http://localhost:54323
- **API**: http://localhost:54321
- **Postgres direto** (SQLTools, DBeaver etc.): `postgresql://postgres:postgres@localhost:54322/postgres`

---

## ✅ Checklist rápido

- [ ] `winget install ...` e reabrir o terminal
- [ ] `npm install -g @anthropic-ai/claude-code`
- [ ] `git clone` + `npm install`
- [ ] Extensões do VS Code
- [ ] Plugins Caveman e Obsidian
- [ ] Aceitar o MCP do shadcn
- [ ] Abrir o Docker Desktop e rodar `npm run db:start`
