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
import { EmConstrucaoPage } from "@/features/escritorio/em-construcao-page"
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
          {
            path: "dashboard",
            element: (
              <EmConstrucaoPage
                titulo="Dashboard"
                descricao="Coletas e entregas em rota, realizadas e pendentes, com alerta de atrasos."
              />
            ),
          },
          {
            path: "kanban",
            element: (
              <EmConstrucaoPage
                titulo="Kanban"
                descricao="Quadro com as colunas Aguardando, Pendente, Em rota e Realizada."
              />
            ),
          },
          {
            path: "mapa",
            element: (
              <EmConstrucaoPage
                titulo="Mapa dos veículos"
                descricao="Todos os veículos ao vivo, ou um de cada vez com a rota."
              />
            ),
          },
          { path: "lancar-coleta", element: <LancarColetaPage /> },
          { path: "empresas", element: <EmpresasPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
