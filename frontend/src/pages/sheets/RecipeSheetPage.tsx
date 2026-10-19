import { useParams } from 'react-router'

import { useRecipe } from '@/api/recipes'
import { formatCRC, formatPercent, formatQuantity, formatUnitCost } from '@/lib/format'

import { Facts, ItemsTable, SheetLayout, SheetSection } from './SheetLayout'

export function RecipeSheetPage() {
  const id = Number(useParams().id)
  const { data: recipe, isError } = useRecipe(id)
  if (isError) return <p className="p-8 text-sm text-bad">La receta no existe.</p>
  if (!recipe) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>
  const { cost } = recipe
  const portionSize = Number(cost.yield_qty) / Number(cost.portions)

  return (
    <SheetLayout
      title={recipe.name}
      subtitle={`${recipe.category}${recipe.is_subrecipe ? ' · Sub-receta' : ''}`}
      backTo={`/recetas/${id}`}
    >
      <SheetSection title="Resumen">
        <Facts
          items={[
            ['Rendimiento', `${formatQuantity(cost.yield_qty)} ${cost.yield_unit}`],
            ['Porciones', formatQuantity(cost.portions, 2)],
            ['Tamaño de porción', `${formatQuantity(String(Math.round(portionSize * 1000) / 1000))} ${cost.yield_unit}`],
            ['Margen de seguridad', formatPercent(cost.safety_margin_rate, 0)],
            ['Costo ingredientes', formatCRC(cost.ingredients_cost)],
            ['Costo total', formatCRC(cost.total_cost)],
            [`Costo por ${cost.reference_unit}`, formatUnitCost(cost.cost_per_reference_unit)],
            ['Costo por porción', formatCRC(cost.cost_per_portion)],
          ]}
        />
        {!cost.complete && <p className="text-xs text-bad">Costo incompleto: hay ingredientes sin precio o con unidades inválidas.</p>}
      </SheetSection>
      <SheetSection title="Ingredientes">
        <ItemsTable items={cost.items} total={cost.ingredients_cost} />
      </SheetSection>
      {recipe.notes && (
        <SheetSection title="Notas">
          <p className="text-sm whitespace-pre-line">{recipe.notes}</p>
        </SheetSection>
      )}
    </SheetLayout>
  )
}
