import "maplibre-gl/dist/maplibre-gl.css"

import {
  LngLatBounds,
  Map as MapaLibre,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef } from "react"

import type { Posicao } from "@/features/motorista/use-gps"
import type { Ponto } from "@/lib/ors"

setWorkerUrl(workerUrl)

// OpenFreeMap: mapa do OpenStreetMap grátis e sem chave
const ESTILO = "https://tiles.openfreemap.org/styles/liberty"
const COR_ROTA = "#2563eb"

export type ParadaNoMapa = Ponto & {
  id: number
  numero: number
  tipo: "coleta" | "entrega"
}

function elemento(classes: string, texto = "") {
  const div = document.createElement("div")
  div.className = classes
  div.textContent = texto
  return div
}

export function MapaRota({
  sede,
  paradas,
  linha,
  posicao,
}: {
  sede: Ponto
  paradas: ParadaNoMapa[]
  linha: [number, number][]
  posicao: Posicao | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaLibre | null>(null)
  const marcadoresParadas = useRef<Marker[]>([])
  const marcadorPosicao = useRef<Marker | null>(null)

  // Cria o mapa uma vez, centrado na sede
  useEffect(() => {
    const instancia = new MapaLibre({
      container: container.current!,
      style: ESTILO,
      center: [sede.longitude, sede.latitude],
      zoom: 12,
      attributionControl: { compact: true },
    })
    instancia.on("load", () => {
      instancia.addSource("rota", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      instancia.addLayer({
        id: "rota-contorno",
        type: "line",
        source: "rota",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9 },
      })
      instancia.addLayer({
        id: "rota",
        type: "line",
        source: "rota",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COR_ROTA, "line-width": 5 },
      })
    })
    new Marker({
      element: elemento(
        "rounded-md bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background shadow",
        "Sede"
      ),
    })
      .setLngLat([sede.longitude, sede.latitude])
      .addTo(instancia)
    mapa.current = instancia
    return () => {
      instancia.remove()
      mapa.current = null
      marcadorPosicao.current = null
      marcadoresParadas.current = []
    }
  }, [sede.latitude, sede.longitude])

  // Linha da rota e enquadramento quando a rota muda
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return

    const desenhar = () => {
      const fonte = instancia.getSource<GeoJSONSource>("rota")
      fonte?.setData({
        type: "FeatureCollection",
        features: linha.length
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: linha },
              },
            ]
          : [],
      })
      if (linha.length) {
        const limites = linha.reduce(
          (caixa, ponto) => caixa.extend(ponto),
          new LngLatBounds(linha[0], linha[0])
        )
        // Espaço extra embaixo para o cartão da próxima parada
        instancia.fitBounds(limites, {
          padding: { top: 80, left: 40, right: 40, bottom: 200 },
          maxZoom: 15,
        })
      }
    }

    if (instancia.getSource("rota")) desenhar()
    // O "load" que cria a fonte foi registrado antes, então roda primeiro
    else instancia.once("load", desenhar)
  }, [linha])

  // Marcadores numerados na ordem de visita
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    marcadoresParadas.current.forEach((m) => m.remove())
    marcadoresParadas.current = paradas.map((parada) =>
      new Marker({
        element: elemento(
          parada.tipo === "coleta"
            ? "flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow ring-2 ring-background"
            : "flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground shadow ring-2 ring-background",
          String(parada.numero)
        ),
      })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(instancia)
    )
  }, [paradas])

  // Ponto azul da posição atual
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !posicao) return
    const ponto: [number, number] = [posicao.longitude, posicao.latitude]
    // setLngLat antes do addTo: o MapLibre precisa da posição para desenhar
    marcadorPosicao.current ??= new Marker({
      element: elemento(
        "size-4 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_6px_rgb(37_99_235/0.25)]"
      ),
    })
      .setLngLat(ponto)
      .addTo(instancia)
    marcadorPosicao.current.setLngLat(ponto)
  }, [posicao])

  // O CSS do MapLibre põe position: relative no container; por isso a caixa de fora
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
