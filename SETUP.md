# 🛠️ Como configurar o projeto em outro computador

Passo a passo para deixar o ambiente igual ao original.

---

## 1. Programas para instalar

| Programa | Onde baixar | Observação |
| --- | --- | --- |
| **Git** | https://git-scm.com/downloads | Instalação padrão (next, next...) |
| **Node.js** (versão LTS) | https://nodejs.org | Já vem com o `npm` e o `npx` |
| **VS Code** | https://code.visualstudio.com | Editor |
| **Claude Code** (extensão do VS Code) | Aba de extensões do VS Code → buscar "Claude Code" | Fazer login com a conta Claude |

Para conferir se instalou certo, abra um terminal e rode:

```
git --version
node --version
```

---

## 2. Baixar o projeto

```
git clone https://github.com/Matheus-Lorenzetti/N3_PAC.git
cd N3_PAC
npm install
```

Na primeira vez que fizer `git push`, o navegador vai abrir pedindo login no GitHub. É só autorizar.

---

## 3. Skills do Claude Code

✅ **Não precisa fazer nada.** As skills já vêm junto no repositório, na pasta `.claude/skills/`.

Se alguma sumir, para reinstalar todas:

```
npx skills experimental_install
```

---

## 4. MCP do shadcn

✅ Já está configurado no arquivo `.mcp.json`.

Ao abrir o Claude Code no projeto pela primeira vez, ele pergunta se pode usar o servidor **shadcn** → clique em **aceitar**.
Para conferir, digite `/mcp` no chat do Claude Code.

---

## 5. Plugins (precisa instalar manualmente)

Os plugins **não vão junto com o git**, então em cada computador novo é preciso instalar. Digite no chat do Claude Code:

```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman

/plugin marketplace add kepano/obsidian-skills
/plugin install obsidian@obsidian-skills
```

Se perguntar o escopo, escolha **Project**.
Se o `/plugin` não funcionar na extensão, abra o terminal, digite `claude` e rode os comandos lá.

> O **Caveman** começa desligado (configurado no `.caveman.json`). Para ligar, use `/caveman`.

---

## ✅ Checklist rápido

- [ ] Git, Node.js, VS Code e Claude Code instalados
- [ ] `git clone` + `npm install`
- [ ] Aceitar o MCP do shadcn
- [ ] Instalar os plugins Caveman e Obsidian
