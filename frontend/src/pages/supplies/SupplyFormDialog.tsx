import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import { type Supply, useCreateSupply, useSupplyFacets, useUpdateSupply } from '@/api/supplies'
import { FormField } from '@/components/forms/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EQUIVALENCE_UNITS, UNITS } from '@/lib/units'

import {
  emptySupplyForm,
  formToCreate,
  formToUpdate,
  type SupplyFormValues,
  supplyFormSchema,
  supplyToForm,
} from './supplyFormSchema'

interface SupplyFormDialogProps {
  open: boolean
  /** Supply to edit; null to create a new one. */
  supply: Supply | null
  onOpenChange: (open: boolean) => void
  onSaved?: (supply: Supply) => void
}

export function SupplyFormDialog({ open, supply, onOpenChange, onSaved }: SupplyFormDialogProps) {
  const isEdit = supply !== null
  const { data: facets } = useSupplyFacets()
  const createSupply = useCreateSupply()
  const updateSupply = useUpdateSupply()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplyFormValues>({
    resolver: zodResolver(supplyFormSchema),
    defaultValues: emptySupplyForm(),
  })

  useEffect(() => {
    if (open) reset(supply ? supplyToForm(supply) : emptySupplyForm())
  }, [open, supply, reset])

  const packUnit = useWatch({ control, name: 'packUnit' })

  async function onSubmit(values: SupplyFormValues) {
    try {
      const saved = isEdit
        ? await updateSupply.mutateAsync({ id: supply.id, body: formToUpdate(values) })
        : await createSupply.mutateAsync(formToCreate(values))
      toast.success(isEdit ? 'Suministro actualizado.' : 'Suministro creado.')
      onOpenChange(false)
      if (saved) onSaved?.(saved)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar suministro' : 'Nuevo suministro'}</DialogTitle>
          <DialogDescription>
            El precio se registra por empaque; el costo unitario se calcula solo.
          </DialogDescription>
        </DialogHeader>

        <form id="supply-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <FormField label="Nombre" htmlFor="name" error={errors.name?.message}>
            <Input id="name" autoFocus {...register('name')} aria-invalid={!!errors.name} />
          </FormField>
          <FormField label="Marca" htmlFor="brand" error={errors.brand?.message}>
            <Input id="brand" {...register('brand')} />
          </FormField>

          <FormField label="Grupo" htmlFor="group" error={errors.group?.message}>
            <Input id="group" list="supply-groups" {...register('group')} aria-invalid={!!errors.group} />
            <datalist id="supply-groups">
              {facets?.groups.map((group) => <option key={group} value={group} />)}
            </datalist>
          </FormField>
          <FormField label="Proveedor" htmlFor="supplier" error={errors.supplier?.message}>
            <Input id="supplier" list="supply-suppliers" {...register('supplier')} />
            <datalist id="supply-suppliers">
              {facets?.suppliers.map((supplier) => <option key={supplier} value={supplier} />)}
            </datalist>
          </FormField>

          <FormField
            label="Cantidad por empaque"
            htmlFor="packQty"
            error={errors.packQty?.message}
            hint="Ej.: 6 L, 1,36 kg, 24 pz"
          >
            <div className="flex gap-2">
              <Input
                id="packQty"
                inputMode="decimal"
                className="text-right tabular-nums"
                {...register('packQty')}
                aria-invalid={!!errors.packQty}
              />
              <Controller
                control={control}
                name="packUnit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-40" aria-label="Unidad del empaque">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </FormField>

          <FormField
            label="Equivalencia por pieza (opcional)"
            htmlFor="equivalenceQty"
            error={errors.equivalenceQty?.message}
            hint={
              packUnit === 'pz'
                ? 'Necesaria si una receta lo usa en g o ml (ej. 1 huevo = 50 g).'
                : 'Necesaria si una receta lo usa en piezas (ej. 1 diente = 5 g).'
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-nowrap text-muted-foreground">1 pz =</span>
              <Input
                id="equivalenceQty"
                inputMode="decimal"
                className="text-right tabular-nums"
                {...register('equivalenceQty')}
                aria-invalid={!!errors.equivalenceQty}
              />
              <Controller
                control={control}
                name="equivalenceUnit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-24" aria-label="Unidad de la equivalencia">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIVALENCE_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </FormField>

          {!isEdit && (
            <>
              <FormField
                label="Precio del empaque (₡)"
                htmlFor="priceAmount"
                error={errors.priceAmount?.message}
                hint="Opcional; puedes agregarlo después."
              >
                <Input
                  id="priceAmount"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  {...register('priceAmount')}
                  aria-invalid={!!errors.priceAmount}
                />
              </FormField>
              <FormField label="Fecha de compra" htmlFor="priceDate">
                <Input id="priceDate" type="date" {...register('priceDate')} />
              </FormField>
            </>
          )}

          <FormField label="Notas" htmlFor="notes" className="col-span-2" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </FormField>

          {isEdit && (
            <div className="col-span-2 flex items-center gap-2">
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <label htmlFor="active" className="text-sm">
                Activo
              </label>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="supply-form" disabled={isSubmitting}>
            {isEdit ? 'Guardar cambios' : 'Crear suministro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
