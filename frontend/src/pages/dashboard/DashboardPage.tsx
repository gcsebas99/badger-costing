import { CheckCircle2, FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useDashboard } from '@/api/insights'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatDate, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { data, isPending, isError } = useDashboard()

  if (isError) {
    return <p className="rounded-lg border bg-surface-card p-6 text-center text-sm text-bad">No se pudo cargar el dashboard.</p>
  }
  if (isPending) return <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Productos bajo el margen mínimo" value={data.products_below_margin} highlight to="/productos?alertas=1" />
        <Kpi label="Productos activos" value={data.active_products} to="/productos" />
        <Kpi label="Recetas y productos con costo incompleto" value={data.incomplete_count} warn={data.incomplete_count > 0} />
        <Kpi label="Suministros sin precio" value={data.supplies_without_price} warn={data.supplies_without_price > 0} to="/suministros" />
      </section>

      <Card
        title="Productos a revisar"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/simulador">
              <FlaskConical />
              Simulador de impacto
            </Link>
          </Button>
        }
      >
        {data.products_to_review.length === 0 ? (
          <AllGood text={data.active_products ? 'Todos los productos están dentro de los objetivos.' : 'Aún no hay productos activos.'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Peor margen</TableHead>
                <TableHead>Motivos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.products_to_review.map((product) => (
                <TableRow key={product.id} className="h-auto">
                  <TableCell className="py-2">
                    <Link to={`/productos/${product.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className={cn('size-2 rounded-full', product.status === 'bad' ? 'bg-bad' : 'bg-warn')} />
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="craft">{product.menu_group_name}</Badge>
                  </TableCell>
                  <TableCell className="num">{formatCRC(product.total_cost)}</TableCell>
                  <TableCell className="num">
                    {product.worst_margin_rate == null ? (
                      '—'
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{product.worst_channel}</span>
                        <StatusBadge level={product.status}>{formatPercent(product.worst_margin_rate)}</StatusBadge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 whitespace-normal">
                    <ul className="text-xs text-muted-foreground">
                      {product.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Alzas recientes de suministros">
          {data.price_increases.length === 0 ? (
            <AllGood text="Sin alzas: ningún suministro subió respecto a su precio anterior." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Suministro</TableHead>
                  <TableHead className="text-right">Antes → ahora</TableHead>
                  <TableHead className="text-right">Alza</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.price_increases.map((item) => (
                  <TableRow key={item.supply_id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.latest_date)}</div>
                    </TableCell>
                    <TableCell className="num text-xs">
                      {formatCRC(item.previous_price)} → <span className="font-medium">{formatCRC(item.latest_price)}</span>
                    </TableCell>
                    <TableCell className="num">
                      <StatusBadge level="bad">+{formatPercent(item.change_rate)}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="link" size="sm">
                        <Link to={`/simulador?suministro=${item.supply_id}`}>Impacto</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Costos incompletos">
          {data.incomplete.length === 0 && data.unpriced_supplies.length === 0 ? (
            <AllGood text="Todas las recetas y productos tienen sus costos completos." />
          ) : (
            <ul className="divide-y text-sm">
              {data.incomplete.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Link
                      to={item.kind === 'recipe' ? `/recetas/${item.id}` : `/productos/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    <Badge variant="outline">{item.kind === 'recipe' ? 'Receta' : 'Producto'}</Badge>
                  </div>
                  <ul className="mt-0.5 text-xs text-muted-foreground">
                    {item.issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                </li>
              ))}
              {data.unpriced_supplies.length > 0 && (
                <li className="px-4 py-2.5">
                  <div className="font-medium">Suministros sin precio</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.unpriced_supplies.map((s) => s.name).join(', ')}
                  </p>
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, highlight = false, warn = false, to }: {
  label: string; value: number; highlight?: boolean; warn?: boolean; to?: string
}) {
  const body = (
    <div
      className={cn(
        'h-full rounded-lg p-4 transition-colors',
        highlight ? 'bg-brand-black' : 'border bg-surface-card',
        to && (highlight ? 'hover:bg-brand-black/90' : 'hover:bg-muted/50'),
      )}
    >
      <div className={cn('text-xs', highlight ? 'text-sidebar-muted' : 'text-muted-foreground')}>{label}</div>
      {/* Gold is only used as text on black (contrast rule). */}
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', highlight && 'text-brand-gold', warn && 'text-warn')}>
        {value}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-surface-card">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function AllGood({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 text-ok" />
      {text}
    </p>
  )
}
