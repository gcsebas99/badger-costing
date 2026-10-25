import { kitchenSheetUrl, ONE_BATCH, scaleFromSearch, scaleToQuery, scaleToSearch } from './kitchenScale'

describe('kitchen scale selection', () => {
  it('round-trips a factor through the URL', () => {
    const selection = { mode: 'factor', factor: '0.5' } as const
    expect(scaleFromSearch(scaleToSearch(selection))).toEqual(selection)
    expect(scaleToQuery(selection)).toEqual({ factor: '0.5' })
  })

  it('round-trips an anchor ingredient through the URL', () => {
    const selection = { mode: 'anchor', itemId: 5, quantity: '1.44', unit: 'kg' } as const
    expect(scaleToSearch(selection).toString()).toBe('ingrediente=5&cantidad=1.44&unidad=kg')
    expect(scaleFromSearch(scaleToSearch(selection))).toEqual(selection)
    expect(scaleToQuery(selection)).toEqual({ anchor_item_id: 5, anchor_qty: '1.44', anchor_unit: 'kg' })
  })

  it('falls back to one batch on missing or bad params', () => {
    expect(scaleFromSearch(new URLSearchParams())).toEqual(ONE_BATCH)
    expect(scaleFromSearch(new URLSearchParams('factor=-2'))).toEqual(ONE_BATCH)
    expect(scaleFromSearch(new URLSearchParams('ingrediente=5&cantidad=1&unidad=lb'))).toEqual(ONE_BATCH)
  })

  it('builds the sheet URL', () => {
    expect(kitchenSheetUrl(3, ONE_BATCH)).toBe('/recetas/3/cocina?factor=1')
    expect(kitchenSheetUrl(3, { mode: 'factor', factor: '2' })).toBe('/recetas/3/cocina?factor=2')
  })
})
