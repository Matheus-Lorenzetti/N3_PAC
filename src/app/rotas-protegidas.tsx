import { Navigate, Outlet } from "react-router"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"
import type { Perfil } from "@/lib/supabase"

function Carregando() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner />
    </main>
  )
}

// Só deixa entrar quem está logado e tem o perfil da área
export function ExigePerfil({ perfil }: { perfil: Perfil }) {
  const { carregando, session, funcionario } = useAuth()

  if (carregando) return <Carregando />
  if (!session) return <Navigate to="/login" replace />
  if (funcionario?.perfil !== perfil) return <Navigate to="/" replace />
  return <Outlet />
}

// Página inicial: manda cada perfil para a sua área
export function RedirecionaPorPerfil() {
  const { carregando, session, funcionario, sair } = useAuth()

  if (carregando) return <Carregando />
  if (!session) return <Navigate to="/login" replace />
  if (funcionario) return <Navigate to={`/${funcionario.perfil}`} replace />

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Alert className="max-w-sm">
        <AlertTitle>Usuário sem cadastro</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          Este login não está vinculado a um funcionário ativo. Fale com o
          escritório.
          <Button variant="outline" size="sm" onClick={sair}>
            Sair
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
