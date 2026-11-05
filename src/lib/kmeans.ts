// K-means para agrupar empresas por região (aprendizado não supervisionado).
//
// 1. As coordenadas viram km num plano centrado na sede (projeção
//    equiretangular: boa para distâncias de até algumas centenas de km).
// 2. Os centros iniciais são escolhidos pelo k-means++ (espalhados), com um
//    gerador aleatório de semente fixa: o mesmo k dá sempre o mesmo resultado.
// 3. Algoritmo de Lloyd: cada ponto vai para o centro mais próximo, cada centro
//    vai para a média dos seus pontos; repete até ninguém mudar de grupo.
// 4. Roda várias vezes (reinícios) e fica com a menor inércia.
// A qualidade de cada k é medida pela inércia (método do cotovelo) e pelo
// coeficiente de silhueta (quanto cada ponto está mais perto do seu grupo
// do que do grupo vizinho; de -1 a 1, quanto maior melhor).

import type { Ponto } from "@/lib/ors"

type Xy = [number, number]

export type ResultadoKmeans = {
  k: number
  // índice do grupo de cada ponto, na mesma ordem da entrada
  rotulos: number[]
  centros: Ponto[]
  // soma das distâncias² (km²) de cada ponto ao seu centro
  inercia: number
  silhueta: number
}

const KM_POR_GRAU_LAT = 110.57

// Converte latitude/longitude em km num plano centrado na origem (e volta)
function projetor(origem: Ponto) {
  const kmPorGrauLon = 111.32 * Math.cos((origem.latitude * Math.PI) / 180)
  return {
    paraXy: (p: Ponto): Xy => [
      (p.longitude - origem.longitude) * kmPorGrauLon,
      (p.latitude - origem.latitude) * KM_POR_GRAU_LAT,
    ],
    paraPonto: ([x, y]: Xy): Ponto => ({
      latitude: origem.latitude + y / KM_POR_GRAU_LAT,
      longitude: origem.longitude + x / kmPorGrauLon,
    }),
  }
}

const dist2 = (a: Xy, b: Xy) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

// Gerador pseudoaleatório com semente (mulberry32)
function aleatorio(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// k-means++: o 1º centro é sorteado; os seguintes, com chance proporcional
// à distância² até o centro mais próximo já escolhido
function centrosIniciais(pontos: Xy[], k: number, sorteio: () => number) {
  const centros: Xy[] = [pontos[Math.floor(sorteio() * pontos.length)]]
  while (centros.length < k) {
    const pesos = pontos.map((p) =>
      Math.min(...centros.map((c) => dist2(p, c)))
    )
    let alvo = sorteio() * pesos.reduce((a, b) => a + b, 0)
    let escolhido = pontos.length - 1
    for (let i = 0; i < pesos.length; i++) {
      alvo -= pesos[i]
      if (alvo <= 0) {
        escolhido = i
        break
      }
    }
    centros.push(pontos[escolhido])
  }
  return centros
}

// Algoritmo de Lloyd: atribui ao centro mais próximo e move o centro para a média, até parar
function lloyd(pontos: Xy[], centros: Xy[]) {
  const rotulos = new Array<number>(pontos.length).fill(-1)
  for (let iteracao = 0; iteracao < 100; iteracao++) {
    let mudou = false
    pontos.forEach((p, i) => {
      let melhor = 0
      for (let c = 1; c < centros.length; c++) {
        if (dist2(p, centros[c]) < dist2(p, centros[melhor])) melhor = c
      }
      if (rotulos[i] !== melhor) {
        rotulos[i] = melhor
        mudou = true
      }
    })
    if (!mudou) break
    centros = centros.map((centro, c) => {
      const membros = pontos.filter((_, i) => rotulos[i] === c)
      if (!membros.length) return centro // grupo vazio: mantém o centro
      return [
        membros.reduce((s, p) => s + p[0], 0) / membros.length,
        membros.reduce((s, p) => s + p[1], 0) / membros.length,
      ]
    })
  }
  const inercia = pontos.reduce(
    (s, p, i) => s + dist2(p, centros[rotulos[i]]),
    0
  )
  return { rotulos, centros, inercia }
}

// Coeficiente de silhueta médio (-1 a 1): quanto maior, mais separados os grupos
function silhueta(pontos: Xy[], rotulos: number[], k: number) {
  if (k < 2) return 0
  const valores = pontos.map((p, i) => {
    const media = (grupo: number) => {
      const outros = pontos.filter((_, j) => j !== i && rotulos[j] === grupo)
      if (!outros.length) return 0
      return (
        outros.reduce((s, q) => s + Math.sqrt(dist2(p, q)), 0) / outros.length
      )
    }
    const a = media(rotulos[i])
    let b = Infinity
    for (let g = 0; g < k; g++) if (g !== rotulos[i]) b = Math.min(b, media(g))
    const sozinho = !rotulos.some((r, j) => j !== i && r === rotulos[i])
    return sozinho || Math.max(a, b) === 0 ? 0 : (b - a) / Math.max(a, b)
  })
  return valores.reduce((s, v) => s + v, 0) / valores.length
}

// Roda o k-means várias vezes e fica com a menor inércia
export function kmeans(
  entrada: Ponto[],
  k: number,
  origem: Ponto,
  { reinicios = 10, semente = 42 } = {}
): ResultadoKmeans {
  const { paraXy, paraPonto } = projetor(origem)
  const pontos = entrada.map(paraXy)
  const sorteio = aleatorio(semente + k)

  let melhor = lloyd(pontos, centrosIniciais(pontos, k, sorteio))
  for (let r = 1; r < reinicios; r++) {
    const tentativa = lloyd(pontos, centrosIniciais(pontos, k, sorteio))
    if (tentativa.inercia < melhor.inercia) melhor = tentativa
  }
  return {
    k,
    rotulos: melhor.rotulos,
    centros: melhor.centros.map(paraPonto),
    inercia: melhor.inercia,
    silhueta: silhueta(pontos, melhor.rotulos, k),
  }
}

// Roda para vários k: base do gráfico do cotovelo e da sugestão por silhueta
export function avaliarKs(
  entrada: Ponto[],
  origem: Ponto,
  ks: number[]
): ResultadoKmeans[] {
  return ks
    .filter((k) => k <= entrada.length)
    .map((k) => kmeans(entrada, k, origem))
}
