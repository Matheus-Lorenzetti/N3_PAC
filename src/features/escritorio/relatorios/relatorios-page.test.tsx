import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RelatoriosPage } from "@/features/escritorio/relatorios/relatorios-page"
import type { ServicoSituacao } from "@/lib/servicos"
import { servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

beforeEach(() => {
  falso.reiniciar()
  // 25/11/2026, meio-dia em Brasília
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"))
  falso.responder("funcionarios", [
    { id: "celio", nome: "Celio", veiculos: { placa: "RFK1H42" } },
    { id: "jeferson", nome: "Jeferson", veiculos: { placa: "MHP3I02" } },
    { id: "igor", nome: "Igor", veiculos: null },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

async function abrir(servicos: ServicoSituacao[]) {
  falso.responder("servicos_situacao", servicos)
  render(<RelatoriosPage />)
  await screen.findByRole("heading", { name: "Resultado" })
}

// Card do indicador: o número grande e o texto de baixo
function indicador(titulo: string) {
  const card = screen.getByText(titulo).closest('[data-slot="card"]')!
  return {
    valor: card.querySelector('[data-slot="card-title"]')!.textContent,
    rodape: card.querySelector('[data-slot="card-footer"]')!.textContent,
  }
}

// Linhas (sem o cabeçalho) da tabela que tem a coluna "cabecalho"
function linhasDaTabela(cabecalho: string) {
  const tabela = screen
    .getByRole("columnheader", { name: cabecalho })
    .closest("table")!
  return within(tabela)
    .getAllByRole("row")
    .slice(1)
    .map((linha) =>
      within(linha)
        .getAllByRole("cell")
        .map((celula) => celula.textContent)
    )
}

// Coleta lançada às 12:00 UTC, aceita 10 min depois e concluída 1 h depois do aceite
const concluida = (campos: Partial<ServicoSituacao> = {}) =>
  servico({
    status: "realizada",
    situacao: "realizada",
    criado_em: "2026-11-25T12:00:00Z",
    aceito_em: "2026-11-25T12:10:00Z",
    concluido_em: "2026-11-25T13:10:00Z",
    ...campos,
  })

describe("RelatoriosPage: indicadores", () => {
  it("conta os serviços do período e quantos foram realizados", async () => {
    await abrir([concluida(), concluida(), servico(), servico()])
    expect(indicador("Serviços no período")).toEqual({
      valor: "4",
      rodape: "2 realizados (50%)",
    })
  })

  it("taxa de atraso = atrasados sobre o total, contando os já concluídos com atraso", async () => {
    await abrir([
      concluida({ atrasado: true }),
      servico({ status: "em_rota", atrasado: true }),
      servico(),
      servico(),
    ])
    expect(indicador("Taxa de atraso").valor).toBe("50%")
    expect(indicador("Taxa de atraso").rodape).toMatch(/^2 atrasados/)
  })

  it("tempo total médio vai do lançamento à conclusão, só dos realizados", async () => {
    await abrir([
      concluida(), // 1 h 10 min
      concluida({ concluido_em: "2026-11-25T14:10:00Z" }), // 2 h 10 min
      servico(), // aberto: não entra na média
    ])
    expect(indicador("Tempo total médio").valor).toBe("1 h 40 min")
  })

  it("tempo de aceite considera só as coletas que o motorista já aceitou", async () => {
    await abrir([
      concluida(), // coleta aceita em 10 min
      servico({
        tipo: "coleta",
        status: "em_rota",
        criado_em: "2026-11-25T12:00:00Z",
        aceito_em: "2026-11-25T12:30:00Z",
      }), // coleta aceita em 30 min
      servico({ tipo: "coleta" }), // ainda não aceita
      // Entrega não passa pelo aceite do motorista
      concluida({ tipo: "entrega", aceito_em: "2026-11-25T12:59:00Z" }),
    ])
    expect(indicador("Aguardando o motorista aceitar").valor).toBe("20 min")
  })

  it("tempo em rota vai do aceite à conclusão", async () => {
    await abrir([
      concluida(), // 1 h em rota
      concluida({ concluido_em: "2026-11-25T12:40:00Z" }), // 30 min em rota
    ])
    expect(indicador("Em rota").valor).toBe("45 min")
  })

  it("sem serviços mostra traço em vez de zero ou erro", async () => {
    await abrir([])
    expect(indicador("Serviços no período")).toEqual({
      valor: "0",
      rodape: "0 realizados (—)",
    })
    expect(indicador("Taxa de atraso").valor).toBe("—")
    expect(indicador("Tempo total médio").valor).toBe("—")
    expect(indicador("Aguardando o motorista aceitar").valor).toBe("—")
    expect(indicador("Em rota").valor).toBe("—")
    expect(screen.getAllByText("Nenhum serviço no período.")).toHaveLength(2)
  })
})

describe("RelatoriosPage: produtividade por motorista", () => {
  it("lista quem teve serviço, do que mais realizou para o que menos realizou", async () => {
    await abrir([
      concluida({ motorista_id: "jeferson" }),
      servico({ motorista_id: "jeferson", status: "em_rota", atrasado: true }),
      concluida({ motorista_id: "celio" }),
      concluida({ motorista_id: "celio" }),
      // O Igor não teve serviço no período: não aparece
    ])
    expect(linhasDaTabela("Motorista")).toEqual([
      ["Celio · RFK1H42", "2 de 2", "0%", "1 h"],
      ["Jeferson · MHP3I02", "1 de 2", "50%", "1 h"],
    ])
  })

  it("motorista sem nenhum realizado fica sem tempo em rota", async () => {
    await abrir([servico({ motorista_id: "igor", status: "em_rota" })])
    expect(linhasDaTabela("Motorista")).toEqual([["Igor", "0 de 1", "0%", "—"]])
  })
})

describe("RelatoriosPage: por dia", () => {
  it("agrupa pelo dia previsto, do mais recente para o mais antigo", async () => {
    await abrir([
      concluida({ data_servico: "2026-11-24" }),
      concluida({ data_servico: "2026-11-24", atrasado: true }),
      servico({ data_servico: "2026-11-25" }),
      servico({
        data_servico: "2026-11-10",
        status: "em_rota",
        atrasado: true,
      }),
    ])
    // Dia, serviços, realizados, atrasados
    expect(linhasDaTabela("Dia")).toEqual([
      ["25/11", "1", "0", "0"],
      ["24/11", "2", "2", "1"],
      ["10/11", "1", "0", "1"],
    ])
  })
})

describe("RelatoriosPage: período", () => {
  const desde = () =>
    falso
      .consultasDe("servicos_situacao")
      .map((consulta) => consulta.gte.mock.calls[0])

  it("abre nos últimos 30 dias, contando hoje", async () => {
    await abrir([])
    expect(desde()).toEqual([["data_servico", "2026-10-27"]])
  })

  it("trocar para 7 dias busca de novo, desde seis dias atrás", async () => {
    await abrir([])
    await userEvent.click(
      screen.getByRole("button", { name: "Últimos 7 dias" })
    )
    await screen.findByRole("heading", { name: "Resultado" })
    expect(desde().at(-1)).toEqual(["data_servico", "2026-11-19"])
  })
})
