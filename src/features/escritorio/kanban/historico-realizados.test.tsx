import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HistoricoRealizados } from "@/features/escritorio/kanban/historico-realizados"
import type {
  FiltroServicos,
  ServicosDoDia,
} from "@/features/escritorio/servicos/use-servicos-do-dia"
import { empresa, servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

const DADOS: ServicosDoDia = {
  servicos: [],
  empresas: new Map([
    [
      1,
      {
        ...empresa({ id: 1, nome: "Dalbor", cidade: "Jaragua do Sul" }),
        regiao: null,
      },
    ],
    [
      2,
      {
        ...empresa({ id: 2, nome: "Febral", cidade: "Joinville" }),
        regiao: null,
      },
    ],
  ]),
  motoristas: new Map([
    ["jeferson", { nome: "Jeferson", placa: "MHP3I02" }],
    ["reno", { nome: "Reno", placa: null }],
  ]),
  erro: null,
}

// Horários montados no fuso do computador, para o teste valer em qualquer lugar
const hora = (dia: number, h: number, min: number) =>
  new Date(2026, 10, dia, h, min).toISOString()

const realizado = (campos: Parameters<typeof servico>[0]) =>
  servico({ status: "realizada", situacao: "realizada", ...campos })

beforeEach(() => {
  falso.reiniciar()
  // 25/11/2026, meio-dia em Brasília
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

async function abrir(
  filtro: FiltroServicos = { cidade: null, motoristaId: null }
) {
  render(
    <HistoricoRealizados
      aberto
      onAbertoChange={() => {}}
      dados={DADOS}
      filtro={filtro}
    />
  )
  const painel = await screen.findByRole("dialog")
  await within(painel).findByText(/do mais recente para o mais antigo/)
  return painel
}

describe("HistoricoRealizados", () => {
  it("busca só os realizados, do mais recente para o mais antigo, desde hoje", async () => {
    await abrir()
    const [consulta] = falso.consultasDe("servicos_situacao")
    expect(consulta.eq).toHaveBeenCalledWith("status", "realizada")
    expect(consulta.gte).toHaveBeenCalledWith(
      "concluido_em",
      "2026-11-25T00:00:00-03:00"
    )
    expect(consulta.order).toHaveBeenCalledWith("concluido_em", {
      ascending: false,
    })
  })

  it("mostra a empresa, o tipo, a conclusão, a placa, a cidade e o lançamento", async () => {
    falso.responder("servicos_situacao", [
      realizado({
        empresa_id: 1,
        tipo: "coleta",
        motorista_id: "jeferson",
        criado_em: hora(25, 9, 49),
        concluido_em: hora(25, 9, 50),
      }),
    ])
    const painel = await abrir()
    expect(within(painel).getByText("Dalbor")).toBeVisible()
    expect(within(painel).getByText("Coleta")).toBeVisible()
    expect(
      within(painel).getByText("Concluída às 09:50 · MHP3I02 · Jaragua do Sul")
    ).toBeVisible()
    expect(within(painel).getByText("Lançada às 09:49")).toBeVisible()
  })

  it("serviço lançado em outro dia mostra a data do lançamento", async () => {
    falso.responder("servicos_situacao", [
      realizado({
        criado_em: hora(10, 11, 34),
        concluido_em: hora(25, 10, 0),
      }),
    ])
    const painel = await abrir()
    expect(within(painel).getByText("Lançada em 10/11 às 11:34")).toBeVisible()
  })

  it("motorista sem placa aparece pelo nome", async () => {
    falso.responder("servicos_situacao", [
      realizado({ motorista_id: "reno", concluido_em: hora(25, 10, 0) }),
    ])
    const painel = await abrir()
    expect(within(painel).getByText(/· Reno ·/)).toBeVisible()
  })

  it("separa por dia e conta quantos foram concluídos em cada um", async () => {
    falso.responder("servicos_situacao", [
      realizado({ empresa_id: 1, concluido_em: hora(25, 11, 0) }),
      realizado({ empresa_id: 2, concluido_em: hora(25, 10, 0) }),
      realizado({ empresa_id: 1, concluido_em: hora(24, 16, 0) }),
    ])
    const painel = await abrir()
    expect(
      within(painel).getByText(/3 serviço\(s\) concluído\(s\)/)
    ).toBeVisible()
    const dias = within(painel)
      .getAllByRole("heading", { level: 3 })
      .map((titulo) => titulo.textContent)
    expect(dias).toEqual([
      "quarta-feira, 25/11/2026 · 2",
      "terça-feira, 24/11/2026 · 1",
    ])
  })

  it("respeita o filtro de cidade e de placa da tela", async () => {
    falso.responder("servicos_situacao", [
      realizado({
        empresa_id: 1,
        motorista_id: "jeferson",
        concluido_em: hora(25, 11, 0),
      }),
      realizado({
        empresa_id: 2,
        motorista_id: "reno",
        concluido_em: hora(25, 10, 0),
      }),
    ])
    const painel = await abrir({ cidade: "Joinville", motoristaId: "reno" })
    expect(within(painel).getByText("Febral")).toBeVisible()
    expect(within(painel).queryByText("Dalbor")).not.toBeInTheDocument()
    expect(
      within(painel).getByText(/Com o filtro de cidade\/placa da tela\./)
    ).toBeVisible()
  })

  it("avisa quando nada foi concluído no período", async () => {
    const painel = await abrir()
    expect(within(painel).getByText("Nada concluído no período.")).toBeVisible()
  })

  it("trocar para 7 dias busca desde seis dias atrás", async () => {
    const painel = await abrir()
    await userEvent.click(
      within(painel).getByRole("button", { name: "7 dias" })
    )
    await within(painel).findByText(/do mais recente para o mais antigo/)

    const consultas = falso.consultasDe("servicos_situacao")
    expect(consultas.at(-1)!.gte).toHaveBeenCalledWith(
      "concluido_em",
      "2026-11-19T00:00:00-03:00"
    )
  })

  it("fechado, não busca nada", () => {
    render(
      <HistoricoRealizados
        aberto={false}
        onAbertoChange={() => {}}
        dados={DADOS}
        filtro={{ cidade: null, motoristaId: null }}
      />
    )
    expect(falso.consultasDe("servicos_situacao")).toHaveLength(0)
  })
})
