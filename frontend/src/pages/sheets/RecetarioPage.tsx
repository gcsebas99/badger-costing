import { useQueries } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import { recipeDetailOptions, scaledRecipeOptions } from '@/api/recipes'
import { notifySheetReady } from '@/lib/printReady'
import { ONE_BATCH, scaleToQuery } from '@/pages/recipes/kitchenScale'
import { parseRecipeIds } from '@/pages/recipes/recetario'

import { KitchenSheet } from './KitchenSheet'
import { SheetToolbar } from './SheetLayout'

/** Several kitchen sheets (×1) in one printable document, each starting on a new page. */
export function RecetarioPage() {
  const [searchParams] = useSearchParams()
  const ids = parseRecipeIds(searchParams.get('ids'))
  const embedded = searchParams.get('embed') === '1'

  const details = useQueries({
    queries: ids.map((id) => ({ ...recipeDetailOptions(id), retry: false })),
  })
  const batches = useQueries({
    queries: ids.map((id) => scaledRecipeOptions(id, scaleToQuery(ONE_BATCH))),
  })

  // Nothing renders until every recipe settled, so a PDF can never come out partial.
  const loading = [...details, ...batches].some((query) => query.isPending)
  const sheets = ids.flatMap((id, index) => {
    const recipe = details[index].data
    const scaled = batches[index].data
    return recipe && scaled ? [{ id, recipe, scaled }] : []
  })
  const failed = ids.flatMap((id, index) =>
    details[index].data && batches[index].data ? [] : [details[index].data?.name ?? `#${id}`],
  )
  const printable = !loading && sheets.length > 0

  useEffect(() => {
    document.title = 'Recetario · Badger Grub'
  }, [])

  useEffect(() => {
    if (embedded && printable) notifySheetReady()
  }, [embedded, printable])

  if (ids.length === 0) return <p className="p-8 text-sm text-muted-foreground">No hay recetas seleccionadas.</p>
  if (loading) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>

  return (
    <>
      {!embedded && (
        <div className="mx-auto max-w-4xl px-8 pt-8 print-hidden">
          <SheetToolbar backTo="/recetas" canPrint={printable} />
        </div>
      )}
      {failed.length > 0 && (
        <p role="alert" className="mx-auto mt-4 max-w-4xl px-8 text-sm font-medium text-bad print-hidden">
          No se pudieron cargar y no saldrán en el recetario: {failed.join(', ')}.
        </p>
      )}
      {/* `not-first` applies among the sheets only: the toolbar and warning stay outside this wrapper. */}
      <div>
        {sheets.map(({ id, recipe, scaled }) => (
          <div
            key={id}
            className="not-first:border-t-4 not-first:border-muted print:not-first:break-before-page print:not-first:border-t-0"
          >
            <KitchenSheet recipe={recipe} scaled={scaled} selection={ONE_BATCH} embedded />
          </div>
        ))}
      </div>
    </>
  )
}
