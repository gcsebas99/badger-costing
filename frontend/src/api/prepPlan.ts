import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type PrepPlanIn = Schemas['PrepPlanIn']
export type PrepPlan = Schemas['PrepPlanRead']
export type PlannedRecipe = Schemas['PlannedRecipeRead']
export type PlannedSupply = Schemas['PlannedSupplyRead']

/** Calculated on the server and never stored; `null` while the form isn't ready. */
export function usePrepPlan(payload: PrepPlanIn | null) {
  return useQuery({
    queryKey: ['prep-plan', payload],
    queryFn: async () => unwrap(await api.POST('/api/prep-plan', { body: payload! })),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  })
}
