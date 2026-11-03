import type { Database } from "@/lib/database.types"

export type ServicoSituacao =
  Database["public"]["Views"]["servicos_situacao"]["Row"]

export type Situacao = "aguardando" | "pendente" | "em_rota" | "realizada"

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  aguardando: "Aguardando motorista",
  pendente: "Pendente (dia anterior)",
  em_rota: "Em rota",
  realizada: "Realizada",
}

export const VARIANTE_SITUACAO = {
  aguardando: "outline",
  pendente: "destructive",
  em_rota: "secondary",
  realizada: "default",
} as const satisfies Record<Situacao, string>

// Dia de hoje no horário de Brasília (AAAA-MM-DD), igual ao data_servico do banco
export function hojeEmBrasilia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date())
}

export function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Distância em linha reta (fórmula de Haversine), em km
export function distanciaKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const rad = (graus: number) => (graus * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// Aberto e vindo de dia anterior = "o que ficou do dia anterior"
export function ehAtrasado(servico: ServicoSituacao) {
  return servico.status !== "realizada" && !!servico.atrasado
}
