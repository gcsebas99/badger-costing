import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type AppSettings = Schemas['SettingsRead']
export type SettingsUpdate = Schemas['SettingsUpdate']

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap(await api.GET('/api/settings')),
  })
}

/** Settings change every computed cost and price, so everything is refetched. */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: SettingsUpdate) => unwrap(await api.PATCH('/api/settings', { body })),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
