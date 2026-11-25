// @vitest-environment node
// Testes do backend: a Edge Function que calcula a rota no OpenRouteService.
// O Supabase Auth e o ORS são trocados por um fetch de mentira.

import { describe, expect, it, vi } from "vitest"

import {
  MAXIMO_PARADAS,
  MAXIMO_PARADAS_FIXA,
  tratarPedido,
  type Ambiente,
} from "./rota.ts"

const SEDE = { latitude: -26.4855, longitude: -49.0714 }
const PARADAS = [
  { id: 10, latitude: -26.47, longitude: -49.09 },
  { id: 20, latitude: -26.5, longitude: -49.05 },
]

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status })

// Ambiente de mentira: o login responde "logado" e o ORS responde o combinado
function criarAmbiente({
  logado = true,
  chavesOrs = ["chave-1"],
  ors = () => json({ routes: [] }),
}: {
  logado?: boolean
  chavesOrs?: string[]
  ors?: (chave: string, url: string, corpo: unknown) => Response
} = {}) {
  const buscar = vi.fn(
    async (url: string | URL | Request, opcoes?: RequestInit) => {
      const endereco = String(url)
      if (endereco.endsWith("/auth/v1/user")) {
        return new Response("{}", { status: logado ? 200 : 401 })
      }
      const cabecalhos = opcoes?.headers as Record<string, string>
      return ors(
        cabecalhos.Authorization,
        endereco,
        JSON.parse(String(opcoes?.body))
      )
    }
  )
  const ambiente: Ambiente = {
    supabaseUrl: "http://supabase.teste",
    chavePublica: "chave-publica",
    chavesOrs,
    buscar: buscar as unknown as typeof fetch,
  }
  return { ambiente, buscar }
}

function pedido(
  corpo: unknown,
  { metodo = "POST", token = "Bearer abc" } = {}
) {
  return new Request("http://funcao.teste/otimizar-rota", {
    method: metodo,
    headers: token ? { Authorization: token } : {},
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  })
}

const pedidoValido = { inicio: SEDE, fim: SEDE, paradas: PARADAS }

// Chamadas feitas ao ORS (sem a do login)
const chamadasOrs = (buscar: ReturnType<typeof vi.fn>) =>
  buscar.mock.calls.filter(([url]) => String(url).includes("api.heigit.org"))

describe("otimizar-rota: quem pode chamar", () => {
  it("responde ao OPTIONS do navegador com os cabeçalhos de CORS", async () => {
    const { ambiente, buscar } = criarAmbiente()
    const resposta = await tratarPedido(
      pedido(null, { metodo: "OPTIONS" }),
      ambiente
    )
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(buscar).not.toHaveBeenCalled()
  })

  it("recusa métodos diferentes de POST", async () => {
    const { ambiente } = criarAmbiente()
    const resposta = await tratarPedido(
      pedido(null, { metodo: "GET" }),
      ambiente
    )
    expect(resposta.status).toBe(405)
    expect(await resposta.json()).toEqual({ erro: "Use POST" })
  })

  it("recusa quem não mandou o token de login", async () => {
    const { ambiente, buscar } = criarAmbiente()
    const resposta = await tratarPedido(
      pedido(pedidoValido, { token: "" }),
      ambiente
    )
    expect(resposta.status).toBe(401)
    // Sem token nem chega a perguntar ao Supabase Auth
    expect(buscar).not.toHaveBeenCalled()
  })

  it("recusa token que o Supabase Auth não reconhece, sem gastar a cota do ORS", async () => {
    const { ambiente, buscar } = criarAmbiente({ logado: false })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(401)
    expect(chamadasOrs(buscar)).toHaveLength(0)
  })

  it("confere o token no Supabase Auth com a chave pública", async () => {
    const { ambiente, buscar } = criarAmbiente()
    await tratarPedido(pedido(pedidoValido), ambiente)
    const [url, opcoes] = buscar.mock.calls[0]
    expect(url).toBe("http://supabase.teste/auth/v1/user")
    expect(opcoes?.headers).toEqual({
      Authorization: "Bearer abc",
      apikey: "chave-publica",
    })
  })

  it("avisa quando a chave do ORS não foi configurada", async () => {
    const { ambiente } = criarAmbiente({ chavesOrs: [] })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(500)
    expect(await resposta.json()).toEqual({
      erro: "ORS_API_KEY não configurada",
    })
  })
})

