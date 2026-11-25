import { describe, expect, it } from "vitest"

import { avaliarKs, kmeans } from "@/lib/kmeans"
import { SEDE } from "@/teste/dados"

// Três "cidades" bem separadas, com 4 empresas juntinhas em cada uma
const JARAGUA = { latitude: -26.48, longitude: -49.07 }
const JOINVILLE = { latitude: -26.3, longitude: -48.85 }
const BLUMENAU = { latitude: -26.92, longitude: -49.07 }

const emVolta = (centro: { latitude: number; longitude: number }) =>
  [
    [0.01, 0],
    [-0.01, 0],
    [0, 0.01],
    [0, -0.01],
  ].map(([dLat, dLon]) => ({
    latitude: centro.latitude + dLat,
    longitude: centro.longitude + dLon,
  }))

const PONTOS = [
  ...emVolta(JARAGUA),
  ...emVolta(JOINVILLE),
  ...emVolta(BLUMENAU),
]

describe("kmeans", () => {
  it("separa as empresas de cada cidade em um grupo", () => {
    const { rotulos } = kmeans(PONTOS, 3, SEDE)

    const jaragua = rotulos.slice(0, 4)
    const joinville = rotulos.slice(4, 8)
    const blumenau = rotulos.slice(8, 12)
    // Dentro da cidade, todas no mesmo grupo
    expect(new Set(jaragua).size).toBe(1)
    expect(new Set(joinville).size).toBe(1)
    expect(new Set(blumenau).size).toBe(1)
    // E cada cidade em um grupo diferente
    expect(new Set([jaragua[0], joinville[0], blumenau[0]]).size).toBe(3)
  })

  it("põe o centro de cada grupo no meio das empresas dele", () => {
    const { rotulos, centros } = kmeans(PONTOS, 3, SEDE)
    const centroDeJoinville = centros[rotulos[4]]
    expect(centroDeJoinville.latitude).toBeCloseTo(JOINVILLE.latitude, 4)
    expect(centroDeJoinville.longitude).toBeCloseTo(JOINVILLE.longitude, 4)
  })

  it("dá sempre o mesmo resultado para os mesmos dados (semente fixa)", () => {
    expect(kmeans(PONTOS, 3, SEDE)).toEqual(kmeans(PONTOS, 3, SEDE))
  })

  it("grupos bem separados têm silhueta perto de 1", () => {
    expect(kmeans(PONTOS, 3, SEDE).silhueta).toBeGreaterThan(0.9)
  })

  it("com um grupo só a silhueta é 0", () => {
    const resultado = kmeans(PONTOS, 1, SEDE)
    expect(resultado.silhueta).toBe(0)
    expect(new Set(resultado.rotulos)).toEqual(new Set([0]))
  })

  it("a inércia cai quando o número de grupos sobe (base do cotovelo)", () => {
    const k1 = kmeans(PONTOS, 1, SEDE).inercia
    const k2 = kmeans(PONTOS, 2, SEDE).inercia
    const k3 = kmeans(PONTOS, 3, SEDE).inercia
    expect(k2).toBeLessThan(k1)
    expect(k3).toBeLessThan(k2)
    // Com k = 3 cada ponto está a ~1 km do centro: 12 pontos x ~1 km²
    expect(k3).toBeLessThan(15)
  })

  it("um ponto por grupo dá inércia zero", () => {
    const tres = [JARAGUA, JOINVILLE, BLUMENAU]
    const resultado = kmeans(tres, 3, SEDE)
    expect(resultado.inercia).toBeCloseTo(0, 10)
    expect(new Set(resultado.rotulos).size).toBe(3)
    // Grupo de uma empresa só não tem silhueta
    expect(resultado.silhueta).toBe(0)
  })
})

describe("avaliarKs", () => {
  it("roda um k-means para cada k pedido", () => {
    const resultados = avaliarKs(PONTOS, SEDE, [2, 3, 4])
    expect(resultados.map((r) => r.k)).toEqual([2, 3, 4])
  })

  it("pula os k maiores que o número de empresas", () => {
    const tres = [JARAGUA, JOINVILLE, BLUMENAU]
    expect(avaliarKs(tres, SEDE, [2, 3, 4, 5]).map((r) => r.k)).toEqual([2, 3])
  })

  it("a melhor silhueta fica no número real de cidades", () => {
    const resultados = avaliarKs(PONTOS, SEDE, [2, 3, 4, 5])
    const melhor = resultados.reduce((a, b) =>
      b.silhueta > a.silhueta ? b : a
    )
    expect(melhor.k).toBe(3)
  })
})
