import { ArrowRight, FlaskConical, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import { type Simulation, useSimulation } from '@/api/insights'
import { useSupplies } from '@/api/supplies'
import { SearchSelect } from '@/components/forms/SearchSelect'
import { StatusBadge, SuggestedPrice } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent, formatUnitCost, percentInputToRate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ChangeRow {
  key: number
  supplyId: number | null
  percent: string
}

let nextKey = 1

/** "+10" / "-5" / "7,5" → signed rate string, or null if invalid. */
function signedRate(value: string): string | null {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const rate = percentInputToRate(trimmed.replace(/^[+-]/, ''))
  if (rate === null || rate === '0') return null
  return negative ? `-${rate}` : rate
}

export function SimulatorPage() {
  const [searchParams] = useSearchParams()
  const initialSupply = searchParams.get('suministro')
  const [rows, setRows] = useState<ChangeRow[]>([
    { key: nextKey++, supplyId: initialSupply ? Number(initialSupply) : null, percent: '10' },
  ])
  const { data: supplies = [] } = useSupplies({ active: true })
  const simulation = useSimulation()
  const result = simulation.data

  const options = supplies.map((s) => ({
    value: s.id,
    label: s.name,
    detail: s.reference_unit_cost ? `${formatUnitCost(s.reference_unit_cost)} / ${s.reference_unit}` : 'sin precio',
    group: s.group,
  }))

  function update(key: number, patch: Partial<ChangeRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function run(event: FormEvent) {
    event.preventDefault()
    const changes = rows
      .filter((row) => row.supplyId !== null)
      .map((row) => ({ supply_id: row.supplyId!, change_rate: signedRate(row.percent) }))
    if (changes.length === 0) {
      toast.error('Elige al menos un suministro.')
      return
    }
    if (changes.some((c) => c.change_rate === null || Number(c.change_rate) <= -1)) {
      toast.error('Revisa los porcentajes (ej. 10 para +10 %, -5 para −5 %).')
      return
    }
    try {
      await simulation.mutateAsync({ changes: changes as { supply_id: number; change_rate: string }[] })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="rounded-lg border bg-surface-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">¿Qué pasa si cambia el precio de…?</h2>
          <p className="text-xs text-muted-foreground">
            Simula alzas o bajas de suministros sin guardar nada. Usa negativos para bajas (ej. -5).
          </p>
        </header>
        <div className="space-y-2 p-4">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2">
              <div className="min-w-72 flex-1">
                <SearchSelect
                  options={options}
                  value={row.supplyId}
                  onChange={(supplyId) => update(row.key, { supplyId })}
                  placeholder="Elegir suministro…"
                  searchPlaceholder="Buscar suministro…"
                  clearable={false}
                />
              </div>
              <div className="relative w-32">
                <Input
                  value={row.percent}
                  onChange={(e) => update(row.key, { percent: e.target.value })}
                  inputMode="decimal"
                  aria-label="Cambio %"
                  className="pr-7 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Quitar"
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => setRows((current) => [...current, { key: nextKey++, supplyId: null, percent: '10' }])}>
              <Plus />
              Agregar suministro
            </Button>
            <Button type="submit" size="sm" disabled={simulation.isPending}>
              <FlaskConical />
              Simular
            </Button>
          </div>
        </div>
      </form>

      {result && <SimulationResults result={result} />}
    </div>
  )
}

function SimulationResults({ result }: { result: Simulation }) {
  const worsened = result.products.filter((p) => p.status_after !== p.status_before && p.status_after === 'bad')
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-3 text-sm">
        {result.changes.map((c) => (
          <span key={c.supply_id} className="rounded-md border bg-surface-card px-3 py-2">
            <span className="font-medium">{c.name}</span>{' '}
            <span className="text-muted-foreground tabular-nums">
              {formatUnitCost(c.cost_before)} → {formatUnitCost(c.cost_after)} / {c.reference_unit}
            </span>{' '}
            <Badge variant={Number(c.change_rate) > 0 ? 'bad' : 'ok'}>
              {Number(c.change_rate) > 0 ? '+' : ''}
              {formatPercent(c.change_rate)}
            </Badge>
          </span>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border bg-surface-card">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Productos afectados</h2>
          <span className="text-xs text-muted-foreground">{result.products.length}</span>
          {worsened.length > 0 && (
            <Badge variant="bad" className="ml-auto">
              {worsened.length} quedarían bajo el margen mínimo
            </Badge>
          )}
        </header>
        {result.products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Ningún producto activo usa estos suministros.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Cambio</TableHead>
                  <TableHead>Margen por canal</TableHead>
                  <TableHead className="text-right">Nuevo precio sugerido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.products.map((p) => (
                  <TableRow key={p.id} className="h-auto">
                    <TableCell className="py-2">
                      <Link to={`/productos/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="text-xs text-muted-foreground">{p.menu_group_name}</div>
                    </TableCell>
                    <TableCell className="num text-xs">
                      {formatCRC(p.cost_before)} <ArrowRight className="inline size-3" /> <span className="font-medium">{formatCRC(p.cost_after)}</span>
                    </TableCell>
                    <TableCell className="num">
                      <span className={cn('font-medium', Number(p.delta) > 0 ? 'text-bad' : 'text-ok')}>
                        {Number(p.delta) > 0 ? '+' : ''}
                        {formatCRC(p.delta)}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {p.delta_rate != null && `${Number(p.delta_rate) > 0 ? '+' : ''}${formatPercent(p.delta_rate)}`}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      {p.channels.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin precio de venta</span>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {p.channels.map((c) => (
                            <li key={c.name} className="flex items-center gap-1.5">
                              <span className="w-28 truncate text-muted-foreground">{c.name}</span>
                              <StatusBadge level={c.status_before}>{formatPercent(c.margin_rate_before)}</StatusBadge>
                              <ArrowRight className="size-3 text-muted-foreground" />
                              <StatusBadge level={c.status_after}>{formatPercent(c.margin_rate_after)}</StatusBadge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="num">
                      {p.suggested_price_after ? <SuggestedPrice>{formatCRC(p.suggested_price_after, 0)}</SuggestedPrice> : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-surface-card">
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Recetas afectadas</h2>
          <span className="text-xs text-muted-foreground">{result.recipes.length}</span>
        </header>
        {result.recipes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Ninguna receta usa estos suministros.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receta</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead className="text-right">Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.recipes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/recetas/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    <span className="ml-2 text-xs text-muted-foreground">{r.category}</span>
                  </TableCell>
                  <TableCell className="num text-xs">
                    {formatCRC(r.cost_before)} <ArrowRight className="inline size-3" /> <span className="font-medium">{formatCRC(r.cost_after)}</span>
                  </TableCell>
                  <TableCell className="num">
                    {Number(r.delta) > 0 ? '+' : ''}
                    {formatCRC(r.delta)}
                    {r.delta_rate != null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({Number(r.delta_rate) > 0 ? '+' : ''}
                        {formatPercent(r.delta_rate)})
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
