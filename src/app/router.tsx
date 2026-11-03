import {
  BuildingIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  MapIcon,
  PackagePlusIcon,
} from "lucide-react"
import { createBrowserRouter, Navigate } from "react-router"

import { LayoutArea, type ItemMenu } from "@/app/layout-area"
import { ExigePerfil, RedirecionaPorPerfil } from "@/app/rotas-protegidas"
import { LoginPage } from "@/features/auth/login-page"
import { LancarColetaPage } from "@/features/escritorio/coletas/lancar-coleta-page"
import { DashboardPage } from "@/features/escritorio/dashboard/dashboard-page"
import { MapaVeiculosPage } from "@/features/escritorio/mapa/mapa-veiculos-page"
import { KanbanPage } from "@/features/escritorio/kanban/kanban-page"
import { EmpresasPage } from "@/features/escritorio/empresas/empresas-page"
import { MotoristaPage } from "@/features/motorista/motorista-page"

const menuEscritorio: ItemMenu[] = [
  { para: "dashboard", rotulo: "Dashboard", icone: LayoutDashboardIcon },
  { para: "kanban", rotulo: "Kanban", icone: KanbanIcon },
  { para: "mapa", rotulo: "Mapa", icone: MapIcon },
  { para: "lancar-coleta", rotulo: "Lançar coleta", icone: PackagePlusIcon },
  { para: "empresas", rotulo: "Empresas", icone: BuildingIcon },
]

export const router = createBrowserRouter([
  { path: "/", element: <RedirecionaPorPerfil /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/motorista",
    element: <ExigePerfil perfil="motorista" />,
    children: [{ index: true, element: <MotoristaPage /> }],
  },
  {
    path: "/escritorio",
    element: <ExigePerfil perfil="escritorio" />,
    children: [
      {
        element: <LayoutArea titulo="Escritório" menu={menuEscritorio} />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "kanban", element: <KanbanPage /> },
          { path: "mapa", element: <MapaVeiculosPage /> },
          { path: "lancar-coleta", element: <LancarColetaPage /> },
          { path: "empresas", element: <EmpresasPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
