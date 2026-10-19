import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type Dashboard = Schemas['DashboardRead']
export type SimulationIn = Schemas['SimulationIn']
export type Simulation = Schemas['SimulationRead']
export type Backup = Schemas['BackupRead']

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => unwrap(await api.GET('/api/dashboard')),
    staleTime: 0, // always fresh when opened: it summarizes everything else
  })
}

export function useSimulation() {
  return useMutation({
    mutationFn: async (body: SimulationIn) => unwrap(await api.POST('/api/simulate', { body })),
  })
}

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: async () => unwrap(await api.GET('/api/backups')),
  })
}

export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/backups')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })
}

export type ExportKind = 'suministros' | 'recetas' | 'productos'

export const exportUrl = (kind: ExportKind) => `/api/export/${kind}.csv`
export const backupUrl = (name: string) => `/api/backups/${encodeURIComponent(name)}`
