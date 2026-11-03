import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase, type Tabela } from "@/lib/supabase"

type Funcionario = Tabela<"funcionarios">

type AuthState = {
  carregando: boolean
  session: Session | null
  // null quando o usuário está logado mas não tem cadastro ativo em funcionarios
  funcionario: Funcionario | null
  sair: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [funcionario, setFuncionario] = React.useState<Funcionario | null>(
    null
  )
  const [carregando, setCarregando] = React.useState(true)

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
      if (!novaSessao) {
        setFuncionario(null)
        setCarregando(false)
        return
      }
      // Fora do callback: chamar o Supabase aqui dentro pode travar o client
      setTimeout(async () => {
        const { data: registro } = await supabase
          .from("funcionarios")
          .select("*")
          .eq("id", novaSessao.user.id)
          .eq("ativo", true)
          .maybeSingle()
        setFuncionario(registro)
        setCarregando(false)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sair = React.useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = React.useMemo(
    () => ({ carregando, session, funcionario, sair }),
    [carregando, session, funcionario, sair]
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = React.use(AuthContext)
  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider")
  }
  return context
}
