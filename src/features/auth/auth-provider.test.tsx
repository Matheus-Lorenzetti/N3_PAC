import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider, useAuth } from "@/features/auth/auth-provider"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

beforeEach(() => falso.reiniciar())

// Tela mínima que mostra o que o useAuth entrega
function Quem() {
  const { carregando, session, funcionario, sair } = useAuth()
  if (carregando) return <p>Carregando</p>
  return (
    <>
      <p>{session ? "Logado" : "Deslogado"}</p>
      <p>
        {funcionario
          ? `${funcionario.nome} (${funcionario.perfil})`
          : "Sem cadastro"}
      </p>
      <button onClick={sair}>Sair</button>
    </>
  )
}

const abrir = () =>
  render(
    <AuthProvider>
      <Quem />
    </AuthProvider>
  )

const SESSAO = { user: { id: "id-do-jeferson" } }

describe("AuthProvider", () => {
  it("fica carregando até o Supabase dizer se há sessão", () => {
    abrir()
    expect(screen.getByText("Carregando")).toBeVisible()
  })

  it("sem sessão: deslogado e sem funcionário", () => {
    abrir()
    act(() => falso.mudarSessao(null))
    expect(screen.getByText("Deslogado")).toBeVisible()
    expect(screen.getByText("Sem cadastro")).toBeVisible()
  })

  it("com sessão, busca o cadastro ativo do funcionário pelo id do login", async () => {
    falso.responder("funcionarios", { nome: "Jeferson", perfil: "motorista" })
    abrir()
    act(() => falso.mudarSessao(SESSAO))

    expect(await screen.findByText("Jeferson (motorista)")).toBeVisible()
    expect(screen.getByText("Logado")).toBeVisible()
    const [consulta] = falso.consultasDe("funcionarios")
    expect(consulta.eq).toHaveBeenCalledWith("id", "id-do-jeferson")
    expect(consulta.eq).toHaveBeenCalledWith("ativo", true)
  })

  it("login sem cadastro ativo fica logado, mas sem funcionário", async () => {
    falso.responder("funcionarios", null)
    abrir()
    act(() => falso.mudarSessao(SESSAO))
    expect(await screen.findByText("Logado")).toBeVisible()
    expect(screen.getByText("Sem cadastro")).toBeVisible()
  })

  it("ao sair, esquece o funcionário", async () => {
    falso.responder("funcionarios", { nome: "Jeferson", perfil: "motorista" })
    abrir()
    act(() => falso.mudarSessao(SESSAO))
    await screen.findByText("Jeferson (motorista)")

    await userEvent.click(screen.getByRole("button", { name: "Sair" }))
    expect(falso.supabase.auth.signOut).toHaveBeenCalledTimes(1)

    act(() => falso.mudarSessao(null))
    await waitFor(() => expect(screen.getByText("Sem cadastro")).toBeVisible())
    expect(screen.getByText("Deslogado")).toBeVisible()
  })

  it("para de ouvir a sessão quando o app fecha", () => {
    const { unmount } = abrir()
    unmount()
    expect(falso.cancelarSessao).toHaveBeenCalledTimes(1)
  })

  it("useAuth fora do AuthProvider é erro de programação e avisa", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Quem />)).toThrow(
      "useAuth precisa estar dentro de AuthProvider"
    )
    erro.mockRestore()
  })
})
