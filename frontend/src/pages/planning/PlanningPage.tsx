import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, Eraser, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router'

import { errorMessage } from '@/api/client'
import { usePrepPlan } from '@/api/prepPlan'
import { useProducts } from '@/api/products'
import { FormField } from '@/components/forms/FormField'
import { SearchSelect } from '@/components/forms/SearchSelect'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  emptyPlan,
  emptyPlanRow,
  initialPlan,
  type PlanFormValues,
  planFormSchema,
  planToParams,
  planToPayload,
  rememberPlan,
  rowTotal,
} from './planForm'
import { PlanResults } from './PlanResults'

const quantityClass = 'h-8 text-right tabular-nums'

export function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [defaults] = useState(() => initialPlan(searchParams))
  const { data: products = [], isPending: loadingProducts } = useProducts({ active: true })

  const {
    register,
    control,
    reset,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: defaults,
    mode: 'onChange',
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'rows' })

  const snapshot = JSON.stringify(useWatch({ control }))
  const debouncedSnapshot = useDebouncedValue(snapshot, 300)
  const values = useMemo(() => JSON.parse(snapshot) as PlanFormValues, [snapshot])
  const debounced = useMemo(() => JSON.parse(debouncedSnapshot) as PlanFormValues, [debouncedSnapshot])
  const payload = useMemo(() => planToPayload(debounced), [debounced])
  const plan = usePrepPlan(payload)
  const isStale = plan.isFetching || snapshot !== debouncedSnapshot

  // The URL holds the plan (D60), written after typing stops so it never fights the inputs.
  useEffect(() => {
    const params = planToParams(debounced)
    rememberPlan(params)
    setSearchParams(params, { replace: true })
  }, [debounced, setSearchParams])

  const selectedIds = new Set(values.rows.map((row) => row.productId))
  const options = products.map((p) => ({ value: p.id, label: p.name, group: p.menu_group_name }))
  const allSelected = !loadingProducts && values.rows.length >= products.length
  const hasInvalidField = !planFormSchema.safeParse(debounced).success

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => event.preventDefault()} className="rounded-lg border bg-surface-card">
        <header className="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Planeación de preparación</h2>
            <p className="text-xs text-muted-foreground">
              Estima los productos a preparar y obtén las recetas y suministros necesarios. No se guarda nada.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => reset(emptyPlan())}>
            <Eraser />
            Limpiar
          </Button>
        </header>

        <div className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FormField label="Nombre del reporte" htmlFor="plan-name" error={errors.name?.message}>
              <Input id="plan-name" placeholder="Planeación sesión 0" {...register('name')} />
            </FormField>
            <FormField
              label="Mermas e imprevistos"
              htmlFor="plan-buffer"
              error={errors.bufferPercent?.message}
              hint="Aplica a acompañamientos, salsas y vegetales, y a frutas y verduras usadas directamente en un producto o plato."
            >
              <div className="relative max-w-32">
                <Input
                  id="plan-buffer"
                  inputMode="decimal"
                  placeholder="0"
                  className="pr-7 text-right tabular-nums"
                  {...register('bufferPercent')}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </FormField>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-28 text-right">Objetivo</TableHead>
                  <TableHead className="w-28 text-right">Adicional</TableHead>
                  <TableHead className="w-20 text-right">Total</TableHead>
                  <TableHead className="w-10" aria-label="Quitar" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const row = values.rows[index]
                  const rowErrors = errors.rows?.[index]
                  const total = row ? rowTotal(row) : null
                  return (
                    <TableRow key={field.id} className="hover:bg-transparent">
                      <TableCell className="py-1.5">
                        <Controller
                          control={control}
                          name={`rows.${index}.productId`}
                          render={({ field: select }) => (
                            <SearchSelect
                              options={options.filter((o) => o.value === select.value || !selectedIds.has(o.value))}
                              value={select.value}
                              onChange={select.onChange}
                              placeholder={loadingProducts ? 'Cargando…' : 'Elegir producto…'}
                              searchPlaceholder="Buscar producto…"
                              clearable={false}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="py-1.5 align-top">
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          aria-label="Objetivo"
                          aria-invalid={!!rowErrors?.target}
                          className={quantityClass}
                          {...register(`rows.${index}.target`)}
                        />
                        {rowErrors?.target && <p className="mt-1 text-right text-xs text-bad">{rowErrors.target.message}</p>}
                      </TableCell>
                      <TableCell className="py-1.5 align-top">
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          aria-label="Adicional"
                          aria-invalid={!!rowErrors?.extra}
                          className={quantityClass}
                          {...register(`rows.${index}.extra`)}
                        />
                        {rowErrors?.extra && <p className="mt-1 text-right text-xs text-bad">{rowErrors.extra.message}</p>}
                      </TableCell>
                      <TableCell className="num font-medium">
                        {total === null ? '—' : formatQuantity(total, 0)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar producto"
                          onClick={() => (fields.length === 1 ? replace([emptyPlanRow()]) : remove(index))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <Button type="button" variant="outline" size="sm" disabled={allSelected} onClick={() => append(emptyPlanRow())}>
            <Plus />
            Agregar producto
          </Button>
        </div>
      </form>

      {plan.isError && payload && (
        <p role="alert" className="rounded-lg border border-bad bg-bad/10 px-4 py-3 text-sm">{errorMessage(plan.error)}</p>
      )}
      {!payload && hasInvalidField && (
        <p className="rounded-lg border border-dashed bg-surface-card px-4 py-6 text-center text-sm text-muted-foreground">
          Revisa los campos marcados para ver el resultado.
        </p>
      )}
      {!payload && !hasInvalidField && (
        <EmptyState
          icon={ClipboardList}
          title="Agrega productos al plan"
          description="Elige al menos un producto con cantidad para ver las recetas y suministros necesarios."
        />
      )}
      {payload && plan.data && (
        <div className={cn('transition-opacity', isStale && 'opacity-60')}>
          <PlanResults plan={plan.data} />
        </div>
      )}
    </div>
  )
}
