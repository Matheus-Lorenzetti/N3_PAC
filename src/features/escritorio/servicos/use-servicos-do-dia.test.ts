import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useServicosDoDia } from "@/features/escritorio/servicos/use-servicos-do-dia"
import { empresa, servico } from "@/teste/dados"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

const DALBOR = { ...empresa({ id: 1, cidade: "Jaragua do Sul" }), regiao: null }
const WEG = { ...empresa({ id: 2, cidade: "Itajai" }), regiao: null }
// Sem serviço hoje: a cidade dela não entra nas opções do filtro
const SEM_SERVICO = { ...empresa({ id: 3, cidade: "Blumenau" }), regiao: null }

const doJeferson = servico({ empresa_id: 1, motorista_id: "jeferson" })
const doReno = servico({ empresa_id: 2, motorista_id: "reno" })

beforeEach(() => {
  falso.reiniciar()
  falso.responder("servicos_situacao", [doJeferson, doReno])
  falso.responder("empresas", [DALBOR, WEG, SEM_SERVICO])
  falso.responder("funcionarios", [
    { id: "jeferson", nome: "Jeferson", veiculos: { placa: "MHP3I02" } },
    { id: "reno", nome: "Reno", veiculos: null },
  ])
})

async function carregar() {
  const hook = renderHook(() => useServicosDoDia("canal-de-teste"))
  await waitFor(() => expect(hook.result.current.dados).not.toBeNull())
  return hook
}

describe("useServicosDoDia", () => {
  it("começa sem dados e depois traz serviços, empresas e motoristas", async () => {
    const { result } = renderHook(() => useServicosDoDia("canal-de-teste"))
    expect(result.current.dados).toBeNull()

    await waitFor(() => expect(result.current.dados).not.toBeNull())
    const dados = result.current.dados!
    expect(dados.servicos).toEqual([doJeferson, doReno])
    expect(dados.empresas.get(2)).toEqual(WEG)
    expect(dados.motoristas.get("jeferson")).toEqual({
      nome: "Jeferson",
      placa: "MHP3I02",
    })
    // Motorista sem veículo fica sem placa
    expect(dados.motoristas.get("reno")).toEqual({ nome: "Reno", placa: null })
    expect(dados.erro).toBeNull()
  })

  it("repassa o erro do banco", async () => {
    falso.responder("servicos_situacao", null, "sem permissão")
    const { result } = await carregar()
    expect(result.current.dados?.erro).toBe("sem permissão")
    expect(result.current.dados?.servicos).toEqual([])
  })

  it("oferece no filtro só as cidades que têm serviço, em ordem alfabética", async () => {
    const { result } = await carregar()
    expect(result.current.opcoes.cidades).toEqual(["Itajai", "Jaragua do Sul"])
    expect(result.current.opcoes.motoristas).toEqual([
      { id: "jeferson", nome: "Jeferson", placa: "MHP3I02" },
      { id: "reno", nome: "Reno", placa: null },
    ])
  })

  it("filtra por cidade", async () => {
    const { result } = await carregar()
    act(() => result.current.setFiltro({ cidade: "Itajai", motoristaId: null }))
    expect(result.current.dados?.servicos).toEqual([doReno])
    // Por cidade, a lista de motoristas continua inteira
    expect(result.current.dados?.motoristas.size).toBe(2)
  })

  it("filtra por placa (motorista) e mostra só esse motorista", async () => {
    const { result } = await carregar()
    act(() =>
      result.current.setFiltro({ cidade: null, motoristaId: "jeferson" })
    )
    expect(result.current.dados?.servicos).toEqual([doJeferson])
    expect([...result.current.dados!.motoristas.keys()]).toEqual(["jeferson"])
  })

  it("cidade e placa juntas valem as duas condições", async () => {
    const { result } = await carregar()
    act(() =>
      result.current.setFiltro({ cidade: "Itajai", motoristaId: "jeferson" })
    )
    expect(result.current.dados?.servicos).toEqual([])
  })

  it("lembra o filtro ao abrir a tela de novo", async () => {
    const primeira = await carregar()
    act(() =>
      primeira.result.current.setFiltro({ cidade: "Itajai", motoristaId: null })
    )
    primeira.unmount()

    const { result } = await carregar()
    expect(result.current.filtro).toEqual({
      cidade: "Itajai",
      motoristaId: null,
    })
    expect(result.current.dados?.servicos).toEqual([doReno])
  })

  it("filtro salvo com defeito é ignorado", async () => {
    localStorage.setItem("filtro-servicos", "{cidade:")
    const { result } = await carregar()
    expect(result.current.filtro).toEqual({ cidade: null, motoristaId: null })
  })

  it("recarrega sozinho quando um serviço muda no banco (Realtime)", async () => {
    await carregar()
    expect(falso.supabase.channel).toHaveBeenCalledWith("canal-de-teste")
    const [evento, filtro, aoMudar] = falso.canal.on.mock.calls[0]
    expect(evento).toBe("postgres_changes")
    expect(filtro).toEqual({ event: "*", schema: "public", table: "servicos" })

    const antes = falso.consultasDe("servicos_situacao").length
    act(() => aoMudar())
    await waitFor(() =>
      expect(falso.consultasDe("servicos_situacao")).toHaveLength(antes + 1)
    )
  })

  it("recarregar() busca de novo, com o que mudou", async () => {
    const { result } = await carregar()
    falso.responder("servicos_situacao", [doReno])
    act(() => result.current.recarregar())
    await waitFor(() =>
      expect(result.current.dados?.servicos).toEqual([doReno])
    )
  })

  it("sai do canal do Realtime ao fechar a tela", async () => {
    const { unmount } = await carregar()
    unmount()
    expect(falso.supabase.removeChannel).toHaveBeenCalledWith(falso.canal)
  })
})
