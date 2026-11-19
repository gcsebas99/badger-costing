import { AlertTriangle } from 'lucide-react'

import type { ClosingReport } from '@/api/closings'
import { formatCRC, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

import { profitClass } from './closingFormat'

interface ClosingSummaryProps {
  report: ClosingReport | undefined
  isStale: boolean
  error: string | null
}

export function ClosingSummary({ report, isStale, error }: ClosingSummaryProps) {
  if (error) {
    return <p className="rounded-lg border bg-surface-card p-4 text-sm text-bad">{error}</p>
  }
  if (!report) {
    return (
      <p className="rounded-lg border bg-surface-card p-4 text-sm text-muted-foreground">
        Revisa los campos marcados para ver el resultado.
      </p>
    )
  }
  return (
    <div className={cn('space-y-4 transition-opacity', isStale && 'opacity-60')}>
      <section className="rounded-lg border bg-surface-card">
        <h2 className="flex items-center justify-between border-b px-4 py-2.5 text-sm font-semibold">
          Resultado
          <span className="text-xs font-normal text-muted-foreground">
            {report.frozen ? 'Costos congelados al cerrar' : 'Costos con precios actuales'}
          </span>
        </h2>
        <dl className="space-y-2 p-4 text-sm">
          <Row label="Facturado" value={formatCRC(report.billed_amount)} />
          <Row label="IVA" value={formatCRC(-Number(report.vat_amount) || 0)} muted />
          <Row label="Comisión bancaria" value={formatCRC(-Number(report.bank_fee_amount) || 0)} muted />
          <Row label="Ingreso neto" value={formatCRC(report.net_income)} strong />
          <div className="border-t pt-2" />
          <Row label="Costo de producto" value={formatCRC(report.product_cost)} rate={report.food_cost_rate} />
          <Row label="Mano de obra" value={formatCRC(report.labor_cost)} rate={report.labor_rate} />
          <Row label="Otros gastos" value={formatCRC(report.other_expenses)} rate={report.other_expenses_rate} />
          <Row label="Gastos totales" value={formatCRC(report.total_expenses)} strong />
          <div className="flex items-baseline justify-between rounded-md bg-brand-black px-3 py-2.5">
            <dt className="text-xs text-sidebar-muted">Ganancia neta</dt>
            <dd className="text-right">
              <span className="text-lg font-semibold text-brand-gold tabular-nums">{formatCRC(report.net_profit)}</span>
              {report.net_margin_rate != null && (
                <span className="ml-2 text-xs text-sidebar-muted tabular-nums">{formatPercent(report.net_margin_rate)}</span>
              )}
            </dd>
          </div>
          <Row label="Prime cost (producto + mano de obra)" value={formatPercent(report.prime_cost_rate)} muted />
        </dl>
      </section>

      {report.expected_billing != null && (
        <section className="rounded-lg border bg-surface-card">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Facturado vs. esperado</h2>
          <dl className="space-y-2 p-4 text-sm">
            <Row label="Esperado (unidades × PVP)" value={formatCRC(report.expected_billing)} />
            <Row label="Diferencia" value={formatCRC(report.billing_difference)}
              valueClass={profitClass(report.billing_difference)} />
            {report.products_without_price.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sin PVP directo (fuera del esperado): {report.products_without_price.join(', ')}.
              </p>
            )}
          </dl>
        </section>
      )}

      {report.warnings.length > 0 && (
        <section className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm">
          <h3 className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-warn" />
            Avisos
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({ label, value, rate, strong, muted, valueClass }: {
  label: string
  value: string
  rate?: string | null
  strong?: boolean
  muted?: boolean
  valueClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn(muted ? 'text-muted-foreground' : '', strong && 'font-medium')}>{label}</dt>
      <dd className={cn('text-right tabular-nums', strong && 'font-semibold', valueClass)}>
        {value}
        {rate !== undefined && (
          <span className="ml-2 inline-block w-14 text-xs text-muted-foreground">{formatPercent(rate)}</span>
        )}
      </dd>
    </div>
  )
}
