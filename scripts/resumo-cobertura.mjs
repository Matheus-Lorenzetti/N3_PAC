// Resume a cobertura dos testes em duas linhas: backend (Edge Function) e
// frontend (src). Lê o que o Vitest gravou em cobertura/coverage-summary.json.
// Roda no fim do npm run test:cobertura.

import { readFileSync } from "node:fs"

const resumo = JSON.parse(
  readFileSync("cobertura/coverage-summary.json", "utf8")
)

const METAS = { backend: 75, frontend: 25 }
const MEDIDAS = {
  linhas: "lines",
  comandos: "statements",
  funcoes: "functions",
  ramos: "branches",
}

const lados = { backend: {}, frontend: {} }
for (const [arquivo, dados] of Object.entries(resumo)) {
  if (arquivo === "total") continue
  const caminho = arquivo.replaceAll("\\", "/")
  const lado = caminho.includes("/supabase/functions/") ? "backend" : "frontend"
  for (const medida of Object.values(MEDIDAS)) {
    lados[lado][medida] ??= { total: 0, coberto: 0 }
    lados[lado][medida].total += dados[medida].total
    lados[lado][medida].coberto += dados[medida].covered
  }
}

const pct = ({ total, coberto }) =>
  total ? ((100 * coberto) / total).toFixed(1) : "100.0"

console.log("\nCobertura por lado (meta do Portfólio, linha Web Apps):")
for (const [lado, medidas] of Object.entries(lados)) {
  const partes = Object.entries(MEDIDAS).map(
    ([nome, medida]) => `${nome} ${pct(medidas[medida])}%`
  )
  console.log(
    `  ${lado.padEnd(8)} meta ${METAS[lado]}%  ->  ${partes.join(" | ")}`
  )
}
