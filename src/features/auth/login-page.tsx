import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Navigate } from "react-router"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"
import {
  credenciaisMotorista,
  ehEmail,
  normalizarPlaca,
  placaValida,
} from "@/lib/login"
import { supabase } from "@/lib/supabase"

const loginSchema = z
  .object({
    identificador: z.string().trim().min(1, "Informe o e-mail ou a placa"),
    segredo: z.string().trim().min(1, "Campo obrigatório"),
  })
  .superRefine(({ identificador }, ctx) => {
    if (ehEmail(identificador)) {
      if (!z.email().safeParse(identificador).success) {
        ctx.addIssue({
          code: "custom",
          path: ["identificador"],
          message: "E-mail inválido",
        })
      }
    } else if (!placaValida(identificador)) {
      ctx.addIssue({
        code: "custom",
        path: ["identificador"],
        message: "Placa inválida. Ex.: ABC1D23",
      })
    }
  })

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { session } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  // Segura o redirecionamento até o motorista assumir o veículo
  const [assumindoVeiculo, setAssumindoVeiculo] = useState(false)
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identificador: "", segredo: "" },
  })
  const identificador = useWatch({
    control: form.control,
    name: "identificador",
  })
  const motorista = identificador.trim() !== "" && !ehEmail(identificador)

  if (session && !assumindoVeiculo) {
    return <Navigate to="/" replace />
  }

  async function entrar({ identificador, segredo }: LoginForm) {
    setErro(null)

    if (ehEmail(identificador)) {
      const { error } = await supabase.auth.signInWithPassword({
        email: identificador,
        password: segredo,
      })
      if (error) setErro("E-mail ou senha incorretos")
      return
    }

    setAssumindoVeiculo(true)
    const { error } = await supabase.auth.signInWithPassword(
      credenciaisMotorista(segredo)
    )
    if (error) {
      setAssumindoVeiculo(false)
      setErro("Nome não encontrado. Digite o nome completo, como no cadastro.")
      return
    }
    // Registra que este motorista está com o veículo da placa
    const { error: erroVeiculo } = await supabase.rpc("assumir_veiculo", {
      p_placa: normalizarPlaca(identificador),
    })
    if (erroVeiculo) {
      await supabase.auth.signOut()
      setErro(
        erroVeiculo.message.includes("Placa")
          ? "Placa não cadastrada. Confira com o escritório."
          : `Não foi possível entrar: ${erroVeiculo.message}`
      )
    }
    setAssumindoVeiculo(false)
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Transmas</CardTitle>
          <CardDescription>
            Motorista: placa e nome. Escritório: e-mail e senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(entrar)}>
            <FieldGroup>
              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <Controller
                name="identificador"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="identificador">
                      E-mail ou placa
                    </FieldLabel>
                    <Input
                      {...field}
                      id="identificador"
                      autoComplete="username"
                      autoCapitalize="characters"
                      placeholder="ABC1D23 ou nome@transmas.com.br"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="segredo"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="segredo">
                      {motorista ? "Seu nome" : "Senha"}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="segredo"
                      type={motorista ? "text" : "password"}
                      autoComplete={motorista ? "name" : "current-password"}
                      autoCapitalize={motorista ? "words" : "none"}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      motorista && (
                        <FieldDescription>
                          Nome completo, como está no cadastro.
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Spinner data-icon="inline-start" />
                )}
                Entrar
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
