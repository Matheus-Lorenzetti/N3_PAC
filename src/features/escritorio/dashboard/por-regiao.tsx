import { TrafficConeIcon } from "lucide-react"
import { useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EtiquetaRegiao } from "@/features/escritorio/regioes/etiqueta-regiao"
import type { ServicosDoDia } from "@/features/escritorio/use-servicos-do-dia"
import { ehAtrasado } from "@/lib/servicos"

// Gargalo: a região concentra 40% ou mais dos atrasos (mínimo 2) ou dos
// serviços abertos (mínimo 4). Regra simples, fácil de conferir na tabela.
const PARCELA_GARGALO = 0.4
const MINIMO_ATRASOS = 2
const MINIMO_ABERTOS = 4

const SEM_REGIAO = { id: -1, nome: "Sem região", cor: "#9ca3af" }

function horas(ms: number) {
  const minutos = Math.round(ms / 60_000)
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function PorRegiao({ dados }: { dados: ServicosDoDia }) {
  const linhas = useMemo(() => {
    const grupos = new Map<
      number,
      {
        regiao: typeof SEM_REGIAO
        aguardando: number
        emRota: number
        realizadas: number
        atrasados: number
        abertos: number
        tempos: number[]
      }
    >()
    for (const servico of dados.servicos) {
      const regiao =
        dados.empresas.get(servico.empresa_id!)?.regiao ?? SEM_REGIAO
      const grupo = grupos.get(regiao.id) ?? {
        regiao,
        aguardando: 0,
        emRota: 0,
        realizadas: 0,
        atrasados: 0,
        abertos: 0,
        tempos: [],
      }
      if (servico.situacao === "aguardando") grupo.aguardando++
      if (servico.status === "em_rota") grupo.emRota++
      if (servico.status !== "realizada") grupo.abertos++
      if (ehAtrasado(servico)) grupo.atrasados++
      if (servico.status === "realizada" && servico.concluido_em) {
        grupo.realizadas++
        // Tempo de atendimento: do lançamento à conclusão
        grupo.tempos.push(
          new Date(servico.concluido_em).getTime() -
            new Date(servico.criado_em!).getTime()
        )
      }
      grupos.set(regiao.id, grupo)
    }
    return [...grupos.values()].sort(
      (a, b) => b.atrasados - a.atrasados || b.abertos - a.abertos
    )
  }, [dados])

  const totalAtrasados = linhas.reduce((s, l) => s + l.atrasados, 0)
  const totalAbertos = linhas.reduce((s, l) => s + l.abertos, 0)

  const gargalos = linhas.filter(
    (l) =>
      l.regiao.id !== SEM_REGIAO.id &&
      ((l.atrasados >= MINIMO_ATRASOS &&
        l.atrasados / totalAtrasados >= PARCELA_GARGALO) ||
        (l.abertos >= MINIMO_ABERTOS &&
          l.abertos / totalAbertos >= PARCELA_GARGALO))
  )

  const temRegioes = linhas.some((l) => l.regiao.id !== SEM_REGIAO.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Por região</CardTitle>
        <CardDescription>
          Regiões definidas pelo k-means (menu Regiões). Mostra onde os serviços
          e os atrasos se concentram.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!temRegioes && (
          <p className="text-sm text-muted-foreground">
            Nenhuma região salva ainda. Gere as regiões no menu Regiões.
          </p>
        )}
        {gargalos.map((g) => (
          <Alert key={g.regiao.id} variant="destructive">
            <TrafficConeIcon />
            <AlertTitle>Possível gargalo: {g.regiao.nome}</AlertTitle>
            <AlertDescription>
              {g.atrasados >= MINIMO_ATRASOS &&
              g.atrasados / totalAtrasados >= PARCELA_GARGALO
                ? `Concentra ${Math.round((g.atrasados / totalAtrasados) * 100)}% dos atrasos (${g.atrasados} de ${totalAtrasados}).`
                : `Concentra ${Math.round((g.abertos / totalAbertos) * 100)}% dos serviços abertos (${g.abertos} de ${totalAbertos}).`}{" "}
              Avalie reforçar a rota nessa região ou agrupar as coletas no mesmo
              dia.
            </AlertDescription>
          </Alert>
        ))}
        {linhas.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Região</TableHead>
                <TableHead className="text-right">Aguardando</TableHead>
                <TableHead className="text-right">Em rota</TableHead>
                <TableHead className="text-right">Realizadas</TableHead>
                <TableHead className="text-right">Atrasados</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.regiao.id}>
                  <TableCell>
                    <EtiquetaRegiao regiao={l.regiao} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.aguardando}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.emRota}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.realizadas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.atrasados > 0 ? (
                      <Badge variant="destructive">{l.atrasados}</Badge>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.tempos.length
                      ? horas(
                          l.tempos.reduce((s, t) => s + t, 0) / l.tempos.length
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