describe("otimizar-rota: validação do pedido", () => {
  const invalidos: [string, unknown][] = [
    ["sem início", { fim: SEDE, paradas: PARADAS }],
    ["sem fim", { inicio: SEDE, paradas: PARADAS }],
    ["início sem longitude", { ...pedidoValido, inicio: { latitude: -26 } }],
    ["paradas que não são lista", { ...pedidoValido, paradas: "10" }],
    ["nenhuma parada", { ...pedidoValido, paradas: [] }],
    [
      "parada sem id",
      { ...pedidoValido, paradas: [{ latitude: -26, longitude: -49 }] },
    ],
    [
      "parada com coordenada que não é número",
      { ...pedidoValido, paradas: [{ id: 1, latitude: "x", longitude: -49 }] },
    ],
    [
      "mais paradas que o limite do ORS",
      {
        ...pedidoValido,
        paradas: Array.from({ length: MAXIMO_PARADAS + 1 }, (_, i) => ({
          ...PARADAS[0],
          id: i,
        })),
      },
    ],
  ]

  it.each(invalidos)("recusa pedido %s", async (_nome, corpo) => {
    const { ambiente, buscar } = criarAmbiente()
    const resposta = await tratarPedido(pedido(corpo), ambiente)
    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({
      erro: "Informe inicio, fim e de 1 a 50 paradas",
    })
    expect(chamadasOrs(buscar)).toHaveLength(0)
  })

  it("recusa corpo que não é JSON", async () => {
    const { ambiente } = criarAmbiente()
    const resposta = await tratarPedido(
      new Request("http://funcao.teste/otimizar-rota", {
        method: "POST",
        headers: { Authorization: "Bearer abc" },
        body: "isto não é json",
      }),
      ambiente
    )
    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({ erro: "JSON inválido" })
  })

  it("na ordem manual aceita menos paradas, porque o traçado leva início e sede", async () => {
    const { ambiente, buscar } = criarAmbiente()
    const paradas = Array.from({ length: MAXIMO_PARADAS_FIXA + 1 }, (_, i) => ({
      ...PARADAS[0],
      id: i,
    }))
    const resposta = await tratarPedido(
      pedido({ ...pedidoValido, paradas, fixa: true }),
      ambiente
    )
    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({
      erro: "Ordem manual aceita até 48 paradas",
    })
    expect(chamadasOrs(buscar)).toHaveLength(0)
  })
})

describe("otimizar-rota: otimização (VROOM)", () => {
  it("manda as paradas como jobs e a sede como início e fim, em [longitude, latitude]", async () => {
    const { ambiente, buscar } = criarAmbiente()
    await tratarPedido(pedido(pedidoValido), ambiente)

    const [[url, opcoes]] = chamadasOrs(buscar)
    expect(url).toBe("https://api.heigit.org/vroom/v0")
    expect(JSON.parse(String(opcoes?.body))).toEqual({
      jobs: [
        { id: 10, location: [-49.09, -26.47] },
        { id: 20, location: [-49.05, -26.5] },
      ],
      vehicles: [
        {
          id: 1,
          profile: "driving-car",
          start: [-49.0714, -26.4855],
          end: [-49.0714, -26.4855],
        },
      ],
      options: { g: true },
    })
  })

  it("devolve a resposta do ORS como veio, com CORS", async () => {
    const doOrs = { routes: [{ steps: [], distance: 1200 }], unassigned: [] }
    const { ambiente } = criarAmbiente({ ors: () => json(doOrs) })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(await resposta.json()).toEqual(doOrs)
  })

  it("responde 502 quando o ORS falha", async () => {
    const { ambiente } = criarAmbiente({ ors: () => json({}, 500) })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(502)
    expect(await resposta.json()).toEqual({
      erro: "OpenRouteService respondeu 500",
    })
  })
})

