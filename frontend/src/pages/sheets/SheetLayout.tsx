import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ItemCost } from '@/api/recipes'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent, formatQuantity, formatUnitCost } from '@/lib/format'
import { cn } from '@/lib/utils'

const today = new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }).format(new Date())

/**
 * Print-friendly page frame: brand header, print button, back link (hidden when printing).
 * `embedded` drops the toolbar too: the print preview dialog shows the page in an iframe.
 */
export function SheetLayout({ title, subtitle, backTo, kicker = 'Ficha de costo', badge, embedded = false, children }: {
  title: string
  subtitle?: string
  backTo: string
  kicker?: string
  badge?: ReactNode
  embedded?: boolean
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 bg-white p-8 print:max-w-none print:p-0">
      <div className={cn('print-hidden flex items-center justify-between', embedded && 'hidden')}>
        <Button asChild variant="ghost" size="sm">
          <Link to={backTo}>
            <ArrowLeft />
            Volver
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Imprimir / guardar PDF
        </Button>
      </div>
      <header className="flex items-end justify-between border-b-2 border-brand-black pb-3">
        <div>
          <div className="text-xs font-semibold tracking-wide text-brand-burgundy uppercase">Badger Grub · {kicker}</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="space-y-1 text-right">
          {badge}
          <div className="text-xs text-muted-foreground">{today}</div>
        </div>
      </header>
      {children}
    </div>
  )
}

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface FlatRow {
  depth: number
  item: ItemCost
  /** Share of the sub-recipe batch actually used (1 for top-level lines). */
  scale: number
}

const BASE_FACTOR: Record<string, number> = { g: 1, kg: 1000, ml: 1, L: 1000, pz: 1 }

/**
 * Ingredient lines with every sub-recipe expanded underneath (indented), scaled to the amount
 * used: 20 g of a 600 g mayo batch shows 1/30 of each mayo ingredient.
 */
function flatten(items: ItemCost[], depth = 0, scale = 1): FlatRow[] {
  return items.flatMap((item) => {
    const rows: FlatRow[] = [{ depth, item, scale }]
    const sub = item.subrecipe
    if (sub && item.base_quantity) {
      const batch = Number(sub.yield_qty) * BASE_FACTOR[sub.yield_unit]
      rows.push(...flatten(sub.items, depth + 1, (scale * Number(item.base_quantity)) / batch))
    }
    return rows
  })
}

const scaled = (value: string | null, scale: number) => (value === null ? null : String(Number(value) * scale))

export function ItemsTable({ items, total }: { items: ItemCost[]; total?: string }) {
  const rows = flatten(items)
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Ingrediente</TableHead>
          <TableHead className="text-right">Cant. bruta</TableHead>
          <TableHead className="text-right">Merma</TableHead>
          <TableHead className="text-right">Costo unitario</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ depth, item, scale }, index) => (
          <TableRow key={index} className={cn('h-8', depth > 0 && 'text-muted-foreground')}>
            <TableCell style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
              {depth > 0 && '↳ '}
              {item.name}
              {item.status !== 'ok' && <span className="ml-1 text-bad">({item.message})</span>}
            </TableCell>
            <TableCell className="num">{formatQuantity(scaled(item.gross_quantity, scale))} {item.unit}</TableCell>
            <TableCell className="num">{Number(item.waste_rate) ? formatPercent(item.waste_rate, 0) : ''}</TableCell>
            <TableCell className="num">
              {item.reference_unit_cost ? `${formatUnitCost(item.reference_unit_cost)} / ${item.reference_unit}` : '—'}
            </TableCell>
            <TableCell className={cn('num', depth === 0 && 'font-medium')}>{formatCRC(scaled(item.cost, scale))}</TableCell>
            <TableCell className="num">{depth === 0 && item.share ? formatPercent(item.share, 0) : ''}</TableCell>
          </TableRow>
        ))}
        {total && (
          <TableRow className="h-8 font-semibold">
            <TableCell colSpan={4}>Total</TableCell>
            <TableCell className="num">{formatCRC(total)}</TableCell>
            <TableCell />
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
