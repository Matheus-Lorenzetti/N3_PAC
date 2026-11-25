import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardPage } from "@/features/escritorio/dashboard/dashboard-page"
import type { ServicoSituacao } from "@/lib/servicos"
import { empresa, servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

beforeEach(() => {
  falso.reiniciar()
  falso.responder("empresas", [
    { ...empresa({ id: 1, nome: "Dalbor" }), regiao: null },
    { ...empresa({ id: 2, nome: "Usimazek" }), regiao: null },
  ])
  falso.responder("funcionarios", [
    { id: "jeferson", nome: "Jeferson", veiculos: { placa: "MHP3I02" } },
    { id: "reno", nome: "Reno", veiculos: { placa: "QIN8D70" } },
  ])
})

async function abrir(servicos: ServicoSituacao[]) {
  falso.responder("servicos_situacao", servicos)
  render(<DashboardPage />)
  // Os cards só aparecem depois que os dados chegam
  await screen.findByRole("heading", { name: "Coletas" })
}

// Número grande do card "titulo" dentro da seção Coletas ou Entregas
function numero(secao: "Coletas" | "Entregas", titulo: string) {
  const area = screen.getByRole("heading", { name: secao }).closest("section")!
  const card = within(area).getByText(titulo).closest('[data-slot="card"]')!
  return card.querySelector('[data-slot="card-title"]')!.textContent
}

// Células da linha do motorista na tabela "Por motorista"
function linhaDoMotorista(nome: string) {
  const linha = screen.getByText(nome).closest("tr")!
  return within(linha)
    .getAllByRole("cell")
    .map((celula) => celula.textContent)
}

describe("DashboardPage", () => {
  it("mostra um esqueleto enquanto os dados não chegam", () => {
    falso.responder("servicos_situacao", [])
    const { container } = render(<DashboardPage />)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6)
  })

  it("conta coletas e entregas separadas, por situação", async () => {
    await abrir([
      servico({ tipo: "coleta", status: "em_rota", situacao: "em_rota" }),
      servico({ tipo: "coleta", status: "em_rota", situacao: "em_rota" }),
      servico({ tipo: "coleta", status: "realizada", situacao: "realizada" }),
      servico({ tipo: "entrega", status: "em_rota", situacao: "em_rota" }),
      servico({ tipo: "entrega", status: "realizada", situacao: "realizada" }),
      servico({ tipo: "entrega", status: "realizada", situacao: "realizada" }),
    ])
    expect(numero("Coletas", "Em rota")).toBe("2")
    expect(numero("Coletas", "Realizadas hoje")).toBe("1")
    expect(numero("Entregas", "Em rota")).toBe("1")
    expect(numero("Entregas", "Realizadas hoje")).toBe("2")
  })

  it("avisa quantas coletas ainda esperam o motorista aceitar", async () => {
    await abrir([
      servico({ tipo: "coleta", situacao: "aguardando" }),
      servico({ tipo: "coleta", situacao: "aguardando" }),
    ])
    expect(screen.getByText("+2 aguardando o motorista aceitar")).toBeVisible()
  })

  it("pendente é o que ficou aberto de dia anterior; realizado não conta", async () => {
    await abrir([
      servico({ tipo: "coleta", status: "pendente", atrasado: true }),
      servico({ tipo: "coleta", status: "em_rota", atrasado: true }),
      // Concluído com atraso: já foi feito, sai dos pendentes
      servico({ tipo: "coleta", status: "realizada", atrasado: true }),
      servico({ tipo: "entrega", status: "em_rota", atrasado: true }),
    ])
    expect(numero("Coletas", "Pendentes (dia anterior)")).toBe("2")
    expect(numero("Entregas", "Pendentes (dia anterior)")).toBe("1")
    expect(screen.getByText("3 serviços atrasados")).toBeVisible()
    expect(screen.getAllByText("Atenção")).toHaveLength(2)
  })

  it("com um atraso só, o aviso fica no singular", async () => {
    await abrir([servico({ status: "em_rota", atrasado: true })])
    expect(screen.getByText("1 serviço atrasado")).toBeVisible()
  })

  it("sem atraso não mostra alerta e diz que está tudo em dia", async () => {
    await abrir([servico({ status: "em_rota", situacao: "em_rota" })])
    expect(screen.queryByText(/atrasado/)).not.toBeInTheDocument()
    expect(screen.getByText("Nenhum atraso. Tudo em dia.")).toBeVisible()
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument()
  })

  it("lista os atrasados do mais antigo para o mais novo, com a empresa e a situação", async () => {
    await abrir([
      servico({
        empresa_id: 2,
        tipo: "entrega",
        status: "em_rota",
        situacao: "em_rota",
        atrasado: true,
        data_servico: "2026-11-24",
      }),
      servico({
        empresa_id: 1,
        tipo: "coleta",
        status: "pendente",
        situacao: "pendente",
        atrasado: true,
        data_servico: "2026-11-10",
      }),
    ])
    const tabela = screen.getByText("Desde").closest("table")!
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1)
      .map((linha) =>
        within(linha)
          .getAllByRole("cell")
          .map((celula) => celula.textContent)
      )
    expect(linhas).toEqual([
      ["10/11/2026", "Dalbor", "Coleta", "Pendente (dia anterior)"],
      ["24/11/2026", "Usimazek", "Entrega", "Em rota"],
    ])
  })

  it("resume cada motorista: em rota, realizadas e atrasados", async () => {
    await abrir([
      servico({ motorista_id: "jeferson", status: "em_rota", atrasado: true }),
      servico({ motorista_id: "jeferson", status: "realizada" }),
      servico({ motorista_id: "jeferson", status: "realizada" }),
      servico({ motorista_id: "reno", status: "em_rota" }),
    ])
    expect(linhaDoMotorista("Jeferson")).toEqual([
      "Jeferson · MHP3I02",
      "1",
      "2",
      "1",
    ])
    expect(linhaDoMotorista("Reno")).toEqual(["Reno · QIN8D70", "1", "0", "0"])
  })

  it("com filtro salvo, conta só os serviços da placa escolhida e deixa limpar", async () => {
    localStorage.setItem(
      "filtro-servicos",
      JSON.stringify({ cidade: null, motoristaId: "reno" })
    )
    await abrir([
      servico({ motorista_id: "jeferson", status: "em_rota" }),
      servico({ motorista_id: "reno", status: "em_rota" }),
    ])
    expect(numero("Coletas", "Em rota")).toBe("1")

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro" }))
    expect(numero("Coletas", "Em rota")).toBe("2")
    expect(
      screen.queryByRole("button", { name: "Limpar filtro" })
    ).not.toBeInTheDocument()
  })
})
