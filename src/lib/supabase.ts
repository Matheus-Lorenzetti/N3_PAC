import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local (veja .env.example)"
  )
}

// Na rede local (npm run dev:rede), quem abre http://IP-do-notebook:5173 precisa
// do banco no mesmo IP: 127.0.0.1 no computador da outra pessoa é ela mesma
function urlDoBanco(configurada: string) {
  const local = ["127.0.0.1", "localhost"]
  const endereco = new URL(configurada)
  if (
    local.includes(endereco.hostname) &&
    !local.includes(window.location.hostname)
  ) {
    endereco.hostname = window.location.hostname
  }
  return endereco.toString()
}

export const supabase = createClient<Database>(urlDoBanco(url), key)

export type Tabela<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Perfil = Database["public"]["Enums"]["perfil_funcionario"]
