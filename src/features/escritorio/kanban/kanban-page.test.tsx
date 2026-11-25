import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { KanbanPage } from "@/features/escritorio/kanban/kanban-page"
import type { ServicoSituacao } from "@/lib/servicos"
import { empresa, servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const HOJE = "2026-11-25"
const ONTEM = "2026-11-24"

beforeEach(() => {
  falso.reiniciar()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
  // 25/11/2026, meio-dia em Brasília
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"))
  falso.responder("empresas", [
    { ...empresa({ id: 1, nome: "Dalbor" }), regiao: null },
    { ...empresa({ id: 2, nome: "Usimazek" }), regiao: null },
  ])
  // "motorista-1" é o motorista dos serviços de exemplo
  falso.responder("funcionarios", [
    { id: "motorista-1", nome: "Jeferson", veiculos: { placa: "MHP3I02" } },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

async function abrir(servicos: ServicoSituacao[]) {
  falso.responder("servicos_situacao", servicos)
  render(<KanbanPage />)
  await screen.findByText("Aguardando motorista")
}

// Coluna do quadro pelo título
function coluna(titulo: string) {
  return screen.getByText(titulo).closest('[data-slot="card"]') as HTMLElement
}

// Número de cartões que a coluna mostra ao lado do título
function contagem(titulo: string) {
  return coluna(titulo).querySelector('[data-slot="card-action"]')?.textContent
}

// Cartão do serviço pelo nome da empresa
function cartao(nomeDaEmpresa: string) {
  return screen
    .getByText(nomeDaEmpresa)
    .closest('[draggable="true"]') as HTMLElement
}

// Arrasta o cartão e solta no destino (coluna ou lixeira)
function arrastar(origem: HTMLElement, destino: HTMLElement) {
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" }
  fireEvent.dragStart(origem, { dataTransfer })
  fireEvent.dragOver(destino, { dataTransfer })
  fireEvent.drop(destino, { dataTransfer })
  fireEvent.dragEnd(origem, { dataTransfer })
}

// Mudanças gravadas na tabela servicos
const gravacoes = () =>
  falso.consultasDe("servicos").flatMap((c) => c.update.mock.calls)

describe("KanbanPage: quadro", () => {
  it("põe cada serviço na coluna da situação dele, com a contagem", async () => {
    await abrir([
      servico({ empresa_id: 1, situacao: "aguardando" }),
      servico({ empresa_id: 2, status: "em_rota", situacao: "em_rota" }),
    ])
    expect(
      within(coluna("Aguardando motorista")).getByText("Dalbor")
    ).toBeVisible()
    expect(within(coluna("Em rota")).getByText("Usimazek")).toBeVisible()
    expect(contagem("Aguardando motorista")).toBe("1")
    expect(contagem("Em rota")).toBe("1")
    expect(contagem("Realizada")).toBe("0")
    expect(
      within(coluna("Pendente (dia anterior)")).getByText("Nenhum serviço.")
    ).toBeVisible()
  })

  it("o cartão mostra a empresa, o tipo, a placa e a hora do lançamento", async () => {
    const lancada = new Date(2026, 10, 25, 9, 49).toISOString()
    await abrir([
      servico({ empresa_id: 1, tipo: "entrega", criado_em: lancada }),
    ])
    const dalbor = cartao("Dalbor")
    expect(within(dalbor).getByText("Entrega")).toBeVisible()
    expect(within(dalbor).getByText("MHP3I02 · Lançada às 09:49")).toBeVisible()
  })

  it("serviço realizado mostra a hora da conclusão", async () => {
    const concluida = new Date(2026, 10, 25, 11, 45).toISOString()
    await abrir([
      servico({
        status: "realizada",
        situacao: "realizada",
        concluido_em: concluida,
      }),
    ])
    expect(screen.getByText("MHP3I02 · Concluída às 11:45")).toBeVisible()
  })

  it("marca como atrasado o serviço aberto de dia anterior", async () => {
    await abrir([
      servico({
        status: "em_rota",
        situacao: "em_rota",
        atrasado: true,
        data_servico: ONTEM,
      }),
    ])
    expect(within(cartao("Dalbor")).getByText("Atrasado")).toBeVisible()
  })

  it("no pendente, diz se o motorista tirou da rota ou nunca adicionou", async () => {
    await abrir([
      servico({
        empresa_id: 1,
        situacao: "pendente",
        data_servico: ONTEM,
        aceito_em: "2026-11-24T14:00:00Z",
      }),
      servico({
        empresa_id: 2,
        situacao: "pendente",
        data_servico: ONTEM,
        aceito_em: null,
      }),
    ])
    expect(
      within(cartao("Dalbor")).getByText("Motorista tirou da rota")
    ).toBeVisible()
    expect(
      within(cartao("Usimazek")).getByText("Motorista não adicionou à rota")
    ).toBeVisible()
  })
})

describe("KanbanPage: arrastar e soltar", () => {
  it("soltar em 'Em rota' põe o serviço na rota e limpa a conclusão", async () => {
    const s = servico({ situacao: "aguardando", data_servico: HOJE })
    await abrir([s])
    arrastar(cartao("Dalbor"), coluna("Em rota"))

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Movido para "Em rota"')
    )
    expect(gravacoes()).toEqual([[{ status: "em_rota", concluido_em: null }]])
    const [consulta] = falso.consultasDe("servicos")
    expect(consulta.eq).toHaveBeenCalledWith("id", s.id)
  })

  it("soltar em 'Realizada' conclui o serviço (o horário quem grava é o banco)", async () => {
    await abrir([servico({ status: "em_rota", situacao: "em_rota" })])
    arrastar(cartao("Dalbor"), coluna("Realizada"))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(gravacoes()).toEqual([[{ status: "realizada" }]])
  })

  it("voltar para 'Aguardando' desfaz o aceite e a conclusão", async () => {
    await abrir([
      servico({ status: "em_rota", situacao: "em_rota", data_servico: HOJE }),
    ])
    arrastar(cartao("Dalbor"), coluna("Aguardando motorista"))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(gravacoes()).toEqual([
      [{ status: "pendente", aceito_em: null, concluido_em: null }],
    ])
  })

  it("serviço de hoje não pode ir para 'Pendente (dia anterior)'", async () => {
    await abrir([servico({ situacao: "aguardando", data_servico: HOJE })])
    arrastar(cartao("Dalbor"), coluna("Pendente (dia anterior)"))
    expect(gravacoes()).toEqual([])
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("serviço de dia anterior não pode voltar para 'Aguardando motorista'", async () => {
    await abrir([
      servico({
        status: "em_rota",
        situacao: "em_rota",
        atrasado: true,
        data_servico: ONTEM,
      }),
    ])
    arrastar(cartao("Dalbor"), coluna("Aguardando motorista"))
    expect(gravacoes()).toEqual([])
  })

  it("mas o de dia anterior pode voltar para 'Pendente'", async () => {
    await abrir([
      servico({
        status: "em_rota",
        situacao: "em_rota",
        atrasado: true,
        data_servico: ONTEM,
      }),
    ])
    arrastar(cartao("Dalbor"), coluna("Pendente (dia anterior)"))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(gravacoes()).toEqual([
      [{ status: "pendente", aceito_em: null, concluido_em: null }],
    ])
  })

  it("soltar na mesma coluna não grava nada", async () => {
    await abrir([servico({ situacao: "aguardando", data_servico: HOJE })])
    arrastar(cartao("Dalbor"), coluna("Aguardando motorista"))
    expect(gravacoes()).toEqual([])
  })

  it("mostra o erro se o banco recusar a mudança", async () => {
    await abrir([servico({ situacao: "aguardando", data_servico: HOJE })])
    falso.responder("servicos", null, "sem permissão")
    arrastar(cartao("Dalbor"), coluna("Em rota"))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível mover: sem permissão"
      )
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe("KanbanPage: lixeira", () => {
  const lixeira = () =>
    screen.getByLabelText("Lixeira: arraste um cartão aqui para excluir")

  it("soltar na lixeira pede confirmação antes de excluir", async () => {
    const s = servico({ tipo: "coleta" })
    await abrir([s])
    arrastar(cartao("Dalbor"), lixeira())

    const dialogo = await screen.findByRole("dialog")
    expect(within(dialogo).getByText("Excluir coleta?")).toBeVisible()
    expect(dialogo).toHaveTextContent("Dalbor · MHP3I02")
    // Nada foi apagado ainda
    expect(falso.consultasDe("servicos")).toHaveLength(0)

    await userEvent.click(
      within(dialogo).getByRole("button", { name: "Excluir" })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Serviço excluído")
    )
    const [consulta] = falso.consultasDe("servicos")
    expect(consulta.delete).toHaveBeenCalled()
    expect(consulta.eq).toHaveBeenCalledWith("id", s.id)
  })

  it("Cancelar fecha sem excluir", async () => {
    await abrir([servico({ tipo: "entrega" })])
    arrastar(cartao("Dalbor"), lixeira())

    const dialogo = await screen.findByRole("dialog")
    expect(within(dialogo).getByText("Excluir entrega?")).toBeVisible()
    await userEvent.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(falso.consultasDe("servicos")).toHaveLength(0)
  })

  it("mostra o erro se o banco recusar a exclusão", async () => {
    await abrir([servico()])
    falso.responder("servicos", null, "sem permissão")
    arrastar(cartao("Dalbor"), lixeira())
    const dialogo = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialogo).getByRole("button", { name: "Excluir" })
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível excluir: sem permissão"
      )
    )
  })
})

describe("KanbanPage: histórico", () => {
  it("o botão abre o histórico de realizados", async () => {
    await abrir([])
    falso.responder("servicos_situacao", [
      servico({
        status: "realizada",
        situacao: "realizada",
        concluido_em: "2026-11-25T14:45:00Z",
      }),
    ])
    await userEvent.click(
      screen.getByRole("button", { name: "Histórico de realizados" })
    )
    const painel = await screen.findByRole("dialog")
    expect(
      await within(painel).findByText(/1 serviço\(s\) concluído\(s\)/)
    ).toBeVisible()
    expect(within(painel).getByText("Dalbor")).toBeVisible()
  })
})
