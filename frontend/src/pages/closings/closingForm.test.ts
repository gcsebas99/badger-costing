import { describe, expect, it } from 'vitest'

import type { ClosingDetail } from '@/api/closings'

import {
  closingFormSchema,
  type ClosingFormValues,
  detailToForm,
  emptyClosingForm,
  emptyExpenseRow,
  emptyLaborRow,
  emptyProductRow,
  formToPayload,
  formToPreview,
} from './closingForm'

function form(overrides: Partial<ClosingFormValues> = {}): ClosingFormValues {
  return { ...emptyClosingForm('2026-11-15'), name: 'Sesión 1', ...overrides }
}

describe('closingFormSchema', () => {
  it('accepts an empty closing with a name', () => {
    expect(closingFormSchema.safeParse(form()).success).toBe(true)
  })

  it('requires a name and dates in order', () => {
    const result = closingFormSchema.safeParse(form({ name: ' ', startDate: '2026-11-16' }))
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toContain('name')
    expect(paths).toContain('endDate')
  })

  it('validates amounts, units and hours', () => {
    const result = closingFormSchema.safeParse(
      form({
        billed: 'abc',
        products: [{ productId: 1, units: '2,5' }],
        labor: [{ collaboratorId: 1, name: 'Ana', hours: '0', rate: '2500' }],
      }),
    )
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['billed', 'products.0.units', 'labor.0.hours']))
  })

  it('ignores blank labor and expense rows but flags half-filled ones', () => {
    expect(closingFormSchema.safeParse(form({ labor: [emptyLaborRow()], expenses: [emptyExpenseRow()] })).success).toBe(true)
    const result = closingFormSchema.safeParse(
      form({ labor: [{ ...emptyLaborRow(), hours: '4' }], expenses: [{ ...emptyExpenseRow(), amount: '100' }] }),
    )
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(['labor.0.name', 'expenses.0.name'])
  })
})

describe('formToPreview / formToPayload', () => {
  const values = form({
    billed: '113000,50',
    vat: '13000',
    products: [emptyProductRow(), { productId: 5, units: '12' }, { productId: 7, units: '' }],
    labor: [{ collaboratorId: 2, name: 'Ana', hours: '7,5', rate: '2500' }, emptyLaborRow()],
    expenses: [emptyExpenseRow(), { expenseTypeId: null, name: 'Gas', amount: '' }],
  })

  it('maps rows, decimals and empty amounts', () => {
    const mapped = formToPreview(values)!
    expect(mapped.payload).toEqual({
      billed_amount: '113000.50',
      vat_amount: '13000',
      bank_fee_amount: '0',
      products: [
        { product_id: 5, units: 12 },
        { product_id: 7, units: 0 },
      ],
      labor: [{ collaborator_id: 2, name: 'Ana', hours: '7.5', hourly_rate: '2500' }],
      expenses: [{ expense_type_id: null, name: 'Gas', amount: '0' }],
    })
    expect(mapped.productIndex).toEqual([-1, 0, 1])
    expect(mapped.laborIndex).toEqual([0, -1])
    expect(mapped.expenseIndex).toEqual([-1, 0])
  })

  it('previews without a name but not with an invalid line', () => {
    expect(formToPreview({ ...values, name: '' })).not.toBeNull()
    expect(formToPreview({ ...values, vat: '-1' })).toBeNull()
  })

  it('adds session fields to the saved payload', () => {
    const payload = formToPayload({ ...values, name: ' Sesión 1 ', notes: '  ' })
    expect(payload.name).toBe('Sesión 1')
    expect(payload.notes).toBeNull()
    expect(payload.start_date).toBe('2026-11-15')
  })
})

describe('detailToForm', () => {
  it('round-trips a saved closing', () => {
    const detail = {
      name: 'Sesión 1',
      start_date: '2026-11-14',
      end_date: '2026-11-15',
      notes: null,
      billed_amount: '56500.5',
      vat_amount: '0',
      bank_fee_amount: '1130',
      products: [{ product_id: 5, units: 10 }],
      labor: [{ collaborator_id: null, name: 'Ana', hours: '6.5', hourly_rate: '3000' }],
      expenses: [],
    } as unknown as ClosingDetail
    const values = detailToForm(detail)
    expect(values.billed).toBe('56500,5')
    expect(values.vat).toBe('')
    expect(values.labor[0]).toEqual({ collaboratorId: null, name: 'Ana', hours: '6,5', rate: '3000' })
    expect(values.expenses).toEqual([emptyExpenseRow()])
    expect(formToPayload(values).billed_amount).toBe('56500.5')
  })
})
