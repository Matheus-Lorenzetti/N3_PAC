import { useCallback, useEffect, useMemo, useState } from "react"

import { hojeEmBrasilia, type ServicoSituacao } from "@/lib/servicos"
import { buscarTodas } from "@/lib/paginacao"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas"> & {
  regiao: { id: number; nome: string; cor: string } | null
}

// Tudo o que está aberto (de qualquer dia) + o que foi concluído hoje
async function buscar() {
  const inicioDoDia = `${hojeEmBrasilia()}T00:00:00-03:00`
  const [servicos, empresas, motoristas] = await Promise.all([
    supabase
      .from("servicos_situacao")
      .select("*")
      .or(`status.neq.realizada,concluido_em.gte.${inicioDoDia}`)
      .order("criado_em"),
    buscarTodas((de, ate) =>
      supabase
        .from("empresas")
        .select("*, regiao:regioes(id, nome, cor)")
        .order("id")
        .range(de, ate)
    ),
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

// null = todos. Guardado no navegador: vale para o Dashboard e o Kanban
export type FiltroServicos = {
  cidade: string | null
  motoristaId: string | null
}

const CHAVE_FILTRO = "filtro-servicos"
const SEM_FILTRO: FiltroServicos = { cidade: null, motoristaId: null }

// Filtro salvo no navegador; sem filtro se não houver ou estiver inválido
function lerFiltro(): FiltroServicos {
  try {
    return { ...SEM_FILTRO, ...JSON.parse(localStorage.getItem(CHAVE_FILTRO)!) }
  } catch {
    return SEM_FILTRO
  }
}

// Serviços do dia para o Dashboard e o Kanban, atualizados por Realtime
export function useServicosDoDia(canal: string) {
  const [todos, setTodos] = useState<ServicosDoDia | null>(null)
  const [filtro, setFiltroEstado] = useState(lerFiltro)

  const setFiltro = useCallback((novo: FiltroServicos) => {
    setFiltroEstado(novo)
    localStorage.setItem(CHAVE_FILTRO, JSON.stringify(novo))
  }, [])

  const recarregar = useCallback(() => {
    buscar().then(setTodos)
  }, [])

  useEffect(() => {
    buscar().then(setTodos)
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

  // Opções do filtro: só as cidades que têm serviço agora
  const opcoes = useMemo(() => {
    if (!todos) return { cidades: [], motoristas: [] }
    const cidades = new Set<string>()
    for (const s of todos.servicos) {
      const cidade = todos.empresas.get(s.empresa_id!)?.cidade
      if (cidade) cidades.add(cidade)
    }
    return {
      cidades: [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR")),
      motoristas: [...todos.motoristas].map(([id, m]) => ({ id, ...m })),
    }
  }, [todos])

  const dados = useMemo<ServicosDoDia | null>(() => {
    if (!todos) return null
    const { cidade, motoristaId } = filtro
    if (!cidade && !motoristaId) return todos
    return {
      ...todos,
      servicos: todos.servicos.filter(
        (s) =>
          (!motoristaId || s.motorista_id === motoristaId) &&
          (!cidade || todos.empresas.get(s.empresa_id!)?.cidade === cidade)
      ),
      motoristas: motoristaId
        ? new Map([...todos.motoristas].filter(([id]) => id === motoristaId))
        : todos.motoristas,
    }
  }, [todos, filtro])

  return { dados, recarregar, filtro, setFiltro, opcoes }
}
