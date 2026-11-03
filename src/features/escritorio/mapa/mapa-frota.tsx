import { Map as MapaLibre, Marker, type GeoJSONSource } from "maplibre-gl"
import { useEffect, useMemo, useRef } from "react"

import { classeParada, type ParadaNoMapa } from "@/features/motorista/mapa-rota"
import {
  adicionarCamadaRota,
  criarMapa,
  elementoMarcador,
  enquadrar,
  quandoPronto,
} from "@/lib/mapa"
import type { Ponto } from "@/lib/ors"

export type VeiculoNoMapa = {
  motoristaId: string
  placa: string
  cor: string
  posicao: Ponto | null
  linha: [number, number][]
  paradas: ParadaNoMapa[]
}

export function MapaFrota({
  sede,
  veiculos,
  selecionado,
  onSelecionar,
}: {
  sede: Ponto
  veiculos: VeiculoNoMapa[]
  // null = todos
  selecionado: string | null
  onSelecionar: (motoristaId: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaLibre | null>(null)
  const marcadoresVeiculos = useRef(new Map<string, Marker>())
  const marcadoresParadas = useRef<Marker[]>([])
  const onSelecionarRef = useRef(onSelecionar)

  useEffect(() => {
    onSelecionarRef.current = onSelecionar
  }, [onSelecionar])

  const { latitude, longitude } = sede
  useEffect(() => {
    const instancia = criarMapa(container.current!, { latitude, longitude })
    instancia.on("load", () => adicionarCamadaRota(instancia, "rotas"))
    mapa.current = instancia
    const veiculosAtuais = marcadoresVeiculos.current
    return () => {
      instancia.remove()
      mapa.current = null
      veiculosAtuais.clear()
      marcadoresParadas.current = []
    }
  }, [latitude, longitude])

  const visiveis = useMemo(
    () =>
      selecionado
        ? veiculos.filter((v) => v.motoristaId === selecionado)
        : veiculos,
    [veiculos, selecionado]
  )

  // Marcador de cada veículo (placa), atualizado a cada posição nova
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    const marcadores = marcadoresVeiculos.current
    for (const [id, marcador] of marcadores) {
      if (!visiveis.some((v) => v.motoristaId === id && v.posicao)) {
        marcador.remove()
        marcadores.delete(id)
      }
    }
    for (const veiculo of visiveis) {
      if (!veiculo.posicao) continue
      const ponto: [number, number] = [
        veiculo.posicao.longitude,
        veiculo.posicao.latitude,
      ]
      let marcador = marcadores.get(veiculo.motoristaId)
      if (!marcador) {
        const elemento = elementoMarcador(
          "cursor-pointer rounded-full border-2 border-white px-2 py-0.5 text-xs font-bold text-white shadow-md",
          veiculo.placa
        )
        elemento.style.backgroundColor = veiculo.cor
        elemento.addEventListener("click", () =>
          onSelecionarRef.current(veiculo.motoristaId)
        )
        marcador = new Marker({ element: elemento })
          .setLngLat(ponto)
          .addTo(instancia)
        marcadores.set(veiculo.motoristaId, marcador)
      }
      marcador.setLngLat(ponto)
    }
  }, [visiveis])

  // Rotas dos veículos visíveis, cada uma na cor do veículo
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    quandoPronto(instancia, "rotas", () => {
      instancia.getSource<GeoJSONSource>("rotas")?.setData({
        type: "FeatureCollection",
        features: visiveis
          .filter((v) => v.linha.length)
          .map((v) => ({
            type: "Feature",
            properties: { cor: v.cor },
            geometry: { type: "LineString", coordinates: v.linha },
          })),
      })
    })
  }, [visiveis])

  // Paradas numeradas só do veículo escolhido
  const paradasSelecionado = selecionado ? visiveis[0]?.paradas : undefined
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    marcadoresParadas.current.forEach((m) => m.remove())
    marcadoresParadas.current = (paradasSelecionado ?? []).map((parada) =>
      new Marker({
        element: elementoMarcador(
          classeParada(parada.tipo),
          String(parada.numero)
        ),
      })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(instancia)
    )
  }, [paradasSelecionado])

  // Enquadra ao trocar entre "todos" e um veículo
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    const pontos = visiveis.flatMap((v) => [
      ...v.linha,
      ...(v.posicao
        ? [[v.posicao.longitude, v.posicao.latitude] as [number, number]]
        : []),
    ])
    quandoPronto(instancia, "rotas", () =>
      enquadrar(instancia, pontos, { top: 60, left: 60, right: 60, bottom: 60 })
    )
    // Só na troca de seleção, não a cada posição nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, veiculos.length])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
