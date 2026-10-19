/** Form row shared by recipe ingredients and product components/packaging. */
import { z } from 'zod'

import type { RecipeItemIn } from '@/api/recipes'
import type { Unit } from '@/api/supplies'
import { parseDecimalInput, percentInputToRate, rateToPercentInput, toDecimalInput } from '@/lib/format'

const units = ['g', 'kg', 'ml', 'L', 'pz'] as const

export const ingredientRowSchema = z.object({
  key: z.string(),
  itemType: z.enum(['supply', 'recipe']).nullable(),
  refId: z.number().nullable(),
  quantity: z.string().refine((value) => {
    const parsed = parseDecimalInput(value)
    return parsed !== null && Number(parsed) > 0
  }, 'Cantidad > 0'),
  unit: z.enum(units).nullable(),
  waste: z.string().refine((value) => {
    const rate = percentInputToRate(value)
    return rate !== null && Number(rate) <= 10
  }, 'Merma inválida'),
})

export type IngredientRowValues = z.infer<typeof ingredientRowSchema>

/** Array of rows: every row needs an ingredient and a unit. */
export const ingredientRowsSchema = z.array(ingredientRowSchema).superRefine((rows, ctx) => {
  rows.forEach((row, index) => {
    if (row.refId === null) {
      ctx.addIssue({ code: 'custom', path: [index, 'refId'], message: 'Elige un ingrediente' })
    }
    if (row.unit === null) {
      ctx.addIssue({ code: 'custom', path: [index, 'unit'], message: 'Elige la unidad' })
    }
  })
})

let rowCounter = 0
export function newRowKey(): string {
  rowCounter += 1
  return `row-${Date.now()}-${rowCounter}`
}

export function emptyRow(): IngredientRowValues {
  return { key: newRowKey(), itemType: null, refId: null, quantity: '', unit: null, waste: '' }
}

export function rowFromItem(line: {
  item_type: IngredientRowValues['itemType']
  ref_id: number
  quantity: string
  unit: Unit
  waste_rate: string
}): IngredientRowValues {
  return {
    key: newRowKey(),
    itemType: line.item_type,
    refId: line.ref_id,
    quantity: toDecimalInput(line.quantity),
    unit: line.unit,
    waste: rateToPercentInput(line.waste_rate),
  }
}

/** A row the API can cost: ingredient, unit, positive quantity and a valid waste %. */
export function rowToItem(row: IngredientRowValues): RecipeItemIn | null {
  const quantity = parseDecimalInput(row.quantity)
  const waste = percentInputToRate(row.waste)
  if (row.itemType === null || row.refId === null || row.unit === null) return null
  if (quantity === null || Number(quantity) <= 0 || waste === null) return null
  return { item_type: row.itemType, ref_id: row.refId, quantity, unit: row.unit as Unit, waste_rate: waste }
}

/** Costable rows and, for each form row, its index among them (null if skipped). */
export function rowsToItems(rows: IngredientRowValues[]): { items: RecipeItemIn[]; index: (number | null)[] } {
  const items: RecipeItemIn[] = []
  const index = rows.map((row) => {
    const item = rowToItem(row)
    if (item === null) return null
    items.push(item)
    return items.length - 1
  })
  return { items, index }
}
