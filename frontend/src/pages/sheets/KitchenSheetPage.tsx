import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { errorMessage } from '@/api/client'
import { useRecipe, useScaledRecipe } from '@/api/recipes'
import { scaleFromSearch, scaleToQuery } from '@/pages/recipes/kitchenScale'

import { KitchenSheet } from './KitchenSheet'

/** Kitchen sheet route: one recipe, scaled by the URL selection (×1 by default). */
export function KitchenSheetPage() {
  const id = Number(useParams().id)
  const [searchParams] = useSearchParams()
  const selection = scaleFromSearch(searchParams)
  const { data: recipe, isError } = useRecipe(id)
  const scaled = useScaledRecipe(id, scaleToQuery(selection))

  useEffect(() => {
    if (recipe) document.title = `Ficha de cocina · ${recipe.name}`
  }, [recipe])

  if (isError) return <p className="p-8 text-sm text-bad">La receta no existe.</p>
  if (scaled.isError) return <p className="p-8 text-sm text-bad">{errorMessage(scaled.error)}</p>
  if (!recipe || !scaled.data) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>

  return (
    <KitchenSheet
      recipe={recipe}
      scaled={scaled.data}
      selection={selection}
      embedded={searchParams.get('embed') === '1'}
    />
  )
}
