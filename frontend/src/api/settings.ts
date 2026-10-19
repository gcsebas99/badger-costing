import { useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type AppSettings = Schemas['SettingsRead']

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap(await api.GET('/api/settings')),
  })
}
