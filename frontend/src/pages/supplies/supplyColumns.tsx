import { MoreHorizontal } from 'lucide-react'

import type { Supply } from '@/api/supplies'
import { appColumnHelper, compareText } from '@/components/tables/features'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCRC, formatDate, formatQuantity, formatUnitCost } from '@/lib/format'

export interface SupplyRowActions {
  onEdit: (supply: Supply) => void
  onShowPrices: (supply: Supply) => void
  onToggleActive: (supply: Supply) => void
  onDelete: (supply: Supply) => void
}

const helper = appColumnHelper<Supply>()

const toNumber = (value: string | null) => (value === null ? undefined : Number(value))

export function supplyColumns(actions: SupplyRowActions) {
  return helper.columns([
    helper.accessor('name', {
      header: 'Suministro',
      sortFn: (a, b) => compareText(a.original.name, b.original.name),
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.brand && (
            <span className="text-xs text-muted-foreground">{row.original.brand}</span>
          )}
          {!row.original.active && <Badge variant="outline">Inactivo</Badge>}
        </span>
      ),
    }),
    helper.accessor('group', {
      header: 'Grupo',
      sortFn: (a, b) => compareText(a.original.group, b.original.group),
      cell: ({ getValue }) => <Badge variant="craft">{getValue()}</Badge>,
    }),
    helper.accessor('supplier', {
      header: 'Proveedor',
      sortFn: (a, b) => compareText(a.original.supplier, b.original.supplier),
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    }),
    helper.display({
      id: 'pack',
      header: 'Empaque',
      meta: { numeric: true },
      cell: ({ row }) => `${formatQuantity(row.original.pack_qty)} ${row.original.pack_unit}`,
    }),
    helper.accessor((s) => toNumber(s.current_price), {
      id: 'current_price',
      header: 'Costo empaque',
      meta: { numeric: true },
      sortUndefined: 'last',
      cell: ({ row }) =>
        row.original.current_price === null ? (
          <Badge variant="warn">Sin precio</Badge>
        ) : (
          formatCRC(row.original.current_price)
        ),
    }),
    helper.accessor((s) => toNumber(s.reference_unit_cost), {
      id: 'reference_unit_cost',
      header: 'Costo unitario',
      meta: { numeric: true },
      sortUndefined: 'last',
      cell: ({ row }) =>
        row.original.reference_unit_cost === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {formatUnitCost(row.original.reference_unit_cost)}
            <span className="ml-1 text-xs text-muted-foreground">/ {row.original.reference_unit}</span>
          </>
        ),
    }),
    helper.accessor((s) => s.last_price_date ?? undefined, {
      id: 'last_price_date',
      header: 'Última actualización',
      meta: { numeric: true },
      sortUndefined: 'last',
      cell: ({ row }) => formatDate(row.original.last_price_date),
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">Acciones</span>,
      meta: { className: 'w-10' },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones para ${row.original.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onSelect={() => actions.onShowPrices(row.original)}>
              Historial de precios
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit(row.original)}>Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onToggleActive(row.original)}>
              {row.original.active ? 'Desactivar' : 'Activar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(row.original)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ])
}
