import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase, type Tabela } from "@/lib/supabase"

// Página de teste da conexão com o banco. Será substituída pelo cadastro de empresas.
export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Tabela<"empresas">[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from("empresas")
      .select("*")
      .order("eh_sede", { ascending: false })
      .order("nome")
      .then(({ data, error }) => {
        if (error) setErro(error.message)
        else setEmpresas(data)
      })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Teste de conexão: dados lidos do Supabase
        </CardDescription>
      </CardHeader>
      <CardContent>
        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
        {!erro && !empresas && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )}
        {empresas && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Coordenadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {empresa.nome}
                      {empresa.eh_sede && <Badge>Sede</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{empresa.endereco}</TableCell>
                  <TableCell>
                    {empresa.cidade}/{empresa.uf}
                  </TableCell>
                  <TableCell>
                    {empresa.latitude !== null ? (
                      <Badge variant="secondary">Sim</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
