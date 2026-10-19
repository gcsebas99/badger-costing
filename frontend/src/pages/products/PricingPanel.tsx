import { AlertTriangle } from 'lucide-react'

import type { ChannelPricing, ProductPricing } from '@/api/products'
import { ProductCostTree } from '@/components/CostTree'
import { StatusBadge, SuggestedPrice } from '@/components/StatusBadge'
import { formatCRC, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PricingPanelProps {
  pricing: ProductPricing | undefined
  isStale: boolean
  error: string | null
}

export function PricingPanel({ pricing, isStale, error }: PricingPanelProps) {
  if (error) {
    return <p className="rounded-lg border bg-surface-card p-4 text-sm text-bad">{error}</p>
  }
  if (!pricing) {
    return (
      <p className="rounded-lg border bg-surface-card p-4 text-sm text-muted-foreground">
        Elige una receta o agrega componentes para calcular el costo.
      </p>
    )
  }
  const { cost } = pricing
  return (
    <div className={cn('space-y-4 transition-opacity', isStale && 'opacity-60')}>
      <section className="rounded-lg border bg-surface-card">
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Costo</h2>
        <dl className="space-y-2 p-4 text-sm">
          <Row label="Receta" value={formatCRC(cost.recipe_cost)} />
          <Row label="Componentes" value={formatCRC(cost.items_cost)} />
          <Row label="Empaque" value={formatCRC(cost.packaging_cost)} />
          <div className="flex items-baseline justify-between rounded-md bg-brand-black px-3 py-2.5">
            <dt className="text-xs text-sidebar-muted">Costo total</dt>
            <dd className="text-lg font-semibold text-brand-gold tabular-nums">{formatCRC(cost.total_cost)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">
              Precio sugerido <span className="text-xs">(food cost {formatPercent(pricing.target_food_cost_rate, 0)})</span>
            </dt>
            <dd>{pricing.suggested_price ? <SuggestedPrice>{formatCRC(pricing.suggested_price)}</SuggestedPrice> : '—'}</dd>
          </div>
          {pricing.deviation != null && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Desviación vs. teórico ({formatCRC(pricing.target_cost)})</dt>
              <dd>
                <StatusBadge level={pricing.deviation_status}>
                  {Number(pricing.deviation) > 0 ? '+' : ''}
                  {formatPercent(pricing.deviation)}
                </StatusBadge>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {cost.issues.length > 0 && (
        <section className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-warn">
            <AlertTriangle className="size-4" />
            Costo incompleto
          </h3>
          <ul className="space-y-1 text-xs">
            {cost.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </section>
      )}

      {pricing.channels.length > 0 ? (
        pricing.channels.map((channel) => <ChannelCard key={channel.platform_id ?? 'direct'} channel={channel} />)
      ) : (
        <p className="rounded-lg border bg-surface-card p-4 text-sm text-muted-foreground">
          Agrega un precio de venta para ver el margen.
        </p>
      )}

      <section className="rounded-lg border bg-surface-card">
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Árbol de costo</h2>
        <div className="p-2">
          <ProductCostTree cost={cost} />
        </div>
      </section>
    </div>
  )
}

function ChannelCard({ channel }: { channel: ChannelPricing }) {
  return (
    <section className="rounded-lg border bg-surface-card">
      <h3 className="flex items-center justify-between border-b px-4 py-2.5 text-sm font-semibold">
        {channel.name}
        <StatusBadge level={channel.margin_status}>Margen {formatPercent(channel.margin_rate)}</StatusBadge>
      </h3>
      <dl className="space-y-1.5 p-4 text-sm">
        <Row label="PVP" value={formatCRC(channel.price)} />
        <Row label="Precio sin IVA" value={formatCRC(channel.price_ex_vat)} />
        <Row label={`Comisión (${formatPercent(channel.fee_rate)})`} value={`−${formatCRC(channel.fee)}`} />
        <Row label="Costo" value={`−${formatCRC(channel.cost)}`} />
        <Row label="Margen" value={formatCRC(channel.margin)} strong />
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">% Costo</dt>
          <dd>
            <StatusBadge level={channel.food_cost_status}>{formatPercent(channel.food_cost_rate)}</StatusBadge>
          </dd>
        </div>
      </dl>
    </section>
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
