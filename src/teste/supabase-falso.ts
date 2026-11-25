// Supabase de mentira para os testes: nenhuma consulta sai para a rede.
// Cada teste combina o que cada tabela devolve com falso.responder("tabela", linhas).
//
// Como usar em um arquivo de teste:
//   vi.mock("@/lib/supabase", async () => {
//     const { falso } = await import("@/teste/supabase-falso")
//     return { supabase: falso.supabase }
//   })
//   beforeEach(() => falso.reiniciar())

import { vi } from "vitest"

type Resposta = { data: unknown; error: { message: string } | null }

// Métodos de consulta que só devolvem a própria consulta (encadeáveis)
const ENCADEAVEIS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "gte",
  "lte",
  "or",
  "in",
  "order",
  "range",
  "limit",
] as const

export type ConsultaFalsa = Record<
  (typeof ENCADEAVEIS)[number] | "maybeSingle" | "single",
  ReturnType<typeof vi.fn>
> &
  PromiseLike<Resposta>

// Consulta que aceita qualquer filtro e, no await, devolve a resposta combinada
function consultaFalsa(resposta: Resposta): ConsultaFalsa {
  const consulta = {} as ConsultaFalsa
  for (const metodo of ENCADEAVEIS) consulta[metodo] = vi.fn(() => consulta)
  consulta.maybeSingle = vi.fn(() => Promise.resolve(resposta))
  consulta.single = vi.fn(() => Promise.resolve(resposta))
  consulta.then = (aoResolver, aoRejeitar) =>
    Promise.resolve(resposta).then(aoResolver, aoRejeitar)
  return consulta
}

const respostas = new Map<string, Resposta>()
const consultas: { tabela: string; consulta: ConsultaFalsa }[] = []

// Canal do Realtime: guarda a função que o app registrou para poder dispará-la
const canal = {
  on: vi.fn(),
  subscribe: vi.fn(),
}

const supabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
  channel: vi.fn(),
  removeChannel: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}

// Função que o app registrou para saber quando a sessão muda
let aoMudarSessao: ((evento: string, sessao: unknown) => void) | null = null
const cancelarSessao = vi.fn()

export const falso = {
  supabase,
  canal,

  // Volta tudo ao começo: sem respostas combinadas e sem chamadas registradas
  reiniciar() {
    respostas.clear()
    consultas.length = 0
    supabase.from.mockReset().mockImplementation((tabela: string) => {
      const consulta = consultaFalsa(
        respostas.get(tabela) ?? { data: [], error: null }
      )
      consultas.push({ tabela, consulta })
      return consulta
    })
    supabase.rpc.mockReset().mockResolvedValue({ data: null, error: null })
    supabase.functions.invoke.mockReset()
    supabase.channel.mockReset().mockReturnValue(canal)
    supabase.removeChannel.mockReset()
    supabase.auth.signInWithPassword.mockReset().mockResolvedValue({
      error: null,
    })
    supabase.auth.signOut.mockReset().mockResolvedValue({ error: null })
    aoMudarSessao = null
    cancelarSessao.mockReset()
    supabase.auth.onAuthStateChange
      .mockReset()
      .mockImplementation((ouvinte: typeof aoMudarSessao) => {
        aoMudarSessao = ouvinte
        return { data: { subscription: { unsubscribe: cancelarSessao } } }
      })
    canal.on.mockReset().mockReturnValue(canal)
    canal.subscribe.mockReset().mockReturnValue(canal)
  },

  // Avisa o app que alguém entrou (sessão) ou saiu (null), como o Supabase faz
  mudarSessao(sessao: unknown) {
    aoMudarSessao?.(sessao ? "SIGNED_IN" : "SIGNED_OUT", sessao)
  },
  cancelarSessao,

  // O que a tabela devolve a partir de agora
  responder(tabela: string, data: unknown, erro: string | null = null) {
    respostas.set(tabela, { data, error: erro ? { message: erro } : null })
  },

  // Consultas já feitas a uma tabela, na ordem
  consultasDe(tabela: string) {
    return consultas.filter((c) => c.tabela === tabela).map((c) => c.consulta)
  },
}
