import { type Ponto } from "@/lib/ors"
import { buscarTodas } from "@/lib/paginacao"
import {
  distanciaKm,
  hojeEmBrasilia,
  type ServicoSituacao,
} from "@/lib/servicos"
import { supabase, type Tabela } from "@/lib/supabase"

// Funções da tela do motorista que não dependem do React: dados do dia,
// ordem manual guardada no celular e gravação da rota no banco

export type Empresa = Tabela<"empresas">

export type ParadaOrdenada = {
  servico: ServicoSituacao
  empresa: Empresa | undefined
  // false = fora do mapa (empresa sem localização ou sem rota possível)
  noMapa: boolean
  // null = ainda sem previsão (rota calculando ou fora do mapa)
  chegadaSeg: number | null
}

// Ordem escolhida pelo motorista: vale só no dia e fica no próprio celular
export function chaveOrdemManual(motoristaId: string) {
  const hoje = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  })
  return `ordem-manual:${motoristaId}:${hoje}`
}

export function lerOrdemManual(motoristaId: string): number[] | null {
  try {
    const texto = localStorage.getItem(chaveOrdemManual(motoristaId))
    return texto ? (JSON.parse(texto) as number[]) : null
  } catch {
    return null
  }
}

// Encaixa a parada onde ela menos alonga o caminho (a rota termina na sede)
export function inserirNoMelhorLugar<P extends Ponto>(
  ordem: P[],
  nova: P,
  sede: Ponto
) {
  let melhor = ordem.length
  let menorAcrescimo = Infinity
  for (let i = 0; i <= ordem.length; i++) {
    const depois = ordem[i] ?? sede
    const antes = ordem[i - 1]
    const acrescimo = antes
      ? distanciaKm(antes, nova) +
        distanciaKm(nova, depois) -
        distanciaKm(antes, depois)
      : distanciaKm(nova, depois)
    if (acrescimo < menorAcrescimo) {
      menorAcrescimo = acrescimo
      melhor = i
    }
  }
  ordem.splice(melhor, 0, nova)
}

export async function buscarDados() {
  const [servicos, empresas, veiculo, ultima, rotaHoje] = await Promise.all([
    // A RLS já devolve só os serviços deste motorista
    supabase
      .from("servicos_situacao")
      .select("*")
      .neq("situacao", "realizada")
      .order("criado_em"),
    buscarTodas((de, ate) =>
      supabase
        .from("empresas")
        .select("*")
        .eq("ativo", true)
        .order("nome")
        .order("id")
        .range(de, ate)
    ),
    // Veículo que o motorista assumiu no login
    supabase.from("veiculos").select("placa").maybeSingle(),
    // Última posição enviada hoje, a mesma da placa no mapa do escritório
    // (a RLS devolve só a deste motorista)
    supabase
      .from("ultimas_localizacoes")
      .select("latitude, longitude")
      .gte("registrado_em", `${hojeEmBrasilia()}T00:00:00-03:00`)
      .maybeSingle(),
    // Rota de hoje gravada no banco (pode ter vindo do escritório)
    supabase
      .from("rotas")
      .select("*")
      .eq("data", hojeEmBrasilia())
      .maybeSingle(),
  ])
  const lista = empresas.data ?? []
  return {
    servicos: servicos.data ?? [],
    empresas: new Map(lista.map((e) => [e.id, e])),
    sede: lista.find((e) => e.eh_sede) ?? null,
    placa: veiculo.data?.placa ?? null,
    ultimaPosicao:
      ultima.data?.latitude != null && ultima.data.longitude != null
        ? { latitude: ultima.data.latitude, longitude: ultima.data.longitude }
        : null,
    rotaHoje: rotaHoje.data,
  }
}

// Mais longe que isso da linha = saiu do caminho; refaz o traçado
export const DESVIO_MAXIMO_M = 300
// Intervalo mínimo entre dois refazimentos por desvio (poupa a cota)
export const INTERVALO_DESVIO_MS = 2 * 60 * 1000

export type Dados = Awaited<ReturnType<typeof buscarDados>>

// Grava a rota do dia para o mapa do escritório (uma linha por motorista por dia)
export function gravarRota(rota: {
  ordem: number[]
  linha: [number, number][]
  distanciaM: number
  duracaoSeg: number
  manual: boolean
}) {
  supabase
    .from("rotas")
    .upsert({
      ordem: rota.ordem,
      origem: "motorista",
      manual: rota.manual,
      linha: rota.linha,
      distancia_m: rota.distanciaM,
      duracao_s: rota.duracaoSeg,
      calculada_em: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.warn("[rota] não foi possível gravar", error)
    })
}

export function posicaoAtual(): Promise<GeolocationPosition | null> {
  return new Promise((resolver) => {
    if (!navigator.geolocation) return resolver(null)
    navigator.geolocation.getCurrentPosition(resolver, () => resolver(null), {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60_000,
    })
  })
}

// Navegação curva a curva fica com o Waze (voz, radares e lombadas);
// ele segue falando em segundo plano enquanto o nosso app manda o GPS
export function linkWaze(destino: {
  latitude: number | null
  longitude: number | null
}) {
  return `https://waze.com/ul?ll=${destino.latitude},${destino.longitude}&navigate=yes`
}

export function minutos(segundos: number) {
  return `${Math.max(1, Math.round(segundos / 60))} min`
}
