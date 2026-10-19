import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
} from '@tanstack/react-table'

/** Shared feature set for app tables: client-side sorting. */
export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
})

export type AppTableFeatures = typeof tableFeatureSet

export function appColumnHelper<TData>() {
  return createColumnHelper<AppTableFeatures, TData>()
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

/** Spanish-aware text comparison (accents and case ignored). */
export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return collator.compare(a ?? '', b ?? '')
}
