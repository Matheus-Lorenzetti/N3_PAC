import { useState } from "react"

import type { ResultadoKmeans } from "@/lib/kmeans"

const LARGURA = 320
const ALTURA = 150
const MARGEM = { top: 12, right: 12, bottom: 28, left: 44 }

function formatar(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
}

// Inércia (km²) por número de regiões. A "dobra" da curva indica o ponto em
// que mais regiões param de melhorar muito o agrupamento.
export function GraficoCotovelo({
  resultados,
  selecionado,
  sugerido,
  onSelecionar,
}: {
  resultados: ResultadoKmeans[]
  selecionado: number
  sugerido: number
  onSelecionar: (k: number) => void
}) {
  const [emFoco, setEmFoco] = useState<ResultadoKmeans | null>(null)
  if (resultados.length < 2) return null

  const ks = resultados.map((r) => r.k)
  const maximo = Math.max(...resultados.map((r) => r.inercia))
  const largura = LARGURA - MARGEM.left - MARGEM.right
  const altura = ALTURA - MARGEM.top - MARGEM.bottom
  const x = (k: number) =>
    MARGEM.left + ((k - ks[0]) / (ks[ks.length - 1] - ks[0])) * largura
  const y = (v: number) => MARGEM.top + altura - (v / maximo) * altura
  const linhas = [0, 0.5, 1].map((f) => maximo * f)
  const caminho = resultados
    .map((r, i) => `${i ? "L" : "M"}${x(r.k)},${y(r.inercia)}`)
    .join(" ")

  return (
    <figure className="relative flex flex-col gap-1">
      <figcaption className="text-xs text-muted-foreground">
        Inércia (km²) × número de regiões
      </figcaption>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="w-full"
        role="img"
        aria-label="Gráfico do cotovelo: inércia por número de regiões"
        onMouseLeave={() => setEmFoco(null)}
      >
        {linhas.map((valor) => (
          <g key={valor}>
            <line
              x1={MARGEM.left}
              x2={LARGURA - MARGEM.right}
              y1={y(valor)}
              y2={y(valor)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGEM.left - 6}
              y={y(valor)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {formatar(valor / 1000)} mil
            </text>
          </g>
        ))}
        <path
          d={caminho}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {resultados.map((r) => (
          <g key={r.k}>
            <text
              x={x(r.k)}
              y={ALTURA - 10}
              textAnchor="middle"
              className={
                r.k === selecionado
                  ? "fill-foreground text-[10px] font-semibold"
                  : "fill-muted-foreground text-[10px]"
              }
            >
              {r.k}
            </text>
            <circle
              cx={x(r.k)}
              cy={y(r.inercia)}
              r={r.k === selecionado ? 6 : 4}
              className={
                r.k === selecionado
                  ? "fill-primary stroke-background"
                  : "fill-background stroke-primary"
              }
              strokeWidth={2}
            />
            {/* Área de clique maior que o ponto */}
            <rect
              x={x(r.k) - largura / (ks.length - 1) / 2}
              y={MARGEM.top}
              width={largura / (ks.length - 1)}
              height={altura}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setEmFoco(r)}
              onClick={() => onSelecionar(r.k)}
            />
          </g>
        ))}
      </svg>
      {emFoco && (
        <div
          className="pointer-events-none absolute top-6 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow"
          style={{
            left: `${(x(emFoco.k) / LARGURA) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium">
            {emFoco.k} regiões{emFoco.k === sugerido && " · sugerido"}
          </div>
          <div className="text-muted-foreground">
            Inércia {formatar(emFoco.inercia)} km²
          </div>
          <div className="text-muted-foreground">
            Silhueta {emFoco.silhueta.toFixed(2)}
          </div>
        </div>
      )}
    </figure>
  )
}
