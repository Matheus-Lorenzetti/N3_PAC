import { describe, expect, it } from "vitest"

import {
  sugerirMotorista,
  type Posicao,
} from "@/features/escritorio/coletas/sugestao"

const AGORA = Date.parse("2026-11-25T15:00:00Z")
const haMinutos = (min: number) => new Date(AGORA - min * 60_000).toISOString()

const JEFERSON = { id: "jeferson", nome: "Jeferson", placa: "MHP3I02" }
const RENO = { id: "reno", nome: "Reno", placa: "QIN8D70" }

// Empresa da coleta nova: fica na região 7 ("Joinville")
const EMPRESA = { latitude: -26.3, longitude: -48.85, regiaoId: 7 }

// A 0,1 grau de latitude da empresa: cerca de 11,1 km
const PERTO: Posicao = {
  latitude: -26.4,
  longitude: -48.85,
  registradoEm: haMinutos(5),
}
const LONGE: Posicao = {
  latitude: -26.9,
  longitude: -48.85,
  registradoEm: haMinutos(5),
}

function sugerir(campos: Partial<Parameters<typeof sugerirMotorista>[0]>) {
  return sugerirMotorista({
    empresa: EMPRESA,
    regiaoNome: "Joinville",
    motoristas: [JEFERSON, RENO],
    abertos: [],
    posicoes: new Map(),
    agora: AGORA,
    ...campos,
  })
}

describe("sugerirMotorista", () => {
  it("não sugere ninguém se não há motorista", () => {
    expect(sugerir({ motoristas: [] })).toBeNull()
  })

  it("1º critério: quem já tem paradas abertas na mesma região", () => {
    const sugestao = sugerir({
      abertos: [
        { motoristaId: "reno", regiaoId: 7 },
        { motoristaId: "reno", regiaoId: 7 },
        { motoristaId: "jeferson", regiaoId: 3 },
      ],
    })
    expect(sugestao).toEqual({
      motoristaId: "reno",
      motivo: "Já tem 2 parada(s) em Joinville hoje",
    })
  })

  it("a região vale mais do que estar perto", () => {
    const sugestao = sugerir({
      abertos: [{ motoristaId: "reno", regiaoId: 7 }],
      posicoes: new Map([
        ["jeferson", PERTO],
        ["reno", LONGE],
      ]),
    })
    expect(sugestao?.motoristaId).toBe("reno")
  })

  it("2º critério: quem está mais perto pelo GPS recente", () => {
    const sugestao = sugerir({
      posicoes: new Map([
        ["jeferson", LONGE],
        ["reno", PERTO],
      ]),
    })
    expect(sugestao).toEqual({
      motoristaId: "reno",
      motivo: "Está mais perto: 11,1 km da empresa",
    })
  })

  it("GPS com mais de 30 minutos não conta como perto", () => {
    const sugestao = sugerir({
      posicoes: new Map([
        ["jeferson", LONGE],
        ["reno", { ...PERTO, registradoEm: haMinutos(31) }],
      ]),
    })
    expect(sugestao?.motoristaId).toBe("jeferson")
  })

  it("3º critério: sem região nem GPS, quem tem menos serviços abertos", () => {
    const sugestao = sugerir({
      abertos: [
        { motoristaId: "jeferson", regiaoId: 3 },
        { motoristaId: "jeferson", regiaoId: 3 },
        { motoristaId: "reno", regiaoId: 3 },
      ],
    })
    expect(sugestao).toEqual({
      motoristaId: "reno",
      motivo: "Menos serviços abertos (1)",
    })
  })

  it("empresa sem região não usa o critério da região", () => {
    const sugestao = sugerir({
      empresa: { ...EMPRESA, regiaoId: null },
      // Paradas sem região não podem contar como "mesma região"
      abertos: [
        { motoristaId: "jeferson", regiaoId: null },
        { motoristaId: "jeferson", regiaoId: null },
      ],
    })
    expect(sugestao).toEqual({
      motoristaId: "reno",
      motivo: "Menos serviços abertos (0)",
    })
  })

  it("região sem nome aparece como 'esta região'", () => {
    const sugestao = sugerir({
      regiaoNome: null,
      abertos: [{ motoristaId: "jeferson", regiaoId: 7 }],
    })
    expect(sugestao?.motivo).toBe("Já tem 1 parada(s) em esta região hoje")
  })

  it("com um motorista só, sugere ele", () => {
    expect(sugerir({ motoristas: [JEFERSON] })).toEqual({
      motoristaId: "jeferson",
      motivo: "Único motorista ativo",
    })
  })
})
