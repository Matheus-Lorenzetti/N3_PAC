// Bolinha na cor da região + nome (o nome sempre aparece: a cor nunca fica sozinha)
export function EtiquetaRegiao({
  regiao,
}: {
  regiao: { nome: string; cor: string } | null | undefined
}) {
  if (!regiao) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: regiao.cor }}
      />
      {regiao.nome}
    </span>
  )
}
