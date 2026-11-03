import { createBrowserRouter, Navigate } from "react-router"

import { LayoutArea } from "@/app/layout-area"
import { ExigePerfil, RedirecionaPorPerfil } from "@/app/rotas-protegidas"
import { LoginPage } from "@/features/auth/login-page"
import { EmpresasPage } from "@/features/escritorio/empresas/empresas-page"
import { InicioMotoristaPage } from "@/features/motorista/inicio-page"

export const router = createBrowserRouter([
  { path: "/", element: <RedirecionaPorPerfil /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/motorista",
    element: <ExigePerfil perfil="motorista" />,
    children: [
      {
        element: <LayoutArea titulo="Motorista" />,
        children: [{ index: true, element: <InicioMotoristaPage /> }],
      },
    ],
  },
  {
    path: "/escritorio",
    element: <ExigePerfil perfil="escritorio" />,
    children: [
      {
        element: <LayoutArea titulo="Escritório" />,
        children: [
          { index: true, element: <Navigate to="empresas" replace /> },
          { path: "empresas", element: <EmpresasPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
