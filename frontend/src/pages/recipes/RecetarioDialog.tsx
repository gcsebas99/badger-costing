import { ArrowLeft, BookOpen, Search } from 'lucide-react'
import { useState } from 'react'

import { useRecipes } from '@/api/recipes'
import { PrintPreviewDialog } from '@/components/PrintPreviewDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  checkState,
  filterRecipes,
  groupByCategory,
  type KindFilter,
  orderedSelection,
  recetarioUrl,
  setSelected,
} from './recetario'

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'sub', label: 'Sub-recetas' },
  { value: 'dish', label: 'Recetas finales' },
]

type Step = 'closed' | 'select' | 'preview'

/** "Recetario" button: choose recipes, then preview and print their kitchen sheets as one document. */
export function RecetarioButton() {
  const [step, setStep] = useState<Step>('closed')
  const [ids, setIds] = useState<number[]>([])
  const close = (open: boolean) => !open && setStep('closed')

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setIds([]) // each opening starts with nothing selected
          setStep('select')
        }}
      >
        <BookOpen />
        Recetario
      </Button>

      <Dialog open={step === 'select'} onOpenChange={close}>
        <DialogContent className="flex h-[85vh] flex-col gap-3 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recetario</DialogTitle>
            <DialogDescription>
              Elige las recetas. Sus fichas para cocina salen en un solo documento, cada una en una página nueva.
            </DialogDescription>
          </DialogHeader>
          {/* Mounted only while open: returning from the preview restores the selection from `ids`. */}
          <RecipeSelection
            initialIds={ids}
            onGenerate={(selection) => {
              setIds(selection)
              setStep('preview')
            }}
          />
        </DialogContent>
      </Dialog>

      <PrintPreviewDialog
        open={step === 'preview'}
        onOpenChange={close}
        title="Recetario"
        description={`${ids.length} receta${ids.length === 1 ? '' : 's'}, cada una en una página nueva.`}
        src={recetarioUrl(ids)}
        waitForReady
        controls={
          <div>
            <Button variant="outline" size="sm" onClick={() => setStep('select')}>
              <ArrowLeft />
              Cambiar selección
            </Button>
          </div>
        }
      />
    </>
  )
}

function RecipeSelection({ initialIds, onGenerate }: {
  initialIds: number[]
  onGenerate: (ids: number[]) => void
}) {
  const { data: recipes, isPending, isError } = useRecipes({})
  const [selected, setSelection] = useState<ReadonlySet<number>>(() => new Set(initialIds))
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')

  const ordered = orderedSelection(recipes ?? [], selected)
  const visible = filterRecipes(recipes ?? [], search, kind)
  const visibleIds = visible.map((recipe) => recipe.id)
  const count = ordered.length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar receta…"
            aria-label="Buscar receta"
            className="pl-8"
          />
        </div>
        <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-md border bg-surface-card p-0.5">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              onClick={() => setKind(option.value)}
              className={cn(
                'h-7 rounded-sm px-2.5 text-xs font-medium transition-colors',
                kind === option.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <Checkbox
            checked={checkState(selected, visibleIds)}
            disabled={visibleIds.length === 0}
            onCheckedChange={(checked) => setSelection(setSelected(selected, visibleIds, checked === true))}
          />
          Seleccionar todas
        </label>
        <Button variant="link" size="sm" className="h-auto p-0" disabled={count === 0} onClick={() => setSelection(new Set())}>
          Limpiar
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {count} seleccionada{count === 1 ? '' : 's'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        {isError ? (
          <p className="p-6 text-center text-sm text-bad">No se pudieron cargar las recetas.</p>
        ) : isPending ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Ninguna receta coincide.</p>
        ) : (
          groupByCategory(visible).map(([category, rows]) => {
            const rowIds = rows.map((recipe) => recipe.id)
            return (
              <section key={category}>
                <label className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted px-3 py-1.5 text-sm font-semibold">
                  <Checkbox
                    checked={checkState(selected, rowIds)}
                    onCheckedChange={(checked) => setSelection(setSelected(selected, rowIds, checked === true))}
                  />
                  {category}
                  <span className="text-xs font-normal text-muted-foreground">{rows.length}</span>
                </label>
                {rows.map((recipe) => (
                  <label
                    key={recipe.id}
                    className={cn(
                      'flex h-9 items-center gap-2 border-b px-3 pl-6 text-sm last:border-b-0 hover:bg-muted/50',
                      selected.has(recipe.id) && 'bg-brand-craft/20',
                    )}
                  >
                    <Checkbox
                      checked={selected.has(recipe.id)}
                      onCheckedChange={(checked) => setSelection(setSelected(selected, [recipe.id], checked === true))}
                    />
                    <span className="truncate">{recipe.name}</span>
                    {recipe.is_subrecipe && <span className="text-xs text-muted-foreground">Sub-receta</span>}
                  </label>
                ))}
              </section>
            )
          })
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" size="sm">Cancelar</Button>
        </DialogClose>
        <Button size="sm" disabled={count === 0} onClick={() => onGenerate(ordered)}>
          Generar recetario
        </Button>
      </DialogFooter>
    </>
  )
}
