import type { RecipeDetail } from '@/api/recipes'

import {
  detailToForm,
  emptyRecipeForm,
  emptyRow,
  formToCreate,
  formToPreview,
  type RecipeFormValues,
  recipeFormSchema,
} from './recipeFormSchema'

function filled(): RecipeFormValues {
  return {
    ...emptyRecipeForm(),
    name: 'Mayo casera',
    category: 'Salsas',
    isSubrecipe: true,
    yieldQty: '600',
    yieldUnit: 'g',
    portions: '20',
    safetyMargin: '5',
    items: [
      { ...emptyRow(), itemType: 'supply', refId: 1, quantity: '3', unit: 'pz', waste: '' },
      { ...emptyRow(), itemType: 'supply', refId: 2, quantity: '0,5', unit: 'L', waste: '13' },
    ],
  }
}

describe('recipeFormSchema', () => {
  it('accepts a complete recipe', () => {
    expect(recipeFormSchema.safeParse(filled()).success).toBe(true)
  })

  it('flags rows without ingredient or unit', () => {
    const result = recipeFormSchema.safeParse({ ...filled(), items: [emptyRow()] })
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['items.0.refId', 'items.0.unit', 'items.0.quantity']))
  })

  it('limits the safety margin to 100 %', () => {
    expect(recipeFormSchema.safeParse({ ...filled(), safetyMargin: '150' }).success).toBe(false)
  })
})

describe('form → API', () => {
  it('converts percents to rates and commas to dots', () => {
    const payload = formToCreate(filled())
    expect(payload).toMatchObject({ yield_qty: '600', portions: '20', safety_margin_rate: '0.05' })
    expect(payload.items).toEqual([
      { item_type: 'supply', ref_id: 1, quantity: '3', unit: 'pz', waste_rate: '0' },
      { item_type: 'supply', ref_id: 2, quantity: '0.5', unit: 'L', waste_rate: '0.13' },
    ])
  })

  it('previews only costable rows and maps row indexes', () => {
    const values = filled()
    values.items.splice(1, 0, emptyRow())
    const preview = formToPreview(values, 7)!
    expect(preview.payload.id).toBe(7)
    expect(preview.payload.items).toHaveLength(2)
    expect(preview.previewIndex).toEqual([0, null, 1])
  })

  it('returns no preview until yield and portions are valid', () => {
    expect(formToPreview({ ...filled(), yieldQty: '' }, null)).toBeNull()
    expect(formToPreview({ ...filled(), portions: '0' }, null)).toBeNull()
  })

  it('loads an existing recipe into the form', () => {
    const detail = {
      id: 7, name: 'Mayo', category: 'Salsas', is_subrecipe: true, yield_qty: '600',
      yield_unit: 'g', portions: '20', safety_margin_rate: '0.05', notes: null,
      items: [{ id: 1, position: 0, item_type: 'recipe', ref_id: 3, quantity: '300', unit: 'g',
                waste_rate: '0.1' }],
    } as unknown as RecipeDetail
    const values = detailToForm(detail)
    expect(values).toMatchObject({ safetyMargin: '5', isSubrecipe: true })
    expect(values.items[0]).toMatchObject({ itemType: 'recipe', refId: 3, waste: '10' })
  })
})
