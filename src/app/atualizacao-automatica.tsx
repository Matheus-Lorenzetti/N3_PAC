import { useEffect } from "react"

// Recarrega a página sozinha quando sai uma versão nova no Vercel.
// Cada build gera um /assets/index-<hash>.js diferente: se o index.html do
// servidor aponta para outro arquivo, há versão nova.
// Só recarrega com a tela à vista, sem mexer há 30 s e sem janela aberta,
// para não perder o que alguém está digitando.

const INTERVALO_MS = 2 * 60_000
const PARADO_MS = 30_000

let segurando = false
let ultimoUso = Date.now()

// O app do motorista segura enquanto o alerta de coleta está na tela
export function segurarAtualizacao(ativo: boolean) {
  segurando = ativo
}

function scriptDaPagina(html: string) {
  return html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1] ?? null
}

function podeRecarregar() {
  return (
    !segurando &&
    document.visibilityState === "visible" &&
    Date.now() - ultimoUso > PARADO_MS &&
    !document.querySelector('[role="dialog"], [role="alertdialog"]')
  )
}

export function AtualizacaoAutomatica() {
  useEffect(() => {
    const atual = scriptDaPagina(document.documentElement.outerHTML)
    // No npm run dev não há build: nada a conferir
    if (import.meta.env.DEV || !atual) return

    let versaoNova = false
    async function conferir() {
      if (!versaoNova) {
        const resposta = await fetch("/", { cache: "no-store" }).catch(
          () => null
        )
        const doServidor = resposta?.ok
          ? scriptDaPagina(await resposta.text())
          : null
        versaoNova = !!doServidor && doServidor !== atual
      }
      if (versaoNova && podeRecarregar()) window.location.reload()
    }

    const usou = () => {
      ultimoUso = Date.now()
    }
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir()
    }
    const repeticao = window.setInterval(conferir, INTERVALO_MS)
    window.addEventListener("pointerdown", usou)
    window.addEventListener("keydown", usou)
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      window.clearInterval(repeticao)
      window.removeEventListener("pointerdown", usou)
      window.removeEventListener("keydown", usou)
      document.removeEventListener("visibilitychange", aoVoltar)
    }
  }, [])

  return null
}
