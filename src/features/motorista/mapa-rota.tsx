import { Map as MapaLibre, Marker, type GeoJSONSource } from "maplibre-gl"
import { useEffect, useRef } from "react"

import type { Posicao } from "@/features/motorista/use-gps"
import {
  adicionarCamadaRota,
  COR_RESTO_ROTA,
  COR_ROTA,
  criarMapa,
  dividirNaParada,
  elementoMarcador,
  enquadrar,
  quandoPronto,
  rotaDaPosicao,
} from "@/lib/mapa"
import type { Ponto } from "@/lib/ors"

export type ParadaNoMapa = Ponto & {
  id: number
  numero: number
  tipo: "coleta" | "entrega"
}

// Coleta = círculo, entrega = quadrado; a próxima parada fica em destaque
export function classeParada(tipo: "coleta" | "entrega", destaque = true) {
  return [
    "flex items-center justify-center text-xs font-bold shadow ring-2 ring-background",
    tipo === "coleta" ? "rounded-full" : "rounded-md",
    destaque
      ? "size-8 bg-primary text-primary-foreground"
      : "size-6 bg-muted text-muted-foreground",
  ].join(" ")
}

const ZOOM_SEGUINDO = 16
// Espaço embaixo para o cartão da próxima parada
const MARGEM = { top: 80, left: 40, right: 40, bottom: 220 }

export function MapaRota({
  sede,
  paradas,
  linha,
  posicao,
  seguir,
  onDeixarDeSeguir,
}: {
  sede: Ponto
  paradas: ParadaNoMapa[]
  linha: [number, number][]
  posicao: Posicao | null
  // true = câmera acompanha o motorista; false = mostra a rota toda
  seguir: boolean
  onDeixarDeSeguir: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaLibre | null>(null)
  const marcadoresParadas = useRef<Marker[]>([])
  const marcadorPosicao = useRef<Marker | null>(null)
  const deixarDeSeguir = useRef(onDeixarDeSeguir)

  useEffect(() => {
    deixarDeSeguir.current = onDeixarDeSeguir
  }, [onDeixarDeSeguir])

  // Cria o mapa uma vez, centrado na sede
  const { latitude, longitude } = sede
  useEffect(() => {
    const instancia = criarMapa(container.current!, { latitude, longitude })
    instancia.on("load", () => adicionarCamadaRota(instancia, "rota"))
    // Arrastar o mapa com o dedo sai do modo seguir
    instancia.on("dragstart", () => deixarDeSeguir.current())
    mapa.current = instancia
    return () => {
      instancia.remove()
      mapa.current = null
      marcadorPosicao.current = null
      marcadoresParadas.current = []
    }
  }, [latitude, longitude])

  // Trecho até a próxima parada em azul forte; o resto em cinza fino.
  // Em tempo real: a linha sai da posição atual (o que ficou para trás some)
  const proxima = paradas[0]
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    const visivel = rotaDaPosicao(linha, posicao, proxima ?? null).linha
    const [atual, resto] = proxima
      ? dividirNaParada(visivel, proxima)
      : [[], visivel]
    quandoPronto(instancia, "rota", () => {
      instancia.getSource<GeoJSONSource>("rota")?.setData({
        type: "FeatureCollection",
        // O resto vem primeiro para ficar por baixo do trecho atual
        features: [
          { coordenadas: resto, cor: COR_RESTO_ROTA, largura: 3 },
          { coordenadas: atual, cor: COR_ROTA, largura: 6 },
        ]
          .filter((t) => t.coordenadas.length > 1)
          .map((t) => ({
            type: "Feature",
            properties: { cor: t.cor, largura: t.largura },
            geometry: { type: "LineString", coordinates: t.coordenadas },
          })),
      })
    })
  }, [linha, proxima, posicao])

  // Visão geral: enquadra a rota toda quando ela muda ou ao sair do modo seguir
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || seguir) return
    quandoPronto(instancia, "rota", () => enquadrar(instancia, linha, MARGEM))
  }, [linha, seguir])

  // Modo seguir: a câmera acompanha cada posição nova
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !seguir || !posicao) return
    instancia.easeTo({
      center: [posicao.longitude, posicao.latitude],
      zoom: Math.max(instancia.getZoom(), ZOOM_SEGUINDO),
      padding: { top: 0, left: 0, right: 0, bottom: MARGEM.bottom },
      duration: 800,
    })
  }, [posicao, seguir])

  // Marcadores numerados na ordem de visita
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    marcadoresParadas.current.forEach((m) => m.remove())
    marcadoresParadas.current = paradas.map((parada, i) =>
      new Marker({
        element: elementoMarcador(
          classeParada(parada.tipo, i === 0),
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
