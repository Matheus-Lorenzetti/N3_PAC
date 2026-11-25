// Lógica da Edge Function otimizar-rota: calcula a rota no OpenRouteService.
// Otimiza a ordem (VROOM) ou, com fixa = true, só traça na ordem recebida
// (Directions).
// Fica separada do Deno.serve (index.ts) para poder ser testada (rota.test.ts):
// quem chama passa o fetch e os segredos em "ambiente".

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Limite de paradas por pedido (o plano grátis do ORS aceita até 50 jobs)
export const MAXIMO_PARADAS = 50
// O Directions aceita até 50 pontos: início + paradas + sede
export const MAXIMO_PARADAS_FIXA = 48

const URL_OTIMIZACAO = "https://api.openrouteservice.org/optimization"
const URL_TRACADO = "https://api.openrouteservice.org/v2/directions/driving-car"

type Ponto = { latitude: number; longitude: number }
type Parada = Ponto & { id: number }

// O que a função precisa de fora: endereço e chave pública do Supabase,
// as chaves do ORS (principal e reserva) e o fetch
export type Ambiente = {
  supabaseUrl: string
  chavePublica: string
  chavesOrs: string[]
  buscar: typeof fetch
}

const ehPonto = (p: unknown): p is Ponto =>
  typeof p === "object" &&
  p !== null &&
  Number.isFinite((p as Ponto).latitude) &&
  Number.isFinite((p as Ponto).longitude)

// Pergunta ao Supabase Auth se o token é de um usuário logado
async function usuarioLogado(autorizacao: string | null, ambiente: Ambiente) {
  if (!autorizacao?.startsWith("Bearer ")) return false
  const resposta = await ambiente.buscar(
    `${ambiente.supabaseUrl}/auth/v1/user`,
    {
      headers: { Authorization: autorizacao, apikey: ambiente.chavePublica },
    }
  )
  return resposta.ok
}

// Chama o ORS com a chave principal e, se a cota dela acabou (403/429),
// com a reserva. Devolve a última resposta
async function chamarOrs(url: string, corpo: unknown, ambiente: Ambiente) {
  let ors: Response | null = null
  for (const chave of ambiente.chavesOrs) {
    ors = await ambiente.buscar(url, {
      method: "POST",
      headers: { Authorization: chave, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    })
    if (ors.status !== 403 && ors.status !== 429) break
  }
  return ors!
}

// Resposta em JSON, já com os cabeçalhos de CORS
function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// Atende um pedido: confere o método, o login e os dados, e chama o ORS
export async function tratarPedido(
  pedido: Request,
  ambiente: Ambiente
): Promise<Response> {
  if (pedido.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (pedido.method !== "POST") return resposta({ erro: "Use POST" }, 405)
  if (!(await usuarioLogado(pedido.headers.get("Authorization"), ambiente))) {
    return resposta({ erro: "Faça login para calcular rotas" }, 401)
  }
  if (!ambiente.chavesOrs.length) {
    return resposta({ erro: "ORS_API_KEY não configurada" }, 500)
  }

  let entrada: {
    inicio?: unknown
    fim?: unknown
    paradas?: unknown
    fixa?: unknown
  }
  try {
    entrada = await pedido.json()
  } catch {
    return resposta({ erro: "JSON inválido" }, 400)
  }

  const { inicio, fim, paradas, fixa } = entrada
  if (
    !ehPonto(inicio) ||
    !ehPonto(fim) ||
    !Array.isArray(paradas) ||
    paradas.length === 0 ||
    paradas.length > MAXIMO_PARADAS ||
    !paradas.every((p) => ehPonto(p) && Number.isInteger((p as Parada).id))
  ) {
    return resposta({ erro: "Informe inicio, fim e de 1 a 50 paradas" }, 400)
  }

  const paraLonLat = (p: Ponto) => [p.longitude, p.latitude]

  // Ordem escolhida pelo motorista: só traça a rota (Directions), sem otimizar.
  // A resposta imita a do VROOM para o app ler os dois do mesmo jeito.
  if (fixa === true) {
    const lista = paradas as Parada[]
    if (lista.length > MAXIMO_PARADAS_FIXA) {
      return resposta(
        { erro: `Ordem manual aceita até ${MAXIMO_PARADAS_FIXA} paradas` },
        400
      )
    }
    const ors = await chamarOrs(
      URL_TRACADO,
      { coordinates: [inicio, ...lista, fim].map(paraLonLat) },
      ambiente
    )
    if (!ors.ok) {
      return resposta({ erro: `OpenRouteService respondeu ${ors.status}` }, 502)
    }
    const rota = (await ors.json()).routes?.[0]
    // Um trecho por perna: até a 1ª parada, até a 2ª, ..., até a sede
    const trechos: { duration?: number }[] = rota?.segments ?? []
    let chegada = 0
    const steps = lista.map((parada, i) => {
      chegada += trechos[i]?.duration ?? 0
      return { type: "job", job: parada.id, arrival: chegada }
    })
    return resposta({
      routes: [
        {
          steps,
          distance: rota?.summary?.distance ?? 0,
          duration: rota?.summary?.duration ?? 0,
          geometry: rota?.geometry,
        },
      ],
      unassigned: [],
    })
  }

  const ors = await chamarOrs(
    URL_OTIMIZACAO,
    {
      jobs: (paradas as Parada[]).map((p) => ({
        id: p.id,
        location: paraLonLat(p),
      })),
      vehicles: [
        {
          id: 1,
          profile: "driving-car",
          start: paraLonLat(inicio),
          end: paraLonLat(fim),
        },
      ],
      options: { g: true },
    },
    ambiente
  )

  if (!ors.ok) {
    return resposta({ erro: `OpenRouteService respondeu ${ors.status}` }, 502)
  }
  return resposta(await ors.json())
}
