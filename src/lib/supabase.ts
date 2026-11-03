import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local (veja .env.example)"
  )
}

export const supabase = createClient<Database>(url, key)

export type Tabela<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Perfil = Database["public"]["Enums"]["perfil_funcionario"]
