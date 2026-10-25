import { z } from 'zod'

import type { RecipeCreate, RecipeDetail, RecipePreview, RecipeUpdate } from '@/api/recipes'
import {
  emptyRow,
  ingredientRowsSchema,
  rowFromItem,
  rowsToItems,
  rowToItem,
} from '@/components/forms/ingredientRow'
import { parseDecimalInput, percentInputToRate, rateToPercentInput, toDecimalInput } from '@/lib/format'

export { emptyRow } from '@/components/forms/ingredientRow'

const units = ['g', 'kg', 'ml', 'L', 'pz'] as const

const positiveDecimal = (message: string) =>
  z.string().refine((value) => {
    const parsed = parseDecimalInput(value)
    return parsed !== null && Number(parsed) > 0
  }, message)

export const recipeFormSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(200),
  category: z.string().trim().min(1, 'Ingresa la categoría.').max(200),
  isSubrecipe: z.boolean(),
  yieldQty: positiveDecimal('Ingresa un rendimiento mayor que 0.'),
  yieldUnit: z.enum(units),
  portions: positiveDecimal('Ingresa las porciones (mayor que 0).'),
  safetyMargin: z.string().refine((value) => {
    const rate = percentInputToRate(value)
    return rate !== null && Number(rate) <= 1
  }, 'Entre 0 y 100 %.'),
  notes: z.string().trim().max(2000),
  items: ingredientRowsSchema,
  // Objects, not strings: useFieldArray needs them. Blank steps are dropped on save.
  steps: z.array(z.object({ text: z.string().max(1000, 'Máximo 1000 caracteres.') })),
})

export type RecipeFormValues = z.infer<typeof recipeFormSchema>

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
    steps: [],
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
    items: recipe.items.map(rowFromItem),
    steps: recipe.steps.map((text) => ({ text })),
  }
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
  return {
    ...headerFields(values),
    items: values.items.map((row) => rowToItem(row)!),
    steps: values.steps.map((step) => step.text.trim()).filter(Boolean),
  }
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

  const { items, index } = rowsToItems(values.items)
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
    previewIndex: index,
  }
}
