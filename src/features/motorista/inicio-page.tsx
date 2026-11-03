import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

// Provisória: aqui entra a rota do dia quando as telas forem definidas
export function InicioMotoristaPage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Rota do dia</EmptyTitle>
        <EmptyDescription>
          Em construção. Aqui vão aparecer as entregas e as coletas.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
