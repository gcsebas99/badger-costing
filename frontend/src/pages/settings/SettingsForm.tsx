import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { errorMessage } from '@/api/client'
import { type AppSettings, useSettings, useUpdateSettings } from '@/api/settings'
import { FormField } from '@/components/forms/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { percentInputToRate, rateToPercentInput } from '@/lib/format'

const percent = (min: number, max: number, message: string) =>
  z.string().refine((value) => {
    const negative = value.trim().startsWith('-')
    const rate = percentInputToRate(value.trim().replace(/^-/, ''))
    if (rate === null) return false
    const n = negative ? -Number(rate) : Number(rate)
    return n >= min && n <= max
  }, message)

const schema = z.object({
  costMode: z.enum(['average_last_3', 'latest']),
  vat: percent(0, 1, 'Entre 0 y 100 %.'),
  bankFee: percent(0, 1, 'Entre 0 y 100 %.'),
  targetFoodCost: percent(0.0001, 1, 'Mayor que 0 y hasta 100 %.'),
  marginAlert: percent(0, 1, 'Entre 0 y 100 %.'),
  deviationUpper: percent(0, 1, 'Entre 0 y 100 %.'),
  deviationLower: percent(-1, 0, 'Entre -100 y 0 %.'),
})
type Values = z.infer<typeof schema>

/** "-0.1" ↔ "-10": rate inputs that may be negative. */
function signedToInput(rate: string): string {
  return rate.startsWith('-') ? `-${rateToPercentInput(rate.slice(1)) || '0'}` : rateToPercentInput(rate) || '0'
}
function signedToRate(value: string): string {
  const negative = value.trim().startsWith('-')
  const rate = percentInputToRate(value.trim().replace(/^-/, '')) ?? '0'
  return negative && rate !== '0' ? `-${rate}` : rate
}

function toValues(s: AppSettings): Values {
  return {
    costMode: s.cost_mode,
    vat: signedToInput(s.vat_rate),
    bankFee: signedToInput(s.bank_fee_rate),
    targetFoodCost: signedToInput(s.target_food_cost_rate),
    marginAlert: signedToInput(s.margin_alert_rate),
    deviationUpper: signedToInput(s.deviation_upper_rate),
    deviationLower: signedToInput(s.deviation_lower_rate),
  }
}

export function SettingsForm() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (settings) reset(toValues(settings))
  }, [settings, reset])

  async function onSubmit(values: Values) {
    try {
      const saved = await update.mutateAsync({
        cost_mode: values.costMode,
        vat_rate: signedToRate(values.vat),
        bank_fee_rate: signedToRate(values.bankFee),
        target_food_cost_rate: signedToRate(values.targetFoodCost),
        margin_alert_rate: signedToRate(values.marginAlert),
        deviation_upper_rate: signedToRate(values.deviationUpper),
        deviation_lower_rate: signedToRate(values.deviationLower),
      })
      reset(toValues(saved))
      toast.success('Ajustes guardados.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const percentField = (name: keyof Omit<Values, 'costMode'>, label: string, hint?: string) => (
    <FormField label={label} htmlFor={name} error={errors[name]?.message} hint={hint}>
      <div className="relative">
        <Input id={name} inputMode="decimal" className="pr-7 text-right tabular-nums" {...register(name)}
          aria-invalid={!!errors[name]} />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
      </div>
    </FormField>
  )

  if (!settings) return <p className="p-4 text-sm text-muted-foreground">Cargando…</p>

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-4">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Impuestos y comisiones</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {percentField('vat', 'IVA')}
          {percentField('bankFee', 'Comisión bancaria', 'Solo en venta directa')}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Objetivos y alertas</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {percentField('targetFoodCost', 'Food cost objetivo', 'Por defecto; cada grupo puede tener el suyo')}
          {percentField('marginAlert', 'Margen mínimo', 'Alerta si el margen baja de esto')}
          {percentField('deviationUpper', 'Desviación superior', 'Alerta si el costo supera el teórico')}
          {percentField('deviationLower', 'Desviación inferior', 'Aviso si el costo queda muy por debajo')}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Costo de suministros</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Costo vigente" htmlFor="costMode">
            <Controller
              control={control}
              name="costMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="costMode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="average_last_3">Promedio de los últimos 3 precios</SelectItem>
                    <SelectItem value="latest">Precio más reciente</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
          Guardar ajustes
        </Button>
      </div>
    </form>
  )
}
