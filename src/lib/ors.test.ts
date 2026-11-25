import { beforeEach, describe, expect, it, vi } from "vitest"

import { otimizarRota } from "@/lib/ors"
import { SEDE } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

beforeEach(() => falso.reiniciar())

const PEDIDO = {
  inicio: SEDE,
  fim: SEDE,
  paradas: [
    { id: 10, latitude: -26.47, longitude: -49.09 },
    { id: 20, latitude: -26.5, longitude: -49.05 },
  ],
}

// O que a Edge Function devolve
const responder = (dados: unknown, error: unknown = null) =>
  falso.supabase.functions.invoke.mockResolvedValue({ data: dados, error })

describe("otimizarRota", () => {
  it("manda o pedido para a Edge Function otimizar-rota", async () => {
    responder({ routes: [] })
    await otimizarRota({ ...PEDIDO, fixa: true })
    expect(falso.supabase.functions.invoke).toHaveBeenCalledWith(
      "otimizar-rota",
      { body: { ...PEDIDO, fixa: true } }
    )
  })

  it("devolve as paradas na ordem de visita, sem a saída e a chegada na sede", async () => {
    responder({
      routes: [
        {
          steps: [
            { type: "start", arrival: 0 },
            { type: "job", job: 20, arrival: 480 },
            { type: "job", job: 10, arrival: 1020 },
            { type: "end", arrival: 1500 },
          ],
          distance: 14100,
          duration: 1500,
        },
      ],
      unassigned: [],
    })
    const rota = await otimizarRota(PEDIDO)
    expect(rota.ordem).toEqual([
      { id: 20, chegadaSeg: 480 },
      { id: 10, chegadaSeg: 1020 },
    ])
    expect(rota.distanciaM).toBe(14100)
    expect(rota.duracaoSeg).toBe(1500)
  })

  it("avisa quais paradas ficaram sem rota", async () => {
    responder({
      routes: [{ steps: [{ type: "job", job: 10, arrival: 300 }] }],
      unassigned: [{ id: 20 }],
    })
    const rota = await otimizarRota(PEDIDO)
    expect(rota.semRota).toEqual([20])
    expect(rota.ordem.map((p) => p.id)).toEqual([10])
  })

  it("decodifica o traçado (encoded polyline) em [longitude, latitude]", async () => {
    // Exemplo da documentação do formato: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    responder({
      routes: [{ steps: [], geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" }],
    })
    const { linha } = await otimizarRota(PEDIDO)
    expect(linha).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it("sem rota na resposta devolve tudo vazio, sem quebrar", async () => {
    responder({})
    expect(await otimizarRota(PEDIDO)).toEqual({
      ordem: [],
      semRota: [],
      distanciaM: 0,
      duracaoSeg: 0,
      linha: [],
    })
  })

  it("mostra um erro claro quando a Edge Function falha", async () => {
    responder(null, { message: "non-2xx status code" })
    await expect(otimizarRota(PEDIDO)).rejects.toThrow(
      "Não foi possível calcular a rota agora"
    )
  })
})
