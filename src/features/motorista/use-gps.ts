import { useEffect, useRef, useState } from "react"

import { distanciaKm } from "@/lib/servicos"
import { supabase } from "@/lib/supabase"

export type Posicao = {
  latitude: number
  longitude: number
  precisao: number
}

// Envia ao banco no máximo a cada 15 s, ou antes se andou mais de 50 m
const INTERVALO_MS = 15_000
const DISTANCIA_KM = 0.05

// Acompanha o GPS do celular e grava em localizacoes para o rastreador
export function useGps(ativo: boolean) {
  const [posicao, setPosicao] = useState<Posicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ultimoEnvio = useRef<{ em: number; ponto: Posicao } | null>(null)

  useEffect(() => {
    if (!ativo || !navigator.geolocation) return

    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const ponto = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          precisao: coords.accuracy,
        }
        setPosicao(ponto)
        setErro(null)

        const anterior = ultimoEnvio.current
        const agora = Date.now()
        if (
          anterior &&
          agora - anterior.em < INTERVALO_MS &&
          distanciaKm(anterior.ponto, ponto) < DISTANCIA_KM
        ) {
          return
        }
        ultimoEnvio.current = { em: agora, ponto }
        supabase
          .from("localizacoes")
          .insert({
            latitude: ponto.latitude,
            longitude: ponto.longitude,
            precisao_m: coords.accuracy,
            velocidade_ms: coords.speed,
          })
          .then(({ error }) => {
            if (error) console.warn("[gps] não foi possível enviar", error)
          })
      },
      (falha) =>
        setErro(
          falha.code === falha.PERMISSION_DENIED
            ? "Permita o acesso à localização para o escritório acompanhar a rota."
            : "Sem sinal de GPS no momento."
        ),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [ativo])

  return { posicao, erro }
}
