import { z } from 'zod'

import type { PlannedSupply, PrepPlanIn } from '@/api/prepPlan'
import { percentInputToRate } from '@/lib/format'

const MAX_QUANTITY = 100_000

function isQuantity(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || (/^\d+$/.test(trimmed) && Number(trimmed) <= MAX_QUANTITY)
}

const quantity = z.string().refine(isQuantity, 'Número entero.')

export const planFormSchema = z.object({
  name: z.string().max(200),
  bufferPercent: z.string().refine((value) => {
    const rate = percentInputToRate(value)
    return rate !== null && Number(rate) <= 1
  }, 'Entre 0 y 100.'),
  rows: z.array(z.object({ productId: z.number().nullable(), target: quantity, extra: quantity })),
})

export type PlanFormValues = z.infer<typeof planFormSchema>
export type PlanRowValues = PlanFormValues['rows'][number]

export function emptyPlanRow(): PlanRowValues {
  return { productId: null, target: '', extra: '' }
}

export function emptyPlan(): PlanFormValues {
  return { name: '', bufferPercent: '', rows: [emptyPlanRow()] }
}

const digitsOnly = (value: string | undefined) => (value && /^\d+$/.test(value) ? value : '')

/** `?nombre=…&merma=10&items=3:20:5,7:10:` → form values. Malformed items and repeats are dropped. */
export function parsePlanParams(params: URLSearchParams): PlanFormValues {
  const seen = new Set<number>()
  const rows: PlanRowValues[] = []
  for (const part of (params.get('items') ?? '').split(',')) {
    const [id, target, extra] = part.split(':')
    const productId = Number(digitsOnly(id))
    if (!Number.isSafeInteger(productId) || productId <= 0 || seen.has(productId)) continue
    seen.add(productId)
    rows.push({ productId, target: digitsOnly(target), extra: digitsOnly(extra) })
  }
  return {
    name: params.get('nombre') ?? '',
    bufferPercent: params.get('merma') ?? '',
    rows: rows.length > 0 ? rows : [emptyPlanRow()],
  }
}

/** Rows without a product stay out of the URL. */
export function planToParams(values: PlanFormValues): URLSearchParams {
  const params = new URLSearchParams()
  if (values.name.trim()) params.set('nombre', values.name.trim())
  if (values.bufferPercent.trim()) params.set('merma', values.bufferPercent.trim())
  const items = values.rows
    .filter((row) => row.productId !== null)
    .map((row) => `${row.productId}:${row.target.trim()}:${row.extra.trim()}`)
  if (items.length > 0) params.set('items', items.join(','))
  return params
}

/** API request, or null when there's nothing valid to calculate yet. */
export function planToPayload(values: PlanFormValues): PrepPlanIn | null {
  if (!planFormSchema.safeParse(values).success) return null
  const items = values.rows.flatMap((row) =>
    row.productId === null
      ? []
      : [{ product_id: row.productId, target_qty: Number(row.target), extra_qty: Number(row.extra) }],
  )
  if (!items.some((item) => item.target_qty + item.extra_qty > 0)) return null
  return { buffer_rate: percentInputToRate(values.bufferPercent)!, items }
}

/** Target + additional, or null while either is invalid (validation errors arrive a moment later). */
export function rowTotal(row: PlanRowValues): number | null {
  return isQuantity(row.target) && isQuantity(row.extra) ? Number(row.target) + Number(row.extra) : null
}

/** Groups by supply group, keeping the incoming (API) order. */
export function groupSupplies(supplies: PlannedSupply[]): [string, PlannedSupply[]][] {
  const groups = new Map<string, PlannedSupply[]>()
  for (const supply of supplies) {
    groups.set(supply.group, [...(groups.get(supply.group) ?? []), supply])
  }
  return [...groups.entries()]
}

// The sidebar link has no params: this brings the plan back after visiting another section.
// In memory only, the plan isn't stored anywhere.
let lastPlanSearch = ''

export function rememberPlan(params: URLSearchParams): void {
  lastPlanSearch = params.toString()
}

export function initialPlan(params: URLSearchParams): PlanFormValues {
  return parsePlanParams(params.size > 0 ? params : new URLSearchParams(lastPlanSearch))
}
