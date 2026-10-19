import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ProductCost } from '@/api/products'
import type { ItemCost, RecipeCost } from '@/api/recipes'
import { Badge } from '@/components/ui/badge'
import { formatCRC, formatQuantity } from '@/lib/format'

/** Expandable "where does every colón come from" tree for a product. */
export function ProductCostTree({ cost }: { cost: ProductCost }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {cost.recipe && (
        <Node
          label={
            <>
              {cost.recipe.name}
              <span className="text-xs text-muted-foreground"> × {formatQuantity(cost.recipe_portions)} porción</span>
            </>
          }
          amount={cost.recipe_cost}
          badge={!cost.recipe.complete ? <Badge variant="warn">Incompleta</Badge> : null}
          defaultOpen
        >
          <RecipeChildren recipe={cost.recipe} />
        </Node>
      )}
      {cost.items.length > 0 && (
        <Node label="Componentes" amount={cost.items_cost}>
          {cost.items.map((item) => <ItemNode key={`i${item.position}`} item={item} />)}
        </Node>
      )}
      {cost.packaging.length > 0 && (
        <Node label="Empaque" amount={cost.packaging_cost}>
          {cost.packaging.map((item) => <ItemNode key={`p${item.position}`} item={item} />)}
        </Node>
      )}
    </ul>
  )
}

function RecipeChildren({ recipe }: { recipe: RecipeCost }) {
  return (
    <>
      {recipe.items.map((item) => <ItemNode key={item.position} item={item} />)}
      {Number(recipe.safety_margin_cost) > 0 && (
        <Leaf label="Margen de seguridad" amount={recipe.safety_margin_cost} />
      )}
    </>
  )
}

function ItemNode({ item }: { item: ItemCost }) {
  const label = (
    <>
      {item.name}
      <span className="text-xs text-muted-foreground">
        {' '}
        {formatQuantity(item.gross_quantity)} {item.unit}
      </span>
    </>
  )
  const badge =
    item.status === 'ok' ? null : (
      <Badge variant={item.status === 'incomplete_subrecipe' || item.status === 'missing_price' ? 'warn' : 'bad'}
        title={item.message ?? undefined}>
        {item.status === 'missing_price' ? 'Sin precio' : item.status === 'incomplete_subrecipe' ? 'Incompleta' : 'Error'}
      </Badge>
    )
  if (item.subrecipe) {
    return (
      <Node label={label} amount={item.cost} badge={badge}>
        <RecipeChildren recipe={item.subrecipe} />
      </Node>
    )
  }
  return <Leaf label={label} amount={item.cost} badge={badge} />
}

function Node({
  label,
  amount,
  badge,
  children,
  defaultOpen = false,
}: {
  label: ReactNode
  amount: string | null
  badge?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <li>
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge}
          <span className="tabular-nums">{formatCRC(amount)}</span>
        </summary>
        <ul className="ml-3 border-l pl-2">{children}</ul>
      </details>
    </li>
  )
}

function Leaf({ label, amount, badge }: { label: ReactNode; amount: string | null; badge?: ReactNode }) {
  return (
    <li className="flex items-center gap-1 px-1 py-1 pl-5">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
      <span className="text-muted-foreground tabular-nums">{formatCRC(amount)}</span>
    </li>
  )
}
