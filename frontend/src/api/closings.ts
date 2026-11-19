import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from './client'

export type ClosingSummary = Schemas['ClosingRead']
export type ClosingDetail = Schemas['ClosingDetail']
export type ClosingIn = Schemas['ClosingIn']
export type ClosingAmountsIn = Schemas['ClosingAmountsIn']
export type ClosingReport = Schemas['ClosingReportRead']
export type ClosingRetention = Schemas['ClosingRetentionRead']
export type Collaborator = Schemas['CollaboratorRead']
export type CollaboratorIn = Schemas['CollaboratorIn']
export type CollaboratorUpdate = Schemas['CollaboratorUpdate']
export type ExpenseType = Schemas['ExpenseTypeRead']
export type ExpenseTypeUpdate = Schemas['ExpenseTypeUpdate']

export const closingKeys = {
  all: ['closings'] as const,
  list: ['closings', 'list'] as const,
  detail: (id: number) => ['closings', 'detail', id] as const,
  retention: ['closings', 'retention'] as const,
  preview: (payload: ClosingAmountsIn | null) => ['closings', 'preview', payload] as const,
  collaborators: ['collaborators'] as const,
  expenseTypes: ['expense-types'] as const,
}

const path = (id: number) => ({ params: { path: { closing_id: id } } })

export function useClosings() {
  return useQuery({
    queryKey: closingKeys.list,
    queryFn: async () => unwrap(await api.GET('/api/closings')),
  })
}

export function useClosing(id: number | null) {
  return useQuery({
    queryKey: closingKeys.detail(id ?? 0),
    queryFn: async () => unwrap(await api.GET('/api/closings/{closing_id}', path(id!))),
    enabled: id !== null,
  })
}

/** Which closings creating a new one would delete (D69). */
export function useClosingRetention(enabled: boolean) {
  return useQuery({
    queryKey: closingKeys.retention,
    queryFn: async () => unwrap(await api.GET('/api/closings/retention')),
    enabled,
    staleTime: 0,
  })
}

/** Live report of the form; never stored. `null` while the form isn't valid. */
export function useClosingPreview(payload: ClosingAmountsIn | null) {
  return useQuery({
    queryKey: closingKeys.preview(payload),
    queryFn: async () => unwrap(await api.POST('/api/closings/preview', { body: payload! })),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  })
}

/** Closings change expense "last amount" and product deletability. */
function useClosingMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: closingKeys.all })
      await queryClient.invalidateQueries({ queryKey: closingKeys.expenseTypes })
    },
  })
}

async function noContent(result: { error?: unknown; response: Response }) {
  if (result.error !== undefined || !result.response.ok) unwrap({ ...result, data: undefined })
}

export function useCreateClosing() {
  return useClosingMutation(async (body: ClosingIn) => unwrap(await api.POST('/api/closings', { body })))
}

export function useUpdateClosing() {
  return useClosingMutation(async ({ id, body }: { id: number; body: ClosingIn }) =>
    unwrap(await api.PUT('/api/closings/{closing_id}', { ...path(id), body })),
  )
}

export function useDeleteClosing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => noContent(await api.DELETE('/api/closings/{closing_id}', path(id))),
    // Refetching the deleted closing would 404 (with retries) and hold up leaving the page.
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({
        queryKey: closingKeys.all,
        predicate: (query) => query.queryKey[1] !== 'detail' || query.queryKey[2] !== id,
      })
      await queryClient.invalidateQueries({ queryKey: closingKeys.expenseTypes })
    },
  })
}

export function useCloseClosing() {
  return useClosingMutation(async (id: number) => unwrap(await api.POST('/api/closings/{closing_id}/close', path(id))))
}

export function useReopenClosing() {
  return useClosingMutation(async (id: number) => unwrap(await api.POST('/api/closings/{closing_id}/reopen', path(id))))
}

export function closingCsvUrl(id: number): string {
  return `/api/closings/${id}/export.csv`
}

export function closingReportUrl(id: number): string {
  return `/cierres/${id}/reporte`
}

// --- Catalogs -------------------------------------------------------------------------------

export function useCollaborators() {
  return useQuery({
    queryKey: closingKeys.collaborators,
    queryFn: async () => unwrap(await api.GET('/api/collaborators')),
  })
}

export function useExpenseTypes() {
  return useQuery({
    queryKey: closingKeys.expenseTypes,
    queryFn: async () => unwrap(await api.GET('/api/expense-types')),
  })
}

function useCatalogMutation<TVariables, TResult>(
  key: readonly string[],
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
      // Closing lines show catalog names (drafts follow renames).
      await queryClient.invalidateQueries({ queryKey: closingKeys.all })
    },
  })
}

const collaboratorPath = (id: number) => ({ params: { path: { collaborator_id: id } } })
const expensePath = (id: number) => ({ params: { path: { expense_type_id: id } } })

export function useCreateCollaborator() {
  return useCatalogMutation(closingKeys.collaborators, async (body: CollaboratorIn) =>
    unwrap(await api.POST('/api/collaborators', { body })),
  )
}

export function useUpdateCollaborator() {
  return useCatalogMutation(closingKeys.collaborators, async ({ id, body }: { id: number; body: CollaboratorUpdate }) =>
    unwrap(await api.PATCH('/api/collaborators/{collaborator_id}', { ...collaboratorPath(id), body })),
  )
}

export function useDeleteCollaborator() {
  return useCatalogMutation(closingKeys.collaborators, async (id: number) =>
    noContent(await api.DELETE('/api/collaborators/{collaborator_id}', collaboratorPath(id))),
  )
}

export function useCreateExpenseType() {
  return useCatalogMutation(closingKeys.expenseTypes, async (name: string) =>
    unwrap(await api.POST('/api/expense-types', { body: { name, active: true } })),
  )
}

export function useUpdateExpenseType() {
  return useCatalogMutation(closingKeys.expenseTypes, async ({ id, body }: { id: number; body: ExpenseTypeUpdate }) =>
    unwrap(await api.PATCH('/api/expense-types/{expense_type_id}', { ...expensePath(id), body })),
  )
}

export function useDeleteExpenseType() {
  return useCatalogMutation(closingKeys.expenseTypes, async (id: number) =>
    noContent(await api.DELETE('/api/expense-types/{expense_type_id}', expensePath(id))),
  )
}
