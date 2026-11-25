import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ExigePerfil, RedirecionaPorPerfil } from "@/app/rotas-protegidas"

// O que o AuthProvider entregaria: cada teste muda só o que precisa
const auth = vi.hoisted(() => ({
  carregando: false,
  session: null as object | null,
  funcionario: null as { perfil: string } | null,
  sair: vi.fn(),
}))
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: () => auth }))

beforeEach(() => {
  auth.carregando = false
  auth.session = null
  auth.funcionario = null
  auth.sair.mockReset()
})

const logado = (perfil: string | null) => {
  auth.session = { user: { id: "abc" } }
  auth.funcionario = perfil ? { perfil } : null
}

// Mini app: a área do escritório é protegida; as outras páginas só dizem o nome
function abrir(caminho: string) {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/" element={<RedirecionaPorPerfil />} />
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route path="/motorista" element={<p>Área do motorista</p>} />
        <Route element={<ExigePerfil perfil="escritorio" />}>
          <Route path="/escritorio" element={<p>Área do escritório</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("ExigePerfil", () => {
  it("quem não está logado vai para o login", () => {
    abrir("/escritorio")
    expect(screen.getByText("Tela de login")).toBeVisible()
  })

  it("motorista não entra na área do escritório: volta para a área dele", () => {
    logado("motorista")
    abrir("/escritorio")
    expect(screen.queryByText("Área do escritório")).not.toBeInTheDocument()
    expect(screen.getByText("Área do motorista")).toBeVisible()
  })

  it("quem tem o perfil certo entra", () => {
    logado("escritorio")
    abrir("/escritorio")
    expect(screen.getByText("Área do escritório")).toBeVisible()
  })

  it("enquanto confere a sessão não mostra nem a página nem o login", () => {
    auth.carregando = true
    abrir("/escritorio")
    expect(screen.queryByText("Área do escritório")).not.toBeInTheDocument()
    expect(screen.queryByText("Tela de login")).not.toBeInTheDocument()
  })
})

describe("RedirecionaPorPerfil", () => {
  it("sem login, a página inicial manda para o login", () => {
    abrir("/")
    expect(screen.getByText("Tela de login")).toBeVisible()
  })

  it("manda cada perfil para a sua área", () => {
    logado("motorista")
    abrir("/")
    expect(screen.getByText("Área do motorista")).toBeVisible()
  })

  it("escritório cai na área do escritório", () => {
    logado("escritorio")
    abrir("/")
    expect(screen.getByText("Área do escritório")).toBeVisible()
  })

  it("login sem cadastro ativo em funcionários vê o aviso e pode sair", async () => {
    logado(null)
    abrir("/")
    expect(screen.getByText("Usuário sem cadastro")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Sair" }))
    expect(auth.sair).toHaveBeenCalledTimes(1)
  })
})
