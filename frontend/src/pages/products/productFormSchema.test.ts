import type { ProductDetail } from '@/api/products'
import { emptyRow } from '@/components/forms/ingredientRow'

import {
  detailToForm,
  emptyProductForm,
  formToCreate,
  formToPreview,
  type ProductFormValues,
  productFormSchema,
} from './productFormSchema'

function filled(): ProductFormValues {
  return {
    ...emptyProductForm(),
    name: 'Hamburguesa clásica',
    menuGroupId: '3',
    recipeId: 9,
    packaging: [{ ...emptyRow(), itemType: 'supply', refId: 4, quantity: '1', unit: 'pz' }],
    directPrice: '4.520'.replace('.', ''),
    platformPrices: { '1': '5650', '2': '' },
    targetCost: '1300,5',
  }
}

describe('productFormSchema', () => {
  it('requires name and menu group', () => {
    const result = productFormSchema.safeParse(emptyProductForm())
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['name', 'menuGroupId']))
  })

  it('rejects invalid prices', () => {
    expect(productFormSchema.safeParse({ ...filled(), directPrice: 'abc' }).success).toBe(false)
    expect(productFormSchema.safeParse(filled()).success).toBe(true)
  })
})

describe('product form → API', () => {
  it('builds the create payload, skipping empty platform prices', () => {
    expect(formToCreate(filled())).toMatchObject({
      menu_group_id: 3,
      recipe_id: 9,
      recipe_portions: '1',
      direct_price: '4520',
      target_cost: '1300.5',
      platform_prices: [{ platform_id: 1, price: '5650' }],
      packaging: [{ item_type: 'supply', ref_id: 4, quantity: '1', unit: 'pz', waste_rate: '0' }],
      items: [],
    })
  })

  it('previews with row index maps', () => {
    const values = filled()
    values.items = [emptyRow()]
    const preview = formToPreview(values)!
    expect(preview.payload.items).toEqual([])
    expect(preview.itemsIndex).toEqual([null])
    expect(preview.packagingIndex).toEqual([0])
    expect(formToPreview({ ...values, recipePortions: '0' })).toBeNull()
  })

  it('loads a product', () => {
    const detail = {
      id: 1, name: 'X', menu_group_id: 3, recipe_id: null, recipe_portions: '1.5', active: true,
      notes: null, direct_price: '4520', target_cost: null, items: [], packaging: [],
      platform_prices: [{ platform_id: 1, price: '5650' }],
    } as unknown as ProductDetail
    expect(detailToForm(detail)).toMatchObject({
      menuGroupId: '3', recipePortions: '1,5', platformPrices: { '1': '5650' }, targetCost: '',
    })
  })
})
