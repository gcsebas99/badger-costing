import { z } from 'zod'

import type { RecipeCreate, RecipeDetail, RecipeItemIn, RecipePreview, RecipeUpdate } from '@/api/recipes'
import type { Unit } from '@/api/supplies'
import { parseDecimalInput, percentInputToRate, rateToPercentInput, toDecimalInput } from '@/lib/format'

const units = ['g', 'kg', 'ml', 'L', 'pz'] as const

const positiveDecimal = (message: string) =>
  z.string().refine((value) => {
    const parsed = parseDecimalInput(value)
    return parsed !== null && Number(parsed) > 0
  }, message)

const percent = (max: number, message: string) =>
  z.string().refine((value) => {
    const rate = percentInputToRate(value)
    return rate !== null && Number(rate) <= max
  }, message)

export const recipeRowSchema = z.object({
  key: z.string(),
  itemType: z.enum(['supply', 'recipe']).nullable(),
  refId: z.number().nullable(),
  quantity: positiveDecimal('Cantidad > 0'),
  unit: z.enum(units).nullable(),
  waste: percent(10, 'Merma inválida'),
})

export const recipeFormSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(200),
  category: z.string().trim().min(1, 'Ingresa la categoría.').max(200),
  isSubrecipe: z.boolean(),
  yieldQty: positiveDecimal('Ingresa un rendimiento mayor que 0.'),
  yieldUnit: z.enum(units),
  portions: positiveDecimal('Ingresa las porciones (mayor que 0).'),
  safetyMargin: percent(1, 'Entre 0 y 100 %.'),
  notes: z.string().trim().max(2000),
  items: z
    .array(recipeRowSchema)
    .superRefine((rows, ctx) => {
      rows.forEach((row, index) => {
        if (row.refId === null) {
          ctx.addIssue({ code: 'custom', path: [index, 'refId'], message: 'Elige un ingrediente' })
        }
        if (row.unit === null) {
          ctx.addIssue({ code: 'custom', path: [index, 'unit'], message: 'Elige la unidad' })
        }
      })
    }),
})

export type RecipeFormValues = z.infer<typeof recipeFormSchema>
export type RecipeRowValues = z.infer<typeof recipeRowSchema>

let rowCounter = 0
export function newRowKey(): string {
  rowCounter += 1
  return `row-${Date.now()}-${rowCounter}`
}

export function emptyRow(): RecipeRowValues {
  return { key: newRowKey(), itemType: null, refId: null, quantity: '', unit: null, waste: '' }
}

export function emptyRecipeForm(): RecipeFormValues {
  return {
    name: '',
    category: '',
    isSubrecipe: false,
    yieldQty: '',
    yieldUnit: 'kg',
    portions: '1',
    safetyMargin: '',
    notes: '',
    items: [emptyRow()],
  }
}

export function detailToForm(recipe: RecipeDetail): RecipeFormValues {
  return {
    name: recipe.name,
    category: recipe.category,
    isSubrecipe: recipe.is_subrecipe ?? false,
    yieldQty: toDecimalInput(recipe.yield_qty),
    yieldUnit: recipe.yield_unit,
    portions: toDecimalInput(recipe.portions),
    safetyMargin: rateToPercentInput(recipe.safety_margin_rate),
    notes: recipe.notes ?? '',
    items: recipe.items.map((line) => ({
      key: newRowKey(),
      itemType: line.item_type,
      refId: line.ref_id,
      quantity: toDecimalInput(line.quantity),
      unit: line.unit,
      waste: rateToPercentInput(line.waste_rate),
    })),
  }
}

/** A row the API can cost: ingredient, unit, positive quantity and a valid waste %. */
function rowToItem(row: RecipeRowValues): RecipeItemIn | null {
  const quantity = parseDecimalInput(row.quantity)
  const waste = percentInputToRate(row.waste)
  if (row.itemType === null || row.refId === null || row.unit === null) return null
  if (quantity === null || Number(quantity) <= 0 || waste === null) return null
  return { item_type: row.itemType, ref_id: row.refId, quantity, unit: row.unit as Unit, waste_rate: waste }
}

function headerFields(values: RecipeFormValues) {
  return {
    name: values.name,
    category: values.category,
    is_subrecipe: values.isSubrecipe,
    yield_qty: parseDecimalInput(values.yieldQty)!,
    yield_unit: values.yieldUnit,
    portions: parseDecimalInput(values.portions)!,
    safety_margin_rate: percentInputToRate(values.safetyMargin) ?? '0',
    notes: values.notes || null,
  }
}

/** Only called after validation, so every row converts. */
export function formToCreate(values: RecipeFormValues): RecipeCreate {
  return { ...headerFields(values), items: values.items.map((row) => rowToItem(row)!) }
}

export function formToUpdate(values: RecipeFormValues): RecipeUpdate {
  return formToCreate(values)
}

export interface PreviewRequest {
  payload: RecipePreview
  /** Row index → index in payload.items (rows that aren't costable yet are skipped). */
  previewIndex: (number | null)[]
}

/** Build a live-cost request from a possibly incomplete form, or null if not costable yet. */
export function formToPreview(values: RecipeFormValues, recipeId: number | null): PreviewRequest | null {
  const yieldQty = parseDecimalInput(values.yieldQty)
  const portions = parseDecimalInput(values.portions)
  const margin = percentInputToRate(values.safetyMargin)
  if (!yieldQty || Number(yieldQty) <= 0 || !portions || Number(portions) <= 0) return null
  if (margin === null || Number(margin) > 1) return null

  const items: RecipeItemIn[] = []
  const previewIndex = values.items.map((row) => {
    const item = rowToItem(row)
    if (item === null) return null
    items.push(item)
    return items.length - 1
  })
  return {
    payload: {
      id: recipeId,
      name: values.name || 'Borrador',
      yield_qty: yieldQty,
      yield_unit: values.yieldUnit,
      portions,
      safety_margin_rate: margin,
      items,
    },
    previewIndex,
  }
}
