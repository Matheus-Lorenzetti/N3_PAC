import { LogOutIcon, type LucideIcon } from "lucide-react"
import { NavLink, Outlet } from "react-router"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-provider"

export type ItemMenu = { para: string; rotulo: string; icone: LucideIcon }

// Cabeçalho comum das áreas do motorista e do escritório
export function LayoutArea({
  titulo,
  menu = [],
}: {
  titulo: string
  menu?: ItemMenu[]
}) {
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
        {menu.length > 0 && (
          <nav className="flex flex-wrap gap-1">
            {menu.map(({ para, rotulo, icone: Icone }) => (
              <NavLink key={para} to={para}>
                {({ isActive }) => (
                  <Button variant={isActive ? "secondary" : "ghost"} size="sm">
                    <Icone data-icon="inline-start" />
                    {rotulo}
                  </Button>
                )}
              </NavLink>
            ))}
          </nav>
        )}
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
