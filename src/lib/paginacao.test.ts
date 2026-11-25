import { describe, expect, it, vi } from "vitest"

import { buscarTodas } from "@/lib/paginacao"

const linhas = (quantas: number, de = 0) =>
  Array.from({ length: quantas }, (_, i) => ({ id: de + i }))

describe("buscarTodas", () => {
  it("com menos de 1.000 linhas faz uma consulta só", async () => {
    const pagina = vi.fn().mockResolvedValue({ data: linhas(3), error: null })
    const { data, error } = await buscarTodas(pagina)
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    expect(pagina).toHaveBeenCalledTimes(1)
    expect(pagina).toHaveBeenCalledWith(0, 999)
  })

  it("com mais de 1.000 linhas busca a página seguinte e junta tudo", async () => {
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: linhas(1000), error: null })
      .mockResolvedValueOnce({ data: linhas(153, 1000), error: null })
    const { data } = await buscarTodas(pagina)
    expect(data).toHaveLength(1153)
    expect(data?.at(-1)).toEqual({ id: 1152 })
    expect(pagina).toHaveBeenNthCalledWith(1, 0, 999)
    expect(pagina).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it("com exatamente 1.000 linhas confere se há mais", async () => {
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: linhas(1000), error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const { data } = await buscarTodas(pagina)
    expect(data).toHaveLength(1000)
    expect(pagina).toHaveBeenCalledTimes(2)
  })

  it("para e devolve o erro se uma página falhar", async () => {
    const erro = { message: "sem permissão" }
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: linhas(1000), error: null })
      .mockResolvedValueOnce({ data: null, error: erro })
    expect(await buscarTodas(pagina)).toEqual({ data: null, error: erro })
  })

  it("trata resposta sem dados como lista vazia", async () => {
    const pagina = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await buscarTodas(pagina)).toEqual({ data: [], error: null })
  })
})
