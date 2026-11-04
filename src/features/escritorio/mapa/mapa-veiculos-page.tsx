import { TruckIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  MapaFrota,
  type VeiculoNoMapa,
} from "@/features/escritorio/mapa/mapa-frota"
import { cn } from "@/lib/utils"
import { rotaDaPosicao } from "@/lib/mapa"
import { hojeEmBrasilia, type ServicoSituacao } from "@/lib/servicos"
import { buscarTodas } from "@/lib/paginacao"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">
type Localizacao = Tabela<"localizacoes">

// Uma cor por veículo, na ordem da lista
const CORES = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"]

// Sem posição nova há mais que isso = sinal perdido
const AO_VIVO_MS = 2 * 60_000

async function buscarFrota() {
  const [motoristas, posicoes, rotas, servicos, empresas] = await Promise.all([
    supabase
      .from("funcionarios")
      .select("id, nome, veiculos(placa)")
      .eq("perfil", "motorista")
      .eq("ativo", true)
      .order("nome"),
    supabase.from("ultimas_localizacoes").select("*"),
    supabase.from("rotas").select("*").eq("data", hojeEmBrasilia()),
    supabase.from("servicos_situacao").select("*").eq("status", "em_rota"),
    buscarTodas((de, ate) =>
      supabase.from("empresas").select("*").order("id").range(de, ate)
    ),
  ])
  return {
    motoristas: (motoristas.data ?? []).map((m) => ({
      id: m.id,
      nome: m.nome,
      placa: m.veiculos?.placa ?? "SEM PLACA",
    })),
    posicoes: new Map(
      (posicoes.data ?? []).map((p) => [p.motorista_id!, p as Localizacao])
    ),
    rotas: new Map((rotas.data ?? []).map((r) => [r.motorista_id, r])),
    servicos: servicos.data ?? [],
    empresas: new Map((empresas.data ?? []).map((e) => [e.id, e])),
  }
}

type Frota = Awaited<ReturnType<typeof buscarFrota>>

function tempoDesde(iso: string, agora: number) {
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return "agora"
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `há ${horas} h` : "há mais de 1 dia"
}

