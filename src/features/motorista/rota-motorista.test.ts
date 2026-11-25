import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buscarDados,
  chaveOrdemManual,
  chaveRotaIniciada,
  gravarRota,
  inserirNoMelhorLugar,
  lerOrdemManual,
  linkTelefone,
  linkWaze,
  minutos,
  posicaoAtual,
} from "@/features/motorista/rota-motorista"
import { empresa, servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

beforeEach(() => {
  falso.reiniciar()
  // 25/11/2026, 10h em Brasília
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-25T13:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("chaves guardadas no celular", () => {
  it("valem para um motorista e um dia", () => {
    expect(chaveOrdemManual("abc")).toBe("ordem-manual:abc:2026-11-25")
    expect(chaveRotaIniciada("abc")).toBe("rota-iniciada:abc:2026-11-25")
  })
})

describe("lerOrdemManual", () => {
  it("devolve null se o motorista não arrastou nada hoje", () => {
    expect(lerOrdemManual("abc")).toBeNull()
  })

  it("devolve a ordem salva hoje", () => {
    localStorage.setItem(chaveOrdemManual("abc"), "[30, 10, 20]")
    expect(lerOrdemManual("abc")).toEqual([30, 10, 20])
  })

  it("a ordem de ontem não vale hoje", () => {
    localStorage.setItem("ordem-manual:abc:2026-11-24", "[30, 10, 20]")
    expect(lerOrdemManual("abc")).toBeNull()
  })

  it("ignora o que estiver salvo com defeito", () => {
    localStorage.setItem(chaveOrdemManual("abc"), "[30, 10")
    expect(lerOrdemManual("abc")).toBeNull()
  })
})

describe("inserirNoMelhorLugar", () => {
  const sede = { latitude: 0, longitude: 0 }
  // A rota sobe até A, vai para leste até B e volta em diagonal para a sede
  const A = { latitude: 0.1, longitude: 0 }
  const B = { latitude: 0.1, longitude: 0.2 }

  it("em rota vazia vira a única parada", () => {
    const ordem: (typeof A)[] = []
    inserirNoMelhorLugar(ordem, A, sede)
    expect(ordem).toEqual([A])
  })

  it("encaixa entre as duas paradas quando fica no caminho entre elas", () => {
    const noMeio = { latitude: 0.1, longitude: 0.1 }
    const ordem = [A, B]
    inserirNoMelhorLugar(ordem, noMeio, sede)
    expect(ordem).toEqual([A, noMeio, B])
  })

  it("vai para o fim quando fica no caminho de volta para a sede", () => {
    const naVolta = { latitude: 0.05, longitude: 0.1 }
    const ordem = [A, B]
    inserirNoMelhorLugar(ordem, naVolta, sede)
    expect(ordem).toEqual([A, B, naVolta])
  })
})

describe("links e textos da parada", () => {
  it("monta o link do Waze com a localização da empresa", () => {
    expect(linkWaze({ latitude: -26.48, longitude: -49.07 })).toBe(
      "https://waze.com/ul?ll=-26.48,-49.07&navigate=yes"
    )
  })

  it("monta o link de ligação só com os números do telefone", () => {
    expect(linkTelefone("(47) 3371-0000")).toBe("tel:4733710000")
  })

  it("mostra o tempo em minutos, no mínimo 1", () => {
    expect(minutos(1020)).toBe("17 min")
    expect(minutos(20)).toBe("1 min")
  })
})

describe("buscarDados", () => {
  const sede = empresa({ id: 1, nome: "Transmas", eh_sede: true })
  const cliente = empresa({ id: 2, nome: "Dalbor" })

  it("junta serviços, empresas, placa, última posição e rota de hoje", async () => {
    const coleta = servico({ empresa_id: 2 })
    const rota = { ordem: [coleta.id], manual: false }
    falso.responder("servicos_situacao", [coleta])
    falso.responder("empresas", [sede, cliente])
    falso.responder("veiculos", { placa: "MHP3I02" })
    falso.responder("ultimas_localizacoes", { latitude: -26.4, longitude: -49 })
    falso.responder("rotas", rota)

    const dados = await buscarDados()

    expect(dados.servicos).toEqual([coleta])
    expect(dados.empresas.get(2)).toEqual(cliente)
    expect(dados.sede).toEqual(sede)
    expect(dados.placa).toBe("MHP3I02")
    expect(dados.ultimaPosicao).toEqual({ latitude: -26.4, longitude: -49 })
    expect(dados.rotaHoje).toEqual(rota)
  })

  it("pede só o que ainda não foi realizado e a posição enviada hoje", async () => {
    await buscarDados()
    const [servicos] = falso.consultasDe("servicos_situacao")
    expect(servicos.neq).toHaveBeenCalledWith("situacao", "realizada")
    const [posicao] = falso.consultasDe("ultimas_localizacoes")
    expect(posicao.gte).toHaveBeenCalledWith(
      "registrado_em",
      "2026-11-25T00:00:00-03:00"
    )
    const [rotas] = falso.consultasDe("rotas")
    expect(rotas.eq).toHaveBeenCalledWith("data", "2026-11-25")
  })

  it("sem veículo, sem GPS e sem sede cadastrada devolve null em cada um", async () => {
    falso.responder("empresas", [cliente])
    falso.responder("veiculos", null)
    falso.responder("ultimas_localizacoes", null)
    falso.responder("rotas", null)

    const dados = await buscarDados()

    expect(dados.sede).toBeNull()
    expect(dados.placa).toBeNull()
    expect(dados.ultimaPosicao).toBeNull()
    expect(dados.rotaHoje).toBeNull()
  })
})

describe("gravarRota", () => {
  const ROTA = {
    ordem: [20, 10],
    linha: [[-49.07, -26.48]] as [number, number][],
    distanciaM: 14100,
    duracaoSeg: 1500,
    manual: true,
  }

  it("grava a rota do dia com a origem 'motorista'", () => {
    gravarRota(ROTA)
    const [rotas] = falso.consultasDe("rotas")
    expect(rotas.upsert).toHaveBeenCalledWith({
      ordem: [20, 10],
      origem: "motorista",
      manual: true,
      linha: [[-49.07, -26.48]],
      distancia_m: 14100,
      duracao_s: 1500,
      calculada_em: "2026-11-25T13:00:00.000Z",
    })
  })

  it("se o banco recusar, só avisa no console: a tela do motorista segue", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
    falso.responder("rotas", null, "sem permissão")
    gravarRota(ROTA)
    await vi.waitFor(() => expect(aviso).toHaveBeenCalled())
  })
})

describe("posicaoAtual", () => {
  it("devolve null em aparelho sem GPS", async () => {
    vi.stubGlobal("navigator", {})
    expect(await posicaoAtual()).toBeNull()
  })

  it("devolve a leitura do GPS", async () => {
    const leitura = { coords: { latitude: -26.4, longitude: -49 } }
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (sucesso: (p: unknown) => void) => sucesso(leitura),
      },
    })
    expect(await posicaoAtual()).toBe(leitura)
  })

  it("devolve null se o motorista negar a permissão ou não houver sinal", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_sucesso: unknown, falha: () => void) => falha(),
      },
    })
    expect(await posicaoAtual()).toBeNull()
  })
})
