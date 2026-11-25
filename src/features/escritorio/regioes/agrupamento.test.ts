import { describe, expect, it } from "vitest"

import {
  corDoTexto,
  dentroDaArea,
  nomearRegioes,
  sugerirK,
} from "@/features/escritorio/regioes/agrupamento"
import type { ResultadoKmeans } from "@/lib/kmeans"
import { SEDE } from "@/teste/dados"

// Resultado de k-means montado à mão: só o que cada teste precisa
function resultado(campos: Partial<ResultadoKmeans>): ResultadoKmeans {
  return { k: 2, rotulos: [], centros: [], inercia: 0, silhueta: 0, ...campos }
}

describe("dentroDaArea", () => {
  it("fica no agrupamento quem está a até 150 km da sede", () => {
    const joinville = { latitude: -26.3045, longitude: -48.8487 }
    expect(dentroDaArea(joinville, SEDE)).toBe(true)
  })

  it("fica fora quem está a mais de 150 km (ex.: Imbituba)", () => {
    const imbituba = { latitude: -28.2416, longitude: -48.6631 }
    expect(dentroDaArea(imbituba, SEDE)).toBe(false)
  })
})

describe("corDoTexto", () => {
  it("usa texto escuro só sobre o amarelo", () => {
    expect(corDoTexto("#eda100")).toBe("#0b0b0b")
    expect(corDoTexto("#2a78d6")).toBe("#ffffff")
  })
})

describe("sugerirK", () => {
  it("escolhe o k de maior silhueta", () => {
    const k = sugerirK([
      resultado({ k: 2, rotulos: [0, 0, 0, 1, 1, 1], silhueta: 0.4 }),
      resultado({
        k: 3,
        rotulos: [0, 0, 0, 1, 1, 1, 2, 2, 2],
        silhueta: 0.7,
      }),
    ])
    expect(k).toBe(3)
  })

  it("descarta o k que deixa algum grupo com menos de 3 empresas", () => {
    const k = sugerirK([
      resultado({ k: 2, rotulos: [0, 0, 0, 1, 1, 1], silhueta: 0.4 }),
      // Silhueta maior, mas o grupo 2 tem só 1 empresa
      resultado({ k: 3, rotulos: [0, 0, 0, 1, 1, 1, 2], silhueta: 0.9 }),
    ])
    expect(k).toBe(2)
  })

  it("se nenhum k tiver grupos de 3 ou mais, fica com a maior silhueta", () => {
    const k = sugerirK([
      resultado({ k: 2, rotulos: [0, 1], silhueta: 0.2 }),
      resultado({ k: 3, rotulos: [0, 1, 2], silhueta: 0.5 }),
    ])
    expect(k).toBe(3)
  })
})

describe("nomearRegioes", () => {
  it("dá a cada grupo o nome da cidade com mais empresas", () => {
    const nomes = nomearRegioes(
      resultado({
        rotulos: [0, 0, 0, 1, 1],
        centros: [
          { latitude: -26.48, longitude: -49.07 },
          { latitude: -26.3, longitude: -48.85 },
        ],
      }),
      [
        "Jaraguá do Sul",
        "Jaraguá do Sul",
        "Guaramirim",
        "Joinville",
        "Joinville",
      ]
    )
    expect(nomes).toEqual(["Jaraguá do Sul", "Joinville"])
  })

  it("dois grupos na mesma cidade ganham a direção (Norte e Sul)", () => {
    const nomes = nomearRegioes(
      resultado({
        rotulos: [0, 0, 1, 1],
        centros: [
          { latitude: -26.25, longitude: -48.85 },
          { latitude: -26.35, longitude: -48.85 },
        ],
      }),
      ["Joinville", "Joinville", "Joinville", "Joinville"]
    )
    expect(nomes).toEqual(["Joinville Norte", "Joinville Sul"])
  })

  it("quando a diferença maior é na longitude, usa Leste e Oeste", () => {
    const nomes = nomearRegioes(
      resultado({
        rotulos: [0, 1],
        centros: [
          { latitude: -26.9, longitude: -49.0 },
          { latitude: -26.9, longitude: -49.2 },
        ],
      }),
      ["Blumenau", "Blumenau"]
    )
    expect(nomes).toEqual(["Blumenau Leste", "Blumenau Oeste"])
  })

  it("numera se ainda sobrar nome repetido", () => {
    const nomes = nomearRegioes(
      resultado({
        k: 3,
        rotulos: [0, 1, 2],
        centros: [
          { latitude: -26.2, longitude: -48.85 },
          { latitude: -26.25, longitude: -48.85 },
          { latitude: -26.6, longitude: -48.85 },
        ],
      }),
      ["Joinville", "Joinville", "Joinville"]
    )
    expect(nomes).toEqual([
      "Joinville Norte",
      "Joinville Norte 2",
      "Joinville Sul",
    ])
  })

  it("grupo sem nenhuma empresa fica como Região", () => {
    const nomes = nomearRegioes(
      resultado({
        rotulos: [0, 0],
        centros: [
          { latitude: -26.48, longitude: -49.07 },
          { latitude: -26.3, longitude: -48.85 },
        ],
      }),
      ["Corupá", "Corupá"]
    )
    expect(nomes).toEqual(["Corupá", "Região"])
  })
})
