import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FiltroServicos } from "@/features/escritorio/servicos/use-servicos-do-dia"

// "todos" no Select = sem filtro (null no estado)
const TODOS = "todos"

// Filtro por cidade e placa, o mesmo no Dashboard e no Kanban
export function FiltroServicosBarra({
  filtro,
  onMudar,
  opcoes,
}: {
  filtro: FiltroServicos
  onMudar: (filtro: FiltroServicos) => void
  opcoes: {
    cidades: string[]
    motoristas: { id: string; nome: string; placa: string | null }[]
  }
}) {
  const itensCidade = [
    { value: TODOS, label: "Todas as cidades" },
    // A cidade escolhida continua na lista mesmo sem serviço no momento
    ...[
      ...new Set([
        ...opcoes.cidades,
        ...(filtro.cidade ? [filtro.cidade] : []),
      ]),
    ].map((c) => ({ value: c, label: c })),
  ]
  const itensPlaca = [
    { value: TODOS, label: "Todas as placas" },
    ...opcoes.motoristas.map((m) => ({
      value: m.id,
      label: m.placa ? `${m.placa} · ${m.nome}` : m.nome,
    })),
  ]
  const filtrando = filtro.cidade !== null || filtro.motoristaId !== null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={itensCidade}
        value={filtro.cidade ?? TODOS}
        onValueChange={(valor) =>
          onMudar({
            ...filtro,
            cidade: !valor || valor === TODOS ? null : String(valor),
          })
        }
      >
        <SelectTrigger aria-label="Filtrar por cidade" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {itensCidade.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={itensPlaca}
        value={filtro.motoristaId ?? TODOS}
        onValueChange={(valor) =>
          onMudar({
            ...filtro,
            motoristaId: !valor || valor === TODOS ? null : String(valor),
          })
        }
      >
        <SelectTrigger aria-label="Filtrar por placa" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {itensPlaca.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {filtrando && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMudar({ cidade: null, motoristaId: null })}
        >
          <XIcon data-icon="inline-start" />
          Limpar filtro
        </Button>
      )}
    </div>
  )
}
