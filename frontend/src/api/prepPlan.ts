import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type PrepPlanIn = Schemas['PrepPlanIn']
export type PrepPlanExportIn = Schemas['PrepPlanExportIn']
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

/** `attachment; filename="x.csv"` → `x.csv`. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  return /filename="([^"]+)"/.exec(header ?? '')?.[1] ?? fallback
}

/** It's a POST (the plan travels in the body), so a plain link can't download it. */
export async function downloadPrepPlanCsv(body: PrepPlanExportIn): Promise<void> {
  const result = await api.POST('/api/prep-plan/export.csv', { body, parseAs: 'blob' })
  const blob = unwrap(result) as Blob
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFromDisposition(result.response.headers.get('content-disposition'), 'badger-plan.csv')
  link.click()
  URL.revokeObjectURL(url)
}
