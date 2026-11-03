import { LogOutIcon } from "lucide-react"
import { Outlet } from "react-router"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-provider"

// Cabeçalho comum das áreas do motorista e do escritório
export function LayoutArea({ titulo }: { titulo: string }) {
  const { funcionario, sair } = useAuth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading font-medium">{titulo}</span>
          <span className="truncate text-xs text-muted-foreground">
            {funcionario?.nome}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={sair}>
          <LogOutIcon data-icon="inline-start" />
          Sair
        </Button>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
