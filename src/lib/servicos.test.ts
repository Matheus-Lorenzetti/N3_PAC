import { afterEach, describe, expect, it, vi } from "vitest"

import {
  distanciaKm,
  ehAtrasado,
  formatarDuracao,
  formatarHora,
  hojeEmBrasilia,
} from "@/lib/servicos"
import { servico } from "@/teste/dados"

afterEach(() => {
  vi.useRealTimers()
})

describe("hojeEmBrasilia", () => {
  it("antes das 3h UTC ainda é o dia anterior em Brasília", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-25T02:30:00Z")) // 23:30 do dia 24 em Brasília
    expect(hojeEmBrasilia()).toBe("2026-11-24")
  })

  it("a partir das 3h UTC já é o dia novo em Brasília", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-25T03:00:00Z")) // meia-noite em Brasília
    expect(hojeEmBrasilia()).toBe("2026-11-25")
  })
})

describe("formatarHora", () => {
  it("mostra hora e minuto com dois dígitos", () => {
    const iso = new Date(2026, 10, 25, 9, 5).toISOString()
    expect(formatarHora(iso)).toBe("09:05")
  })
})

describe("formatarDuracao", () => {
  const MIN = 60_000

  it("abaixo de uma hora mostra só os minutos", () => {
    expect(formatarDuracao(45 * MIN)).toBe("45 min")
    expect(formatarDuracao(0)).toBe("0 min")
  })

  it("a partir de uma hora mostra horas e minutos", () => {
    expect(formatarDuracao(130 * MIN)).toBe("2 h 10 min")
  })

  it("hora cheia não mostra os minutos", () => {
    expect(formatarDuracao(120 * MIN)).toBe("2 h")
  })

  it("arredonda para o minuto mais próximo", () => {
    expect(formatarDuracao(89.6 * MIN)).toBe("1 h 30 min")
    expect(formatarDuracao(59.5 * MIN)).toBe("1 h")
  })
})

describe("distanciaKm", () => {
  it("é zero entre o mesmo ponto", () => {
    const ponto = { latitude: -26.4855, longitude: -49.0714 }
    expect(distanciaKm(ponto, ponto)).toBe(0)
  })

  it("um grau de latitude dá cerca de 111 km", () => {
    const km = distanciaKm(
      { latitude: -26, longitude: -49 },
      { latitude: -27, longitude: -49 }
    )
    expect(km).toBeCloseTo(111.19, 1)
  })

  it("dá o mesmo valor nos dois sentidos", () => {
    const jaragua = { latitude: -26.4855, longitude: -49.0714 }
    const joinville = { latitude: -26.3045, longitude: -48.8487 }
    expect(distanciaKm(jaragua, joinville)).toBeCloseTo(
      distanciaKm(joinville, jaragua),
      10
    )
    // Em linha reta são uns 30 km
    expect(distanciaKm(jaragua, joinville)).toBeGreaterThan(25)
    expect(distanciaKm(jaragua, joinville)).toBeLessThan(35)
  })
})

describe("ehAtrasado", () => {
  it("serviço aberto que veio de dia anterior está atrasado", () => {
    expect(ehAtrasado(servico({ status: "em_rota", atrasado: true }))).toBe(
      true
    )
    expect(ehAtrasado(servico({ status: "pendente", atrasado: true }))).toBe(
      true
    )
  })

  it("serviço já realizado não conta como atrasado", () => {
    expect(ehAtrasado(servico({ status: "realizada", atrasado: true }))).toBe(
      false
    )
  })

  it("serviço do dia não está atrasado", () => {
    expect(ehAtrasado(servico({ status: "pendente", atrasado: false }))).toBe(
      false
    )
    expect(ehAtrasado(servico({ status: "pendente", atrasado: null }))).toBe(
      false
    )
  })
})
