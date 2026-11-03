import { MapPinIcon, PackagePlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { Tabela } from "@/lib/supabase"

export type ColetaRecebida = {
  servico: Tabela<"servicos">
  empresa: Tabela<"empresas"> | null
  distanciaKm: number | null
}

// Cartão grande sobre a tela, no estilo de chamada de corrida
export function NovaColetaAlerta({
  coleta,
  aceitando,
  onAceitar,
  onRecusar,
}: {
  coleta: ColetaRecebida
  aceitando: boolean
  onAceitar: () => void
  onRecusar: () => void
}) {
  const { servico, empresa, distanciaKm } = coleta

  return (
    <div
      role="alertdialog"
      aria-labelledby="nova-coleta-titulo"
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <PackagePlusIcon />
            Nova coleta
          </CardDescription>
          <CardTitle id="nova-coleta-titulo" className="text-2xl">
            {empresa?.nome ?? "Empresa"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {empresa && (
            <p className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 shrink-0" />
              <span>
                {empresa.endereco}
                {empresa.bairro && ` · ${empresa.bairro}`}
                <br />
                <span className="text-muted-foreground">
                  {empresa.cidade}/{empresa.uf}
                </span>
              </span>
            </p>
          )}
          {distanciaKm !== null && (
            <p className="text-3xl font-semibold">
              {distanciaKm.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}{" "}
              km
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                em linha reta de você
              </span>
            </p>
          )}
          {servico.observacao && (
            <p className="text-sm text-muted-foreground">
              {servico.observacao}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={onRecusar}
            disabled={aceitando}
          >
            Agora não
          </Button>
          <Button
            size="lg"
            className="flex-[2]"
            onClick={onAceitar}
            disabled={aceitando}
          >
            {aceitando && <Spinner data-icon="inline-start" />}
            Adicionar à rota
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
