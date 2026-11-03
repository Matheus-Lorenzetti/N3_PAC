import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { buscarCep, geocodificar, somenteDigitos } from "@/lib/enderecos"
import { supabase, type Tabela } from "@/lib/supabase"

const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  cep: z
    .string()
    .refine(
      (valor) => [0, 8].includes(somenteDigitos(valor).length),
      "O CEP tem 8 dígitos"
    ),
  endereco: z.string().trim().min(1, "Informe rua e número"),
  bairro: z.string().trim(),
  cidade: z.string().trim().min(1, "Informe a cidade"),
  uf: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a sigla do estado, por exemplo SC"),
})

type EmpresaForm = z.infer<typeof empresaSchema>
type Empresa = Tabela<"empresas">

const vazio: EmpresaForm = {
  nome: "",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
}

function paraFormulario(empresa: Empresa): EmpresaForm {
  return {
    nome: empresa.nome,
    cep: empresa.cep ?? "",
    endereco: empresa.endereco,
    bairro: empresa.bairro ?? "",
    cidade: empresa.cidade,
    uf: empresa.uf,
  }
}

type Props = {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  // undefined = nova empresa
  empresa?: Empresa
  onSalvo: () => void
}

export function EmpresaFormDialog({
  aberto,
  onAbertoChange,
  empresa,
  onSalvo,
}: Props) {
  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {empresa ? "Editar empresa" : "Nova empresa"}
          </DialogTitle>
          <DialogDescription>
            A localização no mapa é calculada a partir do endereço ao salvar.
          </DialogDescription>
        </DialogHeader>
        {/* key: reinicia o formulário a cada empresa aberta */}
        <Formulario
          key={empresa?.id ?? "nova"}
          empresa={empresa}
          onSalvo={() => {
            onAbertoChange(false)
            onSalvo()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function Formulario({
  empresa,
  onSalvo,
}: {
  empresa?: Empresa
  onSalvo: () => void
}) {
  const [buscandoCep, setBuscandoCep] = useState(false)
  const form = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: empresa ? paraFormulario(empresa) : vazio,
  })

  async function preencherPeloCep(cep: string) {
    if (somenteDigitos(cep).length !== 8) return
    setBuscandoCep(true)
    const encontrado = await buscarCep(cep).catch(() => null)
    setBuscandoCep(false)
    if (!encontrado) {
      toast.warning("CEP não encontrado. Preencha o endereço manualmente.")
      return
    }
    // Mantém o número que já foi digitado no endereço
    const atual = form.getValues("endereco")
    const mesmaRua = atual
      .toLowerCase()
      .startsWith(encontrado.endereco.toLowerCase())
    form.setValue("endereco", mesmaRua ? atual : `${encontrado.endereco}, `)
    form.setValue("bairro", encontrado.bairro)
    form.setValue("cidade", encontrado.cidade)
    form.setValue("uf", encontrado.uf)
    form.setFocus("endereco")
  }

  async function salvar(valores: EmpresaForm) {
    const dados = {
      nome: valores.nome,
      cep: somenteDigitos(valores.cep) || null,
      endereco: valores.endereco,
      bairro: valores.bairro || null,
      cidade: valores.cidade,
      uf: valores.uf.toUpperCase(),
    }

    // Só geocodifica de novo se o endereço mudou ou se ainda não tem coordenadas
    const enderecoMudou =
      !empresa ||
      empresa.latitude === null ||
      empresa.endereco !== dados.endereco ||
      empresa.cidade !== dados.cidade ||
      empresa.uf !== dados.uf
    const coordenadas = enderecoMudou
      ? await geocodificar(dados).catch(() => null)
      : { latitude: empresa.latitude, longitude: empresa.longitude }

    const registro = {
      ...dados,
      latitude: coordenadas?.latitude ?? null,
      longitude: coordenadas?.longitude ?? null,
    }
    const { error } = empresa
      ? await supabase.from("empresas").update(registro).eq("id", empresa.id)
      : await supabase.from("empresas").insert(registro)

    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`)
      return
    }
    if (coordenadas) {
      toast.success("Empresa salva e localizada no mapa")
    } else {
      toast.warning(
        "Empresa salva, mas o endereço não foi encontrado no mapa. Confira rua e cidade."
      )
    }
    onSalvo()
  }

  return (
    <form onSubmit={form.handleSubmit(salvar)}>
      <FieldGroup>
        <Controller
          name="nome"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input {...field} id="nome" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="cep"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="cep">CEP</FieldLabel>
              <Input
                {...field}
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                aria-invalid={fieldState.invalid}
                onBlur={() => {
                  field.onBlur()
                  preencherPeloCep(field.value)
                }}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>
                  {buscandoCep
                    ? "Buscando endereço…"
                    : "Opcional. Preenche o endereço sozinho."}
                </FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          name="endereco"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="endereco">Rua e número</FieldLabel>
              <Input
                {...field}
                id="endereco"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="bairro"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="bairro">Bairro</FieldLabel>
              <Input {...field} id="bairro" />
            </Field>
          )}
        />
        <div className="grid grid-cols-[1fr_5rem] gap-4">
          <Controller
            name="cidade"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                <Input
                  {...field}
                  id="cidade"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="uf"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="uf">UF</FieldLabel>
                <Input
                  {...field}
                  id="uf"
                  maxLength={2}
                  className="uppercase"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
