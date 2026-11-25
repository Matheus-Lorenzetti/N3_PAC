// Roda antes de cada arquivo de teste: liga os comparadores de tela
// (toBeInTheDocument etc.) e limpa a tela e o navegador de mentira entre os testes

import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// localStorage em memória, igual em qualquer versão do Node
// (o que vem no Node 25 chega incompleto aos testes)
function criarArmazenamento(): Storage {
  const dados = new Map<string, string>()
  return {
    get length() {
      return dados.size
    },
    clear: () => dados.clear(),
    getItem: (chave) => dados.get(chave) ?? null,
    key: (indice) => [...dados.keys()][indice] ?? null,
    removeItem: (chave) => void dados.delete(chave),
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
  }
}

// Os testes do backend rodam sem navegador (ambiente node)
const temNavegador = typeof window !== "undefined"

if (temNavegador) {
  Object.defineProperty(globalThis, "localStorage", {
    value: criarArmazenamento(),
    configurable: true,
  })
}

afterEach(() => {
  if (!temNavegador) return
  cleanup()
  localStorage.clear()
})
