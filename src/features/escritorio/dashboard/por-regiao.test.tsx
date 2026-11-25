import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PorRegiao } from "@/features/escritorio/dashboard/por-regiao"
import type { ServicosDoDia } from "@/features/escritorio/servicos/use-servicos-do-dia"
import type { ServicoSituacao } from "@/lib/servicos"
import { empresa, servico } from "@/teste/dados"

const JOINVILLE = { id: 1, nome: "Joinville", cor: "#eb6834" }
const JARAGUA = { id: 2, nome: "Jaraguá do Sul", cor: "#2a78d6" }

// Empresa 1 fica em Joinville, a 2 em Jaraguá e a 3 não tem região
const EMPRESAS: ServicosDoDia["empresas"] = new Map([
  [1, { ...empresa({ id: 1 }), regiao: JOINVILLE }],
  [2, { ...empresa({ id: 2 }), regiao: JARAGUA }],
  [3, { ...empresa({ id: 3 }), regiao: null }],
])

const atrasado = (empresaId: number) =>
  servico({
    empresa_id: empresaId,
    status: "em_rota",
    situacao: "em_rota",
    atrasado: true,
  })
const aberto = (empresaId: number) =>
  servico({ empresa_id: empresaId, status: "em_rota", situacao: "em_rota" })

function mostrar(servicos: ServicoSituacao[], empresas = EMPRESAS) {
  render(
    <PorRegiao
      dados={{ servicos, empresas, motoristas: new Map(), erro: null }}
    />
  )
}

// Células da linha da região na tabela (a 1ª é o nome)
function linhaDa(regiao: string) {
  const linha = screen
    .getAllByRole("row")
    .find((l) => within(l).queryByText(regiao))
  return within(linha!)
    .getAllByRole("cell")
    .map((celula) => celula.textContent)
}

describe("PorRegiao: tabela", () => {
  it("conta os serviços de cada região por situação", () => {
    mostrar([
      servico({ empresa_id: 1, situacao: "aguardando" }),
      aberto(1),
      atrasado(2),
      servico({
        empresa_id: 2,
        status: "realizada",
        situacao: "realizada",
        criado_em: "2026-11-25T12:00:00Z",
        concluido_em: "2026-11-25T13:30:00Z",
      }),
    ])
    // Região, aguardando, em rota, realizadas, atrasados, tempo médio
    expect(linhaDa("Joinville")).toEqual(["Joinville", "1", "1", "0", "0", "—"])
    expect(linhaDa("Jaraguá do Sul")).toEqual([
      "Jaraguá do Sul",
      "0",
      "1",
      "1",
      "1",
      "1 h 30 min",
    ])
  })

  it("põe primeiro a região com mais atrasos", () => {
    mostrar([aberto(1), atrasado(2)])
    const [, primeira, segunda] = screen.getAllByRole("row")
    expect(primeira).toHaveTextContent("Jaraguá do Sul")
    expect(segunda).toHaveTextContent("Joinville")
  })

  it("empresa sem região entra em 'Sem região'", () => {
    mostrar([aberto(3)])
    expect(linhaDa("Sem região")).toEqual([
      "Sem região",
      "0",
      "1",
      "0",
      "0",
      "—",
    ])
  })

  it("avisa quando nenhuma região foi gerada ainda", () => {
    mostrar([aberto(3)])
    expect(
      screen.getByText(
        "Nenhuma região salva ainda. Gere as regiões no menu Regiões."
      )
    ).toBeVisible()
  })
})

describe("PorRegiao: detecção de gargalo", () => {
  it("aponta a região que concentra 40% ou mais dos atrasos", () => {
    mostrar([atrasado(1), atrasado(1), atrasado(2)])
    expect(screen.getByText("Possível gargalo: Joinville")).toBeVisible()
    expect(
      screen.getByText(/Concentra 67% dos atrasos \(2 de 3\)\./)
    ).toBeVisible()
    // Jaraguá tem 33% e só 1 atraso: não é gargalo
    expect(
      screen.queryByText("Possível gargalo: Jaraguá do Sul")
    ).not.toBeInTheDocument()
  })

  it("um atraso só não é gargalo, mesmo sendo 100% dos atrasos", () => {
    mostrar([atrasado(1), aberto(2)])
    expect(screen.queryByText(/Possível gargalo/)).not.toBeInTheDocument()
  })

  it("aponta a região que concentra 40% ou mais dos serviços abertos (mínimo 4)", () => {
    mostrar([aberto(1), aberto(1), aberto(1), aberto(1), aberto(2)])
    expect(screen.getByText("Possível gargalo: Joinville")).toBeVisible()
    expect(
      screen.getByText(/Concentra 80% dos serviços abertos \(4 de 5\)\./)
    ).toBeVisible()
  })

  it("três serviços abertos não bastam para ser gargalo", () => {
    mostrar([aberto(1), aberto(1), aberto(1)])
    expect(screen.queryByText(/Possível gargalo/)).not.toBeInTheDocument()
  })

  it("'Sem região' nunca é apontada como gargalo", () => {
    mostrar([atrasado(3), atrasado(3), atrasado(3), aberto(1)])
    expect(screen.queryByText(/Possível gargalo/)).not.toBeInTheDocument()
  })
})
