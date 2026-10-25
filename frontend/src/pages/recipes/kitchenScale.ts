import type { Schemas } from '@/api/client'

type Unit = Schemas['Unit']

const UNITS: readonly Unit[] = ['g', 'kg', 'ml', 'L', 'pz']

/** How the kitchen sheet scales a recipe. Lives only in the URL / component state, never saved. */
export type ScaleSelection =
  | { mode: 'factor'; factor: string }
  | { mode: 'anchor'; itemId: number; quantity: string; unit: Unit }

export const ONE_BATCH: ScaleSelection = { mode: 'factor', factor: '1' }

/** Query for `GET /api/recipes/{id}/scaled`. */
export function scaleToQuery(selection: ScaleSelection) {
  return selection.mode === 'factor'
    ? { factor: selection.factor }
    : { anchor_item_id: selection.itemId, anchor_qty: selection.quantity, anchor_unit: selection.unit }
}

/** Sheet URL params: `?factor=2` or `?ingrediente=5&cantidad=1.44&unidad=kg`. */
export function scaleToSearch(selection: ScaleSelection): URLSearchParams {
  if (selection.mode === 'factor') return new URLSearchParams({ factor: selection.factor })
  return new URLSearchParams({
    ingrediente: String(selection.itemId),
    cantidad: selection.quantity,
    unidad: selection.unit,
  })
}

/** Inverse of scaleToSearch; anything missing or malformed falls back to one batch. */
export function scaleFromSearch(params: URLSearchParams): ScaleSelection {
  const itemId = Number(params.get('ingrediente'))
  const quantity = params.get('cantidad') ?? ''
  const unit = params.get('unidad') as Unit | null
  if (Number.isInteger(itemId) && itemId > 0 && Number(quantity) > 0 && unit && UNITS.includes(unit)) {
    return { mode: 'anchor', itemId, quantity, unit }
  }
  const factor = params.get('factor') ?? ''
  return Number(factor) > 0 ? { mode: 'factor', factor } : ONE_BATCH
}

export function kitchenSheetUrl(recipeId: number, selection: ScaleSelection): string {
  return `/recetas/${recipeId}/cocina?${scaleToSearch(selection).toString()}`
}
