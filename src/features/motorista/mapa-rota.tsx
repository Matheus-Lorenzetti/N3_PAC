import { Map as MapaLibre, Marker, type GeoJSONSource } from "maplibre-gl"
import { useEffect, useRef } from "react"

import type { Posicao } from "@/features/motorista/use-gps"
import {
  adicionarCamadaRota,
  criarMapa,
  elementoMarcador,
  enquadrar,
  quandoPronto,
} from "@/lib/mapa"
import type { Ponto } from "@/lib/ors"

export type ParadaNoMapa = Ponto & {
  id: number
  numero: number
  tipo: "coleta" | "entrega"
}

export function classeParada(tipo: "coleta" | "entrega") {
  // Coleta = círculo, entrega = quadrado
  return `flex size-7 items-center justify-center bg-primary text-xs font-bold text-primary-foreground shadow ring-2 ring-background ${
    tipo === "coleta" ? "rounded-full" : "rounded-md"
  }`
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
  const { latitude, longitude } = sede
  useEffect(() => {
    const instancia = criarMapa(container.current!, { latitude, longitude })
    instancia.on("load", () => adicionarCamadaRota(instancia, "rota"))
    mapa.current = instancia
    return () => {
      instancia.remove()
      mapa.current = null
      marcadorPosicao.current = null
      marcadoresParadas.current = []
    }
  }, [latitude, longitude])

  // Linha da rota e enquadramento quando a rota muda
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    quandoPronto(instancia, "rota", () => {
      instancia.getSource<GeoJSONSource>("rota")?.setData({
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
      // Espaço extra embaixo para o cartão da próxima parada
      enquadrar(instancia, linha, { top: 80, left: 40, right: 40, bottom: 200 })
    })
  }, [linha])

  // Marcadores numerados na ordem de visita
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    marcadoresParadas.current.forEach((m) => m.remove())
    marcadoresParadas.current = paradas.map((parada) =>
      new Marker({
        element: elementoMarcador(
          classeParada(parada.tipo),
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
      element: elementoMarcador(
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
