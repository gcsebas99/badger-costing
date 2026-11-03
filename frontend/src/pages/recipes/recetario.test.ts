import {
  checkState,
  filterRecipes,
  groupByCategory,
  orderedSelection,
  parseRecipeIds,
  recetarioUrl,
  setSelected,
} from './recetario'

const recipes = [
  { id: 4, name: 'Mayo casera', category: 'Bases', is_subrecipe: true },
  { id: 2, name: 'Salsa de la casa', category: 'Bases', is_subrecipe: true },
  { id: 9, name: 'Hamburguesa Clásica', category: 'Platos', is_subrecipe: false },
]

describe('parseRecipeIds', () => {
  it('keeps order and drops duplicates', () => {
    expect(parseRecipeIds('3,7,3,12')).toEqual([3, 7, 12])
  })

  it('drops malformed values', () => {
    expect(parseRecipeIds('3,abc,-1,0,1.5,,7')).toEqual([3, 7])
    expect(parseRecipeIds('')).toEqual([])
    expect(parseRecipeIds(null)).toEqual([])
  })

  it('round-trips through the URL', () => {
    expect(recetarioUrl([3, 7])).toBe('/recetas/recetario?ids=3,7')
    expect(parseRecipeIds(new URL(recetarioUrl([3, 7]), 'http://x').searchParams.get('ids'))).toEqual([3, 7])
  })
})

describe('filterRecipes', () => {
  it('ignores accents and case and needs every word', () => {
    expect(filterRecipes(recipes, 'CLASICA', 'all').map((r) => r.id)).toEqual([9])
    expect(filterRecipes(recipes, 'casa salsa', 'all').map((r) => r.id)).toEqual([2])
    expect(filterRecipes(recipes, 'chipotle', 'all')).toEqual([])
  })

  it('filters by kind', () => {
    expect(filterRecipes(recipes, '', 'sub').map((r) => r.id)).toEqual([4, 2])
    expect(filterRecipes(recipes, '', 'dish').map((r) => r.id)).toEqual([9])
  })
})

describe('selection', () => {
  it('groups by category keeping the order', () => {
    expect(groupByCategory(recipes).map(([name, rows]) => [name, rows.length])).toEqual([['Bases', 2], ['Platos', 1]])
  })

  it('reports none, some and all', () => {
    expect(checkState(new Set(), [4, 2])).toBe(false)
    expect(checkState(new Set([4]), [4, 2])).toBe('indeterminate')
    expect(checkState(new Set([4, 2, 9]), [4, 2])).toBe(true)
    expect(checkState(new Set([4]), [])).toBe(false)
  })

  it('adds and removes only the given ids', () => {
    expect([...setSelected(new Set([9]), [4, 2], true)]).toEqual([9, 4, 2])
    expect([...setSelected(new Set([9, 4]), [4, 2], false)]).toEqual([9])
  })

  it('orders by list position, not click order, and drops ids no longer listed', () => {
    expect(orderedSelection(recipes, new Set([9, 2, 4, 99]))).toEqual([4, 2, 9])
  })
})
