import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'
import type { paths } from './schema'
import { supplyKeys } from './supplies'

export type RecipeSummary = Schemas['RecipeSummary']
export type RecipeDetail = Schemas['RecipeDetail']
export type RecipeCreate = Schemas['RecipeCreate']
export type RecipeUpdate = Schemas['RecipeUpdate']
export type RecipePreview = Schemas['RecipePreview']
export type RecipeCost = Schemas['RecipeCostRead']
export type ItemCost = Schemas['ItemCostRead']
export type RecipeItemIn = Schemas['RecipeItemIn']
export type IngredientOption = Schemas['IngredientOption']
export type ItemStatus = Schemas['ItemStatus']
export type RecipeScaled = Schemas['RecipeScaledRead']
export type ScaleQuery = NonNullable<
  paths['/api/recipes/{recipe_id}/scaled']['get']['parameters']['query']
>

export interface RecipeFilters {
  q?: string
  category?: string
  is_subrecipe?: boolean
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', 'list', filters] as const,
  detail: (id: number) => ['recipes', 'detail', id] as const,
  facets: ['recipes', 'facets'] as const,
  ingredients: (excludeId: number | null) => ['recipes', 'ingredients', excludeId] as const,
  preview: (payload: RecipePreview) => ['recipes', 'preview', payload] as const,
  scaled: (id: number, query: ScaleQuery) => ['recipes', 'scaled', id, query] as const,
}

export function useRecipes(filters: RecipeFilters) {
  return useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: async () => unwrap(await api.GET('/api/recipes', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: recipeKeys.detail(id ?? 0),
    queryFn: async () =>
      unwrap(await api.GET('/api/recipes/{recipe_id}', { params: { path: { recipe_id: id! } } })),
    enabled: id !== null,
  })
}

export function useRecipeFacets() {
  return useQuery({
    queryKey: recipeKeys.facets,
    queryFn: async () => unwrap(await api.GET('/api/recipes/facets')),
  })
}

export function useIngredientOptions(excludeRecipeId: number | null) {
  return useQuery({
    queryKey: recipeKeys.ingredients(excludeRecipeId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/recipes/ingredients', {
          params: { query: excludeRecipeId ? { exclude_recipe_id: excludeRecipeId } : {} },
        }),
      ),
  })
}

/** Live cost of an unsaved recipe. Pass null while the draft is not costable yet. */
export function useRecipePreview(payload: RecipePreview | null) {
  return useQuery({
    queryKey: recipeKeys.preview(payload ?? ({} as RecipePreview)),
    queryFn: async () => unwrap(await api.POST('/api/recipes/preview', { body: payload! })),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Saved recipe scaled for the kitchen (multiplier or anchor ingredient); nothing is stored. */
export function useScaledRecipe(id: number, query: ScaleQuery | null) {
  return useQuery({
    queryKey: recipeKeys.scaled(id, query ?? {}),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/recipes/{recipe_id}/scaled', {
          params: { path: { recipe_id: id }, query: query! },
        }),
      ),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Recipe changes can affect any recipe cost and supply usage, so refresh both. */
function useRecipeMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipeKeys.all })
      await queryClient.invalidateQueries({ queryKey: supplyKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useCreateRecipe() {
  return useRecipeMutation(async (body: RecipeCreate) =>
    unwrap(await api.POST('/api/recipes', { body })),
  )
}

export function useUpdateRecipe() {
  return useRecipeMutation(async ({ id, body }: { id: number; body: RecipeUpdate }) =>
    unwrap(await api.PATCH('/api/recipes/{recipe_id}', { params: { path: { recipe_id: id } }, body })),
  )
}

export function useDeleteRecipe() {
  return useRecipeMutation(async (id: number) => {
    const { error, response } = await api.DELETE('/api/recipes/{recipe_id}', {
      params: { path: { recipe_id: id } },
    })
    if (error !== undefined || !response.ok) unwrap({ error, response })
  })
}
