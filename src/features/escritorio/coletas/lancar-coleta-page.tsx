import { zodResolver } from "@hookform/resolvers/zod"
import { SendIcon, SparklesIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  sugerirMotorista,
  type Posicao,
  type Sugestao,
} from "@/features/escritorio/coletas/sugestao"
import { EtiquetaRegiao } from "@/features/escritorio/regioes/etiqueta-regiao"
import { Textarea } from "@/components/ui/textarea"
import {
  formatarHora,
  hojeEmBrasilia,
  ROTULO_SITUACAO,
  VARIANTE_SITUACAO,
  type ServicoSituacao,
  type Situacao,
} from "@/lib/servicos"
import { filtrarEmpresa, LIMITE_RESULTADOS } from "@/lib/busca"
import { buscarTodas } from "@/lib/paginacao"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas"> & {
  regiao: { id: number; nome: string; cor: string } | null
}
type Motorista = { id: string; nome: string; placa: string | null }

const coletaSchema = z.object({
  empresaId: z.number({ error: "Escolha a empresa" }),
  motoristaId: z.string({ error: "Escolha o motorista" }).min(1),
  observacao: z.string().trim().max(500),
})

type ColetaForm = z.infer<typeof coletaSchema>

async function buscarCadastros() {
  const [empresas, motoristas] = await Promise.all([
    buscarTodas((de, ate) =>
      supabase
        .from("empresas")
        .select("*, regiao:regioes(id, nome, cor)")
        .eq("ativo", true)
        .eq("eh_sede", false)
        .order("nome")
        .order("id")
        .range(de, ate)
    ),
    supabase
      .from("funcionarios")
      .select("id, nome, veiculos(placa)")
      .eq("perfil", "motorista")
      .eq("ativo", true)
      .order("nome"),
  ])
  return {
    empresas: empresas.data ?? [],
    motoristas: (motoristas.data ?? []).map((m) => ({
      id: m.id,
      nome: m.nome,
      placa: m.veiculos?.placa ?? null,
    })),
  }
}

// Serviços abertos de todos os motoristas e a última posição de cada um:
// base da sugestão de motorista
async function buscarContexto() {
  const [abertos, posicoes] = await Promise.all([
    supabase
      .from("servicos_situacao")
      .select("motorista_id, empresa_id")
      .neq("status", "realizada"),
    supabase
      .from("ultimas_localizacoes")
      .select("motorista_id, latitude, longitude, registrado_em"),
  ])
  return {
    abertos: abertos.data ?? [],
    posicoes: new Map<string, Posicao>(
      (posicoes.data ?? []).map((p) => [
        p.motorista_id!,
        {
          latitude: p.latitude!,
          longitude: p.longitude!,
          registradoEm: p.registrado_em!,
        },
      ])
    ),
  }
}

// Coletas de hoje e as que sobraram de dias anteriores
function buscarColetas() {
  return supabase
    .from("servicos_situacao")
    .select("*")
    .eq("tipo", "coleta")
    .or(`data_servico.eq.${hojeEmBrasilia()},situacao.eq.pendente`)
    .order("criado_em", { ascending: false })
}

