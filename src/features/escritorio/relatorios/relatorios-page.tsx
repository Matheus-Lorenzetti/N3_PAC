import { useEffect, useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { buscarTodas } from "@/lib/paginacao"
import {
  formatarDuracao,
  hojeEmBrasilia,
  type ServicoSituacao,
} from "@/lib/servicos"
import { supabase } from "@/lib/supabase"

const PERIODOS = [7, 30, 90]

// Primeiro dia do período (AAAA-MM-DD), contando hoje
function inicioDoPeriodo(dias: number) {
  const data = new Date(`${hojeEmBrasilia()}T12:00:00-03:00`)
  data.setDate(data.getDate() - (dias - 1))
  return data.toISOString().slice(0, 10)
}

// Serviços com data no período e os motoristas com a placa
async function buscar(dias: number) {
  const [servicos, motoristas] = await Promise.all([
    buscarTodas((de, ate) =>
      supabase
        .from("servicos_situacao")
        .select("*")
        .gte("data_servico", inicioDoPeriodo(dias))
        .order("id")
        .range(de, ate)
    ),
    supabase
      .from("funcionarios")
      .select("id, nome, veiculos(placa)")
      .eq("perfil", "motorista")
      .order("nome"),
  ])
  return {
    servicos: servicos.data ?? [],
    motoristas: (motoristas.data ?? []).map((m) => ({
      id: m.id,
      nome: m.nome,
      placa: m.veiculos?.placa ?? null,
    })),
  }
}

// Média do intervalo entre dois horários (ms); null se nenhum serviço tiver os dois
function mediaEntre(
  servicos: ServicoSituacao[],
  de: (s: ServicoSituacao) => string | null,
  ate: (s: ServicoSituacao) => string | null
) {
  const intervalos = servicos.flatMap((s) => {
    const inicio = de(s)
    const fim = ate(s)
    return inicio && fim ? [Date.parse(fim) - Date.parse(inicio)] : []
  })
  if (!intervalos.length) return null
  return intervalos.reduce((a, b) => a + b, 0) / intervalos.length
}

function porcentagem(parte: number, total: number) {
  return total ? `${Math.round((parte / total) * 100)}%` : "—"
}

function formatarData(data: string) {
  const [, mes, dia] = data.split("-")
  return `${dia}/${mes}`
}

// Card com um indicador do período
function CardIndicador({
  titulo,
  valor,
  rodape,
}: {
  titulo: string
  valor: string
  rodape: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">
        {rodape}
      </CardFooter>
    </Card>
  )
}

// Tela Relatórios: taxa de atraso, tempo médio por etapa e produtividade por
// motorista e por dia, nos últimos 7, 30 ou 90 dias
export function RelatoriosPage() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscar>> | null>(
    null
  )

  useEffect(() => {
    let atual = true
    buscar(dias).then((resultado) => {
      if (atual) setDados(resultado)
    })
    return () => {
      atual = false
    }
  }, [dias])

  const resumo = useMemo(() => {
    const servicos = dados?.servicos ?? []
    const realizados = servicos.filter((s) => s.status === "realizada")
    const coletas = servicos.filter((s) => s.tipo === "coleta")
    return {
      total: servicos.length,
      realizados: realizados.length,
      atrasados: servicos.filter((s) => s.atrasado).length,
      // Coleta: do lançamento pelo escritório até o motorista aceitar
      aceite: mediaEntre(
        coletas,
        (s) => s.criado_em,
        (s) => s.aceito_em
      ),
      // Da entrada na rota até a conclusão
      emRota: mediaEntre(
        realizados,
        (s) => s.aceito_em,
        (s) => s.concluido_em
      ),
      // Do lançamento até a conclusão
      tempoTotal: mediaEntre(
        realizados,
        (s) => s.criado_em,
        (s) => s.concluido_em
      ),
    }
  }, [dados])

  const porMotorista = useMemo(() => {
    if (!dados) return []
    return dados.motoristas
      .map((m) => {
        const dele = dados.servicos.filter((s) => s.motorista_id === m.id)
        const realizados = dele.filter((s) => s.status === "realizada")
        return {
          ...m,
          total: dele.length,
          realizados: realizados.length,
          atrasados: dele.filter((s) => s.atrasado).length,
          emRota: mediaEntre(
            realizados,
            (s) => s.aceito_em,
            (s) => s.concluido_em
          ),
        }
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.realizados - a.realizados)
  }, [dados])

  const porDia = useMemo(() => {
    const grupos = new Map<
      string,
      { total: number; realizados: number; atrasados: number }
    >()
    for (const s of dados?.servicos ?? []) {
      const dia = grupos.get(s.data_servico!) ?? {
        total: 0,
        realizados: 0,
        atrasados: 0,
      }
      dia.total++
      if (s.status === "realizada") dia.realizados++
      if (s.atrasado) dia.atrasados++
      grupos.set(s.data_servico!, dia)
    }
    return [...grupos].sort(([a], [b]) => b.localeCompare(a))
  }, [dados])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[String(dias)]}
          onValueChange={(valor) => {
            if (valor[0]) {
              setDados(null)
              setDias(Number(valor[0]))
            }
          }}
        >
          {PERIODOS.map((p) => (
            <ToggleGroupItem
              key={p}
              value={String(p)}
              aria-label={`Últimos ${p} dias`}
            >
              {p} dias
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!dados ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-medium">Resultado</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <CardIndicador
                titulo="Serviços no período"
                valor={String(resumo.total)}
                rodape={`${resumo.realizados} realizados (${porcentagem(resumo.realizados, resumo.total)})`}
              />
              <CardIndicador
                titulo="Taxa de atraso"
                valor={porcentagem(resumo.atrasados, resumo.total)}
                rodape={`${resumo.atrasados} atrasados: concluídos depois do dia previsto ou abertos de dia anterior`}
              />
              <CardIndicador
                titulo="Tempo total médio"
                valor={
                  resumo.tempoTotal === null
                    ? "—"
                    : formatarDuracao(resumo.tempoTotal)
                }
                rodape="Do lançamento até a conclusão"
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-medium">
              Tempo médio por etapa
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <CardIndicador
                titulo="Aguardando o motorista aceitar"
                valor={
                  resumo.aceite === null ? "—" : formatarDuracao(resumo.aceite)
                }
                rodape="Coletas: do lançamento pelo escritório até o aceite"
              />
              <CardIndicador
                titulo="Em rota"
                valor={
                  resumo.emRota === null ? "—" : formatarDuracao(resumo.emRota)
                }
                rodape="Da entrada na rota até a conclusão"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Produtividade por motorista</CardTitle>
                <CardDescription>
                  Serviços de cada veículo no período.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {porMotorista.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço no período.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead className="text-right">Realizados</TableHead>
                        <TableHead className="text-right">Atraso</TableHead>
                        <TableHead className="text-right">
                          Tempo em rota
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porMotorista.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">
                            {m.nome}
                            {m.placa && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {m.placa}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.realizados} de {m.total}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {porcentagem(m.atrasados, m.total)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.emRota === null
                              ? "—"
                              : formatarDuracao(m.emRota)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por dia</CardTitle>
                <CardDescription>
                  Serviços previstos para cada dia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {porDia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço no período.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dia</TableHead>
                        <TableHead className="text-right">Serviços</TableHead>
                        <TableHead className="text-right">Realizados</TableHead>
                        <TableHead className="text-right">Atrasados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porDia.map(([dia, d]) => (
                        <TableRow key={dia}>
                          <TableCell>{formatarData(dia)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.total}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.realizados}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.atrasados}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
