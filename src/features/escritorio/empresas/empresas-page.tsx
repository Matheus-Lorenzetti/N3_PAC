import { MapPinIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmpresaFormDialog } from "@/features/escritorio/empresas/empresa-form-dialog"
import { buscarTodas } from "@/lib/paginacao"
import { supabase, type Tabela } from "@/lib/supabase"

type Empresa = Tabela<"empresas">

function buscarEmpresas() {
  return buscarTodas((de, ate) =>
    supabase
      .from("empresas")
      .select("*")
      .order("eh_sede", { ascending: false })
      .order("nome")
      .order("id")
      .range(de, ate)
  )
}

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Empresa | undefined>()

  const aplicar = useCallback(
    ({ data, error }: Awaited<ReturnType<typeof buscarEmpresas>>) => {
      if (error) setErro(error.message)
      else setEmpresas(data)
    },
    []
  )

  const carregar = useCallback(() => buscarEmpresas().then(aplicar), [aplicar])

  useEffect(() => {
    buscarEmpresas().then(aplicar)
  }, [aplicar])

  function abrir(empresa?: Empresa) {
    setEmEdicao(empresa)
    setDialogAberto(true)
  }

  const semLocalizacao = empresas?.filter((e) => e.latitude === null).length

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>
            Clientes atendidos e a sede. Só empresas localizadas entram nas
            rotas.
          </CardDescription>
          <CardAction>
            <Button onClick={() => abrir()}>
              <PlusIcon data-icon="inline-start" />
              Nova empresa
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          {!!semLocalizacao && (
            <Alert>
              <MapPinIcon />
              <AlertDescription>
                {semLocalizacao === 1
                  ? "1 empresa ainda não foi localizada no mapa."
                  : `${semLocalizacao} empresas ainda não foram localizadas no mapa.`}{" "}
                Abra e salve de novo para localizar.
              </AlertDescription>
            </Alert>
          )}
          {!erro && !empresas && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          )}
          {empresas?.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhuma empresa cadastrada</EmptyTitle>
                <EmptyDescription>
                  Cadastre a primeira em "Nova empresa".
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!!empresas?.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Mapa</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {empresa.nome}
                        {empresa.eh_sede && <Badge>Sede</Badge>}
                        {!empresa.ativo && (
                          <Badge variant="outline">Inativa</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {empresa.endereco}
                      {empresa.bairro && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {empresa.bairro}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {empresa.cidade}/{empresa.uf}
                    </TableCell>
                    <TableCell>
                      {empresa.latitude !== null ? (
                        <Badge variant="secondary">Localizada</Badge>
                      ) : (
                        <Badge variant="destructive">Sem localização</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${empresa.nome}`}
                        onClick={() => abrir(empresa)}
                      >
                        <PencilIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <EmpresaFormDialog
        aberto={dialogAberto}
        onAbertoChange={setDialogAberto}
        empresa={emEdicao}
        onSalvo={carregar}
      />
    </>
  )
}
