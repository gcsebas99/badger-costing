import { z } from 'zod'

import type { ClosingAmountsIn, ClosingDetail, ClosingIn } from '@/api/closings'
import { parseDecimalInput, toDecimalInput } from '@/lib/format'

const MAX_UNITS = 100_000

const isUnits = (value: string) => {
  const trimmed = value.trim()
  return !trimmed || (/^\d+$/.test(trimmed) && Number(trimmed) <= MAX_UNITS)
}
const isAmount = (value: string) => !value.trim() || parseDecimalInput(value) !== null
const isPositive = (value: string) => {
  const parsed = parseDecimalInput(value)
  return parsed !== null && Number(parsed) > 0
}

const units = z.string().refine(isUnits, 'Número entero.')
const amount = z.string().refine(isAmount, 'Monto inválido.')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha requerida.')

const productRow = z.object({ productId: z.number().nullable(), units })
const laborRow = z
  .object({ collaboratorId: z.number().nullable(), name: z.string(), hours: z.string(), rate: amount })
  .superRefine((row, ctx) => {
    if (isBlankLabor(row)) return
    if (!row.name.trim()) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Elige un colaborador.' })
    if (!isPositive(row.hours)) ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Mayor que 0.' })
  })
const expenseRow = z
  .object({ expenseTypeId: z.number().nullable(), name: z.string(), amount })
  .superRefine((row, ctx) => {
    if (isBlankExpense(row)) return
    if (!row.name.trim()) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Elige un gasto.' })
  })

/** Lines and amounts: everything the report needs. */
const amountsShape = {
  billed: amount,
  vat: amount,
  bankFee: amount,
  products: z.array(productRow),
  labor: z.array(laborRow),
  expenses: z.array(expenseRow),
}

export const closingAmountsSchema = z.object(amountsShape)

export const closingFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Requerido.').max(200),
    startDate: isoDate,
    endDate: isoDate,
    notes: z.string().max(2000),
    ...amountsShape,
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'Debe ser igual o posterior al inicio.',
  })

export type ClosingFormValues = z.infer<typeof closingFormSchema>
export type ProductRowValues = ClosingFormValues['products'][number]
export type LaborRowValues = ClosingFormValues['labor'][number]
export type ExpenseRowValues = ClosingFormValues['expenses'][number]

export const emptyProductRow = (): ProductRowValues => ({ productId: null, units: '' })
export const emptyLaborRow = (): LaborRowValues => ({ collaboratorId: null, name: '', hours: '', rate: '' })
export const emptyExpenseRow = (): ExpenseRowValues => ({ expenseTypeId: null, name: '', amount: '' })

function isBlankLabor(row: LaborRowValues): boolean {
  return row.collaboratorId === null && !row.name.trim() && !row.hours.trim() && !row.rate.trim()
}

function isBlankExpense(row: ExpenseRowValues): boolean {
  return row.expenseTypeId === null && !row.name.trim() && !row.amount.trim()
}

export function emptyClosingForm(today: string): ClosingFormValues {
  return {
    name: '',
    startDate: today,
    endDate: today,
    notes: '',
    billed: '',
    vat: '',
    bankFee: '',
    products: [emptyProductRow()],
    labor: [emptyLaborRow()],
    expenses: [emptyExpenseRow()],
  }
}

/** "0" stays empty so the placeholder shows; anything else in Spanish style. */
const moneyInput = (value: string) => (Number(value) === 0 ? '' : toDecimalInput(value))

export function detailToForm(detail: ClosingDetail): ClosingFormValues {
  const products = detail.products.map((p) => ({ productId: p.product_id, units: String(p.units) }))
  const labor = detail.labor.map((line) => ({
    collaboratorId: line.collaborator_id ?? null,
    name: line.name,
    hours: toDecimalInput(line.hours),
    rate: toDecimalInput(line.hourly_rate),
  }))
  const expenses = detail.expenses.map((line) => ({
    expenseTypeId: line.expense_type_id ?? null,
    name: line.name,
    amount: toDecimalInput(line.amount),
  }))
  return {
    name: detail.name,
    startDate: detail.start_date,
    endDate: detail.end_date,
    notes: detail.notes ?? '',
    billed: moneyInput(detail.billed_amount),
    vat: moneyInput(detail.vat_amount),
    bankFee: moneyInput(detail.bank_fee_amount),
    products: products.length > 0 ? products : [emptyProductRow()],
    labor: labor.length > 0 ? labor : [emptyLaborRow()],
    expenses: expenses.length > 0 ? expenses : [emptyExpenseRow()],
  }
}

const money = (value: string) => parseDecimalInput(value) ?? '0'

/**
 * Payload lines plus, for each form row, its index in the payload (and so in the report), or -1
 * for empty rows that are left out.
 */
export interface MappedAmounts {
  payload: ClosingAmountsIn
  productIndex: number[]
  laborIndex: number[]
  expenseIndex: number[]
}

function indexMap<T>(rows: T[], keep: (row: T) => boolean): number[] {
  let next = 0
  return rows.map((row) => (keep(row) ? next++ : -1))
}

function mapAmounts(values: Omit<ClosingFormValues, 'name' | 'startDate' | 'endDate' | 'notes'>): MappedAmounts {
  const keepProduct = (row: ProductRowValues) => row.productId !== null
  const keepLabor = (row: LaborRowValues) => !isBlankLabor(row)
  const keepExpense = (row: ExpenseRowValues) => !isBlankExpense(row)
  return {
    payload: {
      billed_amount: money(values.billed),
      vat_amount: money(values.vat),
      bank_fee_amount: money(values.bankFee),
      products: values.products
        .filter(keepProduct)
        .map((row) => ({ product_id: row.productId!, units: Number(row.units.trim() || '0') })),
      labor: values.labor.filter(keepLabor).map((row) => ({
        collaborator_id: row.collaboratorId,
        name: row.name.trim(),
        hours: parseDecimalInput(row.hours)!,
        hourly_rate: money(row.rate),
      })),
      expenses: values.expenses.filter(keepExpense).map((row) => ({
        expense_type_id: row.expenseTypeId,
        name: row.name.trim(),
        amount: money(row.amount),
      })),
    },
    productIndex: indexMap(values.products, keepProduct),
    laborIndex: indexMap(values.labor, keepLabor),
    expenseIndex: indexMap(values.expenses, keepExpense),
  }
}

/** Preview request, or null while a line or amount is invalid (name and dates don't matter). */
export function formToPreview(values: ClosingFormValues): MappedAmounts | null {
  if (!closingAmountsSchema.safeParse(values).success) return null
  return mapAmounts(values)
}

/** Call after the form validated. */
export function formToPayload(values: ClosingFormValues): ClosingIn {
  return {
    name: values.name.trim(),
    start_date: values.startDate,
    end_date: values.endDate,
    notes: values.notes.trim() || null,
    ...mapAmounts(values).payload,
  }
}
