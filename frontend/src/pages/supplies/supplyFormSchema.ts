import { z } from 'zod'

import type { Supply, SupplyCreate, SupplyUpdate } from '@/api/supplies'
import { parseDecimalInput, todayISO } from '@/lib/format'

const units = ['g', 'kg', 'ml', 'L', 'pz'] as const
const equivalenceUnits = ['g', 'kg', 'ml', 'L'] as const

const positiveDecimal = (message: string) =>
  z.string().refine((value) => {
    const parsed = parseDecimalInput(value)
    return parsed !== null && Number(parsed) > 0
  }, message)

const optionalDecimal = (message: string, allowZero: boolean) =>
  z.string().refine((value) => {
    if (!value.trim()) return true
    const parsed = parseDecimalInput(value)
    return parsed !== null && (allowZero ? Number(parsed) >= 0 : Number(parsed) > 0)
  }, message)

export const supplyFormSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(200),
  brand: z.string().trim().max(200),
  group: z.string().trim().min(1, 'Ingresa el grupo.').max(200),
  supplier: z.string().trim().max(200),
  packQty: positiveDecimal('Ingresa una cantidad mayor que 0.'),
  packUnit: z.enum(units),
  active: z.boolean(),
  notes: z.string().trim().max(2000),
  equivalenceQty: optionalDecimal('Ingresa una cantidad mayor que 0.', false),
  equivalenceUnit: z.enum(equivalenceUnits),
  priceAmount: optionalDecimal('Ingresa un monto válido.', true),
  priceDate: z.string(),
})

export type SupplyFormValues = z.infer<typeof supplyFormSchema>

export function emptySupplyForm(): SupplyFormValues {
  return {
    name: '',
    brand: '',
    group: '',
    supplier: '',
    packQty: '',
    packUnit: 'kg',
    active: true,
    notes: '',
    equivalenceQty: '',
    equivalenceUnit: 'g',
    priceAmount: '',
    priceDate: todayISO(),
  }
}

export function supplyToForm(supply: Supply): SupplyFormValues {
  return {
    ...emptySupplyForm(),
    name: supply.name,
    brand: supply.brand ?? '',
    group: supply.group,
    supplier: supply.supplier ?? '',
    packQty: supply.pack_qty,
    packUnit: supply.pack_unit,
    active: supply.active,
    notes: supply.notes ?? '',
    equivalenceQty: supply.equivalence?.quantity ?? '',
    equivalenceUnit: (supply.equivalence?.unit as SupplyFormValues['equivalenceUnit']) ?? 'g',
  }
}

function commonFields(values: SupplyFormValues) {
  const equivalenceQty = parseDecimalInput(values.equivalenceQty)
  return {
    name: values.name,
    brand: values.brand || null,
    group: values.group,
    supplier: values.supplier || null,
    pack_qty: parseDecimalInput(values.packQty)!,
    pack_unit: values.packUnit,
    active: values.active,
    notes: values.notes || null,
    equivalence: equivalenceQty ? { quantity: equivalenceQty, unit: values.equivalenceUnit } : null,
  }
}

export function formToCreate(values: SupplyFormValues): SupplyCreate {
  const amount = parseDecimalInput(values.priceAmount)
  return {
    ...commonFields(values),
    initial_price: amount ? { amount, purchased_on: values.priceDate || todayISO() } : null,
  }
}

export function formToUpdate(values: SupplyFormValues): SupplyUpdate {
  return commonFields(values)
}
