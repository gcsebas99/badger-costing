import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Copy, FileText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { useMenuGroups, usePlatforms } from '@/api/catalog'
import { errorMessage } from '@/api/client'
import {
  useCloneProduct,
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useProductPreview,
  useUpdateProduct,
} from '@/api/products'
import { useIngredientOptions, useRecipes } from '@/api/recipes'
import { FormField } from '@/components/forms/FormField'
import { IngredientRows } from '@/components/forms/IngredientRows'
import { SearchSelect } from '@/components/forms/SearchSelect'
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
import { formatCRC, formatPercent } from '@/lib/format'

import { PricingPanel } from './PricingPanel'
import {
  detailToForm,
  emptyProductForm,
  formToCreate,
  formToPreview,
  formToUpdate,
  type ProductFormValues,
  productFormSchema,
} from './productFormSchema'

export function ProductEditorPage() {
  const params = useParams()
  const productId = params.id ? Number(params.id) : null
  const isNew = productId === null
  const navigate = useNavigate()

  const { data: product, isError: notFound } = useProduct(productId)
  const { data: groups = [] } = useMenuGroups()
  const { data: platforms = [] } = usePlatforms()
  const { data: recipes = [] } = useRecipes({})
  const { data: options = [] } = useIngredientOptions(null)
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const cloneProduct = useCloneProduct()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyProductForm(),
  })

  useEffect(() => {
    if (product) reset(detailToForm(product))
  }, [product, reset])

  // Live pricing (same pattern as the recipe editor).
  const snapshot = JSON.stringify(useWatch({ control }))
  const debouncedSnapshot = useDebouncedValue(snapshot, 300)
  const previewRequest = useMemo(
    () => formToPreview(JSON.parse(debouncedSnapshot) as ProductFormValues),
    [debouncedSnapshot],
  )
  const showSaved = !isDirty && product !== undefined
  const preview = useProductPreview(showSaved ? null : (previewRequest?.payload ?? null))
  const pricing = showSaved ? product.pricing : previewRequest ? preview.data : undefined
  const isStale = !showSaved && (preview.isFetching || snapshot !== debouncedSnapshot)
  const itemsIndex = showSaved ? product.items.map((_, i) => i) : (previewRequest?.itemsIndex ?? [])
  const packagingIndex = showSaved ? product.packaging.map((_, i) => i) : (previewRequest?.packagingIndex ?? [])

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && !isSubmitting && currentLocation.pathname !== nextLocation.pathname,
  )

  const recipeOptions = recipes.map((r) => ({
    value: r.id,
    label: r.name,
    detail: `${formatCRC(r.cost_per_portion)} / porción`,
    group: r.is_subrecipe ? 'Sub-recetas' : r.category,
  }))
  // Platforms shown in the price section: active ones, plus inactive ones that already have a price.
  const savedPlatformIds = new Set(product?.platform_prices.map((p) => p.platform_id) ?? [])
  const priceablePlatforms = platforms.filter((p) => p.active || savedPlatformIds.has(p.id))

  async function onSubmit(values: ProductFormValues) {
    try {
      if (isNew) {
        const created = await createProduct.mutateAsync(formToCreate(values))
        reset(detailToForm(created))
        toast.success('Producto creado.')
        navigate(`/productos/${created.id}`, { replace: true })
      } else {
        const updated = await updateProduct.mutateAsync({ id: productId, body: formToUpdate(values) })
        reset(detailToForm(updated))
        toast.success('Producto guardado.')
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function handleClone() {
    if (productId === null) return
    try {
      const clone = await cloneProduct.mutateAsync(productId)
      toast.success('Producto clonado.')
      navigate(`/productos/${clone.id}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function handleDelete() {
    if (productId === null) return
    try {
      await deleteProduct.mutateAsync(productId)
      reset(emptyProductForm())
      toast.success('Producto eliminado.')
      navigate('/productos')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirmDelete(false)
    }
  }

  if (notFound) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">El producto no existe.</p>
        <Link to="/productos" className="text-sm text-primary hover:underline">
          Volver a Productos
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/productos">
            <ArrowLeft />
            Productos
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{isNew ? 'Nuevo producto' : (product?.name ?? 'Cargando…')}</h2>
        {isDirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
        <div className="ml-auto flex gap-2">
          {!isNew && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/productos/${productId}/ficha`}>
                <FileText />
                Ficha PDF
              </Link>
            </Button>
          )}
          {!isNew && (
            <Button type="button" variant="outline" size="sm" onClick={handleClone}
              disabled={isDirty || cloneProduct.isPending}
              title={isDirty ? 'Guarda los cambios antes de clonar' : undefined}>
              <Copy />
              Clonar producto
            </Button>
          )}
          {!isNew && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              Eliminar
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSubmitting || (!isNew && !isDirty)}>
            {isNew ? 'Crear producto' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border bg-surface-card p-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField label="Nombre" htmlFor="name" error={errors.name?.message} className="col-span-2">
                <Input id="name" autoFocus={isNew} {...register('name')} aria-invalid={!!errors.name} />
              </FormField>
              <FormField
                label="Grupo del menú"
                htmlFor="menuGroupId"
                error={errors.menuGroupId?.message}
                hint={groups.length === 0 ? 'Crea grupos en Ajustes.' : undefined}
              >
                <Controller
                  control={control}
                  name="menuGroupId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="menuGroupId" className="w-full" aria-invalid={!!errors.menuGroupId}>
                        <SelectValue placeholder="Elegir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <div className="flex items-end pb-2">
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      Activo
                    </label>
                  )}
                />
              </div>
              <FormField label="Receta principal" htmlFor="recipeId" className="col-span-2"
                hint="Opcional: un refresco o un extra pueden ir solo con componentes.">
                <Controller
                  control={control}
                  name="recipeId"
                  render={({ field }) => (
                    <SearchSelect id="recipeId" options={recipeOptions} value={field.value}
                      onChange={field.onChange} placeholder="Elegir receta…" searchPlaceholder="Buscar receta…" />
                  )}
                />
              </FormField>
              <FormField label="Porciones de la receta" htmlFor="recipePortions" error={errors.recipePortions?.message}>
                <Input id="recipePortions" inputMode="decimal" className="text-right tabular-nums"
                  {...register('recipePortions')} aria-invalid={!!errors.recipePortions} />
              </FormField>
              <FormField label="Notas" htmlFor="notes">
                <Textarea id="notes" rows={1} className="min-h-9" {...register('notes')} />
              </FormField>
            </div>
          </section>

          <section className="rounded-lg border bg-surface-card p-4">
            <h3 className="mb-1 text-sm font-semibold">Componentes directos</h3>
            <p className="mb-3 text-xs text-muted-foreground">Lo que se agrega fuera de la receta: salsas en vasito, extras, bebidas.</p>
            <IngredientRows control={control} name="items" errors={errors.items as never} options={options}
              costItems={pricing?.cost.items} previewIndex={itemsIndex}
              addLabel="Agregar componente" emptyMessage="Sin componentes." />
          </section>

          <section className="rounded-lg border bg-surface-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Empaque</h3>
            <IngredientRows control={control} name="packaging" errors={errors.packaging as never} options={options}
              costItems={pricing?.cost.packaging} previewIndex={packagingIndex}
              addLabel="Agregar empaque" emptyMessage="Sin empaque." />
          </section>

          <section className="rounded-lg border bg-surface-card p-4">
            <h3 className="mb-1 text-sm font-semibold">Precios de venta (PVP con IVA)</h3>
            <p className="mb-3 text-xs text-muted-foreground">Deja vacío un canal donde no se vende.</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <PriceField id="directPrice" label="Venta directa" error={errors.directPrice?.message}
                input={<Input id="directPrice" inputMode="decimal" className="pl-7 text-right tabular-nums"
                  {...register('directPrice')} aria-invalid={!!errors.directPrice} />} />
              {priceablePlatforms.map((platform) => (
                <PriceField key={platform.id} id={`platform-${platform.id}`}
                  label={`${platform.name} (${formatPercent(platform.fee_rate, 0)})${platform.active ? '' : ' · inactiva'}`}
                  error={errors.platformPrices?.[String(platform.id)]?.message}
                  input={<Input id={`platform-${platform.id}`} inputMode="decimal" className="pl-7 text-right tabular-nums"
                    {...register(`platformPrices.${platform.id}`)} />} />
              ))}
              <PriceField id="targetCost" label="Costo teórico" error={errors.targetCost?.message}
                hint="Para la alerta de desviación"
                input={<Input id="targetCost" inputMode="decimal" className="pl-7 text-right tabular-nums"
                  {...register('targetCost')} aria-invalid={!!errors.targetCost} />} />
            </div>
            {platforms.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                ¿Vendes por delivery? Agrega las plataformas en{' '}
                <Link to="/ajustes" className="text-primary hover:underline">Ajustes</Link>.
              </p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PricingPanel pricing={pricing} isStale={isStale}
            error={!showSaved && preview.isError ? errorMessage(preview.error) : null} />
        </aside>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{product?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>Los cambios de este producto se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>Salir sin guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

function PriceField({ id, label, error, hint, input }: {
  id: string; label: string; error?: string; hint?: string; input: React.ReactNode
}) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
        {input}
      </div>
    </FormField>
  )
}
