import type { Map as MapaLibre } from "maplibre-gl"
import { describe, expect, it, vi } from "vitest"

import {
  adicionarCamadaRota,
  criarMapa,
  dividirNaParada,
  elementoMarcador,
  enquadrar,
  quandoPronto,
  rotaDaPosicao,
} from "@/lib/mapa"
import { SEDE } from "@/teste/dados"

// O MapLibre desenha com WebGL, que não existe nos testes: entra um de mentira
// que só guarda o que recebeu
const criados = vi.hoisted(() => ({
  mapas: [] as { opcoes: unknown }[],
  marcadores: [] as { elemento: HTMLElement; posicao: unknown }[],
}))

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(opcoes: unknown) {
      criados.mapas.push({ opcoes })
    }
  }
  class Marker {
    registro: { elemento: HTMLElement; posicao: unknown }
    constructor({ element }: { element: HTMLElement }) {
      this.registro = { elemento: element, posicao: null }
      criados.marcadores.push(this.registro)
    }
    setLngLat(posicao: unknown) {
      this.registro.posicao = posicao
      return this
    }
    addTo() {
      return this
    }
  }
  class LngLatBounds {
    pontos: unknown[]
    constructor(a: unknown, b: unknown) {
      this.pontos = [a, b]
    }
    extend(ponto: unknown) {
      this.pontos.push(ponto)
      return this
    }
  }
  return { Map, Marker, LngLatBounds, setWorkerUrl: vi.fn() }
})
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}))
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "worker.js",
}))

// Rua reta de oeste para leste, na latitude -26,5
const RUA: [number, number][] = [
  [-49.1, -26.5],
  [-49.08, -26.5],
  [-49.06, -26.5],
  [-49.04, -26.5],
]

describe("elementoMarcador", () => {
  it("cria o quadradinho do mapa com as classes e o texto", () => {
    const div = elementoMarcador("rounded-md bg-primary", "3")
    expect(div.className).toBe("rounded-md bg-primary")
    expect(div.textContent).toBe("3")
  })
})

describe("criarMapa", () => {
  it("centra o mapa na sede e põe o marcador dela", () => {
    criarMapa(document.createElement("div"), SEDE)
    expect(criados.mapas[0].opcoes).toMatchObject({
      center: [SEDE.longitude, SEDE.latitude],
      zoom: 12,
    })
    expect(criados.marcadores[0].elemento.textContent).toBe("Sede")
    expect(criados.marcadores[0].posicao).toEqual([
      SEDE.longitude,
      SEDE.latitude,
    ])
  })
})

describe("adicionarCamadaRota", () => {
  it("cria a fonte da rota e duas linhas: o contorno branco e a rota por cima", () => {
    const mapa = { addSource: vi.fn(), addLayer: vi.fn() }
    adicionarCamadaRota(mapa as unknown as MapaLibre, "rota")
    expect(mapa.addSource).toHaveBeenCalledWith("rota", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    })
    const camadas = mapa.addLayer.mock.calls.map(([camada]) => camada.id)
    expect(camadas).toEqual(["rota-contorno", "rota"])
  })
})

describe("dividirNaParada", () => {
  it("corta o traçado no ponto mais perto da parada", () => {
    const parada = { latitude: -26.5001, longitude: -49.0601 }
    const [ate, depois] = dividirNaParada(RUA, parada)
    expect(ate).toEqual(RUA.slice(0, 3))
    // O ponto da parada fica nos dois pedaços, para a linha não ter buraco
    expect(depois).toEqual(RUA.slice(2))
  })

  it("traçado vazio devolve dois pedaços vazios", () => {
    expect(dividirNaParada([], SEDE)).toEqual([[], []])
  })
})

