// OpenRouteService: otimização de rota (VROOM) com a geometria já incluída.
// Uma chamada por recálculo, só quando muda o conjunto de paradas.

export type Ponto = { latitude: number; longitude: number }

export type Parada = Ponto & { id: number }

export type RotaOtimizada = {
  // ids das paradas na ordem de visita, com a chegada prevista (s desde a saída)
  ordem: { id: number; chegadaSeg: number }[]
  semRota: number[]
  distanciaM: number
  duracaoSeg: number
  // [longitude, latitude], formato do GeoJSON
  linha: [number, number][]
}

const paraLonLat = (p: Ponto) => [p.longitude, p.latitude]

export async function otimizarRota({
  inicio,
  fim,
  paradas,
}: {
  inicio: Ponto
  fim: Ponto
  paradas: Parada[]
}): Promise<RotaOtimizada> {
  const chave = import.meta.env.VITE_ORS_API_KEY
  if (!chave) throw new Error("Falta VITE_ORS_API_KEY no .env.local")

  const resposta = await fetch(
    "https://api.openrouteservice.org/optimization",
    {
      method: "POST",
      headers: { Authorization: chave, "Content-Type": "application/json" },
      body: JSON.stringify({
        jobs: paradas.map((p) => ({ id: p.id, location: paraLonLat(p) })),
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
    }
  )
  if (!resposta.ok) {
    throw new Error(`OpenRouteService respondeu ${resposta.status}`)
  }

  const dados = await resposta.json()
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
