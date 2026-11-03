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

// Roda agora se a camada já existe; senão, logo depois do "load" que a cria
export function quandoPronto(
  mapa: MapaLibre,
  fonte: string,
  fazer: () => void
) {
  if (mapa.getSource(fonte)) fazer()
  else mapa.once("load", fazer)
}

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
