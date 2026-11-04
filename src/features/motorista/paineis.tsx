import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ParadaOrdenada } from "@/features/motorista/motorista-page"
import { formatarHora, type ServicoSituacao } from "@/lib/servicos"
import { filtrarEmpresa, LIMITE_RESULTADOS } from "@/lib/busca"
import type { Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">

function LinhaParada({
  numero,
  titulo,
  detalhe,
  children,
}: {
  numero?: number
  titulo: string
  detalhe: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {numero !== undefined && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {numero}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{titulo}</span>
        <span className="truncate text-xs text-muted-foreground">
          {detalhe}
        </span>
      </div>
      {children}
    </div>
  )
}

export function PainelRota({
  aberto,
  onAbertoChange,
  paradas,
  empresas,
  ocupado,
  onConcluir,
  onAdicionarEntrega,
  manual,
  onMover,
  onTirar,
  onUsarSugerida,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  paradas: ParadaOrdenada[]
  empresas: Empresa[]
  ocupado: boolean
  onConcluir: (servicoId: number) => void
  onAdicionarEntrega: (empresaId: number) => void
  // true = o motorista mudou a ordem; false = segue a ordem sugerida
  manual: boolean
  onMover: (servicoId: number, direcao: -1 | 1) => void
  onTirar: (servicoId: number) => void
  onUsarSugerida: () => void
}) {
  const [busca, setBusca] = useState<Empresa | null>(null)
  const clientes = empresas.filter((e) => !e.eh_sede)
  const totalNoMapa = paradas.filter((p) => p.noMapa).length

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent side="bottom" className="max-h-[85svh]">
        <SheetHeader>
          <SheetTitle>Rota do dia</SheetTitle>
          <SheetDescription>
            {manual
              ? "Ordem escolhida por você, saindo e voltando à sede."
              : "Ordem sugerida para o menor caminho, saindo e voltando à sede. Use as setas para mudar."}
          </SheetDescription>
          {manual && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={onUsarSugerida}
            >
              <SparklesIcon data-icon="inline-start" />
              Usar rota sugerida
            </Button>
          )}
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          <Field>
            <FieldLabel htmlFor="nova-entrega">Adicionar entrega</FieldLabel>
            <div className="flex gap-2">
              <Combobox
                items={clientes}
                value={busca}
                onValueChange={(empresa: Empresa | null) => setBusca(empresa)}
                itemToStringLabel={(empresa: Empresa) => empresa.nome}
                filter={filtrarEmpresa}
                limit={LIMITE_RESULTADOS}
              >
                <ComboboxInput
                  id="nova-entrega"
                  placeholder="Digite o nome da empresa…"
                  className="flex-1"
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    Nenhuma empresa encontrada. Tente parte do nome, a cidade ou
                    o CNPJ.
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(empresa: Empresa) => (
                      <ComboboxItem key={empresa.id} value={empresa}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{empresa.nome}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {empresa.endereco} · {empresa.bairro}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <Button
                size="icon"
                aria-label="Adicionar entrega"
                disabled={!busca}
                onClick={() => {
                  if (!busca) return
                  onAdicionarEntrega(busca.id)
                  setBusca(null)
                }}
              >
                <PlusIcon />
              </Button>
            </div>
            <FieldDescription>
              {manual
                ? "Paradas novas entram no fim da sua ordem."
                : "A rota é recalculada sozinha a cada parada nova."}
            </FieldDescription>
          </Field>

          {paradas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma parada na rota ainda.
            </p>
          )}
          {paradas.map(({ servico, empresa, noMapa }, i) => (
            <LinhaParada
              key={servico.id}
              numero={noMapa ? i + 1 : undefined}
              titulo={empresa?.nome ?? "—"}
              detalhe={`${servico.tipo === "coleta" ? "Coleta" : "Entrega"} · ${empresa?.endereco ?? ""}`}
            >
              {noMapa ? (
                <div className="flex flex-col">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Subir ${empresa?.nome}`}
                    disabled={i === 0}
                    onClick={() => onMover(servico.id!, -1)}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Descer ${empresa?.nome}`}
                    disabled={i === totalNoMapa - 1}
                    onClick={() => onMover(servico.id!, 1)}
                  >
                    <ChevronDownIcon />
                  </Button>
                </div>
              ) : (
                <Badge variant="destructive">Fora do mapa</Badge>
              )}
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`Tirar ${empresa?.nome} da rota`}
                disabled={ocupado}
                onClick={() => onTirar(servico.id!)}
              >
                <XIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`Concluir ${empresa?.nome}`}
                disabled={ocupado}
                onClick={() => onConcluir(servico.id!)}
              >
                <CheckIcon />
              </Button>
            </LinhaParada>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function PainelColetas({
  aberto,
  onAbertoChange,
  coletas,
  empresas,
  ocupado,
  onAdicionar,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  coletas: ServicoSituacao[]
  empresas: Map<number, Empresa>
  ocupado: boolean
  onAdicionar: (servicoId: number) => void
}) {
  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent side="bottom" className="max-h-[85svh]">
        <SheetHeader>
          <SheetTitle>Coletas aguardando</SheetTitle>
          <SheetDescription>
            As que você não adicionar hoje entram na rota de amanhã.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {coletas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma coleta aguardando.
            </p>
          )}
          {coletas.map((coleta) => {
            const empresa = empresas.get(coleta.empresa_id!)
            return (
              <LinhaParada
                key={coleta.id}
                titulo={empresa?.nome ?? "—"}
                detalhe={`${coleta.tipo === "entrega" ? "Entrega · " : ""}Lançada às ${formatarHora(coleta.criado_em!)} · ${empresa?.endereco ?? ""}`}
              >
                <Button
                  size="sm"
                  disabled={ocupado}
                  onClick={() => onAdicionar(coleta.id!)}
                >
                  Adicionar
                </Button>
              </LinhaParada>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
