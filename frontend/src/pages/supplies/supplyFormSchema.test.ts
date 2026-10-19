import type { Supply } from '@/api/supplies'

import {
  emptySupplyForm,
  formToCreate,
  formToUpdate,
  supplyFormSchema,
  supplyToForm,
} from './supplyFormSchema'

const valid = {
  ...emptySupplyForm(),
  name: 'Huevo',
  group: 'Lácteos y huevos',
  packQty: '30',
  packUnit: 'pz' as const,
}

describe('supplyFormSchema', () => {
  it('requires name, group and a positive pack quantity', () => {
    const result = supplyFormSchema.safeParse(emptySupplyForm())
    expect(result.success).toBe(false)
    const fields = result.error!.issues.map((issue) => issue.path[0])
    expect(fields).toEqual(expect.arrayContaining(['name', 'group', 'packQty']))
  })

  it('accepts comma decimals and blank optional numbers', () => {
    expect(supplyFormSchema.safeParse({ ...valid, packQty: '1,36' }).success).toBe(true)
    expect(supplyFormSchema.safeParse({ ...valid, packQty: '0' }).success).toBe(false)
    expect(supplyFormSchema.safeParse({ ...valid, equivalenceQty: '0' }).success).toBe(false)
    expect(supplyFormSchema.safeParse({ ...valid, priceAmount: '0' }).success).toBe(true)
  })
})

describe('form → API payload', () => {
  it('builds a create payload with equivalence and initial price', () => {
    const payload = formToCreate({
      ...valid,
      brand: '',
      equivalenceQty: '50',
      priceAmount: '2.850,5'.replace('.', ''),
      priceDate: '2026-10-18',
    })
    expect(payload).toMatchObject({
      name: 'Huevo',
      brand: null,
      pack_qty: '30',
      pack_unit: 'pz',
      equivalence: { quantity: '50', unit: 'g' },
      initial_price: { amount: '2850.5', purchased_on: '2026-10-18' },
    })
  })

  it('omits empty price and clears the equivalence on update', () => {
    expect(formToCreate(valid).initial_price).toBeNull()
    expect(formToUpdate(valid).equivalence).toBeNull()
  })

  it('round-trips an existing supply', () => {
    const supply = {
      id: 1,
      name: 'Aceite',
      brand: 'Kirkland',
      group: 'Abarrotes',
      supplier: null,
      pack_qty: '6',
      pack_unit: 'L',
      active: false,
      notes: null,
      equivalence: null,
    } as unknown as Supply
    const values = supplyToForm(supply)
    expect(values).toMatchObject({ name: 'Aceite', supplier: '', packQty: '6', active: false })
    expect(formToUpdate(values)).toMatchObject({ supplier: null, pack_qty: '6', active: false })
  })
})
