import { foldText } from '@/lib/utils'

/** The recipe fields the selection logic needs. */
export interface RecetarioRecipe {
  id: number
  name: string
  category: string
  is_subrecipe: boolean
}

export type KindFilter = 'all' | 'sub' | 'dish'
export type CheckState = boolean | 'indeterminate'

/** `?ids=3,7,12` → [3, 7, 12]: keeps the order, drops duplicates and anything malformed. */
export function parseRecipeIds(raw: string | null): number[] {
  const ids = (raw ?? '')
    .split(',')
    .filter((part) => /^\d+$/.test(part.trim()))
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0)
  return [...new Set(ids)]
}

export function recetarioUrl(ids: number[]): string {
  return `/recetas/recetario?ids=${ids.join(',')}`
}

/** Every search word must appear in the name, ignoring case and accents. */
export function filterRecipes<T extends RecetarioRecipe>(recipes: T[], search: string, kind: KindFilter): T[] {
  const words = foldText(search).split(/\s+/).filter(Boolean)
  return recipes.filter((recipe) => {
    if (kind === 'sub' && !recipe.is_subrecipe) return false
    if (kind === 'dish' && recipe.is_subrecipe) return false
    const name = foldText(recipe.name)
    return words.every((word) => name.includes(word))
  })
}

/** Groups by category, keeping the incoming (API) order. */
export function groupByCategory<T extends RecetarioRecipe>(recipes: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const recipe of recipes) {
    groups.set(recipe.category, [...(groups.get(recipe.category) ?? []), recipe])
  }
  return [...groups.entries()]
}

/** Checkbox state of a group of recipes (a category, or everything visible). */
export function checkState(selected: ReadonlySet<number>, ids: number[]): CheckState {
  const count = ids.filter((id) => selected.has(id)).length
  if (count === 0) return false
  return count === ids.length ? true : 'indeterminate'
}

export function setSelected(selected: ReadonlySet<number>, ids: number[], checked: boolean): Set<number> {
  const next = new Set(selected)
  for (const id of ids) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

/** Selected ids in list order (category, then name), whatever order they were clicked in. */
export function orderedSelection<T extends RecetarioRecipe>(recipes: T[], selected: ReadonlySet<number>): number[] {
  return recipes.filter((recipe) => selected.has(recipe.id)).map((recipe) => recipe.id)
}
