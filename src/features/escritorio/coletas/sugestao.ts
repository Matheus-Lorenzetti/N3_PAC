import type { Ponto } from "@/lib/ors"
import { distanciaKm } from "@/lib/servicos"

// Sugestão de motorista para uma coleta nova, em ordem de prioridade:
// 1. quem já tem paradas abertas na MESMA REGIÃO do k-means (agrupa as coletas)
// 2. quem está mais perto agora (GPS dos últimos 30 min)
// 3. quem tem menos serviços abertos (divide a carga)

// GPS mais antigo que isso não conta como "mais perto"
const POSICAO_RECENTE_MS = 30 * 60_000

export type MotoristaCandidato = {
  id: string
  nome: string
  placa: string | null
}

export type ServicoAberto = {
  motoristaId: string
  regiaoId: number | null
}

export type Posicao = Ponto & { registradoEm: string }

export type Sugestao = {
  motoristaId: string
  motivo: string
}

// Escolhe o motorista pela ordem acima e devolve o motivo; null se não houver motorista
export function sugerirMotorista({
  empresa,
  regiaoNome,
  motoristas,
  abertos,
  posicoes,
  agora = Date.now(),
}: {
  empresa: Ponto & { regiaoId: number | null }
  regiaoNome: string | null
  motoristas: MotoristaCandidato[]
  abertos: ServicoAberto[]
  posicoes: Map<string, Posicao>
  agora?: number
}): Sugestao | null {
  if (!motoristas.length) return null

  const avaliados = motoristas.map((m) => {
    const dele = abertos.filter((s) => s.motoristaId === m.id)
    const posicao = posicoes.get(m.id)
    const recente =
      posicao &&
      agora - new Date(posicao.registradoEm).getTime() < POSICAO_RECENTE_MS
    return {
      motorista: m,
      naRegiao:
        empresa.regiaoId === null
          ? 0
          : dele.filter((s) => s.regiaoId === empresa.regiaoId).length,
      distancia: recente ? distanciaKm(posicao, empresa) : null,
      carga: dele.length,
    }
  })

  avaliados.sort(
    (a, b) =>
      b.naRegiao - a.naRegiao ||
      (a.distancia ?? Infinity) - (b.distancia ?? Infinity) ||
      a.carga - b.carga
  )
  const melhor = avaliados[0]

  let motivo: string
  if (melhor.naRegiao > 0) {
    motivo = `Já tem ${melhor.naRegiao} parada(s) em ${regiaoNome ?? "esta região"} hoje`
  } else if (melhor.distancia !== null) {
    motivo = `Está mais perto: ${melhor.distancia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km da empresa`
  } else if (motoristas.length > 1) {
    motivo = `Menos serviços abertos (${melhor.carga})`
  } else {
    motivo = "Único motorista ativo"
  }
  return { motoristaId: melhor.motorista.id, motivo }
}
