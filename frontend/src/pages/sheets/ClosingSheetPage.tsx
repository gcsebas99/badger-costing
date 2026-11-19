import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { useClosing } from '@/api/closings'
import { errorMessage } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatDate, formatPercent, formatQuantity, formatUnitCost } from '@/lib/format'
import { notifySheetReady } from '@/lib/printReady'
import { cn } from '@/lib/utils'
import { dateRange, profitClass } from '@/pages/closings/closingFormat'

import { Facts, SheetLayout, SheetSection } from './SheetLayout'

/** Printable closing report (income, expenses, net profit), from the stored closing. */
export function ClosingSheetPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const embedded = searchParams.get('embed') === '1'
  const closingId = Number(params.id)
  const closing = useClosing(Number.isSafeInteger(closingId) ? closingId : null)

  useEffect(() => {
    if (closing.data) document.title = `Cierre ${closing.data.name} · Badger Grub`
  }, [closing.data])

  useEffect(() => {
    if (embedded && closing.data) notifySheetReady()
  }, [embedded, closing.data])

  if (closing.isError) return <p className="p-8 text-sm text-bad">{errorMessage(closing.error)}</p>
  if (!closing.data) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>

  const { report } = closing.data
  const isClosed = closing.data.status === 'closed'

  return (
    <SheetLayout
      title={closing.data.name}
      subtitle={dateRange(closing.data.start_date, closing.data.end_date)}
      backTo={`/cierres/${closingId}`}
      kicker="Cierre de sesión"
      embedded={embedded}
      badge={
        <div className="flex justify-end gap-1.5">
          {!report.complete && <Badge variant="warn">Costo incompleto</Badge>}
          {isClosed ? (
            <Badge variant="ok">Cerrado {formatDate(closing.data.closed_at)}</Badge>
          ) : (
            <Badge variant="craft">Borrador · costos actuales</Badge>
          )}
        </div>
      }
    >
      <SheetSection title="Resumen">
        <Facts
          items={[
            ['Ingreso neto', formatCRC(report.net_income)],
            ['Gastos totales', formatCRC(report.total_expenses)],
            ['Ganancia neta', formatCRC(report.net_profit)],
            ['Margen neto', formatPercent(report.net_margin_rate)],
            ['Food cost', formatPercent(report.food_cost_rate)],
            ['Mano de obra', formatPercent(report.labor_rate)],
            ['Prime cost', formatPercent(report.prime_cost_rate)],
            ['Unidades vendidas', formatQuantity(report.total_units, 0)],
          ]}
        />
      </SheetSection>

      <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <SheetSection title="Ingresos">
          <Statement
            rows={[
              ['Facturado', report.billed_amount],
              ['IVA', negative(report.vat_amount)],
              ['Comisión bancaria', negative(report.bank_fee_amount)],
            ]}
            total={['Ingreso neto', report.net_income]}
          />
        </SheetSection>
        <SheetSection title="Resultado">
          <Statement
            rows={[
              ['Ingreso neto', report.net_income],
              ['Costo de producto', negative(report.product_cost)],
              ['Mano de obra', negative(report.labor_cost)],
              ['Otros gastos', negative(report.other_expenses)],
            ]}
            total={['Ganancia neta', report.net_profit]}
            highlight
          />
        </SheetSection>
      </div>

      {report.warnings.length > 0 && (
        <SheetSection title="Avisos">
          <ul className="list-disc pl-5 text-sm text-warn">
            {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </SheetSection>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Costo de producto</h2>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Costo unitario</TableHead>
              <TableHead className="text-right">Empaque c/u</TableHead>
              <TableHead className="text-right">Costo total</TableHead>
              <TableHead className="text-right">PVP</TableHead>
              <TableHead className="text-right">Esperado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.products.map((p) => (
              <TableRow key={p.product_id} className="h-8">
                <TableCell>
                  {p.name}
                  {!p.complete && <span className="ml-1 text-bad">(costo incompleto)</span>}
                </TableCell>
                <TableCell className="num">{formatQuantity(p.units, 0)}</TableCell>
                <TableCell className="num">{formatUnitCost(p.unit_cost)}</TableCell>
                <TableCell className="num">{formatUnitCost(p.packaging_cost)}</TableCell>
                <TableCell className="num font-medium">{formatCRC(p.total_cost)}</TableCell>
                <TableCell className="num">{formatCRC(p.unit_price)}</TableCell>
                <TableCell className="num">{formatCRC(p.expected_revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="h-8 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="num">{formatQuantity(report.total_units, 0)}</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="num">{formatCRC(report.product_cost)}</TableCell>
              <TableCell />
              <TableCell className="num">{formatCRC(report.expected_billing)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {report.billing_difference != null && (
          <p className="text-xs text-muted-foreground">
            Facturado vs. esperado (unidades × PVP directo):{' '}
            <span className={cn('font-medium tabular-nums', profitClass(report.billing_difference))}>
              {formatCRC(report.billing_difference)}
            </span>
            {report.products_without_price.length > 0 &&
              ` · Sin PVP directo: ${report.products_without_price.join(', ')}.`}
          </p>
        )}
      </section>

      <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <SheetSection title="Mano de obra">
          {report.labor.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin horas registradas.</p>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Por hora</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.labor.map((line, index) => (
                  <TableRow key={index} className="h-8">
                    <TableCell>{line.name}</TableCell>
                    <TableCell className="num">{formatQuantity(line.hours, 2)}</TableCell>
                    <TableCell className="num">{formatCRC(line.hourly_rate)}</TableCell>
                    <TableCell className="num">{formatCRC(line.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="h-8 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="num">{formatQuantity(report.labor_hours, 2)}</TableCell>
                  <TableCell />
                  <TableCell className="num">{formatCRC(report.labor_cost)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </SheetSection>
        <SheetSection title="Otros gastos">
          {report.expenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin otros gastos.</p>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Gasto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.expenses.map((line, index) => (
                  <TableRow key={index} className="h-8">
                    <TableCell>{line.name}</TableCell>
                    <TableCell className="num">{formatCRC(line.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="h-8 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="num">{formatCRC(report.other_expenses)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </SheetSection>
      </div>

      {closing.data.notes && (
        <SheetSection title="Notas">
          <p className="text-sm whitespace-pre-line">{closing.data.notes}</p>
        </SheetSection>
      )}
    </SheetLayout>
  )
}

const negative = (value: string) => (Number(value) === 0 ? '0' : `-${value}`)

function Statement({ rows, total, highlight = false }: {
  rows: [string, string][]
  total: [string, string]
  highlight?: boolean
}) {
  return (
    <dl className="space-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{formatCRC(value)}</dd>
        </div>
      ))}
      <div
        className={cn(
          'flex justify-between gap-3 border-t pt-1 font-semibold',
          highlight && 'rounded-md border-t-0 bg-brand-black px-2 py-1.5 text-white',
        )}
      >
        <dt>{total[0]}</dt>
        <dd className={cn('tabular-nums', highlight && 'text-brand-gold')}>{formatCRC(total[1])}</dd>
      </div>
    </dl>
  )
}
