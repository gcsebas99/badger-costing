import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { errorMessage } from '@/api/client'
import { usePrepPlan } from '@/api/prepPlan'
import { useProducts } from '@/api/products'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatKitchenQuantity, formatNumber, formatQuantity } from '@/lib/format'
import { notifySheetReady } from '@/lib/printReady'
import { groupSupplies, parsePlanParams, planToPayload, rowTotal } from '@/pages/planning/planForm'

import { Facts, SheetLayout, SheetSection } from './SheetLayout'

const DEFAULT_TITLE = 'Planeación'

const CheckBox = () => <span className="inline-block size-4 rounded-xs border border-brand-black/60" />
const BufferNote = () => <span className="ml-1.5 text-xs text-muted-foreground">con mermas</span>

/** Printable prep plan, rebuilt from the URL (the plan isn't stored); no prices. */
export function PlanSheetPage() {
  const [searchParams] = useSearchParams()
  const search = searchParams.toString()
  const values = useMemo(() => parsePlanParams(new URLSearchParams(search)), [search])
  const payload = useMemo(() => planToPayload(values), [values])
  const embedded = searchParams.get('embed') === '1'
  const title = values.name.trim() || DEFAULT_TITLE

  const plan = usePrepPlan(payload)
  const products = useProducts({ active: true })
  const printable = !!plan.data && !!products.data

  useEffect(() => {
    document.title = `${title} · Badger Grub`
  }, [title])

  useEffect(() => {
    if (embedded && printable) notifySheetReady()
  }, [embedded, printable])

  if (!payload) return <p className="p-8 text-sm text-muted-foreground">El plan no tiene productos con cantidad.</p>
  if (plan.isError) return <p className="p-8 text-sm text-bad">{errorMessage(plan.error)}</p>
  if (products.isError) return <p className="p-8 text-sm text-bad">{errorMessage(products.error)}</p>
  if (!plan.data || !products.data) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>

  const names = new Map(products.data.map((product) => [product.id, product.name]))
  const rows = values.rows.filter((row) => row.productId !== null && rowTotal(row))
  const units = rows.reduce((sum, row) => sum + (rowTotal(row) ?? 0), 0)
  const { recipes, supplies, warnings } = plan.data
  const percent = values.bufferPercent.trim().replace('.', ',') || '0'

  return (
    <SheetLayout
      title={title}
      backTo={`/planeacion?${search.replace(/(^|&)embed=1/, '')}`}
      kicker="Planeación de preparación"
      embedded={embedded}
    >
      <SheetSection title="Resumen">
        <Facts
          items={[
            ['Unidades a preparar', formatQuantity(units, 0)],
            ['Mermas e imprevistos', `${percent} %`],
            ['Recetas', String(recipes.length)],
            ['Suministros', String(supplies.length)],
          ]}
        />
      </SheetSection>

      {warnings.length > 0 && (
        <SheetSection title="Líneas sin incluir">
          <ul className="list-disc pl-5 text-sm text-bad">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </SheetSection>
      )}

      <SheetSection title="Productos">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Objetivo</TableHead>
              <TableHead className="text-right">Adicional</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.productId} className="h-8">
                <TableCell>{names.get(row.productId!) ?? `#${row.productId}`}</TableCell>
                <TableCell className="num">{Number(row.target)}</TableCell>
                <TableCell className="num">{Number(row.extra)}</TableCell>
                <TableCell className="num font-semibold">{rowTotal(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SheetSection>

      {recipes.length > 0 && (
        <SheetSection title="Recetas a hacer">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" aria-label="Listo" />
                <TableHead>Receta</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Recetas</TableHead>
                <TableHead className="text-right">Rendimiento total</TableHead>
                <TableHead className="text-right">Porciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => (
                <TableRow key={recipe.recipe_id} className="h-8 break-inside-avoid">
                  <TableCell><CheckBox /></TableCell>
                  <TableCell>
                    {recipe.name}
                    {recipe.buffered && <BufferNote />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{recipe.category}</TableCell>
                  <TableCell className="num font-semibold">{formatNumber(recipe.batches, 2)}</TableCell>
                  <TableCell className="num">{formatKitchenQuantity(recipe.yield_qty, recipe.yield_unit)}</TableCell>
                  <TableCell className="num">{formatQuantity(recipe.portions, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Valores exactos: quien prepara decide si redondea.</p>
        </SheetSection>
      )}

      {/*
        Long list on its own page, so the heading can't be stranded and recipes stay apart from the
        shopping list. It may span pages: only each group stays together, not the whole section.
      */}
      <section className="space-y-2 print:break-before-page">
        <h2 className="text-sm font-semibold">Suministros</h2>
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" aria-label="Listo" />
              <TableHead>Suministro</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          {groupSupplies(supplies).map(([group, groupRows]) => (
            <TableBody key={group} className="break-inside-avoid">
              <TableRow className="h-7 bg-muted/50">
                <TableCell colSpan={3} className="text-xs font-semibold">{group}</TableCell>
              </TableRow>
              {groupRows.map((supply) => (
                <TableRow key={supply.supply_id} className="h-8">
                  <TableCell><CheckBox /></TableCell>
                  <TableCell>
                    {supply.name}
                    {supply.buffered && <BufferNote />}
                  </TableCell>
                  <TableCell className="num font-semibold">{formatKitchenQuantity(supply.quantity, supply.unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </section>
    </SheetLayout>
  )
}
