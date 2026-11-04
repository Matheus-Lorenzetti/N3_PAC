import { Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { EtiquetaRegiao } from "@/features/escritorio/regioes/etiqueta-regiao"
import {
  useServicosDoDia,
  type ServicosDoDia,
} from "@/features/escritorio/use-servicos-do-dia"
import {
  formatarHora,
  hojeEmBrasilia,
  ROTULO_SITUACAO,
  type ServicoSituacao,
  type Situacao,
} from "@/lib/servicos"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const COLUNAS: { situacao: Situacao; descricao: string }[] = [
  {
    situacao: "aguardando",
    descricao: "Lançadas hoje, o motorista ainda não aceitou",
  },
  {
    situacao: "pendente",
    descricao: "Ficaram do dia anterior ou o motorista tirou da rota",
  },
  { situacao: "em_rota", descricao: "Na rota do motorista" },
  { situacao: "realizada", descricao: "Concluídas hoje" },
]

// Para onde o cartão pode ir: "aguardando" e "pendente" dependem da data
function podeSoltar(servico: ServicoSituacao, destino: Situacao) {
  if (servico.situacao === destino) return false
  const deHoje = servico.data_servico === hojeEmBrasilia()
  if (destino === "aguardando") return deHoje
  if (destino === "pendente") return !deHoje
  return true
}

// Mudança no banco para cada coluna; os horários são preenchidos pelo gatilho
function mudancaPara(destino: Situacao) {
  if (destino === "em_rota")
    return { status: "em_rota" as const, concluido_em: null }
  if (destino === "realizada") return { status: "realizada" as const }
  return { status: "pendente" as const, aceito_em: null, concluido_em: null }
}

function Cartao({
  servico,
  dados,
  onArrastar,
}: {
  servico: ServicoSituacao
  dados: ServicosDoDia
  onArrastar: (servico: ServicoSituacao | null) => void
}) {
  const empresa = dados.empresas.get(servico.empresa_id!)
  const motorista = dados.motoristas.get(servico.motorista_id!)
  const horario =
    servico.status === "realizada"
      ? `Concluída às ${formatarHora(servico.concluido_em!)}`
      : `Lançada às ${formatarHora(servico.criado_em!)}`

  return (
    <div
      draggable
      onDragStart={(evento) => {
        evento.dataTransfer.setData("text/plain", String(servico.id))
        evento.dataTransfer.effectAllowed = "move"
        onArrastar(servico)
      }}
      onDragEnd={() => onArrastar(null)}
      className="flex cursor-grab flex-col gap-1 rounded-lg border bg-card p-3 shadow-xs active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{empresa?.nome ?? "—"}</span>
        <Badge variant={servico.tipo === "coleta" ? "default" : "secondary"}>
          {servico.tipo === "coleta" ? "Coleta" : "Entrega"}
        </Badge>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {empresa?.endereco}
      </span>
      <EtiquetaRegiao regiao={empresa?.regiao} />
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span>
          {motorista?.placa ?? motorista?.nome ?? "—"} · {horario}
        </span>
        {servico.atrasado && servico.status !== "realizada" && (
          <Badge variant="destructive">Atrasado</Badge>
        )}
      </div>
    </div>
  )
}

// Canto da tela: soltar um cartão aqui pede confirmação e exclui o serviço
function Lixeira({
  arrastando,
  onSoltar,
}: {
  arrastando: ServicoSituacao | null
  onSoltar: (servico: ServicoSituacao) => void
}) {
  const [emCima, setEmCima] = useState(false)

  return (
    <div
      aria-label="Lixeira: arraste um cartão aqui para excluir"
      onDragOver={(evento) => {
        if (!arrastando) return
        evento.preventDefault()
        evento.dataTransfer.dropEffect = "move"
        setEmCima(true)
      }}
      onDragLeave={() => setEmCima(false)}
      onDrop={(evento) => {
        evento.preventDefault()
        setEmCima(false)
        if (arrastando) onSoltar(arrastando)
      }}
      className={cn(
        "fixed right-6 bottom-6 flex items-center gap-2 rounded-full border bg-card p-4 text-muted-foreground shadow-md transition-all",
        arrastando && "scale-110 border-destructive text-destructive",
        emCima && "scale-125 bg-destructive text-white"
      )}
    >
      <Trash2Icon />
      {arrastando && <span className="text-sm font-medium">Excluir</span>}
    </div>
  )
}

export function KanbanPage() {
  const { dados, recarregar } = useServicosDoDia("escritorio-kanban")
  const [arrastando, setArrastando] = useState<ServicoSituacao | null>(null)
  const [alvo, setAlvo] = useState<Situacao | null>(null)
  const [excluir, setExcluir] = useState<ServicoSituacao | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const porColuna = useMemo(() => {
    const grupos = new Map<Situacao, ServicoSituacao[]>(
      COLUNAS.map((c) => [c.situacao, []])
    )
    for (const servico of dados?.servicos ?? []) {
      grupos.get(servico.situacao as Situacao)?.push(servico)
    }
    return grupos
  }, [dados])

  async function mover(servico: ServicoSituacao, destino: Situacao) {
    const { error } = await supabase
      .from("servicos")
      .update(mudancaPara(destino))
      .eq("id", servico.id!)
    if (error) {
      toast.error(`Não foi possível mover: ${error.message}`)
      return
    }
    toast.success(`Movido para "${ROTULO_SITUACAO[destino]}"`)
    recarregar()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", excluir.id!)
    setExcluindo(false)
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`)
      return
    }
    toast.success("Serviço excluído")
    setExcluir(null)
    recarregar()
  }

  if (!dados) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUNAS.map((c) => (
          <Skeleton key={c.situacao} className="h-64" />
        ))}
      </div>
    )
  }

  const empresaExcluir = excluir && dados.empresas.get(excluir.empresa_id!)
  const motoristaExcluir =
    excluir && dados.motoristas.get(excluir.motorista_id!)

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUNAS.map(({ situacao, descricao }) => {
          const cartoes = porColuna.get(situacao) ?? []
          const aceita = !!arrastando && podeSoltar(arrastando, situacao)
          return (
            <Card
              key={situacao}
              size="sm"
              onDragOver={(evento) => {
                if (!aceita) return
                evento.preventDefault()
                setAlvo(situacao)
              }}
              onDragLeave={() => setAlvo(null)}
              onDrop={(evento) => {
                evento.preventDefault()
                setAlvo(null)
                if (arrastando && aceita) mover(arrastando, situacao)
              }}
              className={cn(
                "min-h-64 transition-colors",
                aceita && "ring-2 ring-ring/40",
                alvo === situacao && "bg-muted"
              )}
            >
              <CardHeader>
                <CardTitle>{ROTULO_SITUACAO[situacao]}</CardTitle>
                <CardDescription>{descricao}</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="tabular-nums">
                    {cartoes.length}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {cartoes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum serviço.
                  </p>
                )}
                {cartoes.map((servico) => (
                  <Cartao
                    key={servico.id}
                    servico={servico}
                    dados={dados}
                    onArrastar={setArrastando}
                  />
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Lixeira arrastando={arrastando} onSoltar={setExcluir} />

      <Dialog
        open={!!excluir}
        onOpenChange={(aberto) => !aberto && setExcluir(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir {excluir?.tipo === "coleta" ? "coleta" : "entrega"}?
            </DialogTitle>
            <DialogDescription>
              {empresaExcluir?.nome ?? "—"} ·{" "}
              {motoristaExcluir?.placa ?? motoristaExcluir?.nome ?? "—"}. O
              serviço e o histórico dele são apagados e saem da rota do
              motorista. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              disabled={excluindo}
              onClick={confirmarExclusao}
            >
              {excluindo && <Spinner data-icon="inline-start" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
