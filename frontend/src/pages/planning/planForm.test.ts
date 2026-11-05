import type { PlannedSupply } from '@/api/prepPlan'

import {
  emptyPlan,
  groupSupplies,
  initialPlan,
  parsePlanParams,
  planToParams,
  planToPayload,
  rememberPlan,
  rowTotal,
} from './planForm'

const plan = (rows: { productId: number | null; target: string; extra: string }[], bufferPercent = '') => ({
  name: '',
  bufferPercent,
  rows,
})

describe('plan URL', () => {
  it('round-trips the form, including accents and empty quantities', () => {
    const values = {
      name: 'Planeación sesión 0',
      bufferPercent: '7,5',
      rows: [
        { productId: 3, target: '20', extra: '5' },
        { productId: 7, target: '10', extra: '' },
      ],
    }
    expect(parsePlanParams(new URLSearchParams(planToParams(values).toString()))).toEqual(values)
  })

  it('leaves rows without a product and blank fields out', () => {
    expect(planToParams(emptyPlan()).toString()).toBe('')
  })

  it('drops malformed items and repeats, and blanks bad quantities', () => {
    const { rows } = parsePlanParams(new URLSearchParams('items=abc,3:20:5,3:1:1,-2:1:1,0:1:1,7:x:2'))
    expect(rows).toEqual([
      { productId: 3, target: '20', extra: '5' },
      { productId: 7, target: '', extra: '2' },
    ])
  })

  it('starts with one empty row when there are no items', () => {
    expect(parsePlanParams(new URLSearchParams()).rows).toEqual(emptyPlan().rows)
  })
})

describe('planToPayload', () => {
  it('builds the request and converts the percent to a rate', () => {
    expect(
      planToPayload(
        plan(
          [
            { productId: 3, target: '20', extra: '5' },
            { productId: null, target: '9', extra: '' },
            { productId: 7, target: '', extra: '2' },
          ],
          '7,5',
        ),
      ),
    ).toEqual({
      buffer_rate: '0.075',
      items: [
        { product_id: 3, target_qty: 20, extra_qty: 5 },
        { product_id: 7, target_qty: 0, extra_qty: 2 },
      ],
    })
  })

  it('treats a blank percent as zero', () => {
    expect(planToPayload(plan([{ productId: 3, target: '1', extra: '' }]))?.buffer_rate).toBe('0')
  })

  it('returns null with nothing to calculate', () => {
    expect(planToPayload(emptyPlan())).toBeNull()
    expect(planToPayload(plan([{ productId: 3, target: '0', extra: '' }]))).toBeNull()
  })

  it.each([
    [{ productId: 3, target: '1,5', extra: '' }, ''],
    [{ productId: 3, target: '1', extra: '-1' }, ''],
    [{ productId: 3, target: '100001', extra: '' }, ''],
    [{ productId: 3, target: '1', extra: '' }, '101'],
    [{ productId: 3, target: '1', extra: '' }, 'mucho'],
  ])('returns null on invalid input %#', (row, percent) => {
    expect(planToPayload(plan([row], percent))).toBeNull()
  })
})

describe('rowTotal', () => {
  it('adds target and additional, blanks count as zero', () => {
    expect(rowTotal({ productId: 3, target: '20', extra: '5' })).toBe(25)
    expect(rowTotal({ productId: 3, target: '', extra: '' })).toBe(0)
  })

  it('is null, never NaN, while a quantity is being typed wrong', () => {
    expect(rowTotal({ productId: 3, target: '1,', extra: '' })).toBeNull()
    expect(rowTotal({ productId: 3, target: '1', extra: 'x' })).toBeNull()
  })
})

describe('initialPlan', () => {
  it('restores the last plan when the URL has none, and the URL wins otherwise', () => {
    rememberPlan(new URLSearchParams('nombre=Sesion+1'))
    expect(initialPlan(new URLSearchParams()).name).toBe('Sesion 1')
    expect(initialPlan(new URLSearchParams('nombre=Otra')).name).toBe('Otra')
    rememberPlan(new URLSearchParams())
    expect(initialPlan(new URLSearchParams()).name).toBe('')
  })
})

describe('groupSupplies', () => {
  it('groups and keeps the incoming order', () => {
    const supply = (name: string, group: string) => ({ name, group }) as PlannedSupply
    const groups = groupSupplies([supply('Caja', 'Desechables'), supply('Sticker', 'Desechables'), supply('Sal', 'Secos')])
    expect(groups.map(([group, rows]) => [group, rows.map((r) => r.name)])).toEqual([
      ['Desechables', ['Caja', 'Sticker']],
      ['Secos', ['Sal']],
    ])
  })
})
