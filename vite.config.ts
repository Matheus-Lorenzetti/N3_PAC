import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  // Testes (Vitest): npm test roda tudo; npm run test:cobertura mede a cobertura
  test: {
    environment: "jsdom",
    setupFiles: ["./src/teste/preparar.ts"],
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts"],
    // Endereço de mentira: nenhum teste fala com o banco de verdade
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "chave-de-teste",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "cobertura",
      include: ["src/**/*.{ts,tsx}", "supabase/functions/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/teste/**",
        // Tipos gerados pelo Supabase: não têm código para executar
        "src/lib/database.types.ts",
      ],
      // Metas da linha Web Apps do Portfólio: 75% no backend e 25% no frontend.
      // Abaixo disso o comando falha
      thresholds: {
        "supabase/functions/**": {
          statements: 75,
          branches: 75,
          functions: 75,
          lines: 75,
        },
        "src/**": { statements: 25, lines: 25 },
      },
    },
  },
})
