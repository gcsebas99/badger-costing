import { CalendarPlus, LayoutGrid, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import {
  useCreatePeriod,
  useDeletePeriod,
  useImportSales,
  useSalesPeriod,
  useSalesPeriods,
} from '@/api/sales'
import { FormField } from '@/components/forms/FormField'
import { EmptyState } from '@/components/layout/EmptyState'
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
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MenuAnalysis } from './MenuAnalysis'
import { SalesEditor } from './SalesEditor'

type View = 'analisis' | 'ventas'

export function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: periods, isPending } = useSalesPeriods()
  const periodParam = searchParams.get('periodo')
  const periodId = periodParam ? Number(periodParam) : (periods?.[0]?.id ?? null)
  const view = (searchParams.get('vista') as View | null) ?? 'analisis'
  const { data: period } = useSalesPeriod(periodId)

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletePeriod = useDeletePeriod()
  const importSales = useImportSales()
  const fileInput = useRef<HTMLInputElement>(null)

  /** Update several URL params in one navigation (consecutive calls would overwrite each other). */
  function setParams(changes: Record<string, string | null>) {
    setSearchParams(
      (params) => {
        for (const [key, value] of Object.entries(changes)) {
          if (value) params.set(key, value)
          else params.delete(key)
        }
        return params
      },
      { replace: true },
    )
  }
  const setParam = (key: string, value: string | null) => setParams({ [key]: value })

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || periodId === null) return
    try {
      const result = await importSales.mutateAsync({ id: periodId, content: await file.text(), replace: true })
      const notes = [
        result.unmatched_products.length && `sin coincidencia: ${result.unmatched_products.join(', ')}`,
        result.unmatched_channels.length && `canales desconocidos: ${result.unmatched_channels.join(', ')}`,
        result.invalid_rows.length && `filas inválidas: ${result.invalid_rows.join(', ')}`,
      ].filter(Boolean)
      toast.success(`${result.imported_rows} filas importadas.`, { description: notes.join(' · ') || undefined })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function handleDelete() {
    if (periodId === null) return
    try {
      await deletePeriod.mutateAsync(periodId)
      setParam('periodo', null)
      toast.success('Periodo eliminado.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  if (isPending) return <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {periods && periods.length > 0 && (
          <Select value={periodId ? String(periodId) : undefined} onValueChange={(v) => setParam('periodo', v)}>
            <SelectTrigger size="sm" className="w-64" aria-label="Periodo">
              <SelectValue placeholder="Elegir periodo…" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} · {p.total_units} uds
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <CalendarPlus />
          Nuevo periodo
        </Button>
        {period && (
          <>
            <div className="ml-2 inline-flex rounded-md border bg-surface-card p-0.5" role="tablist">
              {(['analisis', 'ventas'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setParam('vista', v === 'analisis' ? null : v)}
                  className={cn(
                    'rounded px-3 py-1 text-sm',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v === 'analisis' ? 'Análisis' : 'Ventas'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(period.start_date)} – {formatDate(period.end_date)}
            </span>
            <div className="ml-auto flex gap-2">
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={importSales.isPending}
                title="Columnas: producto; unidades; canal (opcional)">
                <Upload />
                Importar CSV
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Eliminar periodo" onClick={() => setDeleting(true)}>
                <Trash2 />
              </Button>
            </div>
          </>
        )}
      </div>

      {!periods?.length ? (
        <EmptyState
          icon={LayoutGrid}
          title="Aún no hay periodos de ventas"
          description="Crea un periodo (ej. “Octubre 2026”), registra o importa las unidades vendidas por producto y verás la clasificación Estrella / Caballo / Puzzle / Perro."
        />
      ) : !period ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : view === 'ventas' ? (
        <SalesEditor period={period} />
      ) : period.total_units === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Este periodo no tiene ventas"
          description="Registra las unidades en la pestaña Ventas o importa un CSV con columnas producto y unidades."
        />
      ) : (
        <MenuAnalysis periodId={period.id} />
      )}

      <NewPeriodDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => setParams({ periodo: String(id), vista: 'ventas' })}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{period?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Se borran las ventas registradas de este periodo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function monthDefaults() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const name = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric' }).format(now)
  return { name: name.charAt(0).toUpperCase() + name.slice(1), start: iso(first), end: iso(last) }
}

function NewPeriodDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: number) => void
}) {
  const defaults = monthDefaults()
  const [name, setName] = useState(defaults.name)
  const [start, setStart] = useState(defaults.start)
  const [end, setEnd] = useState(defaults.end)
  const create = useCreatePeriod()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const period = await create.mutateAsync({ name: name.trim(), start_date: start, end_date: end })
      toast.success('Periodo creado.')
      onOpenChange(false)
      onCreated(period.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo periodo de ventas</DialogTitle>
          <DialogDescription>Luego registra o importa las unidades vendidas en ese periodo.</DialogDescription>
        </DialogHeader>
        <form id="period-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
          <FormField label="Nombre" htmlFor="period-name" className="col-span-2">
            <Input id="period-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Desde" htmlFor="period-start">
            <Input id="period-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </FormField>
          <FormField label="Hasta" htmlFor="period-end">
            <Input id="period-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="period-form" disabled={!name.trim() || create.isPending}>Crear periodo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
