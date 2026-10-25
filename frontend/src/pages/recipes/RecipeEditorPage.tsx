import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import {
  useCreateRecipe,
  useDeleteRecipe,
  useIngredientOptions,
  useRecipe,
  useRecipeFacets,
  useRecipePreview,
  useUpdateRecipe,
} from '@/api/recipes'
import { FormField } from '@/components/forms/FormField'
import { IngredientRows } from '@/components/forms/IngredientRows'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { UNITS } from '@/lib/units'

import { CostSummary } from './CostSummary'
import { KitchenTools } from './KitchenTools'
import { PreparationSteps } from './PreparationSteps'
import {
  detailToForm,
  emptyRecipeForm,
  formToCreate,
  formToPreview,
  formToUpdate,
  type RecipeFormValues,
  recipeFormSchema,
} from './recipeFormSchema'

export function RecipeEditorPage() {
  const params = useParams()
  const recipeId = params.id ? Number(params.id) : null
  const isNew = recipeId === null
  const navigate = useNavigate()

  const { data: recipe, isError: notFound } = useRecipe(recipeId)
  const { data: options = [] } = useIngredientOptions(recipeId)
  const { data: facets } = useRecipeFacets()
  const createRecipe = useCreateRecipe()
  const updateRecipe = useUpdateRecipe()
  const deleteRecipe = useDeleteRecipe()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: emptyRecipeForm(),
  })

  useEffect(() => {
    if (recipe) reset(detailToForm(recipe))
  }, [recipe, reset])

  // Live cost: debounce the form, send the costable part to /preview.
  // Debounce a serialized snapshot: useWatch may hand back a new object on every render.
  const snapshot = JSON.stringify(useWatch({ control }))
  const debouncedSnapshot = useDebouncedValue(snapshot, 300)
  const previewRequest = useMemo(
    () => formToPreview(JSON.parse(debouncedSnapshot) as RecipeFormValues, recipeId),
    [debouncedSnapshot, recipeId],
  )
  // Unedited saved recipe: show its stored breakdown right away instead of waiting for a preview.
  const showSaved = !isDirty && recipe !== undefined
  const preview = useRecipePreview(showSaved ? null : (previewRequest?.payload ?? null))
  const isStale = !showSaved && (preview.isFetching || snapshot !== debouncedSnapshot)
  const cost = showSaved ? recipe.cost : previewRequest ? preview.data : undefined
  const previewIndex = showSaved ? recipe.items.map((_, i) => i) : (previewRequest?.previewIndex ?? [])

  // Warn before leaving with unsaved changes (in-app navigation).
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && !isSubmitting && currentLocation.pathname !== nextLocation.pathname,
  )

  async function onSubmit(form: RecipeFormValues) {
    try {
      if (isNew) {
        const created = await createRecipe.mutateAsync(formToCreate(form))
        reset(detailToForm(created))
        toast.success('Receta creada.')
        navigate(`/recetas/${created.id}`, { replace: true })
      } else {
        const updated = await updateRecipe.mutateAsync({ id: recipeId, body: formToUpdate(form) })
        reset(detailToForm(updated))
        toast.success('Receta guardada.')
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function handleDelete() {
    if (recipeId === null) return
    try {
      await deleteRecipe.mutateAsync(recipeId)
      reset(emptyRecipeForm()) // clear dirty state so the blocker lets us leave
      toast.success('Receta eliminada.')
      navigate('/recetas')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirmDelete(false)
    }
  }

  if (notFound) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">La receta no existe.</p>
        <Link to="/recetas" className="text-sm text-primary hover:underline">
          Volver a Recetas
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/recetas">
            <ArrowLeft />
            Recetas
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">
          {isNew ? 'Nueva receta' : (recipe?.name ?? 'Cargando…')}
        </h2>
        {isDirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {!isNew && <KitchenTools recipeId={recipeId} disabled={isDirty} />}
          {!isNew && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/recetas/${recipeId}/ficha`}>
                <FileText />
                Ficha PDF
              </Link>
            </Button>
          )}
          {!isNew && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              Eliminar
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSubmitting || (!isNew && !isDirty)}>
            {isNew ? 'Crear receta' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border bg-surface-card p-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField label="Nombre" htmlFor="name" error={errors.name?.message} className="col-span-2">
                <Input id="name" autoFocus={isNew} {...register('name')} aria-invalid={!!errors.name} />
              </FormField>
              <FormField label="Categoría" htmlFor="category" error={errors.category?.message}>
                <Input id="category" list="recipe-categories" {...register('category')}
                  aria-invalid={!!errors.category} />
                <datalist id="recipe-categories">
                  {facets?.categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </FormField>
              <div className="flex items-end pb-2">
                <Controller
                  control={control}
                  name="isSubrecipe"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      Es sub-receta
                    </label>
                  )}
                />
              </div>

              <FormField label="Rendimiento" htmlFor="yieldQty" error={errors.yieldQty?.message}
                hint="Lo que produce una tanda">
                <div className="flex gap-2">
                  <Input id="yieldQty" inputMode="decimal" className="text-right tabular-nums"
                    {...register('yieldQty')} aria-invalid={!!errors.yieldQty} />
                  <Controller
                    control={control}
                    name="yieldUnit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-20" aria-label="Unidad del rendimiento">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </FormField>
              <FormField label="Porciones" htmlFor="portions" error={errors.portions?.message}>
                <Input id="portions" inputMode="decimal" className="text-right tabular-nums"
                  {...register('portions')} aria-invalid={!!errors.portions} />
              </FormField>
              <FormField label="Margen de seguridad %" htmlFor="safetyMargin"
                error={errors.safetyMargin?.message} hint="Sobre el costo de ingredientes">
                <Input id="safetyMargin" inputMode="decimal" placeholder="0" className="text-right tabular-nums"
                  {...register('safetyMargin')} aria-invalid={!!errors.safetyMargin} />
              </FormField>
              <FormField label="Notas" htmlFor="notes" error={errors.notes?.message}>
                <Textarea id="notes" rows={1} className="min-h-9" {...register('notes')} />
              </FormField>
            </div>
          </section>

          <section className="rounded-lg border bg-surface-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Ingredientes</h3>
            <IngredientRows
              control={control}
              name="items"
              errors={errors.items as never}
              options={options}
              costItems={cost?.items}
              previewIndex={previewIndex}
            />
          </section>

          <section className="rounded-lg border bg-surface-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Preparación</h3>
            <PreparationSteps control={control} register={register} errors={errors.steps} />
          </section>
        </div>

        <CostSummary
          cost={cost}
          isStale={isStale}
          error={preview.isError ? errorMessage(preview.error) : null}
          usedIn={recipe?.used_in ?? []}
        />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{recipe?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>Los cambios de esta receta se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
