import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  FiltroServicos,
  ServicosDoDia,
} from "@/features/escritorio/servicos/use-servicos-do-dia"
import { buscarTodas } from "@/lib/paginacao"
import {
  formatarHora,
  hojeEmBrasilia,
  type ServicoSituacao,
} from "@/lib/servicos"
import { supabase } from "@/lib/supabase"

const PERIODOS = [
  { dias: 1, rotulo: "Hoje" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
]

// Início do período no horário de Brasília (hoje = desde a meia-noite)
function inicioDoPeriodo(dias: number) {
  const data = new Date(`${hojeEmBrasilia()}T12:00:00-03:00`)
  data.setDate(data.getDate() - (dias - 1))
  return `${data.toISOString().slice(0, 10)}T00:00:00-03:00`
}

// Serviços concluídos no período, do mais recente para o mais antigo
function buscarRealizados(dias: number) {
  return buscarTodas((de, ate) =>
    supabase
      .from("servicos_situacao")
      .select("*")
      .eq("status", "realizada")
      .gte("concluido_em", inicioDoPeriodo(dias))
      .order("concluido_em", { ascending: false })
      .order("id")
      .range(de, ate)
  )
}

// "05/11/2026 (quinta)" a partir de um horário
function diaDe(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// Painel lateral do Kanban: tudo o que foi concluído, em ordem, dia a dia.
// Respeita o filtro de cidade e placa da tela
export function HistoricoRealizados({
  aberto,
  onAbertoChange,
  dados,
  filtro,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  dados: ServicosDoDia
  filtro: FiltroServicos
}) {
  const [dias, setDias] = useState(1)
  const [realizados, setRealizados] = useState<ServicoSituacao[] | null>(null)

  useEffect(() => {
    if (!aberto) return
    let atual = true
    buscarRealizados(dias).then(({ data }) => {
      if (atual) setRealizados(data ?? [])
    })
    return () => {
      atual = false
    }
  }, [aberto, dias])

  const porDia = useMemo(() => {
    const grupos = new Map<string, ServicoSituacao[]>()
    for (const s of realizados ?? []) {
      const empresa = dados.empresas.get(s.empresa_id!)
      if (filtro.motoristaId && s.motorista_id !== filtro.motoristaId) continue
      if (filtro.cidade && empresa?.cidade !== filtro.cidade) continue
      const dia = diaDe(s.concluido_em!)
      grupos.set(dia, [...(grupos.get(dia) ?? []), s])
    }
    return [...grupos]
  }, [realizados, dados, filtro])

  const total = porDia.reduce((soma, [, lista]) => soma + lista.length, 0)

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Histórico de realizados</SheetTitle>
          <SheetDescription>
            {realizados === null
              ? "Carregando…"
              : `${total} serviço(s) concluído(s), do mais recente para o mais antigo.`}
            {(filtro.cidade || filtro.motoristaId) &&
              " Com o filtro de cidade/placa da tela."}
          </SheetDescription>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[String(dias)]}
            onValueChange={(valor) => {
              if (valor[0]) {
                setRealizados(null)
                setDias(Number(valor[0]))
              }
            }}
          >
            {PERIODOS.map((p) => (
              <ToggleGroupItem
                key={p.dias}
                value={String(p.dias)}
                aria-label={p.rotulo}
              >
                {p.rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {realizados === null &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          {realizados !== null && total === 0 && (
            <p className="text-sm text-muted-foreground">
              Nada concluído no período.
            </p>
          )}
          {porDia.map(([dia, lista]) => (
            <section key={dia} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground capitalize">
                {dia} · {lista.length}
              </h3>
              {lista.map((s) => {
                const empresa = dados.empresas.get(s.empresa_id!)
                const motorista = dados.motoristas.get(s.motorista_id!)
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">
                        {empresa?.nome ?? "—"}
                      </span>
                      <Badge
                        variant={s.tipo === "coleta" ? "default" : "secondary"}
                      >
                        {s.tipo === "coleta" ? "Coleta" : "Entrega"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Concluída às {formatarHora(s.concluido_em!)} ·{" "}
                      {motorista?.placa ?? motorista?.nome ?? "—"} ·{" "}
                      {empresa?.cidade}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Lançada{" "}
                      {diaDe(s.criado_em!) === dia
                        ? "às"
                        : `em ${new Date(s.criado_em!).toLocaleDateString(
                            "pt-BR",
                            {
                              timeZone: "America/Sao_Paulo",
                              day: "2-digit",
                              month: "2-digit",
                            }
                          )} às`}{" "}
                      {formatarHora(s.criado_em!)}
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
