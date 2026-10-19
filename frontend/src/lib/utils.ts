import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Case- and accent-insensitive form for search ("Clásica" → "clasica"). */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** cmdk filter: every search word must appear, ignoring case and accents. */
export function commandFilter(value: string, search: string): number {
  const haystack = foldText(value)
  return foldText(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
    ? 1
    : 0
}
