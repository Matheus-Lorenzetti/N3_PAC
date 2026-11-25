import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { CartaoParada } from "@/features/motorista/cartao-parada"
import type { ParadaOrdenada } from "@/features/motorista/rota-motorista"
import { empresa, servico } from "@/teste/dados"

function parada(campos: Partial<ParadaOrdenada> = {}): ParadaOrdenada {
  return {
    servico: servico({ tipo: "coleta" }),
    empresa: empresa({
      nome: "Dalbor Máquinas",
      endereco: "Rua Caminho das Flores, 728",
      bairro: "Rio Cerro",
      cidade: "Jaraguá do Sul",
      telefone: "(47) 3371-0000",
      latitude: -26.48,
      longitude: -49.12,
    }),
    noMapa: true,
    chegadaSeg: 1020,
    ...campos,
  }
}

function mostrar(props: Partial<ComponentProps<typeof CartaoParada>> = {}) {
  const onConcluir = vi.fn()
  render(
    <CartaoParada
      parada={parada()}
      numero={1}
      ehProxima
      ocupado={false}
      onConcluir={onConcluir}
      {...props}
    />
  )
  return { onConcluir }
}

describe("CartaoParada", () => {
  it("mostra a próxima parada com o tipo, a previsão e os dados da empresa", () => {
    mostrar()
    expect(screen.getByText("Próxima parada · Coleta · ~17 min")).toBeVisible()
    expect(screen.getByText("Dalbor Máquinas")).toBeVisible()
    expect(
      screen.getByText("Rua Caminho das Flores, 728 · Rio Cerro")
    ).toBeVisible()
    expect(screen.getByText("Jaraguá do Sul · (47) 3371-0000")).toBeVisible()
  })

  it("parada tocada no mapa mostra o número dela; sem previsão, não mostra tempo", () => {
    mostrar({
      parada: parada({
        servico: servico({ tipo: "entrega" }),
        chegadaSeg: null,
      }),
      numero: 3,
      ehProxima: false,
    })
    expect(screen.getByText("Parada 3 · Entrega")).toBeVisible()
  })

  it("Ligar disca o telefone e Navegar abre o Waze na empresa", () => {
    mostrar()
    expect(screen.getByText("Ligar").closest("a")).toHaveAttribute(
      "href",
      "tel:4733710000"
    )
    expect(screen.getByText("Navegar").closest("a")).toHaveAttribute(
      "href",
      "https://waze.com/ul?ll=-26.48,-49.12&navigate=yes"
    )
  })

  it("sem telefone não mostra Ligar; sem localização não mostra Navegar", () => {
    mostrar({
      parada: parada({
        empresa: empresa({ telefone: null, latitude: null, longitude: null }),
      }),
    })
    expect(screen.queryByText("Ligar")).not.toBeInTheDocument()
    expect(screen.queryByText("Navegar")).not.toBeInTheDocument()
  })

  it("Concluir avisa a tela do motorista", async () => {
    const { onConcluir } = mostrar()
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }))
    expect(onConcluir).toHaveBeenCalledTimes(1)
  })

  it("enquanto uma conclusão está sendo gravada, Concluir fica travado", () => {
    mostrar({ ocupado: true })
    expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled()
  })

  it("o X só aparece quando a parada foi escolhida no mapa", async () => {
    mostrar()
    expect(
      screen.queryByRole("button", { name: "Fechar" })
    ).not.toBeInTheDocument()

    const onFechar = vi.fn()
    mostrar({ onFechar })
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})