describe("rotaDaPosicao", () => {
  it("sem posição do GPS devolve o traçado inteiro", () => {
    expect(rotaDaPosicao(RUA, null, null)).toEqual({ linha: RUA, desvioM: 0 })
  })

  it("traçado com menos de dois pontos volta como veio", () => {
    const umPonto: [number, number][] = [[-49.1, -26.5]]
    const posicao = { latitude: -26.5, longitude: -49.09 }
    expect(rotaDaPosicao(umPonto, posicao, null)).toEqual({
      linha: umPonto,
      desvioM: 0,
    })
  })

  it("motorista no caminho: corta o que ficou para trás e o desvio é zero", () => {
    // No meio do 2º trecho da rua
    const posicao = { latitude: -26.5, longitude: -49.07 }
    const { linha, desvioM } = rotaDaPosicao(RUA, posicao, null)
    expect(desvioM).toBeCloseTo(0, 3)
    // Posição, ponto da rua mais perto dela e o resto do traçado
    expect(linha).toHaveLength(4)
    expect(linha[0]).toEqual([-49.07, -26.5])
    expect(linha[1][0]).toBeCloseTo(-49.07, 6)
    expect(linha.slice(2)).toEqual(RUA.slice(2))
  })

  it("motorista fora do caminho: mede a distância até a rua em metros", () => {
    // 0,005 grau de latitude ao norte da rua: uns 550 m
    const posicao = { latitude: -26.495, longitude: -49.07 }
    const { desvioM } = rotaDaPosicao(RUA, posicao, null)
    expect(desvioM).toBeGreaterThan(540)
    expect(desvioM).toBeLessThan(565)
  })

  it("antes do começo da rua liga a posição ao primeiro ponto", () => {
    const posicao = { latitude: -26.5, longitude: -49.12 }
    const { linha } = rotaDaPosicao(RUA, posicao, null)
    expect(linha).toEqual([[-49.12, -26.5], RUA[0], ...RUA.slice(1)])
  })

  it("só procura até a próxima parada, mesmo que a volta passe mais perto", () => {
    // Vai até a parada pela rua de cima e volta pela de baixo, 11 m ao lado
    const idaEVolta: [number, number][] = [
      [-49.1, -26.5],
      [-49.08, -26.5],
      [-49.06, -26.5],
      [-49.08, -26.5001],
      [-49.1, -26.5001],
    ]
    const parada = { latitude: -26.5, longitude: -49.06 }
    // O motorista está exatamente em cima da rua da volta
    const posicao = { latitude: -26.5001, longitude: -49.09 }

    const { linha, desvioM } = rotaDaPosicao(idaEVolta, posicao, parada)

    // Fica com a ida: a rota continua com as 4 pontas que faltam
    expect(linha).toHaveLength(6)
    expect(linha.slice(2)).toEqual(idaEVolta.slice(1))
    expect(desvioM).toBeGreaterThan(5)
    expect(desvioM).toBeLessThan(20)
  })
})

describe("quandoPronto", () => {
  it("roda na hora se a camada já existe", () => {
    const fazer = vi.fn()
    const mapa = { getSource: () => ({}), once: vi.fn() }
    quandoPronto(mapa as unknown as MapaLibre, "rota", fazer)
    expect(fazer).toHaveBeenCalledTimes(1)
    expect(mapa.once).not.toHaveBeenCalled()
  })

  it("se o mapa ainda está carregando, espera o 'load'", () => {
    const fazer = vi.fn()
    const mapa = { getSource: () => undefined, once: vi.fn() }
    quandoPronto(mapa as unknown as MapaLibre, "rota", fazer)
    expect(fazer).not.toHaveBeenCalled()
    expect(mapa.once).toHaveBeenCalledWith("load", fazer)
  })
})

describe("enquadrar", () => {
  const padding = { top: 10, left: 10, right: 10, bottom: 10 }

  it("ajusta o zoom para caber todos os pontos, sem aproximar demais", () => {
    const mapa = { fitBounds: vi.fn() }
    enquadrar(mapa as unknown as MapaLibre, RUA, padding)
    const [limites, opcoes] = mapa.fitBounds.mock.calls[0]
    expect(limites.pontos).toEqual(expect.arrayContaining(RUA))
    expect(opcoes).toEqual({ padding, maxZoom: 15 })
  })

  it("sem pontos não mexe no mapa", () => {
    const mapa = { fitBounds: vi.fn() }
    enquadrar(mapa as unknown as MapaLibre, [], padding)
    expect(mapa.fitBounds).not.toHaveBeenCalled()
  })
})
