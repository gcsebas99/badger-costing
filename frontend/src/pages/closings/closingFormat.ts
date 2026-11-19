import { formatDate } from '@/lib/format'

/** "14/11/2026 – 15/11/2026", or a single date when both are the same day. */
export function dateRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

/** Positive profit (or difference) in green, negative in red. */
export function profitClass(value: string | null | undefined): string {
  const n = Number(value ?? 0)
  return n > 0 ? 'text-ok' : n < 0 ? 'text-bad' : ''
}
