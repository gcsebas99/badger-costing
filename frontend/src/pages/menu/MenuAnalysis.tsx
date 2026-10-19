import { Link } from 'react-router'

import { type MenuGroupAnalysis, type MenuItem, useMenuEngineering } from '@/api/sales'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MENU_CLASS } from './menuClasses'

export function MenuAnalysis({ periodId }: { periodId: number }) {
  const { data: groups, isPending } = useMenuEngineering(periodId)
  if (isPending) return <p className="p-6 text-sm text-muted-foreground">Calculando…</p>
  if (!groups || groups.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No hay productos para analizar.</p>
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <GroupAnalysis key={group.menu_group_id} group={group} />
      ))}
    </div>
  )
}

function GroupAnalysis({ group }: { group: MenuGroupAnalysis }) {
  const byClass = (cls: keyof typeof MENU_CLASS) => group.items.filter((i) => i.classification === cls)
  return (
    <section className="overflow-hidden rounded-lg border bg-surface-card">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{group.menu_group_name}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {group.total_units} uds · {group.item_count} productos · popularidad alta ≥ {formatPercent(group.popularity_threshold)} ·
          margen promedio {formatCRC(group.average_margin)}
        </span>
      </header>
      {group.total_units === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Sin ventas registradas en este periodo para este grupo.</p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Matrix: x = popularity (low → high), y = margin (high on top) */}
          <div>
            <div className="grid grid-cols-[auto_1fr_1fr] grid-rows-[1fr_1fr_auto] gap-1.5 text-xs">
              <AxisLabel className="row-span-2 [writing-mode:vertical-rl] rotate-180">Margen →</AxisLabel>
              <Quadrant cls="puzzle" items={byClass('puzzle')} />
              <Quadrant cls="star" items={byClass('star')} />
              <Quadrant cls="dog" items={byClass('dog')} />
              <Quadrant cls="plowhorse" items={byClass('plowhorse')} />
              <span />
              <AxisLabel className="col-span-2 text-center">Popularidad →</AxisLabel>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Uds</TableHead>
                  <TableHead className="text-right">Popularidad</TableHead>
                  <TableHead className="text-right">Margen unitario</TableHead>
                  <TableHead className="text-right">Margen total</TableHead>
                  <TableHead>Clasificación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item) => (
                  <ItemRow key={item.product_id} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  )
}

function ItemRow({ item }: { item: MenuItem }) {
  const cls = item.classification ? MENU_CLASS[item.classification] : null
  return (
    <TableRow className="h-9">
      <TableCell>
        <Link to={`/productos/${item.product_id}`} className="font-medium hover:underline">{item.name}</Link>
        {item.unpriced_units > 0 && (
          <span className="ml-1 text-warn" title="Unidades en canales sin precio: no cuentan para el margen">
            ({item.unpriced_units} sin precio)
          </span>
        )}
      </TableCell>
      <TableCell className="num">{item.units}</TableCell>
      <TableCell className="num">
        {formatPercent(item.popularity)}{' '}
        <span className={item.high_popularity ? 'text-ok' : 'text-muted-foreground'}>
          {item.high_popularity ? 'alta' : 'baja'}
        </span>
      </TableCell>
      <TableCell className="num">
        {formatCRC(item.unit_margin)}{' '}
        {item.high_margin != null && (
          <span className={item.high_margin ? 'text-ok' : 'text-muted-foreground'}>{item.high_margin ? 'alto' : 'bajo'}</span>
        )}
      </TableCell>
      <TableCell className="num">{formatCRC(item.total_margin)}</TableCell>
      <TableCell>
        {cls ? (
          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', cls.className)} title={cls.advice}>
            {cls.label}
          </span>
        ) : (
          <Badge variant="outline" title="Sin precio de venta">Sin clasificar</Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

function Quadrant({ cls, items }: { cls: keyof typeof MENU_CLASS; items: MenuItem[] }) {
  const meta = MENU_CLASS[cls]
  return (
    <div className="min-h-28 rounded-md border p-2">
      <div className={cn('mb-1 inline-block rounded-full px-2 py-0.5 font-semibold', meta.className)}>
        {meta.label} <span className="tabular-nums">{items.length}</span>
      </div>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.product_id} className="truncate">{i.name}</li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{meta.advice}</p>
    </div>
  )
}

function AxisLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('self-center text-[11px] text-muted-foreground', className)}>{children}</span>
}
