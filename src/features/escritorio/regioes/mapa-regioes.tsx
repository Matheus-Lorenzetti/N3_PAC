import { Map as MapaLibre, Marker, type GeoJSONSource } from "maplibre-gl"
import { useEffect, useRef } from "react"

import { corDoTexto } from "@/features/escritorio/regioes/agrupamento"
import {
  criarMapa,
  elementoMarcador,
  enquadrar,
  quandoPronto,
} from "@/lib/mapa"
import type { Ponto } from "@/lib/ors"

export type CentroRegiao = Ponto & { nome: string; cor: string }

const COR_FORA_DA_AREA = "#9ca3af"

export function MapaRegioes({
  sede,
  pontos,
  centros,
}: {
  sede: Ponto
  // cor null = fora da área de atendimento
  pontos: (Ponto & { cor: string | null })[]
  centros: CentroRegiao[]
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaLibre | null>(null)
  const marcadoresCentros = useRef<Marker[]>([])
  const enquadrado = useRef(false)

  const { latitude, longitude } = sede
  useEffect(() => {
    const instancia = criarMapa(container.current!, { latitude, longitude })
    instancia.on("load", () => {
      instancia.addSource("empresas", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      // Contorno branco: separa pontos vizinhos e dá contraste às cores claras
      instancia.addLayer({
        id: "empresas",
        type: "circle",
        source: "empresas",
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "cor"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      })
    })
    mapa.current = instancia
    return () => {
      instancia.remove()
      mapa.current = null
      marcadoresCentros.current = []
      enquadrado.current = false
    }
  }, [latitude, longitude])

  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    quandoPronto(instancia, "empresas", () => {
      instancia.getSource<GeoJSONSource>("empresas")?.setData({
        type: "FeatureCollection",
        features: pontos.map((p) => ({
          type: "Feature",
          properties: { cor: p.cor ?? COR_FORA_DA_AREA },
          geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
        })),
      })
      // Enquadra uma vez, só nas empresas da área (as de fora estão a centenas de km)
      if (!enquadrado.current && pontos.length) {
        enquadrado.current = true
        enquadrar(
          instancia,
          pontos
            .filter((p) => p.cor)
            .map((p) => [p.longitude, p.latitude] as [number, number]),
          { top: 40, left: 40, right: 40, bottom: 40 }
        )
      }
    })
  }, [pontos])

  // Nome de cada região no centro do grupo
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    marcadoresCentros.current.forEach((m) => m.remove())
    marcadoresCentros.current = centros.map((centro) => {
      const elemento = elementoMarcador(
        "rounded-full border-2 border-white px-2 py-0.5 text-xs font-semibold shadow-md",
        centro.nome
      )
      elemento.style.backgroundColor = centro.cor
      elemento.style.color = corDoTexto(centro.cor)
      return new Marker({ element: elemento })
        .setLngLat([centro.longitude, centro.latitude])
        .addTo(instancia)
    })
  }, [centros])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
