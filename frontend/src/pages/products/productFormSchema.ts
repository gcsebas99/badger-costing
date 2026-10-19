import { z } from 'zod'

import type { ProductCreate, ProductDetail, ProductPreview, ProductUpdate } from '@/api/products'
import {
  emptyRow,
  type IngredientRowValues,
  ingredientRowsSchema,
  rowFromItem,
  rowsToItems,
  rowToItem,
} from '@/components/forms/ingredientRow'
import { parseDecimalInput, toDecimalInput } from '@/lib/format'

const optionalMoney = z
  .string()
  .refine((value) => !value.trim() || parseDecimalInput(value) !== null, 'Monto inválido.')

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(200),
  menuGroupId: z.string().min(1, 'Elige el grupo del menú.'),
  active: z.boolean(),
  notes: z.string().trim().max(2000),
  recipeId: z.number().nullable(),
  recipePortions: z.string().refine((value) => {
    const parsed = parseDecimalInput(value)
    return parsed !== null && Number(parsed) > 0
  }, 'Mayor que 0.'),
  items: ingredientRowsSchema,
  packaging: ingredientRowsSchema,
  directPrice: optionalMoney,
  /** Platform id → PVP input ("" = not sold on that platform). */
  platformPrices: z.record(z.string(), optionalMoney),
  targetCost: optionalMoney,
})

export type ProductFormValues = z.infer<typeof productFormSchema>

export function emptyProductForm(): ProductFormValues {
  return {
    name: '',
    menuGroupId: '',
    active: true,
    notes: '',
    recipeId: null,
    recipePortions: '1',
    items: [],
    packaging: [],
    directPrice: '',
    platformPrices: {},
    targetCost: '',
  }
}

export function detailToForm(product: ProductDetail): ProductFormValues {
  return {
    name: product.name,
    menuGroupId: String(product.menu_group_id),
    active: product.active ?? true,
    notes: product.notes ?? '',
    recipeId: product.recipe_id ?? null,
    recipePortions: toDecimalInput(product.recipe_portions ?? '1'),
    items: product.items.map(rowFromItem),
    packaging: product.packaging.map(rowFromItem),
    directPrice: toDecimalInput(product.direct_price),
    platformPrices: Object.fromEntries(
      product.platform_prices.map((p) => [String(p.platform_id), toDecimalInput(p.price)]),
    ),
    targetCost: toDecimalInput(product.target_cost),
  }
}

const money = (value: string) => (value.trim() ? parseDecimalInput(value) : null)

function platformPrices(values: ProductFormValues) {
  return Object.entries(values.platformPrices)
    .map(([platformId, price]) => ({ platform_id: Number(platformId), price: money(price) }))
    .filter((p): p is { platform_id: number; price: string } => p.price !== null)
}

/** Only called after validation, so every row converts. */
export function formToCreate(values: ProductFormValues): ProductCreate {
  const all = (rows: IngredientRowValues[]) => rows.map((row) => rowToItem(row)!)
  return {
    name: values.name,
    menu_group_id: Number(values.menuGroupId),
    active: values.active,
    notes: values.notes || null,
    recipe_id: values.recipeId,
    recipe_portions: parseDecimalInput(values.recipePortions)!,
    items: all(values.items),
    packaging: all(values.packaging),
    direct_price: money(values.directPrice),
    platform_prices: platformPrices(values),
    target_cost: money(values.targetCost),
  }
}

export function formToUpdate(values: ProductFormValues): ProductUpdate {
  return formToCreate(values)
}

export interface ProductPreviewRequest {
  payload: ProductPreview
  itemsIndex: (number | null)[]
  packagingIndex: (number | null)[]
}

export function formToPreview(values: ProductFormValues): ProductPreviewRequest | null {
  const portions = parseDecimalInput(values.recipePortions)
  if (portions === null || Number(portions) <= 0) return null
  const items = rowsToItems(values.items)
  const packaging = rowsToItems(values.packaging)
  return {
    payload: {
      menu_group_id: values.menuGroupId ? Number(values.menuGroupId) : null,
      recipe_id: values.recipeId,
      recipe_portions: portions,
      direct_price: money(values.directPrice),
      target_cost: money(values.targetCost),
      items: items.items,
      packaging: packaging.items,
      platform_prices: platformPrices(values),
    },
    itemsIndex: items.index,
    packagingIndex: packaging.index,
  }
}

export { emptyRow }
