import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type SalesPeriod = Schemas['SalesPeriodRead']
export type SalesPeriodDetail = Schemas['SalesPeriodDetail']
export type SalesPeriodIn = Schemas['SalesPeriodIn']
export type SalesEntryIn = Schemas['SalesEntryIn']
export type MenuGroupAnalysis = Schemas['MenuGroupAnalysisRead']
export type MenuItem = Schemas['MenuItemRead']
export type MenuClass = Schemas['MenuClass']

export const salesKeys = {
  all: ['sales'] as const,
  periods: ['sales', 'periods'] as const,
  period: (id: number) => ['sales', 'period', id] as const,
  analysis: (id: number) => ['sales', 'analysis', id] as const,
}

export function useSalesPeriods() {
  return useQuery({
    queryKey: salesKeys.periods,
    queryFn: async () => unwrap(await api.GET('/api/sales-periods')),
  })
}

export function useSalesPeriod(id: number | null) {
  return useQuery({
    queryKey: salesKeys.period(id ?? 0),
    queryFn: async () =>
      unwrap(await api.GET('/api/sales-periods/{period_id}', { params: { path: { period_id: id! } } })),
    enabled: id !== null,
  })
}

export function useMenuEngineering(id: number | null) {
  return useQuery({
    queryKey: salesKeys.analysis(id ?? 0),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/sales-periods/{period_id}/menu-engineering', {
          params: { path: { period_id: id! } },
        }),
      ),
    enabled: id !== null,
    staleTime: 0,
  })
}

function useSalesMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: salesKeys.all }),
  })
}

export function useCreatePeriod() {
  return useSalesMutation(async (body: SalesPeriodIn) => unwrap(await api.POST('/api/sales-periods', { body })))
}

export function useDeletePeriod() {
  return useSalesMutation(async (id: number) => {
    const { error, response } = await api.DELETE('/api/sales-periods/{period_id}', {
      params: { path: { period_id: id } },
    })
    if (error !== undefined || !response.ok) unwrap({ error, response })
  })
}

export function useSaveEntries() {
  return useSalesMutation(async ({ id, entries }: { id: number; entries: SalesEntryIn[] }) =>
    unwrap(
      await api.PUT('/api/sales-periods/{period_id}/entries', {
        params: { path: { period_id: id } },
        body: { entries },
      }),
    ),
  )
}

export function useImportSales() {
  return useSalesMutation(async ({ id, content, replace }: { id: number; content: string; replace: boolean }) =>
    unwrap(
      await api.POST('/api/sales-periods/{period_id}/import', {
        params: { path: { period_id: id } },
        body: { content, replace },
      }),
    ),
  )
}
