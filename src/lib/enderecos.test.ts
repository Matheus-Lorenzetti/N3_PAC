import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buscarCep, geocodificar, somenteDigitos } from "@/lib/enderecos"

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status })

const buscar = vi.fn()

beforeEach(() => {
  buscar.mockReset()
  vi.stubGlobal("fetch", buscar)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("somenteDigitos", () => {
  it("tira tudo que não é número", () => {
    expect(somenteDigitos("89.251-000")).toBe("89251000")
    expect(somenteDigitos("(47) 3371-0000")).toBe("4733710000")
  })
})

describe("buscarCep", () => {
  it("devolve o endereço do ViaCEP", async () => {
    buscar.mockResolvedValue(
      json({
        logradouro: "Rua Carlos Blank",
        bairro: "Vila Lalau",
        localidade: "Jaraguá do Sul",
        uf: "SC",
      })
    )
    expect(await buscarCep("89256-180")).toEqual({
      endereco: "Rua Carlos Blank",
      bairro: "Vila Lalau",
      cidade: "Jaraguá do Sul",
      uf: "SC",
    })
    expect(buscar).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/89256180/json/"
    )
  })

  it("CEP incompleto nem consulta o ViaCEP", async () => {
    expect(await buscarCep("89256")).toBeNull()
    expect(buscar).not.toHaveBeenCalled()
  })

  it("CEP que não existe devolve null", async () => {
    buscar.mockResolvedValue(json({ erro: true }))
    expect(await buscarCep("00000-000")).toBeNull()
  })

  it("ViaCEP fora do ar devolve null", async () => {
    buscar.mockResolvedValue(json({}, 500))
    expect(await buscarCep("89256-180")).toBeNull()
  })

  it("CEP geral da cidade (sem rua) vem com os campos vazios", async () => {
    buscar.mockResolvedValue(json({ localidade: "Itapoá", uf: "SC" }))
    expect(await buscarCep("89249-000")).toEqual({
      endereco: "",
      bairro: "",
      cidade: "Itapoá",
      uf: "SC",
    })
  })
})

describe("geocodificar", () => {
  const ENDERECO = {
    endereco: "Rua Carlos Blank, 194",
    cidade: "Jaraguá do Sul",
    uf: "SC",
  }

  // Parâmetros da consulta feita ao Nominatim na chamada de número "indice"
  const parametros = (indice: number) =>
    Object.fromEntries(new URL(buscar.mock.calls[indice][0]).searchParams)

  it("usa a busca estruturada (rua, cidade, estado) e só no Brasil", async () => {
    buscar.mockResolvedValue(json([{ lat: "-26.4855", lon: "-49.0714" }]))
    expect(await geocodificar(ENDERECO)).toEqual({
      latitude: -26.4855,
      longitude: -49.0714,
    })
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(parametros(0)).toEqual({
      street: "Rua Carlos Blank, 194",
      city: "Jaraguá do Sul",
      state: "SC",
      format: "jsonv2",
      limit: "1",
      countrycodes: "br",
    })
  })

  it("se a estruturada não achar, tenta em texto livre", async () => {
    buscar
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ lat: "-26.48", lon: "-49.07" }]))
    expect(await geocodificar(ENDERECO)).toEqual({
      latitude: -26.48,
      longitude: -49.07,
    })
    expect(parametros(1).q).toBe("Rua Carlos Blank, 194, Jaraguá do Sul - SC")
  })

  it("devolve null quando nenhuma das duas buscas acha", async () => {
    buscar.mockImplementation(async () => json([]))
    expect(await geocodificar(ENDERECO)).toBeNull()
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it("devolve null quando o Nominatim responde com erro", async () => {
    buscar.mockImplementation(async () => json({}, 503))
    expect(await geocodificar(ENDERECO)).toBeNull()
  })
})
