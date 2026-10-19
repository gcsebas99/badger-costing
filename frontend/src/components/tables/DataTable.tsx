import { type ColumnDef, type SortingState, useTable } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { type AppTableFeatures, tableFeatureSet } from './features'

export interface ColumnMeta {
  /** Right-align with tabular numbers (money, quantities). */
  numeric?: boolean
  className?: string
}

interface DataTableProps<TData> {
  columns: ColumnDef<AppTableFeatures, TData, any>[]
  data: TData[]
  initialSorting?: SortingState
  getRowId?: (row: TData) => string
  onRowClick?: (row: TData) => void
  isRowMuted?: (row: TData) => boolean
  emptyMessage?: string
}

export function DataTable<TData>({
  columns,
  data,
  initialSorting = [],
  getRowId,
  onRowClick,
  isRowMuted,
  emptyMessage = 'Sin resultados.',
}: DataTableProps<TData>) {
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    initialState: { sorting: initialSorting },
    enableSortingRemoval: false,
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              const meta = header.column.columnDef.meta as ColumnMeta | undefined
              const sorted = header.column.getIsSorted()
              const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
              return (
                <TableHead
                  key={header.id}
                  className={cn(meta?.numeric && 'text-right', meta?.className)}
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        'inline-flex items-center gap-1 uppercase hover:text-brand-gold focus-visible:text-brand-gold focus-visible:outline-none',
                        meta?.numeric && 'flex-row-reverse',
                      )}
                    >
                      <table.FlexRender header={header} />
                      <SortIcon className={cn('size-3', sorted ? 'text-brand-gold' : 'opacity-40')} />
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(onRowClick && 'cursor-pointer', isRowMuted?.(row.original) && 'text-muted-foreground')}
            >
              {row.getAllCells().map((cell) => {
                const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                return (
                  <TableCell key={cell.id} className={cn(meta?.numeric && 'num', meta?.className)}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
