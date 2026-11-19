import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Download, Lock, LockOpen, Printer, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import {
  closingCsvUrl,
  closingReportUrl,
  useClosing,
  useClosingPreview,
  useClosingRetention,
  useCloseClosing,
  useCreateClosing,
  useDeleteClosing,
  useReopenClosing,
  useUpdateClosing,
} from '@/api/closings'
import { errorMessage } from '@/api/client'
import { useProducts } from '@/api/products'
import { FormField } from '@/components/forms/FormField'
import { PrintPreviewDialog } from '@/components/PrintPreviewDialog'
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
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatCRC, formatDate, roundDecimal, todayISO, toDecimalInput } from '@/lib/format'

import { ExpenseLines, LaborLines, MoneyInput, ProductLines } from './ClosingLines'
import { dateRange } from './closingFormat'
import { ClosingStatusBadge } from './ClosingsPage'
import { ClosingSummary } from './ClosingSummary'
import {
  type ClosingFormValues,
  closingFormSchema,
  detailToForm,
  emptyClosingForm,
  formToPayload,
  formToPreview,
} from './closingForm'

const SAVED = 'saved'

type Confirm = 'delete' | 'close' | 'reopen' | 'retention' | null

export function ClosingEditorPage() {
  const params = useParams()
  const closingId = params.id ? Number(params.id) : null
  const isNew = closingId === null
  const navigate = useNavigate()

  const { data: closing, isError: notFound } = useClosing(closingId)
  const { data: products = [] } = useProducts({})
  const retention = useClosingRetention(isNew)
  const createClosing = useCreateClosing()
  const updateClosing = useUpdateClosing()
  const deleteClosing = useDeleteClosing()
  const closeClosing = useCloseClosing()
  const reopenClosing = useReopenClosing()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pending, setPending] = useState<ClosingFormValues | null>(null)
  const [printing, setPrinting] = useState(false)

  const form = useForm<ClosingFormValues>({
    resolver: zodResolver(closingFormSchema),
    defaultValues: emptyClosingForm(todayISO()),
  })
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty, isSubmitting } } = form

  useEffect(() => {
    if (closing) reset(detailToForm(closing))
  }, [closing, reset])

  const readOnly = closing?.status === 'closed'
  const snapshot = JSON.stringify(useWatch({ control }))
  const debouncedSnapshot = useDebouncedValue(snapshot, 300)
  const mapping = useMemo(
    () => formToPreview(JSON.parse(debouncedSnapshot) as ClosingFormValues),
    [debouncedSnapshot],
  )
  const showSaved = !isDirty && closing !== undefined
  const preview = useClosingPreview(showSaved ? null : (mapping?.payload ?? null))
  const report = showSaved ? closing.report : mapping ? preview.data : undefined
  const isStale = !showSaved && (preview.isFetching || snapshot !== debouncedSnapshot)

  // Leaving after a save or delete passes `state: SAVED`: the blocker's closure may still see the
  // old `isDirty`, and a save confirmed from a dialog runs outside `handleSubmit`.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && !isSubmitting && nextLocation.state !== SAVED && currentLocation.pathname !== nextLocation.pathname,
  )

  async function save(values: ClosingFormValues) {
    try {
      if (isNew) {
        const created = await createClosing.mutateAsync(formToPayload(values))
        reset(detailToForm(created))
        toast.success('Cierre creado.')
        navigate(`/cierres/${created.id}`, { replace: true, state: SAVED })
      } else {
        const updated = await updateClosing.mutateAsync({ id: closingId, body: formToPayload(values) })
        reset(detailToForm(updated))
        toast.success('Cierre guardado.')
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onSubmit(values: ClosingFormValues) {
    // Creating past the limit deletes the oldest closing: say which one first (D69).
    if (isNew && (retention.data?.will_delete.length ?? 0) > 0) {
      setPending(values)
      setConfirm('retention')
      return
    }
    await save(values)
  }

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action()
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  function applySuggestion(field: 'vat' | 'bankFee', value: string) {
    setValue(field, toDecimalInput(roundDecimal(value, 2)), { shouldDirty: true, shouldValidate: true })
  }

  if (notFound) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">El cierre no existe (puede que se haya eliminado por antigüedad).</p>
        <Link to="/cierres" className="text-sm text-primary hover:underline">Volver a Cierres</Link>
      </div>
    )
  }

  const lineProps = { form, report, mapping: showSaved ? null : mapping, readOnly }
  const toDelete = retention.data?.will_delete ?? []

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cierres">
            <ArrowLeft />
            Cierres
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{isNew ? 'Nuevo cierre' : (closing?.name ?? 'Cargando…')}</h2>
        {closing && <ClosingStatusBadge status={closing.status} />}
        {closing?.closed_at && (
          <span className="text-xs text-muted-foreground">Cerrado el {formatDate(closing.closed_at)}</span>
        )}
        {isDirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {!isNew && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={isDirty} onClick={() => setPrinting(true)}
                title={isDirty ? 'Guarda los cambios antes de imprimir' : undefined}>
                <Printer />
                Imprimir / PDF
              </Button>
              {isDirty ? (
                <Button type="button" variant="outline" size="sm" disabled title="Guarda los cambios antes de exportar">
                  <Download />
                  Exportar CSV
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={closingCsvUrl(closingId)} download>
                    <Download />
                    Exportar CSV
                  </a>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirm('delete')}>
                <Trash2 />
                Eliminar
              </Button>
            </>
          )}
          {readOnly ? (
            <Button type="button" size="sm" onClick={() => setConfirm('reopen')}>
              <LockOpen />
              Reabrir
            </Button>
          ) : (
            <>
              {!isNew && (
                <Button type="button" variant="outline" size="sm" disabled={isDirty} onClick={() => setConfirm('close')}
                  title={isDirty ? 'Guarda los cambios antes de cerrar' : 'Congela los costos de este cierre'}>
                  <Lock />
                  Cerrar cierre
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isSubmitting || (!isNew && !isDirty)}>
                {isNew ? 'Crear cierre' : 'Guardar cambios'}
              </Button>
            </>
          )}
        </div>
      </div>

      {isNew && toDelete.length > 0 && (
        <p className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm">
          Se conservan {retention.data?.keep} cierres: al crear este se eliminará «{toDelete[0].name}» (
          {dateRange(toDelete[0].start_date, toDelete[0].end_date)}).
        </p>
      )}
      {readOnly && (
        <p className="rounded-lg border bg-surface-card px-4 py-2.5 text-sm text-muted-foreground">
          Este cierre está cerrado: sus costos quedaron congelados. Reábrelo para editarlo (los costos se recalcularán
          con los precios actuales).
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <fieldset disabled={readOnly} className="min-w-0 space-y-4">
          <Section title="Sesión">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField label="Nombre" htmlFor="name" error={errors.name?.message} className="col-span-2">
                <Input id="name" autoFocus={isNew} placeholder="Sesión 12" {...register('name')} aria-invalid={!!errors.name} />
              </FormField>
              <FormField label="Desde" htmlFor="startDate" error={errors.startDate?.message}>
                <Input id="startDate" type="date" {...register('startDate')} aria-invalid={!!errors.startDate} />
              </FormField>
              <FormField label="Hasta" htmlFor="endDate" error={errors.endDate?.message}>
                <Input id="endDate" type="date" {...register('endDate')} aria-invalid={!!errors.endDate} />
              </FormField>
              <FormField label="Notas" htmlFor="notes" className="col-span-2 md:col-span-4">
                <Textarea id="notes" rows={1} className="min-h-9" {...register('notes')} />
              </FormField>
            </div>
          </Section>

          <Section title="Ingresos" description="Total facturado en la sesión (POS + badgergrub.com) y lo que se descuenta de él.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Monto facturado" htmlFor="billed" error={errors.billed?.message}>
                <MoneyInput id="billed" {...register('billed')} aria-invalid={!!errors.billed} />
              </FormField>
              <FormField label="IVA" htmlFor="vat" error={errors.vat?.message}>
                <MoneyInput id="vat" {...register('vat')} aria-invalid={!!errors.vat} />
              </FormField>
              <FormField label="Comisión bancaria" htmlFor="bankFee" error={errors.bankFee?.message}>
                <MoneyInput id="bankFee" {...register('bankFee')} aria-invalid={!!errors.bankFee} />
              </FormField>
            </div>
            {report && !readOnly && (Number(report.suggested_vat_amount) > 0 || Number(report.suggested_bank_fee_amount) > 0) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                Según las tasas de Ajustes:
                {Number(report.suggested_vat_amount) > 0 && (
                  <SuggestButton label={`IVA ${formatCRC(report.suggested_vat_amount)}`}
                    onClick={() => applySuggestion('vat', report.suggested_vat_amount)} />
                )}
                {Number(report.suggested_bank_fee_amount) > 0 && (
                  <SuggestButton label={`comisión ${formatCRC(report.suggested_bank_fee_amount)}`}
                    onClick={() => applySuggestion('bankFee', report.suggested_bank_fee_amount)} />
                )}
              </p>
            )}
          </Section>

          <Section title="Productos vendidos" description="Combos, platos y bebidas que realmente se vendieron. El costo incluye empaque.">
            <ProductLines {...lineProps} products={products} />
          </Section>

          <Section title="Mano de obra" description="Horas de cocina a pagar; cada colaborador puede cobrar distinto por hora.">
            <LaborLines {...lineProps} />
          </Section>

          <Section title="Otros gastos" description="Lo que no está costeado en los productos: aceite de fritura, electricidad, agua, gas…">
            <ExpenseLines {...lineProps} />
          </Section>
        </fieldset>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ClosingSummary report={report} isStale={isStale}
            error={!showSaved && preview.isError ? errorMessage(preview.error) : null} />
        </aside>
      </div>

      {closingId !== null && (
        <PrintPreviewDialog open={printing} onOpenChange={setPrinting} title="Reporte de cierre"
          src={closingReportUrl(closingId)} waitForReady />
      )}

      <ConfirmDialog
        open={confirm === 'retention'}
        title="¿Crear el cierre?"
        description={`Se conservan ${retention.data?.keep} cierres. Se eliminará ${toDelete.map((c) => `«${c.name}»`).join(', ')}; los respaldos lo conservan.`}
        action="Crear y eliminar el más antiguo"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null)
          if (pending) await save(pending)
        }}
      />
      <ConfirmDialog
        open={confirm === 'close'}
        title="¿Cerrar este cierre?"
        description={
          report && !report.complete
            ? 'Hay productos con costo incompleto: el reporte quedará marcado así. Los costos y precios de hoy quedarán congelados.'
            : 'Los costos y precios de hoy quedarán congelados; un cambio de precio posterior no lo modificará.'
        }
        action="Cerrar cierre"
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => closeClosing.mutateAsync(closingId!), 'Cierre cerrado.')}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title="¿Reabrir este cierre?"
        description="Los costos dejarán de estar congelados y se recalcularán con los precios actuales."
        action="Reabrir"
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => reopenClosing.mutateAsync(closingId!), 'Cierre reabierto.')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`¿Eliminar “${closing?.name}”?`}
        description="Esta acción no se puede deshacer."
        action="Eliminar"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            await deleteClosing.mutateAsync(closingId!)
            navigate('/cierres', { state: SAVED })
          }, 'Cierre eliminado.')
        }
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="¿Salir sin guardar?"
        description="Los cambios de este cierre se perderán."
        action="Salir sin guardar"
        cancel="Seguir editando"
        destructive
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-surface-card p-4">
      <h3 className={description ? 'mb-1 text-sm font-semibold' : 'mb-3 text-sm font-semibold'}>{title}</h3>
      {description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  )
}

function SuggestButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded border px-2 py-0.5 text-foreground tabular-nums hover:bg-accent">
      Usar {label}
    </button>
  )
}

function ConfirmDialog({ open, title, description, action, cancel = 'Cancelar', destructive, onCancel, onConfirm }: {
  open: boolean
  title: string
  description: string
  action: string
  cancel?: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
