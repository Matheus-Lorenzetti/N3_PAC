import { useCallback, useEffect, useState } from "react"

import { hojeEmBrasilia, type ServicoSituacao } from "@/lib/servicos"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">

// Tudo o que está aberto (de qualquer dia) + o que foi concluído hoje
async function buscar() {
  const inicioDoDia = `${hojeEmBrasilia()}T00:00:00-03:00`
  const [servicos, empresas, motoristas] = await Promise.all([
    supabase
      .from("servicos_situacao")
      .select("*")
      .or(`status.neq.realizada,concluido_em.gte.${inicioDoDia}`)
      .order("criado_em"),
    supabase.from("empresas").select("*"),
    supabase
      .from("funcionarios")
      .select("id, nome, veiculos(placa)")
      .eq("perfil", "motorista"),
  ])
  return {
    servicos: servicos.data ?? [],
    empresas: new Map((empresas.data ?? []).map((e) => [e.id, e])),
    motoristas: new Map(
      (motoristas.data ?? []).map((m) => [
        m.id,
        { nome: m.nome, placa: m.veiculos?.placa ?? null },
      ])
    ),
    erro: servicos.error?.message ?? null,
  }
}

export type ServicosDoDia = {
  servicos: ServicoSituacao[]
  empresas: Map<number, Empresa>
  motoristas: Map<string, { nome: string; placa: string | null }>
  erro: string | null
}

// Serviços do dia para o Dashboard e o Kanban, atualizados por Realtime
export function useServicosDoDia(canal: string) {
  const [dados, setDados] = useState<ServicosDoDia | null>(null)

  const recarregar = useCallback(() => {
    buscar().then(setDados)
  }, [])

  useEffect(() => {
    buscar().then(setDados)
    const inscricao = supabase
      .channel(canal)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servicos" },
        () => recarregar()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(inscricao)
    }
  }, [canal, recarregar])

  return { dados, recarregar }
}
