// Edge Function: calcula a rota no OpenRouteService. Otimiza a ordem (VROOM)
// ou, com fixa = true, só traça na ordem recebida (Directions).
// A chave do ORS fica só no servidor (segredo ORS_API_KEY), nunca no navegador.
// Só usuários logados chamam: a função confere a sessão no Supabase Auth
// (a chave pública sozinha não basta).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Limite de paradas por pedido (o plano grátis do ORS aceita até 50 jobs)
const MAXIMO_PARADAS = 50
// O Directions aceita até 50 pontos: início + paradas + sede
const MAXIMO_PARADAS_FIXA = 48

type Ponto = { latitude: number; longitude: number }
type Parada = Ponto & { id: number }

const ehPonto = (p: unknown): p is Ponto =>
  typeof p === "object" &&
  p !== null &&
  Number.isFinite((p as Ponto).latitude) &&
  Number.isFinite((p as Ponto).longitude)

// Pergunta ao Supabase Auth se o token é de um usuário logado
async function usuarioLogado(autorizacao: string | null) {
  if (!autorizacao?.startsWith("Bearer ")) return false
  const resposta = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: autorizacao,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
  })
  return resposta.ok
}

// Resposta em JSON, já com os cabeçalhos de CORS
function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (pedido.method !== "POST") return resposta({ erro: "Use POST" }, 405)
  if (!(await usuarioLogado(pedido.headers.get("Authorization")))) {
    return resposta({ erro: "Faça login para calcular rotas" }, 401)
  }

  const chave = Deno.env.get("ORS_API_KEY")
  if (!chave) return resposta({ erro: "ORS_API_KEY não configurada" }, 500)

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
    const ors = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      {
        method: "POST",
        headers: { Authorization: chave, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [inicio, ...lista, fim].map(paraLonLat),
        }),
      }
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

  const ors = await fetch("https://api.openrouteservice.org/optimization", {
    method: "POST",
    headers: { Authorization: chave, "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  })

  if (!ors.ok) {
    return resposta({ erro: `OpenRouteService respondeu ${ors.status}` }, 502)
  }
  return resposta(await ors.json())
})
