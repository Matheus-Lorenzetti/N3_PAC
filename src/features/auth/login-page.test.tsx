import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/features/auth/login-page"
import { falso } from "@/teste/supabase-falso"

vi.mock("@/lib/supabase", async () => {
  const { falso } = await import("@/teste/supabase-falso")
  return { supabase: falso.supabase }
})

// Sessão que o AuthProvider entregaria (null = ninguém logado)
const auth = vi.hoisted(() => ({ session: null as object | null }))
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session: auth.session }),
}))

beforeEach(() => {
  falso.reiniciar()
  auth.session = null
})

function abrir() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Página inicial</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function preencher(identificador: string, segredo: string) {
  if (identificador) {
    await userEvent.type(
      screen.getByLabelText("E-mail ou placa"),
      identificador
    )
  }
  if (segredo) {
    await userEvent.type(screen.getByLabelText(/Senha|Seu nome/), segredo)
  }
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }))
}

describe("LoginPage: um campo para os dois perfis", () => {
  it("começa pedindo senha", () => {
    abrir()
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password")
  })

  it("ao digitar uma placa, o segundo campo vira o nome do motorista", async () => {
    abrir()
    await userEvent.type(screen.getByLabelText("E-mail ou placa"), "MHP3I02")
    expect(screen.getByLabelText("Seu nome")).toHaveAttribute("type", "text")
    expect(
      screen.getByText("Nome completo, como está no cadastro.")
    ).toBeVisible()
  })

  it("ao digitar um e-mail, continua pedindo a senha escondida", async () => {
    abrir()
    await userEvent.type(
      screen.getByLabelText("E-mail ou placa"),
      "escritorio@transmas.com.br"
    )
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password")
  })

  it("quem já está logado é mandado para a página inicial", () => {
    auth.session = { user: { id: "abc" } }
    abrir()
    expect(screen.getByText("Página inicial")).toBeVisible()
  })
})

describe("LoginPage: validação", () => {
  it("exige os dois campos", async () => {
    abrir()
    await preencher("", "")
    expect(await screen.findByText("Informe o e-mail ou a placa")).toBeVisible()
    expect(screen.getByText("Campo obrigatório")).toBeVisible()
    expect(falso.supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("recusa placa fora do padrão", async () => {
    abrir()
    await preencher("ABC12", "Fulano de Tal")
    expect(
      await screen.findByText("Placa inválida. Ex.: ABC1D23")
    ).toBeVisible()
    expect(falso.supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("recusa e-mail incompleto", async () => {
    abrir()
    await preencher("escritorio@", "qualquer")
    expect(await screen.findByText("E-mail inválido")).toBeVisible()
    expect(falso.supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe("LoginPage: escritório (e-mail e senha)", () => {
  it("entra com o e-mail em minúsculas e a senha digitada", async () => {
    abrir()
    await preencher("Escritorio@Transmas.com.br", "senha-de-teste")
    await waitFor(() =>
      expect(falso.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "escritorio@transmas.com.br",
        password: "senha-de-teste",
      })
    )
    // Escritório não assume veículo
    expect(falso.supabase.rpc).not.toHaveBeenCalled()
  })

  it("avisa quando o e-mail ou a senha estão errados", async () => {
    falso.supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    })
    abrir()
    await preencher("escritorio@transmas.com.br", "errada")
    expect(await screen.findByText("E-mail ou senha incorretos")).toBeVisible()
  })
})

describe("LoginPage: motorista (placa e nome)", () => {
  it("entra com o login derivado do nome e assume o veículo da placa", async () => {
    abrir()
    await preencher("mhp-3i02", "Fulano de Tal")
    await waitFor(() =>
      expect(falso.supabase.rpc).toHaveBeenCalledWith("assumir_veiculo", {
        p_placa: "MHP3I02",
      })
    )
    expect(falso.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "fulano.de.tal@motorista.transmas.local",
      password: "motorista:fulano de tal",
    })
  })

  it("avisa quando o nome não está cadastrado, sem tentar assumir veículo", async () => {
    falso.supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    })
    abrir()
    await preencher("MHP3I02", "Nome Errado")
    expect(
      await screen.findByText(
        "Nome não encontrado. Digite o nome completo, como no cadastro."
      )
    ).toBeVisible()
    expect(falso.supabase.rpc).not.toHaveBeenCalled()
  })

  it("placa que não existe: desfaz o login e avisa", async () => {
    falso.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Placa não cadastrada" },
    })
    abrir()
    await preencher("ZZZ9Z99", "Fulano de Tal")
    expect(
      await screen.findByText("Placa não cadastrada. Confira com o escritório.")
    ).toBeVisible()
    expect(falso.supabase.auth.signOut).toHaveBeenCalled()
  })

  it("outro erro ao assumir o veículo aparece com a mensagem do banco", async () => {
    falso.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "tempo esgotado" },
    })
    abrir()
    await preencher("MHP3I02", "Fulano de Tal")
    expect(
      await screen.findByText("Não foi possível entrar: tempo esgotado")
    ).toBeVisible()
    expect(falso.supabase.auth.signOut).toHaveBeenCalled()
  })
})
