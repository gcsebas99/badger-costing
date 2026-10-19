import type { RecipeSummary } from '@/api/recipes'
import { appColumnHelper, compareText } from '@/components/tables/features'
import { Badge } from '@/components/ui/badge'
import { formatCRC, formatQuantity, formatUnitCost } from '@/lib/format'

const helper = appColumnHelper<RecipeSummary>()

export const recipeColumns = helper.columns([
  helper.accessor('name', {
    header: 'Receta',
    sortFn: (a, b) => compareText(a.original.name, b.original.name),
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.is_subrecipe && <Badge variant="craft">Sub-receta</Badge>}
      </span>
    ),
  }),
  helper.display({
    id: 'yield',
    header: 'Rendimiento',
    meta: { numeric: true },
    cell: ({ row }) => `${formatQuantity(row.original.yield_qty)} ${row.original.yield_unit}`,
  }),
  helper.accessor((r) => Number(r.portions), {
    id: 'portions',
    header: 'Porciones',
    meta: { numeric: true },
    cell: ({ row }) => formatQuantity(row.original.portions, 2),
  }),
  helper.accessor('item_count', {
    header: 'Ingredientes',
    meta: { numeric: true },
  }),
  helper.accessor((r) => Number(r.total_cost), {
    id: 'total_cost',
    header: 'Costo total',
    meta: { numeric: true },
    cell: ({ row }) => formatCRC(row.original.total_cost),
  }),
  helper.accessor((r) => Number(r.cost_per_portion), {
    id: 'cost_per_portion',
    header: 'Costo / porción',
    meta: { numeric: true },
    cell: ({ row }) => formatCRC(row.original.cost_per_portion),
  }),
  helper.accessor((r) => Number(r.cost_per_reference_unit), {
    id: 'cost_per_reference_unit',
    header: 'Costo unitario',
    meta: { numeric: true },
    cell: ({ row }) => (
      <>
        {formatUnitCost(row.original.cost_per_reference_unit)}
        <span className="ml-1 text-xs text-muted-foreground">/ {row.original.reference_unit}</span>
      </>
    ),
  }),
  helper.accessor('complete', {
    header: 'Estado',
    cell: ({ getValue }) =>
      getValue() ? <Badge variant="ok">Completa</Badge> : <Badge variant="warn">Incompleta</Badge>,
  }),
])
