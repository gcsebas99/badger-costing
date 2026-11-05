import { TriangleAlert } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { PrepPlan } from '@/api/prepPlan'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatKitchenQuantity, formatNumber, formatQuantity } from '@/lib/format'

import { groupSupplies } from './planForm'

function Section({ title, count, hint, children }: { title: string; count: number; hint: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-surface-card">
      <header className="flex flex-wrap items-baseline gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
        <p className="ml-auto text-xs text-muted-foreground">{hint}</p>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

const BufferBadge = () => <Badge variant="craft" className="ml-2">Con mermas</Badge>

export function PlanResults({ plan }: { plan: PrepPlan }) {
  return (
    <div className="space-y-6">
      {plan.warnings.length > 0 && (
        <div role="alert" className="rounded-lg border border-warn bg-warn/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 text-warn" />
            Algunas líneas no se pudieron incluir
          </p>
          <ul className="mt-1 list-disc pl-10 text-xs">
            {plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      <Section title="Recetas" count={plan.recipes.length} hint="Valores exactos: quien prepara decide si redondea.">
        {plan.recipes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Este plan no usa recetas.</p>
        ) : (
          <Table className="min-w-[44rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Receta</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Recetas a hacer</TableHead>
                <TableHead className="text-right">Rendimiento total</TableHead>
                <TableHead className="text-right">Porciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.recipes.map((recipe) => (
                <TableRow key={recipe.recipe_id}>
                  <TableCell>
                    <Link to={`/recetas/${recipe.recipe_id}`} className="font-medium hover:underline">{recipe.name}</Link>
                    {recipe.buffered && <BufferBadge />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{recipe.category}</TableCell>
                  <TableCell className="num font-semibold">{formatNumber(recipe.batches, 2)}</TableCell>
                  <TableCell className="num">{formatKitchenQuantity(recipe.yield_qty, recipe.yield_unit)}</TableCell>
                  <TableCell className="num">{formatQuantity(recipe.portions, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Suministros" count={plan.supplies.length} hint="Incluye desechables y bebidas.">
        <Table className="min-w-[32rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Suministro</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupSupplies(plan.supplies).map(([group, supplies]) => (
              <Fragment key={group}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={2} className="text-xs font-semibold">{group}</TableCell>
                </TableRow>
                {supplies.map((supply) => (
                  <TableRow key={supply.supply_id}>
                    <TableCell>
                      {supply.name}
                      {supply.buffered && <BufferBadge />}
                    </TableCell>
                    <TableCell className="num font-medium">{formatKitchenQuantity(supply.quantity, supply.unit)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  )
}
