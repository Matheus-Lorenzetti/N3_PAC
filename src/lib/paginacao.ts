import type { PostgrestError } from "@supabase/supabase-js"

// O Supabase devolve no máximo 1.000 linhas por consulta (max_rows). Com mais
// de 1.000 empresas, a lista vinha cortada: sumiam a sede e parte dos
// clientes. Aqui a consulta é repetida página a página até trazer tudo.
// A consulta precisa de uma ordem estável (termine com .order("id")).

const TAMANHO_PAGINA = 1000

type Pagina<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

// Repete a consulta de 1.000 em 1.000 linhas até acabar
export async function buscarTodas<T>(
  pagina: (de: number, ate: number) => Pagina<T>
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const linhas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await pagina(de, de + TAMANHO_PAGINA - 1)
    if (error) return { data: null, error }
    linhas.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA)
      return { data: linhas, error: null }
  }
}
