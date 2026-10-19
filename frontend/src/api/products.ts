import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type ProductSummary = Schemas['ProductSummary']
export type ProductDetail = Schemas['ProductDetail']
export type ProductCreate = Schemas['ProductCreate']
export type ProductUpdate = Schemas['ProductUpdate']
export type ProductPreview = Schemas['ProductPreview']
export type ProductPricing = Schemas['ProductPricingRead']
export type ProductCost = Schemas['ProductCostRead']
export type ChannelPricing = Schemas['ChannelPricingRead']
export type AlertLevel = Schemas['AlertLevel']

export interface ProductFilters {
  q?: string
  menu_group_id?: number
  active?: boolean
}

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => ['products', 'list', filters] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
  preview: (payload: ProductPreview) => ['products', 'preview', payload] as const,
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async () => unwrap(await api.GET('/api/products', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? 0),
    queryFn: async () =>
      unwrap(await api.GET('/api/products/{product_id}', { params: { path: { product_id: id! } } })),
    enabled: id !== null,
  })
}

export function useProductPreview(payload: ProductPreview | null) {
  return useQuery({
    queryKey: productKeys.preview(payload ?? ({} as ProductPreview)),
    queryFn: async () => unwrap(await api.POST('/api/products/preview', { body: payload! })),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Product changes affect usages shown on recipes and supplies. */
function useProductMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['menu-groups'] })
      await queryClient.invalidateQueries({ queryKey: ['recipes'] })
      await queryClient.invalidateQueries({ queryKey: ['supplies'] })
    },
  })
}

export function useCreateProduct() {
  return useProductMutation(async (body: ProductCreate) => unwrap(await api.POST('/api/products', { body })))
}

export function useUpdateProduct() {
  return useProductMutation(async ({ id, body }: { id: number; body: ProductUpdate }) =>
    unwrap(await api.PATCH('/api/products/{product_id}', { params: { path: { product_id: id } }, body })),
  )
}

export function useDeleteProduct() {
  return useProductMutation(async (id: number) => {
    const { error, response } = await api.DELETE('/api/products/{product_id}', {
      params: { path: { product_id: id } },
    })
    if (error !== undefined || !response.ok) unwrap({ error, response })
  })
}
