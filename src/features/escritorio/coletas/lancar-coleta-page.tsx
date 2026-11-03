import { zodResolver } from "@hookform/resolvers/zod"
import { SendIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import {
  formatarHora,
  hojeEmBrasilia,
  ROTULO_SITUACAO,
  VARIANTE_SITUACAO,
  type ServicoSituacao,
  type Situacao,
} from "@/lib/servicos"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">
type Motorista = { id: string; nome: string; placa: string | null }

const coletaSchema = z.object({
  empresaId: z.number({ error: "Escolha a empresa" }),
  motoristaId: z.string({ error: "Escolha o motorista" }).min(1),
  observacao: z.string().trim().max(500),
})

type ColetaForm = z.infer<typeof coletaSchema>

async function buscarCadastros() {
  const [empresas, motoristas] = await Promise.all([
    supabase
      .from("empresas")
      .select("*")
      .eq("ativo", true)
      .eq("eh_sede", false)
      .order("nome"),
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

  const form = useForm<ColetaForm>({
    resolver: zodResolver(coletaSchema),
    defaultValues: { observacao: "" },
  })

  const atualizarColetas = useCallback(() => {
    buscarColetas().then(({ data }) => setColetas(data ?? []))
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

    // A lista acompanha ao vivo quando o motorista aceita ou conclui
    const canal = supabase
      .channel("escritorio-coletas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servicos" },
        () => atualizarColetas()
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
                      onValueChange={(empresa: Empresa | null) =>
                        field.onChange(empresa?.id)
                      }
                      itemToStringLabel={(empresa: Empresa) => empresa.nome}
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
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
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
