import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type Supply = Schemas['SupplyRead']
export type SupplyDetail = Schemas['SupplyDetail']
export type SupplyCreate = Schemas['SupplyCreate']
export type SupplyUpdate = Schemas['SupplyUpdate']
export type PriceCreate = Schemas['PriceCreate']
export type Price = Schemas['PriceRead']
export type Unit = Schemas['Unit']

export interface SupplyFilters {
  q?: string
  group?: string
  supplier?: string
  active?: boolean
}

export const supplyKeys = {
  all: ['supplies'] as const,
  list: (filters: SupplyFilters) => ['supplies', 'list', filters] as const,
  detail: (id: number) => ['supplies', 'detail', id] as const,
  facets: ['supplies', 'facets'] as const,
}

export function useSupplies(filters: SupplyFilters) {
  return useQuery({
    queryKey: supplyKeys.list(filters),
    queryFn: async () => unwrap(await api.GET('/api/supplies', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })
}

export function useSupply(id: number | null) {
  return useQuery({
    queryKey: supplyKeys.detail(id ?? 0),
    queryFn: async () =>
      unwrap(await api.GET('/api/supplies/{supply_id}', { params: { path: { supply_id: id! } } })),
    enabled: id !== null,
  })
}

export function useSupplyUsages(id: number | null) {
  return useQuery({
    queryKey: [...supplyKeys.detail(id ?? 0), 'usages'],
    queryFn: async () =>
      unwrap(await api.GET('/api/supplies/{supply_id}/usages', { params: { path: { supply_id: id! } } })),
    enabled: id !== null,
  })
}

export function useSupplyFacets() {
  return useQuery({
    queryKey: supplyKeys.facets,
    queryFn: async () => unwrap(await api.GET('/api/supplies/facets')),
  })
}

/** Every supply mutation refreshes lists, details and facets. */
function useSupplyMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<SupplyDetail | void>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: supplyKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['recipes'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useCreateSupply() {
  return useSupplyMutation(async (body: SupplyCreate) =>
    unwrap(await api.POST('/api/supplies', { body })),
  )
}

export function useUpdateSupply() {
  return useSupplyMutation(async ({ id, body }: { id: number; body: SupplyUpdate }) =>
    unwrap(await api.PATCH('/api/supplies/{supply_id}', { params: { path: { supply_id: id } }, body })),
  )
}

export function useDeleteSupply() {
  return useSupplyMutation(async (id: number) => {
    const { error, response } = await api.DELETE('/api/supplies/{supply_id}', {
      params: { path: { supply_id: id } },
    })
    if (error !== undefined || !response.ok) unwrap({ error, response })
  })
}

export function useAddPrice() {
  return useSupplyMutation(async ({ supplyId, body }: { supplyId: number; body: PriceCreate }) =>
    unwrap(
      await api.POST('/api/supplies/{supply_id}/prices', {
        params: { path: { supply_id: supplyId } },
        body,
      }),
    ),
  )
}

export function useDeletePrice() {
  return useSupplyMutation(async ({ supplyId, priceId }: { supplyId: number; priceId: number }) =>
    unwrap(
      await api.DELETE('/api/supplies/{supply_id}/prices/{price_id}', {
        params: { path: { supply_id: supplyId, price_id: priceId } },
      }),
    ),
  )
}
