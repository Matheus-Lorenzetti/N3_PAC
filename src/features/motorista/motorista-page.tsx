import {
  CheckIcon,
  ListOrderedIcon,
  LogOutIcon,
  MenuIcon,
  NavigationIcon,
  PackageIcon,
  PlayIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"
import {
  iniciarAlerta,
  pararAlerta,
  prepararAlertas,
} from "@/features/motorista/alerta"
import { MapaRota, type ParadaNoMapa } from "@/features/motorista/mapa-rota"
import {
  NovaColetaAlerta,
  type ColetaRecebida,
} from "@/features/motorista/nova-coleta-alerta"
import { PainelColetas, PainelRota } from "@/features/motorista/paineis"
import { useGps } from "@/features/motorista/use-gps"
import { otimizarRota, type Ponto, type RotaOtimizada } from "@/lib/ors"
import { distanciaKm, type ServicoSituacao } from "@/lib/servicos"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">

export type ParadaOrdenada = {
  servico: ServicoSituacao
  empresa: Empresa | undefined
  // null = fora do mapa (empresa sem localização ou sem rota possível)
  chegadaSeg: number | null
}

async function buscarDados() {
  const [servicos, empresas] = await Promise.all([
    // A RLS já devolve só os serviços deste motorista
    supabase
      .from("servicos_situacao")
      .select("*")
      .neq("situacao", "realizada")
      .order("criado_em"),
    supabase.from("empresas").select("*").eq("ativo", true).order("nome"),
  ])
  const lista = empresas.data ?? []
  return {
    servicos: servicos.data ?? [],
    empresas: new Map(lista.map((e) => [e.id, e])),
    sede: lista.find((e) => e.eh_sede) ?? null,
  }
}

type Dados = Awaited<ReturnType<typeof buscarDados>>

// Grava a rota do dia para o mapa do escritório (uma linha por motorista por dia)
function gravarRota(rota: {
  ordem: number[]
  linha: [number, number][]
  distanciaM: number
  duracaoSeg: number
}) {
  supabase
    .from("rotas")
    .upsert({
      ordem: rota.ordem,
      linha: rota.linha,
      distancia_m: rota.distanciaM,
      duracao_s: rota.duracaoSeg,
      calculada_em: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.warn("[rota] não foi possível gravar", error)
    })
}

function posicaoAtual(): Promise<GeolocationPosition | null> {
  return new Promise((resolver) => {
    if (!navigator.geolocation) return resolver(null)
    navigator.geolocation.getCurrentPosition(resolver, () => resolver(null), {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60_000,
    })
  })
}

function minutos(segundos: number) {
  return `${Math.max(1, Math.round(segundos / 60))} min`
}

export function MotoristaPage() {
  const { funcionario, sair } = useAuth()
  const [iniciado, setIniciado] = useState(false)
  const [dados, setDados] = useState<Dados | null>(null)
  const [rota, setRota] = useState<(RotaOtimizada & { chave: string }) | null>(
    null
  )
  const [erroRota, setErroRota] = useState<string | null>(null)
  const [alerta, setAlerta] = useState<ColetaRecebida | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [painel, setPainel] = useState<"rota" | "coletas" | null>(null)
  const { posicao, erro: erroGps } = useGps(iniciado)
  const posicaoRef = useRef(posicao)

  useEffect(() => {
    posicaoRef.current = posicao
  }, [posicao])

  const atualizar = useCallback(() => {
    buscarDados().then(setDados)
  }, [])

  useEffect(() => {
    buscarDados().then(setDados)
  }, [])

  // Avisos do escritório em tempo real
  useEffect(() => {
    if (!iniciado || !funcionario) return
    const canal = supabase
      .channel("motorista-servicos")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "servicos",
          filter: `motorista_id=eq.${funcionario.id}`,
        },
        async ({ eventType, new: registro }) => {
          atualizar()
          const servico = registro as Tabela<"servicos">
          if (eventType !== "INSERT" || servico.tipo !== "coleta") return
          iniciarAlerta()
          const [{ data: empresa }, gps] = await Promise.all([
            supabase
              .from("empresas")
              .select("*")
              .eq("id", servico.empresa_id)
              .maybeSingle(),
            posicaoAtual(),
          ])
          setAlerta({
            servico,
            empresa,
            distanciaKm:
              gps && empresa?.latitude != null && empresa.longitude != null
                ? distanciaKm(gps.coords, {
                    latitude: empresa.latitude,
                    longitude: empresa.longitude,
                  })
                : null,
          })
        }
      )
      .subscribe()
    return () => {
      pararAlerta()
      supabase.removeChannel(canal)
    }
  }, [iniciado, funcionario, atualizar])

  const sede: Ponto | null =
    dados?.sede?.latitude != null && dados.sede.longitude != null
      ? { latitude: dados.sede.latitude, longitude: dados.sede.longitude }
      : null

  // Paradas que entram no cálculo: em rota e com localização
  const paradasNoMapa = useMemo(() => {
    if (!dados) return []
    return dados.servicos.flatMap((servico) => {
      const empresa = dados.empresas.get(servico.empresa_id!)
      if (
        servico.status !== "em_rota" ||
        empresa?.latitude == null ||
        empresa.longitude == null
      ) {
        return []
      }
      return [
        {
          id: servico.id!,
          latitude: empresa.latitude,
          longitude: empresa.longitude,
        },
      ]
    })
  }, [dados])

  const chaveRota = paradasNoMapa
    .map((p) => p.id)
    .sort((a, b) => a - b)
    .join(",")

  // Recalcula só quando muda o conjunto de paradas (aceitou, concluiu, adicionou)
  useEffect(() => {
    if (!iniciado || !sede) return
    if (!paradasNoMapa.length) {
      // Sem paradas: limpa a rota que o escritório vê
      gravarRota({ ordem: [], linha: [], distanciaM: 0, duracaoSeg: 0 })
      return
    }
    // Começa de onde o motorista está; termina sempre na sede
    const inicio = posicaoRef.current ?? sede
    otimizarRota({ inicio, fim: sede, paradas: paradasNoMapa })
      .then((resultado) => {
        setRota({ ...resultado, chave: chaveRota })
        setErroRota(null)
        gravarRota({
          ordem: resultado.ordem.map((o) => o.id),
          linha: resultado.linha,
          distanciaM: resultado.distanciaM,
          duracaoSeg: resultado.duracaoSeg,
        })
      })
      .catch((erro: Error) => setErroRota(erro.message))
    // paradasNoMapa muda junto com chaveRota
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciado, chaveRota, sede?.latitude, sede?.longitude])

  const rotaAtual = chaveRota && rota?.chave === chaveRota ? rota : null
  const calculando = !!chaveRota && iniciado && !rotaAtual && !erroRota

  const ordenadas: ParadaOrdenada[] = useMemo(() => {
    if (!dados) return []
    const emRota = dados.servicos.filter((s) => s.status === "em_rota")
    const porId = new Map(emRota.map((s) => [s.id!, s]))
    const naRota = (rotaAtual?.ordem ?? []).flatMap(({ id, chegadaSeg }) => {
      const servico = porId.get(id)
      porId.delete(id)
      return servico
        ? [
            {
              servico,
              empresa: dados.empresas.get(servico.empresa_id!),
              chegadaSeg,
            },
          ]
        : []
    })
    const foraDoMapa = [...porId.values()].map((servico) => ({
      servico,
      empresa: dados.empresas.get(servico.empresa_id!),
      chegadaSeg: null,
    }))
    return [...naRota, ...foraDoMapa]
  }, [dados, rotaAtual])

  const marcadores: ParadaNoMapa[] = useMemo(
    () =>
      ordenadas.flatMap(({ servico, empresa, chegadaSeg }, i) =>
        chegadaSeg !== null &&
        empresa?.latitude != null &&
        empresa.longitude != null
          ? [
              {
                id: servico.id!,
                numero: i + 1,
                tipo: servico.tipo!,
                latitude: empresa.latitude,
                longitude: empresa.longitude,
              },
            ]
          : []
      ),
    [ordenadas]
  )

  const aguardando = (dados?.servicos ?? []).filter(
    (s) => s.situacao === "aguardando"
  )
  const proxima = ordenadas[0]

  async function iniciar() {
    await prepararAlertas()
    // Pendentes de dias anteriores entram na rota sem perguntar
    const { data, error } = await supabase.rpc("iniciar_rota")
    if (error) toast.error(`Erro ao iniciar a rota: ${error.message}`)
    else if (data.length)
      toast.info(`${data.length} pendente(s) de ontem entraram na rota`)
    setIniciado(true)
    atualizar()
  }

  async function mudarStatus(
    servicoId: number,
    status: "em_rota" | "realizada",
    mensagem: string
  ) {
    setOcupado(true)
    const { error } = await supabase
      .from("servicos")
      .update({ status })
      .eq("id", servicoId)
    setOcupado(false)
    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`)
      return false
    }
    toast.success(mensagem)
    atualizar()
    return true
  }

  async function aceitarAlerta() {
    if (!alerta) return
    if (
      await mudarStatus(
        alerta.servico.id,
        "em_rota",
        "Coleta adicionada à rota"
      )
    ) {
      pararAlerta()
      setAlerta(null)
    }
  }

  async function adicionarEntrega(empresaId: number) {
    const { error } = await supabase.from("servicos").insert({
      tipo: "entrega",
      empresa_id: empresaId,
      motorista_id: funcionario!.id,
      status: "em_rota",
    })
    if (error) toast.error(`Não foi possível adicionar: ${error.message}`)
    else {
      toast.success("Entrega adicionada à rota")
      atualizar()
    }
  }

  if (dados && !sede) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>
            A sede ainda não tem localização. Peça ao escritório para conferir o
            cadastro da sede.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <div className="relative h-svh overflow-hidden">
      {sede && (
        <MapaRota
          sede={sede}
          paradas={marcadores}
          linha={rotaAtual?.linha ?? []}
          posicao={posicao}
        />
      )}

      {/* Topo: situação e menu */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-col gap-1">
          {calculando && (
            <Badge variant="secondary">
              <Spinner data-icon="inline-start" />
              Calculando rota…
            </Badge>
          )}
          {rotaAtual && (
            <Badge variant="secondary">
              {(rotaAtual.distanciaM / 1000).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}{" "}
              km · {minutos(rotaAtual.duracaoSeg)} até voltar à sede
            </Badge>
          )}
          {(erroGps || erroRota) && (
            <Badge variant="destructive">{erroGps ?? erroRota}</Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="icon-lg"
                className="pointer-events-auto shadow"
                aria-label="Menu"
              />
            }
          >
            <MenuIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{funcionario?.nome}</DropdownMenuLabel>
              <DropdownMenuItem onClick={sair}>
                <LogOutIcon />
                Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Base: próxima parada e botões */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
        {iniciado && proxima && (
          <Card size="sm" className="shadow-lg">
            <CardHeader>
              <CardDescription>
                Próxima parada ·{" "}
                {proxima.servico.tipo === "coleta" ? "Coleta" : "Entrega"}
                {proxima.chegadaSeg !== null &&
                  ` · ~${minutos(proxima.chegadaSeg)}`}
              </CardDescription>
              <CardTitle className="truncate">
                {proxima.empresa?.nome ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="truncate text-sm text-muted-foreground">
              {proxima.empresa?.endereco} · {proxima.empresa?.bairro}
            </CardContent>
            <CardFooter className="flex gap-2">
              {proxima.empresa?.latitude != null && (
                <Button
                  variant="outline"
                  className="flex-1"
                  render={
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${proxima.empresa.latitude},${proxima.empresa.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  nativeButton={false}
                >
                  <NavigationIcon data-icon="inline-start" />
                  Navegar
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={ocupado}
                onClick={() =>
                  mudarStatus(
                    proxima.servico.id!,
                    "realizada",
                    "Parada concluída"
                  )
                }
              >
                <CheckIcon data-icon="inline-start" />
                Concluir
              </Button>
            </CardFooter>
          </Card>
        )}
        {iniciado && !proxima && (
          <Card size="sm" className="shadow-lg">
            <CardHeader>
              <CardTitle>Nenhuma parada na rota</CardTitle>
              <CardDescription>
                Adicione entregas em "Rota" ou aguarde as coletas do escritório.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {iniciado ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="secondary"
              className="shadow"
              onClick={() => setPainel("rota")}
            >
              <ListOrderedIcon data-icon="inline-start" />
              Rota ({ordenadas.length})
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="shadow"
              onClick={() => setPainel("coletas")}
            >
              <PackageIcon data-icon="inline-start" />
              Coletas
              {aguardando.length > 0 && (
                <Badge variant="destructive">{aguardando.length}</Badge>
              )}
            </Button>
          </div>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Pronto para sair?</CardTitle>
              <CardDescription>
                Deixe o celular no carregador. A tela fica ligada, o escritório
                acompanha sua posição e você recebe as coletas com som.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={iniciar}>
                <PlayIcon data-icon="inline-start" />
                Iniciar rota
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <PainelRota
        aberto={painel === "rota"}
        onAbertoChange={(aberto) => setPainel(aberto ? "rota" : null)}
        paradas={ordenadas}
        empresas={dados ? [...dados.empresas.values()] : []}
        ocupado={ocupado}
        onConcluir={(id) => mudarStatus(id, "realizada", "Parada concluída")}
        onAdicionarEntrega={adicionarEntrega}
      />
      <PainelColetas
        aberto={painel === "coletas"}
        onAbertoChange={(aberto) => setPainel(aberto ? "coletas" : null)}
        coletas={aguardando}
        empresas={dados?.empresas ?? new Map()}
        ocupado={ocupado}
        onAdicionar={(id) =>
          mudarStatus(id, "em_rota", "Coleta adicionada à rota")
        }
      />

      {alerta && (
        <NovaColetaAlerta
          coleta={alerta}
          aceitando={ocupado}
          onAceitar={aceitarAlerta}
          onRecusar={() => {
            pararAlerta()
            setAlerta(null)
          }}
        />
      )}
    </div>
  )
}
