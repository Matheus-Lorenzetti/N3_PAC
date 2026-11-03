import { TriangleAlertIcon } from "lucide-react"
import { useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
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
import { useServicosDoDia } from "@/features/escritorio/use-servicos-do-dia"
import {
  ROTULO_SITUACAO,
  VARIANTE_SITUACAO,
  type ServicoSituacao,
  type Situacao,
} from "@/lib/servicos"

type Tipo = "coleta" | "entrega"

// Aberto e vindo de dia anterior = "o que ficou do dia anterior"
const ehPendente = (s: ServicoSituacao) =>
  s.status !== "realizada" && !!s.atrasado

function contar(servicos: ServicoSituacao[], tipo: Tipo) {
  const doTipo = servicos.filter((s) => s.tipo === tipo)
  return {
    emRota: doTipo.filter((s) => s.status === "em_rota").length,
    realizadas: doTipo.filter((s) => s.status === "realizada").length,
    pendentes: doTipo.filter(ehPendente).length,
    aguardando: doTipo.filter((s) => s.situacao === "aguardando").length,
  }
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

function CardNumero({
  titulo,
  valor,
  rodape,
  alerta,
}: {
  titulo: string
  valor: number
  rodape?: string
  alerta?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
        {alerta && valor > 0 && (
          <CardAction>
            <Badge variant="destructive">Atenção</Badge>
          </CardAction>
        )}
      </CardHeader>
      {rodape && (
        <CardFooter className="text-xs text-muted-foreground">
          {rodape}
        </CardFooter>
      )}
    </Card>
  )
}

export function DashboardPage() {
  const { dados } = useServicosDoDia("escritorio-dashboard")

  const coletas = useMemo(
    () => contar(dados?.servicos ?? [], "coleta"),
    [dados]
  )
  const entregas = useMemo(
    () => contar(dados?.servicos ?? [], "entrega"),
    [dados]
  )
  const atrasados = useMemo(
    () =>
      (dados?.servicos ?? [])
        .filter(ehPendente)
        .sort((a, b) => a.data_servico!.localeCompare(b.data_servico!)),
    [dados]
  )
  const porMotorista = useMemo(() => {
    if (!dados) return []
    return [...dados.motoristas].map(([id, motorista]) => {
      const dele = dados.servicos.filter((s) => s.motorista_id === id)
      return {
        id,
        ...motorista,
        emRota: dele.filter((s) => s.status === "em_rota").length,
        realizadas: dele.filter((s) => s.status === "realizada").length,
        atrasados: dele.filter(ehPendente).length,
      }
    })
  }, [dados])

  if (!dados) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {atrasados.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {atrasados.length === 1
              ? "1 serviço atrasado"
              : `${atrasados.length} serviços atrasados`}
          </AlertTitle>
          <AlertDescription>
            Ficaram de dias anteriores e ainda não foram concluídos. Veja a
            lista abaixo.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-medium">Coletas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <CardNumero
            titulo="Em rota"
            valor={coletas.emRota}
            rodape={
              coletas.aguardando
                ? `+${coletas.aguardando} aguardando o motorista aceitar`
                : undefined
            }
          />
          <CardNumero titulo="Realizadas hoje" valor={coletas.realizadas} />
          <CardNumero
            titulo="Pendentes (dia anterior)"
            valor={coletas.pendentes}
            alerta
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-medium">Entregas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <CardNumero titulo="Em rota" valor={entregas.emRota} />
          <CardNumero titulo="Realizadas hoje" valor={entregas.realizadas} />
          <CardNumero
            titulo="Pendentes (dia anterior)"
            valor={entregas.pendentes}
            alerta
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atrasados</CardTitle>
            <CardDescription>
              Serviços abertos que vieram de dias anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {atrasados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum atraso. Tudo em dia.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atrasados.map((s) => {
                    const situacao = s.situacao as Situacao
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{formatarData(s.data_servico!)}</TableCell>
                        <TableCell className="font-medium">
                          {dados.empresas.get(s.empresa_id!)?.nome ?? "—"}
                        </TableCell>
                        <TableCell>
                          {s.tipo === "coleta" ? "Coleta" : "Entrega"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_SITUACAO[situacao]}>
                            {ROTULO_SITUACAO[situacao]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por motorista</CardTitle>
            <CardDescription>Situação de hoje de cada veículo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right">Em rota</TableHead>
                  <TableHead className="text-right">Realizadas</TableHead>
                  <TableHead className="text-right">Atrasados</TableHead>
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
                      {m.emRota}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.realizadas}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.atrasados}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
