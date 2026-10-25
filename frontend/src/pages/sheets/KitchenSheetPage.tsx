import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { errorMessage } from '@/api/client'
import { type RecipeScaled, useRecipe, useScaledRecipe } from '@/api/recipes'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatKitchenQuantity, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type ScaleSelection, scaleFromSearch, scaleToQuery } from '@/pages/recipes/kitchenScale'

import { Facts, SheetLayout, SheetSection } from './SheetLayout'

/** Kitchen sheet: ingredients (scaled by the URL selection, ×1 by default) and steps; no prices. */
export function KitchenSheetPage() {
  const id = Number(useParams().id)
  const [searchParams] = useSearchParams()
  const selection = scaleFromSearch(searchParams)
  const embedded = searchParams.get('embed') === '1'
  const { data: recipe, isError } = useRecipe(id)
  const scaled = useScaledRecipe(id, scaleToQuery(selection))

  useEffect(() => {
    if (recipe) document.title = `Ficha de cocina · ${recipe.name}`
  }, [recipe])

  if (isError) return <p className="p-8 text-sm text-bad">La receta no existe.</p>
  if (scaled.isError) return <p className="p-8 text-sm text-bad">{errorMessage(scaled.error)}</p>
  if (!recipe || !scaled.data) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>

  const { cost, anchor_item_id: anchorId } = scaled.data
  const hasWaste = cost.items.some((item) => Number(item.waste_rate) > 0)
  const portionSize = String(Number(cost.yield_qty) / Number(cost.portions))

  return (
    <SheetLayout
      title={recipe.name}
      subtitle={`${recipe.category}${recipe.is_subrecipe ? ' · Sub-receta' : ''}`}
      backTo={`/recetas/${id}`}
      kicker="Ficha de cocina"
      badge={<ScaleBadge data={scaled.data} selection={selection} />}
      embedded={embedded}
    >
      <SheetSection title="Resumen">
        <Facts
          items={[
            ['Rendimiento', formatKitchenQuantity(cost.yield_qty, cost.yield_unit)],
            ['Porciones', formatQuantity(cost.portions, 2)],
            ['Tamaño de porción', formatKitchenQuantity(portionSize, cost.yield_unit)],
          ]}
        />
      </SheetSection>

      <SheetSection title="Ingredientes">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" aria-label="Listo" />
              <TableHead>Ingrediente</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              {hasWaste && <TableHead className="text-right">Bruto (con merma)</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cost.items.map((item) => {
              const isAnchor = anchorId !== null && item.id === anchorId
              return (
                <TableRow key={item.position} className={cn('h-9', isAnchor && 'bg-brand-craft/20')}>
                  <TableCell>
                    <span className="inline-block size-4 rounded-xs border border-brand-black/60" />
                  </TableCell>
                  <TableCell>
                    {item.name}
                    {item.item_type === 'recipe' && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(sub-receta)</span>
                    )}
                    {isAnchor && (
                      <span className="ml-1.5 text-xs font-semibold text-brand-burgundy">ingrediente base</span>
                    )}
                  </TableCell>
                  <TableCell className="num font-semibold">{formatKitchenQuantity(item.quantity, item.unit)}</TableCell>
                  {hasWaste && (
                    <TableCell className="num text-muted-foreground">
                      {Number(item.waste_rate) > 0 ? formatKitchenQuantity(item.gross_quantity, item.unit) : ''}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SheetSection>

      <SheetSection title="Preparación">
        {recipe.steps.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-6 text-base marker:font-semibold marker:text-brand-burgundy">
            {recipe.steps.map((step, index) => (
              <li key={index} className="pl-1 whitespace-pre-line">{step}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Sin pasos de preparación.</p>
        )}
      </SheetSection>

      {recipe.notes && (
        <SheetSection title="Notas">
          <p className="text-sm whitespace-pre-line">{recipe.notes}</p>
        </SheetSection>
      )}
    </SheetLayout>
  )
}

function ScaleBadge({ data, selection }: { data: RecipeScaled; selection: ScaleSelection }) {
  let label: string | null = null
  if (selection.mode === 'anchor') {
    const anchor = data.cost.items.find((item) => item.id === data.anchor_item_id)
    const amount = formatKitchenQuantity(selection.quantity, selection.unit)
    label = `Ajustada a ${amount} de ${anchor?.name ?? 'ingrediente'} · ×${formatQuantity(data.factor, 2)}`
  } else if (Number(data.factor) !== 1) {
    label = `Receta ×${formatQuantity(data.factor, 2)}`
  }
  if (!label) return null
  return (
    <div className="inline-block rounded-md bg-brand-black px-2.5 py-1 text-sm font-semibold text-brand-gold">
      {label}
    </div>
  )
}
