// Serviços gratuitos e sem chave:
//   ViaCEP    -> endereço a partir do CEP
//   Nominatim -> coordenadas a partir do endereço (OpenStreetMap; limite de 1 consulta/s,
//                por isso a geocodificação é feita uma única vez, ao salvar a empresa)

export type EnderecoCep = {
  endereco: string
  bairro: string
  cidade: string
  uf: string
}

export type Coordenadas = { latitude: number; longitude: number }

export function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "")
}

// Endereço pelo CEP no ViaCEP; null se o CEP não existir
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const digitos = somenteDigitos(cep)
  if (digitos.length !== 8) return null

  const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
  if (!resposta.ok) return null
  const dados = await resposta.json()
  if (dados.erro) return null

  return {
    endereco: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  }
}

type EnderecoGeocodificar = {
  endereco: string
  cidade: string
  uf: string
}

// Primeiro resultado do Nominatim no Brasil, em latitude e longitude
async function consultarNominatim(parametros: Record<string, string>) {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.search = new URLSearchParams({
    ...parametros,
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
  }).toString()

  const resposta = await fetch(url)
  if (!resposta.ok) return null
  const [primeiro] = await resposta.json()
  if (!primeiro) return null
  return { latitude: Number(primeiro.lat), longitude: Number(primeiro.lon) }
}

// Endereço → coordenadas pelo Nominatim; null se não achar
export async function geocodificar({
  endereco,
  cidade,
  uf,
}: EnderecoGeocodificar): Promise<Coordenadas | null> {
  // Busca estruturada primeiro (mais precisa); se não achar, tenta em texto livre
  return (
    (await consultarNominatim({ street: endereco, city: cidade, state: uf })) ??
    (await consultarNominatim({ q: `${endereco}, ${cidade} - ${uf}` }))
  )
}
