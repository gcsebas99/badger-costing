import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type Platform = Schemas['PlatformRead']
export type PlatformIn = Schemas['PlatformIn']
export type PlatformUpdate = Schemas['PlatformUpdate']
export type MenuGroup = Schemas['MenuGroupRead']
export type MenuGroupIn = Schemas['MenuGroupIn']
export type MenuGroupUpdate = Schemas['MenuGroupUpdate']

export const catalogKeys = {
  platforms: ['platforms'] as const,
  menuGroups: ['menu-groups'] as const,
}

export function usePlatforms() {
  return useQuery({
    queryKey: catalogKeys.platforms,
    queryFn: async () => unwrap(await api.GET('/api/platforms')),
  })
}

export function useMenuGroups() {
  return useQuery({
    queryKey: catalogKeys.menuGroups,
    queryFn: async () => unwrap(await api.GET('/api/menu-groups')),
  })
}

/** Platforms and groups change product pricing, so products are refreshed too. */
function useCatalogMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogKeys.platforms })
      await queryClient.invalidateQueries({ queryKey: catalogKeys.menuGroups })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

async function noContent(result: { error?: unknown; response: Response }) {
  if (result.error !== undefined || !result.response.ok) unwrap({ ...result, data: undefined })
}

export function useCreatePlatform() {
  return useCatalogMutation(async (body: PlatformIn) => unwrap(await api.POST('/api/platforms', { body })))
}

export function useUpdatePlatform() {
  return useCatalogMutation(async ({ id, body }: { id: number; body: PlatformUpdate }) =>
    unwrap(await api.PATCH('/api/platforms/{platform_id}', { params: { path: { platform_id: id } }, body })),
  )
}

export function useDeletePlatform() {
  return useCatalogMutation(async (id: number) =>
    noContent(await api.DELETE('/api/platforms/{platform_id}', { params: { path: { platform_id: id } } })),
  )
}

export function useCreateMenuGroup() {
  return useCatalogMutation(async (body: MenuGroupIn) => unwrap(await api.POST('/api/menu-groups', { body })))
}

export function useUpdateMenuGroup() {
  return useCatalogMutation(async ({ id, body }: { id: number; body: MenuGroupUpdate }) =>
    unwrap(await api.PATCH('/api/menu-groups/{group_id}', { params: { path: { group_id: id } }, body })),
  )
}

export function useDeleteMenuGroup() {
  return useCatalogMutation(async (id: number) =>
    noContent(await api.DELETE('/api/menu-groups/{group_id}', { params: { path: { group_id: id } } })),
  )
}
