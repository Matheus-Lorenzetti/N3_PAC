import { describe, expect, it } from "vitest"

import { filtrarEmpresa, normalizar } from "@/lib/busca"

describe("normalizar", () => {
  it("tira acento, maiúsculas e pontuação", () => {
    expect(normalizar("  Jaraguá do Sul - SC ")).toBe("jaragua do sul sc")
    expect(normalizar("AÇO & CIA. LTDA")).toBe("aco cia ltda")
  })
})

describe("filtrarEmpresa", () => {
  const weg = {
    nome: "WEG Equipamentos Elétricos S.A.",
    // No banco o CNPJ fica só com os 14 dígitos
    cnpj: "07175725000402",
    cidade: "Itajaí",
    bairro: "Salseiros",
    endereco: "Rodovia BR 101, 4600",
  }

  it("busca vazia mostra todas", () => {
    expect(filtrarEmpresa(weg, "")).toBe(true)
    expect(filtrarEmpresa(weg, "   ")).toBe(true)
  })

  it("ignora acento e maiúsculas", () => {
    expect(filtrarEmpresa(weg, "eletricos")).toBe(true)
    expect(filtrarEmpresa(weg, "ITAJAI")).toBe(true)
  })

  it("aceita as palavras em qualquer ordem e pedaços de palavra", () => {
    expect(filtrarEmpresa(weg, "itajai weg")).toBe(true)
    expect(filtrarEmpresa(weg, "equip sals")).toBe(true)
  })

  it("todas as palavras precisam aparecer", () => {
    expect(filtrarEmpresa(weg, "weg joinville")).toBe(false)
  })

  it("procura também no bairro e no endereço", () => {
    expect(filtrarEmpresa(weg, "salseiros")).toBe(true)
    expect(filtrarEmpresa(weg, "br 101")).toBe(true)
  })

  it("acha pelo CNPJ com ou sem pontuação", () => {
    expect(filtrarEmpresa(weg, "07.175.725/0004-02")).toBe(true)
    expect(filtrarEmpresa(weg, "07175725")).toBe(true)
    expect(filtrarEmpresa(weg, "99.999.999/0001-99")).toBe(false)
  })

  it("funciona com empresa sem CNPJ, bairro nem endereço", () => {
    const simples = { nome: "Oficina do Zé", cidade: "Schroeder" }
    expect(filtrarEmpresa(simples, "ze schroeder")).toBe(true)
    expect(filtrarEmpresa(simples, "weg")).toBe(false)
  })
})
