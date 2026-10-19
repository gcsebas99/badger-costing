import createClient from 'openapi-fetch'

import type { components, paths } from './schema'

/** Typed API client. Paths already include the `/api` prefix; Vite proxies it in dev. */
export const api = createClient<paths>({ baseUrl: '' })

export type Schemas = components['schemas']

/** Unwrap an openapi-fetch result: return data or throw so TanStack Query sees the error. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiError(result.response.status, result.error)
  }
  return result.data
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`API error ${status}`)
    this.status = status
    this.detail = detail
  }
}

/** Human-readable (Spanish) message from an API/network error, for toasts. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = (error.detail as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string }
      return first.msg ?? 'Datos inválidos.'
    }
    return `Error del servidor (${error.status}).`
  }
  return 'No se pudo conectar con la API.'
}
