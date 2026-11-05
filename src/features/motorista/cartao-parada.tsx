import { CheckIcon, NavigationIcon, PhoneIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  linkTelefone,
  linkWaze,
  minutos,
  type ParadaOrdenada,
} from "@/features/motorista/rota-motorista"
// Cartão da parada na base da tela: a próxima, ou a que o motorista tocou no
// mapa, com o que está no banco
export function CartaoParada({
  parada,
  numero,
  ehProxima,
  ocupado,
  onConcluir,
  onFechar,
}: {
  parada: ParadaOrdenada
  numero: number
  ehProxima: boolean
  ocupado: boolean
  onConcluir: () => void
  // Só aparece quando a parada foi escolhida no mapa
  onFechar?: () => void
}) {
  const { servico, empresa, chegadaSeg } = parada

  return (
    <Card size="sm" className="shadow-lg">
      <CardHeader>
        <CardDescription>
          {ehProxima ? "Próxima parada" : `Parada ${numero}`} ·{" "}
          {servico.tipo === "coleta" ? "Coleta" : "Entrega"}
          {chegadaSeg !== null && ` · ~${minutos(chegadaSeg)}`}
        </CardDescription>
        <CardTitle className="truncate">{empresa?.nome ?? "—"}</CardTitle>
        {onFechar && (
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar"
              onClick={onFechar}
            >
              <XIcon />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p className="truncate">
          {empresa?.endereco}
          {empresa?.bairro && ` · ${empresa.bairro}`}
        </p>
        <p className="truncate">
          {empresa?.cidade}
          {empresa?.telefone && ` · ${empresa.telefone}`}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {empresa && (
          <div className="flex w-full gap-2">
            {empresa.telefone && (
              <Button
                variant="outline"
                className="flex-1"
                render={<a href={linkTelefone(empresa.telefone)} />}
                nativeButton={false}
              >
                <PhoneIcon data-icon="inline-start" />
                Ligar
              </Button>
            )}
            {empresa.latitude != null && (
              <Button
                variant="outline"
                className="flex-1"
                render={
                  <a
                    href={linkWaze(empresa)}
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
          </div>
        )}
        <Button className="w-full" disabled={ocupado} onClick={onConcluir}>
          <CheckIcon data-icon="inline-start" />
          Concluir
        </Button>
      </CardFooter>
    </Card>
  )
}
