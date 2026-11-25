// Edge Function: calcula a rota no OpenRouteService (a lógica está em rota.ts).
// A chave do ORS fica só no servidor (segredo ORS_API_KEY), nunca no navegador.
// Reserva: se a cota do dia da chave acabar, tenta a ORS_API_KEY_2 (opcional).
// Só usuários logados chamam: a função confere a sessão no Supabase Auth
// (a chave pública sozinha não basta).

import { tratarPedido } from "./rota.ts"

Deno.serve((pedido) =>
  tratarPedido(pedido, {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    chavePublica: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    chavesOrs: [
      Deno.env.get("ORS_API_KEY"),
      Deno.env.get("ORS_API_KEY_2"),
    ].filter((c): c is string => !!c),
    buscar: fetch,
  })
)
