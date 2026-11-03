import { SaveIcon, SparklesIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CORES_REGIOES,
  dentroDaArea,
  KS,
  nomearRegioes,
  RAIO_ATENDIMENTO_KM,
  sugerirK,
} from "@/features/escritorio/regioes/agrupamento"
import { GraficoCotovelo } from "@/features/escritorio/regioes/grafico-cotovelo"
import { MapaRegioes } from "@/features/escritorio/regioes/mapa-regioes"
import { avaliarKs } from "@/lib/kmeans"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas"> & { latitude: number; longitude: number }

async function buscar() {
  const [empresas, regioes] = await Promise.all([
    supabase
      .from("empresas")
      .select("*")
      .eq("ativo", true)
      .not("latitude", "is", null),
    supabase.from("regioes").select("criado_em").limit(1),
  ])
  return {
    empresas: (empresas.data ?? []) as Empresa[],
    salvoEm: regioes.data?.[0]?.criado_em ?? null,
  }
}

export function RegioesPage() {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscar>> | null>(
    null
  )
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscar().then(setDados)
  }, [])

  const sede = dados?.empresas.find((e) => e.eh_sede)
  const clientes = useMemo(
    () => (dados?.empresas ?? []).filter((e) => !e.eh_sede),
    [dados]
  )
  const naArea = useMemo(
    () => (sede ? clientes.filter((e) => dentroDaArea(e, sede)) : []),
    [clientes, sede]
  )
  const foraDaArea = clientes.length - naArea.length

  // k-means para cada k (2 a 8): leva alguns milissegundos no navegador
  const resultados = useMemo(
    () => (sede && naArea.length ? avaliarKs(naArea, sede, KS) : []),
    [naArea, sede]
  )
  const sugerido = resultados.length ? sugerirK(resultados) : null
  const k = escolhido ?? sugerido
  const atual = resultados.find((r) => r.k === k)

  const regioes = useMemo(() => {
    if (!atual) return []
    const nomes = nomearRegioes(
      atual,
      naArea.map((e) => e.cidade)
    )
    return atual.centros.map((centro, grupo) => ({
      ...centro,
      nome: nomes[grupo],
      cor: CORES_REGIOES[grupo],
      empresas: naArea.filter((_, i) => atual.rotulos[i] === grupo),
    }))
  }, [atual, naArea])

  const pontos = useMemo(() => {
    if (!atual || !sede) return []
    const corPorId = new Map(
      naArea.map((e, i) => [e.id, CORES_REGIOES[atual.rotulos[i]]])
    )
    return clientes.map((e) => ({
      latitude: e.latitude,
      longitude: e.longitude,
      cor: corPorId.get(e.id) ?? null,
    }))
  }, [atual, clientes, naArea, sede])

  async function salvar() {
    setSalvando(true)
    const { data, error } = await supabase.rpc("aplicar_regioes", {
      p_regioes: regioes.map((r) => ({
        nome: r.nome,
        cor: r.cor,
        latitude: r.latitude,
        longitude: r.longitude,
        empresas: r.empresas.map((e) => e.id),
      })),
    })
    setSalvando(false)
    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`)
      return
    }
    toast.success(
      `${data} regiões salvas. Elas aparecem no Kanban e nas coletas.`
    )
    buscar().then(setDados)
  }

  if (!dados) {
    return (
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100svh-6rem)] gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Regiões de atendimento</CardTitle>
          <CardDescription>
            O k-means agrupa os clientes pela localização. Clientes perto uns
            dos outros ficam na mesma região.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Número de regiões</span>
            <ToggleGroup
              variant="outline"
              size="sm"
              value={k ? [String(k)] : []}
              onValueChange={(valor) => {
                if (valor[0]) setEscolhido(Number(valor[0]))
              }}
            >
              {resultados.map((r) => (
                <ToggleGroupItem
                  key={r.k}
                  value={String(r.k)}
                  aria-label={`${r.k} regiões`}
                >
                  {r.k}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {sugerido && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <SparklesIcon className="size-3.5" />
                Sugerido: {sugerido} (melhor silhueta com grupos de pelo menos 3
                clientes)
              </p>
            )}
          </div>

          {atual && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">
                Silhueta {atual.silhueta.toFixed(2)}
              </Badge>
              <Badge variant="secondary">
                {naArea.length} clientes agrupados
              </Badge>
              {foraDaArea > 0 && (
                <Badge variant="outline">
                  {foraDaArea} fora da área (+{RAIO_ATENDIMENTO_KM} km)
                </Badge>
              )}
            </div>
          )}

          <GraficoCotovelo
            resultados={resultados}
            selecionado={k ?? 0}
            sugerido={sugerido ?? 0}
            onSelecionar={setEscolhido}
          />

          <Separator />

          <ul className="flex flex-col gap-2">
            {regioes.map((r) => (
              <li key={r.nome} className="flex items-center gap-2 text-sm">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: r.cor }}
                />
                <span className="flex-1 truncate">{r.nome}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.empresas.length}
                </span>
              </li>
            ))}
          </ul>

          <Button onClick={salvar} disabled={salvando || !regioes.length}>
            {salvando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            Salvar {k} regiões
          </Button>
          <p className="text-xs text-muted-foreground">
            {dados.salvoEm
              ? `Regiões em uso desde ${new Date(dados.salvoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
              : "Nenhuma região salva ainda."}
          </p>
        </CardContent>
      </Card>

      <Card className="relative min-h-80 overflow-hidden p-0">
        {sede && (
          <MapaRegioes
            sede={{ latitude: sede.latitude, longitude: sede.longitude }}
            pontos={pontos}
            centros={regioes}
          />
        )}
      </Card>
    </div>
  )
}