describe("otimizar-rota: chave reserva do ORS", () => {
  it.each([403, 429])(
    "tenta a chave reserva quando a principal responde %i (cota do dia)",
    async (status) => {
      const { ambiente, buscar } = criarAmbiente({
        chavesOrs: ["principal", "reserva"],
        ors: (chave) =>
          chave === "principal" ? json({}, status) : json({ routes: [] }),
      })
      const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
      expect(resposta.status).toBe(200)
      const chaves = chamadasOrs(buscar).map(
        ([, opcoes]) =>
          (opcoes?.headers as Record<string, string>).Authorization
      )
      expect(chaves).toEqual(["principal", "reserva"])
    }
  )

  it("não gasta a reserva quando a principal funciona", async () => {
    const { ambiente, buscar } = criarAmbiente({
      chavesOrs: ["principal", "reserva"],
    })
    await tratarPedido(pedido(pedidoValido), ambiente)
    expect(chamadasOrs(buscar)).toHaveLength(1)
  })

  it("não troca de chave em erro que não é de cota", async () => {
    const { ambiente, buscar } = criarAmbiente({
      chavesOrs: ["principal", "reserva"],
      ors: () => json({}, 500),
    })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(502)
    expect(chamadasOrs(buscar)).toHaveLength(1)
  })

  it("responde 502 quando as duas chaves estão sem cota", async () => {
    const { ambiente, buscar } = criarAmbiente({
      chavesOrs: ["principal", "reserva"],
      ors: () => json({}, 429),
    })
    const resposta = await tratarPedido(pedido(pedidoValido), ambiente)
    expect(resposta.status).toBe(502)
    expect(await resposta.json()).toEqual({
      erro: "OpenRouteService respondeu 429",
    })
    expect(chamadasOrs(buscar)).toHaveLength(2)
  })
})

describe("otimizar-rota: ordem manual do motorista (fixa)", () => {
  const pedidoFixo = { ...pedidoValido, fixa: true }

  it("só traça a rota, na ordem recebida: início, paradas e sede", async () => {
    const { ambiente, buscar } = criarAmbiente()
    await tratarPedido(pedido(pedidoFixo), ambiente)

    const [[url, opcoes]] = chamadasOrs(buscar)
    expect(url).toBe(
      "https://api.heigit.org/openrouteservice/v2/directions/driving-car"
    )
    expect(JSON.parse(String(opcoes?.body))).toEqual({
      coordinates: [
        [-49.0714, -26.4855],
        [-49.09, -26.47],
        [-49.05, -26.5],
        [-49.0714, -26.4855],
      ],
    })
  })

  it("devolve no formato do VROOM, com a chegada acumulada em cada parada", async () => {
    const { ambiente } = criarAmbiente({
      ors: () =>
        json({
          routes: [
            {
              // Um trecho por perna: até a 1ª, até a 2ª e a volta para a sede
              segments: [
                { duration: 300 },
                { duration: 420 },
                { duration: 600 },
              ],
              summary: { distance: 15400, duration: 1320 },
              geometry: "abc",
            },
          ],
        }),
    })
    const resposta = await tratarPedido(pedido(pedidoFixo), ambiente)
    expect(await resposta.json()).toEqual({
      routes: [
        {
          steps: [
            { type: "job", job: 10, arrival: 300 },
            { type: "job", job: 20, arrival: 720 },
          ],
          distance: 15400,
          duration: 1320,
          geometry: "abc",
        },
      ],
      unassigned: [],
    })
  })

  it("mantém a ordem mesmo se o ORS não devolver rota", async () => {
    const { ambiente } = criarAmbiente({ ors: () => json({}) })
    const resposta = await tratarPedido(pedido(pedidoFixo), ambiente)
    expect(await resposta.json()).toEqual({
      routes: [
        {
          steps: [
            { type: "job", job: 10, arrival: 0 },
            { type: "job", job: 20, arrival: 0 },
          ],
          distance: 0,
          duration: 0,
        },
      ],
      unassigned: [],
    })
  })

  it("responde 502 quando o traçado falha", async () => {
    const { ambiente } = criarAmbiente({ ors: () => json({}, 404) })
    const resposta = await tratarPedido(pedido(pedidoFixo), ambiente)
    expect(resposta.status).toBe(502)
    expect(await resposta.json()).toEqual({
      erro: "OpenRouteService respondeu 404",
    })
  })
})
