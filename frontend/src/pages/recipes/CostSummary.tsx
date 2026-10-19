import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'

import type { RecipeCost, RecipeDetail } from '@/api/recipes'
import { Badge } from '@/components/ui/badge'
import { formatCRC, formatPercent, formatQuantity, formatUnitCost } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CostSummaryProps {
  cost: RecipeCost | undefined
  isStale: boolean
  error: string | null
  usedIn: RecipeDetail['used_in']
}

export function CostSummary({ cost, isStale, error, usedIn }: CostSummaryProps) {
  const issues = cost?.items.filter((item) => item.status !== 'ok') ?? []
  const portionSize = cost ? Number(cost.yield_qty) / Number(cost.portions) : null

  return (
    <aside className="space-y-4 lg:sticky lg:top-20">
      <section className={cn('rounded-lg border bg-surface-card transition-opacity', isStale && 'opacity-60')}>
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Costo</h2>
        {error ? (
          <p className="p-4 text-sm text-bad">{error}</p>
        ) : !cost ? (
          <p className="p-4 text-sm text-muted-foreground">
            Completa el rendimiento y las porciones para calcular el costo.
          </p>
        ) : (
          <dl className="space-y-2 p-4 text-sm">
            <Row label="Ingredientes" value={formatCRC(cost.ingredients_cost)} />
            <Row
              label={`Margen de seguridad (${formatPercent(cost.safety_margin_rate, 0)})`}
              value={formatCRC(cost.safety_margin_cost)}
            />
            <div className="flex items-baseline justify-between rounded-md bg-brand-black px-3 py-2.5">
              <dt className="text-xs text-sidebar-muted">Costo total</dt>
              <dd className="text-lg font-semibold text-brand-gold tabular-nums">{formatCRC(cost.total_cost)}</dd>
            </div>
            <Row label={`Costo por ${cost.reference_unit}`} value={formatUnitCost(cost.cost_per_reference_unit)} />
            <Row label="Costo por porción" value={formatCRC(cost.cost_per_portion)} strong />
            {portionSize !== null && (
              <Row
                label="Tamaño de porción"
                value={`${formatQuantity(String(Math.round(portionSize * 1000) / 1000))} ${cost.yield_unit}`}
              />
            )}
          </dl>
        )}
      </section>

      {issues.length > 0 && (
        <section className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-warn">
            <AlertTriangle className="size-4" />
            Costo incompleto
          </h3>
          <ul className="space-y-1 text-xs">
            {issues.map((item) => (
              <li key={item.position}>
                <span className="font-medium">{item.name}:</span> {item.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {usedIn.length > 0 && (
        <section className="rounded-lg border bg-surface-card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Se usa en</h3>
          <ul className="space-y-1">
            {usedIn.map((recipe) => (
              <li key={recipe.id} className="flex items-center gap-2">
                <Link to={`/recetas/${recipe.id}`} className="text-primary hover:underline">
                  {recipe.name}
                </Link>
                {recipe.is_subrecipe && <Badge variant="craft">Sub-receta</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums', strong && 'font-semibold')}>{value}</dd>
    </div>
  )
}
