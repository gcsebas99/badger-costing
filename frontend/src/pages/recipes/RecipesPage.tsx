import { ChefHat } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'

import { type RecipeSummary, useRecipeFacets, useRecipes } from '@/api/recipes'
import { EmptyState } from '@/components/layout/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SEARCH_PARAM } from '@/navigation'

import { recipeColumns } from './recipeColumns'

const ALL = '__all__'
type KindFilter = 'all' | 'sub' | 'dish'
const KIND_TO_PARAM: Record<KindFilter, boolean | undefined> = { all: undefined, sub: true, dish: false }

export function RecipesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('categoria')
  const kind = (searchParams.get('tipo') as KindFilter | null) ?? 'all'
  const q = searchParams.get(SEARCH_PARAM) || undefined

  const { data: recipes, isPending, isError } = useRecipes({
    q,
    category: category ?? undefined,
    is_subrecipe: KIND_TO_PARAM[kind],
  })
  const { data: facets } = useRecipeFacets()

  function setParam(key: string, value: string | null) {
    setSearchParams(
      (params) => {
        if (value) params.set(key, value)
        else params.delete(key)
        return params
      },
      { replace: true },
    )
  }

  // Group by manual category, keeping the API's (category, name) order.
  const groups = new Map<string, RecipeSummary[]>()
  for (const recipe of recipes ?? []) {
    groups.set(recipe.category, [...(groups.get(recipe.category) ?? []), recipe])
  }
  const hasFilters = Boolean(q || category || kind !== 'all')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category ?? ALL} onValueChange={(v) => setParam('categoria', v === ALL ? null : v)}>
            <SelectTrigger size="sm" className="w-48" aria-label="Categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Categoría: todas</SelectItem>
              {facets?.categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setParam('tipo', v === 'all' ? null : v)}>
            <SelectTrigger size="sm" className="w-40" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sub">Sub-recetas</SelectItem>
              <SelectItem value="dish">Recetas finales</SelectItem>
            </SelectContent>
          </Select>
          {(category || kind !== 'all') && (
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                setSearchParams(
                  (params) => {
                    params.delete('categoria')
                    params.delete('tipo')
                    return params
                  },
                  { replace: true },
                )
              }
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {recipes ? `${recipes.length} receta${recipes.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {isError ? (
        <p className="rounded-lg border bg-surface-card p-6 text-center text-sm text-bad">
          No se pudieron cargar las recetas.
        </p>
      ) : isPending ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : groups.size === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={hasFilters ? 'Ninguna receta coincide' : 'Aún no hay recetas'}
          description={
            hasFilters
              ? 'Prueba con otros filtros o busca otro nombre.'
              : 'Crea la primera con "Nueva receta". Empieza por las sub-recetas (salsas, bases) para usarlas después.'
          }
        />
      ) : (
        [...groups.entries()].map(([groupName, rows]) => (
          <section key={groupName} className="overflow-hidden rounded-lg border bg-surface-card">
            <h2 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
              {groupName}
              <span className="text-xs font-normal text-muted-foreground">{rows.length}</span>
            </h2>
            <DataTable
              columns={recipeColumns}
              data={rows}
              initialSorting={[{ id: 'name', desc: false }]}
              getRowId={(r) => String(r.id)}
              onRowClick={(r) => navigate(`/recetas/${r.id}`)}
            />
          </section>
        ))
      )}
    </div>
  )
}