export function LancarColetaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [coletas, setColetas] = useState<ServicoSituacao[] | null>(null)
  const [contexto, setContexto] = useState<Awaited<
    ReturnType<typeof buscarContexto>
  > | null>(null)

  const form = useForm<ColetaForm>({
    resolver: zodResolver(coletaSchema),
    defaultValues: { observacao: "" },
  })

  const atualizarColetas = useCallback(() => {
    buscarColetas().then(({ data }) => setColetas(data ?? []))
    buscarContexto().then(setContexto)
  }, [])

  useEffect(() => {
    buscarCadastros().then((cadastros) => {
      setEmpresas(cadastros.empresas)
      setMotoristas(cadastros.motoristas)
      // Com um motorista só, já vem escolhido
      if (cadastros.motoristas.length === 1) {
        form.setValue("motoristaId", cadastros.motoristas[0].id)
      }
    })
    buscarColetas().then(({ data }) => setColetas(data ?? []))
    buscarContexto().then(setContexto)

    // A lista acompanha ao vivo quando o motorista aceita ou conclui
    const canal = supabase
      .channel("escritorio-coletas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servicos" },
        () => atualizarColetas()
      )
      // Posição nova pode mudar quem está mais perto
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "localizacoes" },
        () => buscarContexto().then(setContexto)
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [form, atualizarColetas])

  const nomeEmpresa = useMemo(
    () => new Map(empresas.map((e) => [e.id, e.nome])),
    [empresas]
  )
  const nomeMotorista = useMemo(
    () => new Map(motoristas.map((m) => [m.id, m.nome])),
    [motoristas]
  )

  // Sugestão de motorista para a empresa escolhida (região do k-means, distância, carga)
  const calcularSugestao = useCallback(
    (empresaId: number | undefined): Sugestao | null => {
      const empresa = empresas.find((e) => e.id === empresaId)
      if (!empresa || !contexto) return null
      const regiaoDaEmpresa = new Map(empresas.map((e) => [e.id, e.regiao_id]))
      return sugerirMotorista({
        empresa: {
          latitude: empresa.latitude ?? 0,
          longitude: empresa.longitude ?? 0,
          regiaoId: empresa.regiao_id,
        },
        regiaoNome: empresa.regiao?.nome ?? null,
        motoristas,
        abertos: contexto.abertos.map((s) => ({
          motoristaId: s.motorista_id!,
          regiaoId: regiaoDaEmpresa.get(s.empresa_id!) ?? null,
        })),
        posicoes: empresa.latitude === null ? new Map() : contexto.posicoes,
      })
    },
    [empresas, contexto, motoristas]
  )
  const empresaEscolhida = useWatch({
    control: form.control,
    name: "empresaId",
  })
  const sugestao = calcularSugestao(empresaEscolhida)

  async function lancar(valores: ColetaForm) {
    const { error } = await supabase.from("servicos").insert({
      tipo: "coleta",
      empresa_id: valores.empresaId,
      motorista_id: valores.motoristaId,
      observacao: valores.observacao || null,
    })
    if (error) {
      toast.error(`Não foi possível lançar: ${error.message}`)
      return
    }
    toast.success("Coleta lançada. O motorista foi avisado.")
    form.reset({
      empresaId: undefined,
      motoristaId: valores.motoristaId,
      observacao: "",
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Lançar coleta</CardTitle>
          <CardDescription>
            A coleta aparece na hora no celular do motorista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(lancar)}>
            <FieldGroup>
              <Controller
                name="empresaId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="empresa">Empresa</FieldLabel>
                    <Combobox
                      items={empresas}
                      value={empresas.find((e) => e.id === field.value) ?? null}
                      onValueChange={(empresa: Empresa | null) => {
                        field.onChange(empresa?.id)
                        // Já escolhe o motorista sugerido; o escritório pode trocar
                        const sugerido = calcularSugestao(empresa?.id)
                        if (sugerido) {
                          form.setValue("motoristaId", sugerido.motoristaId, {
                            shouldValidate: true,
                          })
                        }
                      }}
                      itemToStringLabel={(empresa: Empresa) => empresa.nome}
                      filter={filtrarEmpresa}
                      limit={LIMITE_RESULTADOS}
                    >
                      <ComboboxInput
                        id="empresa"
                        placeholder="Buscar empresa…"
                        aria-invalid={fieldState.invalid}
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>
                          Nenhuma empresa encontrada.
                        </ComboboxEmpty>
                        <ComboboxList>
                          {(empresa: Empresa) => (
                            <ComboboxItem key={empresa.id} value={empresa}>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate">{empresa.nome}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {empresa.endereco} · {empresa.cidade}
                                </span>
                                <EtiquetaRegiao regiao={empresa.regiao} />
                              </div>
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      empresas.find((e) => e.id === field.value)?.latitude ===
                        null && (
                        <FieldDescription>
                          Esta empresa ainda não tem localização: não vai
                          aparecer no mapa da rota.
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
              <Controller
                name="motoristaId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="motorista">Motorista</FieldLabel>
                    <Select
                      items={motoristas.map((m) => ({
                        value: m.id,
                        label: m.placa ? `${m.nome} · ${m.placa}` : m.nome,
                      }))}
                      value={field.value ?? null}
                      onValueChange={(valor) => field.onChange(valor ?? "")}
                    >
                      <SelectTrigger
                        id="motorista"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Escolha o motorista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {motoristas.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.placa ? `${m.nome} · ${m.placa}` : m.nome}
                              {sugestao?.motoristaId === m.id && (
                                <Badge variant="secondary">Sugerido</Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      sugestao && (
                        <FieldDescription className="flex items-start gap-1">
                          <SparklesIcon className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            Sugerido:{" "}
                            {motoristas.find(
                              (m) => m.id === sugestao.motoristaId
                            )?.placa ?? ""}{" "}
                            — {sugestao.motivo}
                            {field.value !== sugestao.motoristaId && (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className="underline underline-offset-2"
                                  onClick={() =>
                                    field.onChange(sugestao.motoristaId)
                                  }
                                >
                                  Usar sugestão
                                </button>
                              </>
                            )}
                          </span>
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
              <Controller
                name="observacao"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="observacao">Observação</FieldLabel>
                    <Textarea
                      {...field}
                      id="observacao"
                      placeholder="Opcional. Ex.: retirar na doca 2"
                    />
                  </Field>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                Lançar coleta
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coletas de hoje</CardTitle>
          <CardDescription>
            Atualiza sozinha quando o motorista aceita ou conclui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coletas?.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhuma coleta hoje</EmptyTitle>
                <EmptyDescription>
                  As coletas lançadas aparecem aqui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!!coletas?.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coletas.map((coleta) => {
                  const situacao = coleta.situacao as Situacao
                  return (
                    <TableRow key={coleta.id}>
                      <TableCell>{formatarHora(coleta.criado_em!)}</TableCell>
                      <TableCell className="font-medium">
                        {nomeEmpresa.get(coleta.empresa_id!) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {nomeMotorista.get(coleta.motorista_id!) ?? "—"}
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
    </div>
  )
}
