import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => unwrap(await api.GET('/api/health')),
    refetchInterval: 30_000,
    retry: false,
  })
}
