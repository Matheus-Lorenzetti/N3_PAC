import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

// Provisória para as telas do escritório que ainda vão ser feitas
export function EmConstrucaoPage({
  titulo,
  descricao,
}: {
  titulo: string
  descricao: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{descricao}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
