import { useParams } from 'react-router'

import { useProduct } from '@/api/products'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent, formatQuantity } from '@/lib/format'

import { Facts, ItemsTable, SheetLayout, SheetSection } from './SheetLayout'

export function ProductSheetPage() {
  const id = Number(useParams().id)
  const { data: product, isError } = useProduct(id)
  if (isError) return <p className="p-8 text-sm text-bad">El producto no existe.</p>
  if (!product) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>
  const { pricing } = product
  const { cost } = pricing

  return (
    <SheetLayout title={product.name} subtitle={product.menu_group_name} backTo={`/productos/${id}`}>
      <SheetSection title="Resumen">
        <Facts
          items={[
            ['Receta', cost.recipe ? `${cost.recipe.name} × ${formatQuantity(cost.recipe_portions)}` : '—'],
            ['Costo receta', formatCRC(cost.recipe_cost)],
            ['Componentes', formatCRC(cost.items_cost)],
            ['Empaque', formatCRC(cost.packaging_cost)],
            ['Costo total', formatCRC(cost.total_cost)],
            ['Food cost objetivo', formatPercent(pricing.target_food_cost_rate, 0)],
            ['Precio sugerido', formatCRC(pricing.suggested_price)],
            ['Costo teórico', pricing.target_cost ? formatCRC(pricing.target_cost) : '—'],
          ]}
        />
        {cost.issues.length > 0 && <p className="text-xs text-bad">Costo incompleto: {cost.issues.join(' ')}</p>}
      </SheetSection>

      {pricing.channels.length > 0 && (
        <SheetSection title="Precio y margen por canal">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">PVP</TableHead>
                <TableHead className="text-right">Sin IVA</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">% Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">% Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.channels.map((c) => (
                <TableRow key={c.platform_id ?? 'direct'} className="h-8">
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="num">{formatCRC(c.price)}</TableCell>
                  <TableCell className="num">{formatCRC(c.price_ex_vat)}</TableCell>
                  <TableCell className="num">{formatCRC(c.fee)} ({formatPercent(c.fee_rate)})</TableCell>
                  <TableCell className="num">{formatCRC(c.cost)}</TableCell>
                  <TableCell className="num">{formatPercent(c.food_cost_rate)}</TableCell>
                  <TableCell className="num font-medium">{formatCRC(c.margin)}</TableCell>
                  <TableCell className={c.margin_status === 'bad' ? 'num font-semibold text-bad' : 'num'}>
                    {formatPercent(c.margin_rate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SheetSection>
      )}

      {cost.recipe && (
        <SheetSection title={`Receta: ${cost.recipe.name} (por porción × ${formatQuantity(cost.recipe_portions)})`}>
          <ItemsTable items={cost.recipe.items} total={cost.recipe.ingredients_cost} />
          <p className="text-xs text-muted-foreground">
            Costo total de la tanda {formatCRC(cost.recipe.total_cost)} ÷ {formatQuantity(cost.recipe.portions, 2)} porciones
            = {formatCRC(cost.recipe.cost_per_portion)} por porción.
          </p>
        </SheetSection>
      )}
      {cost.items.length > 0 && (
        <SheetSection title="Componentes directos">
          <ItemsTable items={cost.items} total={cost.items_cost} />
        </SheetSection>
      )}
      {cost.packaging.length > 0 && (
        <SheetSection title="Empaque">
          <ItemsTable items={cost.packaging} total={cost.packaging_cost} />
        </SheetSection>
      )}
      {product.notes && (
        <SheetSection title="Notas">
          <p className="text-sm whitespace-pre-line">{product.notes}</p>
        </SheetSection>
      )}
    </SheetLayout>
  )
}
