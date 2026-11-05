import "maplibre-gl/dist/maplibre-gl.css"

import {
  LngLatBounds,
  Map as MapaLibre,
  Marker,
  setWorkerUrl,
  type ExpressionSpecification,
} from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

import type { Ponto } from "@/lib/ors"

// MapLibre 6 com Vite: o worker precisa ser informado uma vez
setWorkerUrl(workerUrl)

// OpenFreeMap: mapa do OpenStreetMap grátis e sem chave
const ESTILO = "https://tiles.openfreemap.org/styles/liberty"
export const COR_ROTA = "#2563eb"

// Elemento HTML de um marcador do mapa
export function elementoMarcador(classes: string, texto = "") {
  const div = document.createElement("div")
  div.className = classes
  div.textContent = texto
  return div
}

// Mapa centrado na sede, com o marcador dela
export function criarMapa(container: HTMLElement, sede: Ponto) {
  const mapa = new MapaLibre({
    container,
    style: ESTILO,
    center: [sede.longitude, sede.latitude],
    zoom: 12,
    attributionControl: { compact: true },
  })
  new Marker({
    element: elementoMarcador(
      "rounded-md bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background shadow",
      "Sede"
    ),
  })
    .setLngLat([sede.longitude, sede.latitude])
    .addTo(mapa)
  return mapa
}

export const COR_RESTO_ROTA = "#9ca3af"

// Fonte GeoJSON + linha com contorno branco, para ler bem sobre o mapa.
// Cada trecho pode trazer "cor" e "largura" nas propriedades.
export function adicionarCamadaRota(mapa: MapaLibre, id: string) {
  const largura: ExpressionSpecification = ["coalesce", ["get", "largura"], 5]
  mapa.addSource(id, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  })
  mapa.addLayer({
    id: `${id}-contorno`,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["+", largura, 4] },
  })
  mapa.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "cor"], COR_ROTA],
      "line-width": largura,
    },
  })
}

// Divide o traçado no ponto mais próximo da parada: [até a parada, depois dela]
export function dividirNaParada(
  linha: [number, number][],
  parada: Ponto
): [[number, number][], [number, number][]] {
  if (!linha.length) return [[], []]
  let indice = 0
  let menor = Infinity
  linha.forEach(([lon, lat], i) => {
    const d = (lon - parada.longitude) ** 2 + (lat - parada.latitude) ** 2
    if (d < menor) {
      menor = d
      indice = i
    }
  })
  return [linha.slice(0, indice + 1), linha.slice(indice)]
}

// Rota a partir de onde o motorista está: corta o que já ficou para trás e
// liga a posição ao resto da linha, sem chamar a API. Só procura no trecho até
// a próxima parada, porque a volta para a sede costuma passar pelas mesmas ruas.
// desvioM = distância da posição até a linha (saiu do caminho?)
export function rotaDaPosicao(
  linha: [number, number][],
  posicao: Ponto | null,
  proxima: Ponto | null
): { linha: [number, number][]; desvioM: number } {
  if (!posicao || linha.length < 2) return { linha, desvioM: 0 }
  const [trecho] = proxima ? dividirNaParada(linha, proxima) : [linha]

  // Metros aproximados em volta da posição (suficiente para poucos km)
  const mx = 111_320 * Math.cos((posicao.latitude * Math.PI) / 180)
  const my = 110_540
  const emMetros = ([lon, lat]: [number, number]) => [
    (lon - posicao.longitude) * mx,
    (lat - posicao.latitude) * my,
  ]

  // Ponto mais perto da posição em cada segmento do trecho
  let melhor = { distancia: Infinity, segmento: 0, ponto: trecho[0] }
  for (let i = 0; i < Math.max(1, trecho.length - 1); i++) {
    const a = trecho[i]
    const b = trecho[i + 1] ?? a
    const [ax, ay] = emMetros(a)
    const [bx, by] = emMetros(b)
    const dx = bx - ax
    const dy = by - ay
    const comprimento = dx * dx + dy * dy
    const t = comprimento
      ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / comprimento))
      : 0
    const distancia = Math.hypot(ax + t * dx, ay + t * dy)
    if (distancia < melhor.distancia) {
      melhor = {
        distancia,
        segmento: i,
        ponto: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
      }
    }
  }

  return {
    linha: [
      [posicao.longitude, posicao.latitude],
      melhor.ponto,
      ...linha.slice(melhor.segmento + 1),
    ],
    desvioM: melhor.distancia,
  }
}

// Roda agora se a camada já existe; senão, logo depois do "load" que a cria
export function quandoPronto(
  mapa: MapaLibre,
  fonte: string,
  fazer: () => void
) {
  if (mapa.getSource(fonte)) fazer()
  else mapa.once("load", fazer)
}

// Ajusta o zoom para mostrar todos os pontos
export function enquadrar(
  mapa: MapaLibre,
  pontos: [number, number][],
  padding: { top: number; left: number; right: number; bottom: number }
) {
  if (!pontos.length) return
  const limites = pontos.reduce(
    (caixa, ponto) => caixa.extend(ponto),
    new LngLatBounds(pontos[0], pontos[0])
  )
  mapa.fitBounds(limites, { padding, maxZoom: 15 })
}
