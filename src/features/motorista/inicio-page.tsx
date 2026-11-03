import { PlayIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAuth } from "@/features/auth/auth-provider"
import {
  iniciarAlerta,
  pararAlerta,
  prepararAlertas,
} from "@/features/motorista/alerta"
import {
  NovaColetaAlerta,
  type ColetaRecebida,
} from "@/features/motorista/nova-coleta-alerta"
import {
  distanciaKm,
  ROTULO_SITUACAO,
  VARIANTE_SITUACAO,
  type ServicoSituacao,
  type Situacao,
} from "@/lib/servicos"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">

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

// Serviços abertos do motorista (a RLS já filtra só os dele)
async function buscarAbertos() {
  const { data: servicos } = await supabase
    .from("servicos_situacao")
    .select("*")
    .neq("situacao", "realizada")
    .order("criado_em")
  const ids = [...new Set((servicos ?? []).map((s) => s.empresa_id!))]
  const { data: empresas } = ids.length
    ? await supabase.from("empresas").select("*").in("id", ids)
    : { data: [] as Empresa[] }
  return {
    servicos: servicos ?? [],
    empresas: new Map((empresas ?? []).map((e) => [e.id, e])),
  }
}

// Provisória: no passo 2 vira o mapa em tela cheia com a rota
export function InicioMotoristaPage() {
  const { funcionario } = useAuth()
  const [iniciado, setIniciado] = useState(false)
  const [abertos, setAbertos] = useState<ServicoSituacao[]>([])
  const [empresas, setEmpresas] = useState(new Map<number, Empresa>())
  const [alerta, setAlerta] = useState<ColetaRecebida | null>(null)
  const [aceitando, setAceitando] = useState(false)

  const atualizar = useCallback(() => {
    buscarAbertos().then((r) => {
      setAbertos(r.servicos)
      setEmpresas(r.empresas)
    })
  }, [])

  useEffect(() => {
    if (!iniciado || !funcionario) return
    buscarAbertos().then((r) => {
      setAbertos(r.servicos)
      setEmpresas(r.empresas)
    })

    const canal = supabase
      .channel("motorista-coletas")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "servicos",
          filter: `motorista_id=eq.${funcionario.id}`,
        },
        async ({ new: servico }) => {
          const novo = servico as Tabela<"servicos">
          if (novo.tipo !== "coleta") return
          iniciarAlerta()
          const [{ data: empresa }, posicao] = await Promise.all([
            supabase
              .from("empresas")
              .select("*")
              .eq("id", novo.empresa_id)
              .maybeSingle(),
            posicaoAtual(),
          ])
          const distancia =
            posicao && empresa?.latitude != null && empresa.longitude != null
              ? distanciaKm(posicao.coords, {
                  latitude: empresa.latitude,
                  longitude: empresa.longitude,
                })
              : null
          setAlerta({ servico: novo, empresa, distanciaKm: distancia })
          atualizar()
        }
      )
      .subscribe()

    return () => {
      pararAlerta()
      supabase.removeChannel(canal)
    }
  }, [iniciado, funcionario, atualizar])

  async function iniciar() {
    await prepararAlertas()
    // Pendentes de dias anteriores entram na rota sem perguntar
    const { data, error } = await supabase.rpc("iniciar_rota")
    if (error) toast.error(`Erro ao iniciar a rota: ${error.message}`)
    else if (data.length)
      toast.info(`${data.length} pendente(s) de ontem entraram na rota`)
    setIniciado(true)
  }

  async function adicionarARota(servicoId: number) {
    setAceitando(true)
    const { error } = await supabase
      .from("servicos")
      .update({ status: "em_rota" })
      .eq("id", servicoId)
    setAceitando(false)
    if (error) {
      toast.error(`Não foi possível adicionar: ${error.message}`)
      return
    }
    pararAlerta()
    setAlerta(null)
    toast.success("Coleta adicionada à rota")
    atualizar()
  }

  function recusar() {
    pararAlerta()
    setAlerta(null)
  }

  if (!iniciado) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Pronto para sair?</EmptyTitle>
          <EmptyDescription>
            Deixe o celular no carregador. A tela fica ligada e você recebe as
            coletas com som.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg" onClick={iniciar}>
            <PlayIcon data-icon="inline-start" />
            Iniciar rota
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Serviços do dia</CardTitle>
          <CardDescription>
            O mapa com a rota otimizada entra no próximo passo.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{abertos.length} abertos</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {abertos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum serviço aberto. As coletas lançadas pelo escritório
              aparecem aqui.
            </p>
          )}
          {abertos.map((servico) => {
            const situacao = servico.situacao as Situacao
            const empresa = empresas.get(servico.empresa_id!)
            return (
              <div
                key={servico.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {empresa?.nome ?? "—"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {servico.tipo === "coleta" ? "Coleta" : "Entrega"} ·{" "}
                    {empresa?.endereco}
                  </span>
                </div>
                {situacao === "aguardando" ? (
                  <Button size="sm" onClick={() => adicionarARota(servico.id!)}>
                    Adicionar
                  </Button>
                ) : (
                  <Badge variant={VARIANTE_SITUACAO[situacao]}>
                    {ROTULO_SITUACAO[situacao]}
                  </Badge>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
      {alerta && (
        <NovaColetaAlerta
          coleta={alerta}
          aceitando={aceitando}
          onAceitar={() => adicionarARota(alerta.servico.id)}
          onRecusar={recusar}
        />
      )}
    </>
  )
}
