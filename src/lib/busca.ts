// Busca de empresas tolerante: ignora acento, maiúsculas e pontuação, aceita
// as palavras em qualquer ordem e pedaços de palavra ("acril 3d", "weg itajai"),
// e procura no nome, no CNPJ, na cidade, no bairro e no endereço.

type EmpresaBuscavel = {
  nome: string
  cnpj?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
}

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Texto em que a busca procura; os números do CNPJ entram juntos e separados
function textoDaEmpresa(empresa: EmpresaBuscavel) {
  return normalizar(
    [
      empresa.nome,
      empresa.cnpj,
      empresa.cidade,
      empresa.bairro,
      empresa.endereco,
    ]
      .filter(Boolean)
      .join(" ")
  )
}

const cache = new WeakMap<object, string>()

// Filtro para o Combobox: todas as palavras digitadas precisam aparecer
export function filtrarEmpresa(empresa: EmpresaBuscavel, consulta: string) {
  const palavras = normalizar(consulta).split(" ").filter(Boolean)
  if (!palavras.length) return true
  let texto = cache.get(empresa)
  if (texto === undefined) {
    texto = textoDaEmpresa(empresa)
    cache.set(empresa, texto)
  }
  // CNPJ digitado com pontos ("07.175.725/0004-02") vira só números
  const soNumeros = consulta.replace(/\D/g, "")
  if (soNumeros.length >= 8 && texto.includes(soNumeros)) return true
  return palavras.every((palavra) => texto.includes(palavra))
}

// Muitas empresas: mostra só as primeiras e pede para refinar
export const LIMITE_RESULTADOS = 50