export function MapaVeiculosPage() {
  const [frota, setFrota] = useState<Frota | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const atualizar = useCallback(() => {
    buscarFrota().then(setFrota)
  }, [])

  useEffect(() => {
    buscarFrota().then(setFrota)
    const relogio = window.setInterval(() => setAgora(Date.now()), 30_000)

    const canal = supabase
      .channel("escritorio-frota")
      // Posição nova: atualiza só o veículo, sem buscar tudo de novo
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "localizacoes" },
        ({ new: registro }) => {
          const posicao = registro as Localizacao
          setFrota((atual) => {
            if (!atual) return atual
            const posicoes = new Map(atual.posicoes)
            posicoes.set(posicao.motorista_id, posicao)
            return { ...atual, posicoes }
          })
          setAgora(Date.now())
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rotas" },
        () => atualizar()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servicos" },
        () => atualizar()
      )
      .subscribe()

    return () => {
      window.clearInterval(relogio)
      supabase.removeChannel(canal)
    }
  }, [atualizar])

  const sede = frota
    ? [...frota.empresas.values()].find((e) => e.eh_sede)
    : undefined

  const veiculos: (VeiculoNoMapa & {
    nome: string
    atualizadoEm: string | null
    distanciaM: number
    paradasNomes: { servico: ServicoSituacao; empresa?: Empresa }[]
  })[] = useMemo(() => {
    if (!frota) return []
    return frota.motoristas.map((motorista, i) => {
      const posicao = frota.posicoes.get(motorista.id)
      const rota = frota.rotas.get(motorista.id)
      const porId = new Map(
        frota.servicos
          .filter((s) => s.motorista_id === motorista.id)
          .map((s) => [s.id!, s])
      )
      // Paradas na ordem que o app do motorista calculou; as que ainda não
      // entraram na rota gravada (ex.: cálculo falhou) aparecem no fim
      const naOrdem = (rota?.ordem ?? []).flatMap((id) => {
        const servico = porId.get(id)
        porId.delete(id)
        return servico ? [servico] : []
      })
      naOrdem.push(...porId.values())
      const paradasNomes = naOrdem.map((servico) => ({
        servico,
        empresa: frota.empresas.get(servico.empresa_id!),
      }))
      const paradas = paradasNomes.flatMap(({ servico, empresa }, n) =>
        empresa?.latitude != null && empresa.longitude != null
          ? [
              {
                id: servico.id!,
                numero: n + 1,
                tipo: servico.tipo!,
                latitude: empresa.latitude,
                longitude: empresa.longitude,
              },
            ]
          : []
      )
      const ponto = posicao
        ? { latitude: posicao.latitude, longitude: posicao.longitude }
        : null
      return {
        motoristaId: motorista.id,
        placa: motorista.placa,
        nome: motorista.nome,
        cor: CORES[i % CORES.length],
        posicao: ponto,
        atualizadoEm: posicao?.registrado_em ?? null,
        // Em tempo real: a linha sai da placa (o que ficou para trás some)
        linha: rotaDaPosicao(
          (rota?.linha as [number, number][] | undefined) ?? [],
          ponto,
          paradas[0] ?? null
        ).linha,
        distanciaM: rota?.distancia_m ?? 0,
        paradasNomes,
        paradas,
      }
    })
  }, [frota])

  const escolhido = veiculos.find((v) => v.motoristaId === selecionado)

  return (
    <div className="grid h-[calc(100svh-6rem)] gap-4 lg:grid-cols-[20rem_1fr]">
      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Veículos</CardTitle>
          <CardDescription>
            Posição ao vivo e a rota que o motorista está seguindo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Button
            variant={selecionado === null ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setSelecionado(null)}
          >
            <TruckIcon data-icon="inline-start" />
            Todos os veículos
          </Button>
          {frota && veiculos.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhum motorista</EmptyTitle>
                <EmptyDescription>
                  Cadastre motoristas para acompanhar aqui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {veiculos.map((veiculo) => {
            const aoVivo =
              veiculo.atualizadoEm !== null &&
              agora - new Date(veiculo.atualizadoEm).getTime() < AO_VIVO_MS
            return (
              <button
                key={veiculo.motoristaId}
                type="button"
                onClick={() => setSelecionado(veiculo.motoristaId)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted",
                  selecionado === veiculo.motoristaId && "bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: veiculo.cor }}
                  />
                  <span className="font-medium">{veiculo.placa}</span>
                  <span className="truncate text-muted-foreground">
                    {veiculo.nome}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {veiculo.atualizadoEm === null ? (
                    <Badge variant="outline">Sem sinal</Badge>
                  ) : aoVivo ? (
                    <Badge>Ao vivo</Badge>
                  ) : (
                    <Badge variant="destructive">
                      Último sinal {tempoDesde(veiculo.atualizadoEm, agora)}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {veiculo.paradasNomes.length} parada(s)
                    {veiculo.distanciaM > 0 &&
                      ` · ${(veiculo.distanciaM / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`}
                  </Badge>
                </div>
              </button>
            )
          })}
          {escolhido && (
            <>
              <Separator />
              <span className="text-sm font-medium">
                Rota de {escolhido.placa}
              </span>
              {escolhido.paradasNomes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma parada na rota agora.
                </p>
              )}
              {escolhido.paradasNomes.map(({ servico, empresa }, i) => (
                <div key={servico.id} className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">
                      {empresa?.nome ?? "—"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {servico.tipo === "coleta" ? "Coleta" : "Entrega"} ·{" "}
                      {empresa?.endereco}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="relative min-h-80 overflow-hidden p-0">
        {sede?.latitude != null && sede.longitude != null && (
          <MapaFrota
            sede={{ latitude: sede.latitude, longitude: sede.longitude }}
            veiculos={veiculos}
            selecionado={selecionado}
            onSelecionar={setSelecionado}
          />
        )}
      </Card>
    </div>
  )
}
