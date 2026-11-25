import { describe, expect, it } from "vitest"

import {
  credenciaisMotorista,
  ehEmail,
  normalizarNome,
  normalizarPlaca,
  placaValida,
} from "@/lib/login"

describe("ehEmail", () => {
  it("com @ é login do escritório; sem @ é placa do motorista", () => {
    expect(ehEmail("escritorio@transmas.com.br")).toBe(true)
    expect(ehEmail("MHP3I02")).toBe(false)
  })
})

describe("normalizarPlaca", () => {
  it("deixa em maiúsculas, sem traço nem espaço", () => {
    expect(normalizarPlaca("mhp-3i02")).toBe("MHP3I02")
    expect(normalizarPlaca(" abc 1234 ")).toBe("ABC1234")
  })
})

describe("placaValida", () => {
  it("aceita o padrão antigo (ABC1234) e o Mercosul (ABC1D23)", () => {
    expect(placaValida("ABC1234")).toBe(true)
    expect(placaValida("ABC1D23")).toBe(true)
    expect(placaValida("abc-1d23")).toBe(true)
  })

  it("recusa o que não é placa", () => {
    expect(placaValida("")).toBe(false)
    expect(placaValida("ABC123")).toBe(false) // curta
    expect(placaValida("ABC12345")).toBe(false) // longa
    expect(placaValida("1BC1234")).toBe(false) // começa com número
    expect(placaValida("ABCD123")).toBe(false) // 4ª posição precisa ser número
  })
})

describe("normalizarNome", () => {
  it("tira acento, deixa minúsculo e com um espaço só entre as palavras", () => {
    expect(normalizarNome("  João   da  SILVA ")).toBe("joao da silva")
  })
})

describe("credenciaisMotorista", () => {
  it("deriva o e-mail e a senha internos do nome completo", () => {
    expect(credenciaisMotorista("João da Silva")).toEqual({
      email: "joao.da.silva@motorista.transmas.local",
      password: "motorista:joao da silva",
    })
  })

  it("dá o mesmo login para o nome digitado com ou sem acento e maiúsculas", () => {
    expect(credenciaisMotorista("JOAO DA SILVA")).toEqual(
      credenciaisMotorista("joão  da silva ")
    )
  })
})
