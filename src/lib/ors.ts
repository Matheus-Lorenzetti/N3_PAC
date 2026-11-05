// OpenRouteService: otimização de rota (VROOM) com a geometria já incluída.
// Uma chamada por recálculo: quando muda o conjunto ou a ordem das paradas,
// ou quando o motorista sai do caminho.
// Com fixa = true, mantém a ordem do motorista e só traça (Directions),
// sem gastar a cota de otimização.
// O pedido passa pela Edge Function otimizar-rota, que guarda a chave do ORS.

import { supabase } from "@/lib/supabase"

export type Ponto = { latitude: number; longitude: number }

export type Parada = Ponto & { id: number }

export type RotaOtimizada = {
  // ids das paradas na ordem de visita, com a chegada prevista (s desde a saída)
  ordem: { id: number; chegadaSeg: number | null }[]
  semRota: number[]
  distanciaM: number
  duracaoSeg: number
  // [longitude, latitude], formato do GeoJSON
  linha: [number, number][]
}

// Pede a rota à Edge Function e devolve a ordem, a linha, a distância e o tempo
export async function otimizarRota(pedido: {
  inicio: Ponto
  fim: Ponto
  paradas: Parada[]
  fixa?: boolean
}): Promise<RotaOtimizada> {
  const { data: dados, error } = await supabase.functions.invoke(
    "otimizar-rota",
    { body: pedido }
  )
  if (error) throw new Error("Não foi possível calcular a rota agora")

  const rota = dados.routes?.[0]
  return {
    ordem: (rota?.steps ?? [])
      .filter((passo: { type: string }) => passo.type === "job")
      .map((passo: { job: number; arrival: number }) => ({
        id: passo.job,
        chegadaSeg: passo.arrival,
      })),
    semRota: (dados.unassigned ?? []).map((u: { id: number }) => u.id),
    distanciaM: rota?.distance ?? 0,
    duracaoSeg: rota?.duration ?? 0,
    linha: rota?.geometry ? decodificarPolyline(rota.geometry) : [],
  }
}

// Formato "encoded polyline" do Google (precisão 5), usado pelo VROOM
function decodificarPolyline(texto: string): [number, number][] {
  const pontos: [number, number][] = []
  let indice = 0
  let lat = 0
  let lon = 0

  const proximoValor = () => {
    let resultado = 0
    let deslocamento = 0
    let byte: number
    do {
      byte = texto.charCodeAt(indice++) - 63
      resultado |= (byte & 0x1f) << deslocamento
      deslocamento += 5
    } while (byte >= 0x20)
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1
  }

  while (indice < texto.length) {
    lat += proximoValor()
    lon += proximoValor()
    pontos.push([lon / 1e5, lat / 1e5])
  }
  return pontos
}
