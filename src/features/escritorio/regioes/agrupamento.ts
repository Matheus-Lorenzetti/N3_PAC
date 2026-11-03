import type { ResultadoKmeans } from "@/lib/kmeans"
import type { Ponto } from "@/lib/ors"
import { distanciaKm } from "@/lib/servicos"

// Empresas além deste raio ficam fora do agrupamento: poucas e muito longe,
// puxariam um centro para o meio do caminho
export const RAIO_ATENDIMENTO_KM = 150

// Menor grupo aceito na sugestão automática de k
const MINIMO_POR_GRUPO = 3

export const KS = [2, 3, 4, 5, 6, 7, 8]

// Paleta categórica validada (ordem fixa, segura para daltonismo)
export const CORES_REGIOES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
]

// Texto escuro sobre o amarelo; branco sobre as outras cores
export function corDoTexto(cor: string) {
  return cor === "#eda100" ? "#0b0b0b" : "#ffffff"
}

export function dentroDaArea(ponto: Ponto, sede: Ponto) {
  return distanciaKm(ponto, sede) <= RAIO_ATENDIMENTO_KM
}

// Maior silhueta entre os k em que todo grupo tem pelo menos 3 empresas
export function sugerirK(resultados: ResultadoKmeans[]) {
  const validos = resultados.filter((r) =>
    Array.from(
      { length: r.k },
      (_, g) => r.rotulos.filter((x) => x === g).length
    ).every((tamanho) => tamanho >= MINIMO_POR_GRUPO)
  )
  const candidatos = validos.length ? validos : resultados
  return candidatos.reduce((melhor, r) =>
    r.silhueta > melhor.silhueta ? r : melhor
  ).k
}

// Nome = cidade com mais empresas no grupo; cidades repetidas ganham a direção
// em relação à média dos grupos com o mesmo nome (Norte, Sul, Leste, Oeste)
export function nomearRegioes(
  resultado: ResultadoKmeans,
  cidades: string[]
): string[] {
  const base = resultado.centros.map((_, grupo) => {
    const contagem = new Map<string, number>()
    cidades.forEach((cidade, i) => {
      if (resultado.rotulos[i] === grupo) {
        contagem.set(cidade, (contagem.get(cidade) ?? 0) + 1)
      }
    })
    return [...contagem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Região"
  })

  const nomes = base.map((nome, grupo) => {
    const iguais = base.flatMap((n, g) => (n === nome ? [g] : []))
    if (iguais.length === 1) return nome
    const media = {
      latitude:
        iguais.reduce((s, g) => s + resultado.centros[g].latitude, 0) /
        iguais.length,
      longitude:
        iguais.reduce((s, g) => s + resultado.centros[g].longitude, 0) /
        iguais.length,
    }
    const centro = resultado.centros[grupo]
    const dLat = centro.latitude - media.latitude
    const dLon = centro.longitude - media.longitude
    const direcao =
      Math.abs(dLat) > Math.abs(dLon)
        ? dLat > 0
          ? "Norte"
          : "Sul"
        : dLon > 0
          ? "Leste"
          : "Oeste"
    return `${nome} ${direcao}`
  })

  // Se ainda sobrar repetido (3+ grupos na mesma direção), numera
  return nomes.map((nome, i) => {
    const antes = nomes.slice(0, i).filter((n) => n === nome).length
    return antes ? `${nome} ${antes + 1}` : nome
  })
}
