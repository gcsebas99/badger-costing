import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Controller, type UseFormReturn, useFieldArray, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import {
  type ClosingReport,
  useCollaborators,
  useCreateCollaborator,
  useCreateExpenseType,
  useExpenseTypes,
} from '@/api/closings'
import { errorMessage } from '@/api/client'
import type { ProductSummary } from '@/api/products'
import { SearchSelect } from '@/components/forms/SearchSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatQuantity, formatUnitCost, toDecimalInput } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  type ClosingFormValues,
  emptyExpenseRow,
  emptyLaborRow,
  emptyProductRow,
  type MappedAmounts,
} from './closingForm'

type Form = UseFormReturn<ClosingFormValues>

interface LinesProps {
  form: Form
  report: ClosingReport | undefined
  /** Form row → report row (−1 for empty rows); null while showing the saved closing as is. */
  mapping: MappedAmounts | null
  readOnly: boolean
}

const numberInput = 'h-8 text-right tabular-nums'

/** Report row for form row `index`: the saved closing has no empty rows, so indexes match. */
function reportIndex(mapping: MappedAmounts | null, key: keyof Omit<MappedAmounts, 'payload'>, index: number): number {
  return mapping ? mapping[key][index] : index
}

export function MoneyInput({ prefix = '₡', className, ...props }: React.ComponentProps<typeof Input> & { prefix?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
      <Input inputMode="decimal" placeholder="0" className={cn('pl-7 text-right tabular-nums', className)} {...props} />
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-right text-xs text-bad">{message}</p> : null
}

function LinesTable({ head, children, footer }: { head: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[40rem]">
        <TableHeader>
          <TableRow>{head}</TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    </div>
  )
}

function RemoveButton({ label, onClick, hidden }: { label: string; onClick: () => void; hidden: boolean }) {
  if (hidden) return null
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <Trash2 />
    </Button>
  )
}

// --- Products ------------------------------------------------------------------------------

export function ProductLines({ form, report, mapping, readOnly, products }: LinesProps & { products: ProductSummary[] }) {
  const { control, register, formState: { errors } } = form
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'products' })
  const rows = useWatch({ control, name: 'products' })
  const selected = new Set(rows.map((row) => row.productId))
  const options = products.map((p) => ({
    value: p.id,
    label: p.active ? p.name : `${p.name} (inactivo)`,
    group: p.menu_group_name,
    active: p.active,
  }))
  const allSelected = options.filter((o) => o.active).every((o) => selected.has(o.value))

  return (
    <>
      <LinesTable
        head={
          <>
            <TableHead>Producto</TableHead>
            <TableHead className="w-28 text-right">Unidades</TableHead>
            <TableHead className="w-32 text-right">Costo unitario</TableHead>
            <TableHead className="w-32 text-right">Costo total</TableHead>
            <TableHead className="w-10" aria-label="Quitar" />
          </>
        }
        footer={
          report && (
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="num font-medium">{formatQuantity(report.total_units, 0)}</TableCell>
              <TableCell />
              <TableCell className="num font-medium">{formatCRC(report.product_cost)}</TableCell>
              <TableCell />
            </TableRow>
          )
        }
      >
        {fields.map((field, index) => {
          const line = report?.products[reportIndex(mapping, 'productIndex', index)]
          return (
            <TableRow key={field.id} className="hover:bg-transparent">
              <TableCell className="py-1.5">
                <Controller
                  control={control}
                  name={`products.${index}.productId`}
                  render={({ field: select }) => (
                    <SearchSelect
                      options={options.filter((o) => o.value === select.value || (o.active && !selected.has(o.value)))}
                      value={select.value}
                      onChange={select.onChange}
                      placeholder="Elegir producto…"
                      searchPlaceholder="Buscar producto…"
                      clearable={false}
                    />
                  )}
                />
                {line && !line.complete && <p className="mt-1 text-xs text-warn">Costo incompleto</p>}
              </TableCell>
              <TableCell className="py-1.5 align-top">
                <Input inputMode="numeric" placeholder="0" aria-label="Unidades vendidas" className={numberInput}
                  aria-invalid={!!errors.products?.[index]?.units} {...register(`products.${index}.units`)} />
                <FieldError message={errors.products?.[index]?.units?.message} />
              </TableCell>
              <TableCell className="num">{line ? formatUnitCost(line.unit_cost) : '—'}</TableCell>
              <TableCell className="num">{line ? formatCRC(line.total_cost) : '—'}</TableCell>
              <TableCell className="py-1.5">
                <RemoveButton label="Quitar producto" hidden={readOnly}
                  onClick={() => (fields.length === 1 ? replace([emptyProductRow()]) : remove(index))} />
              </TableCell>
            </TableRow>
          )
        })}
      </LinesTable>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={allSelected}
          onClick={() => append(emptyProductRow())}>
          <Plus />
          Agregar producto
        </Button>
      )}
    </>
  )
}

// --- Labor ---------------------------------------------------------------------------------

export function LaborLines({ form, report, mapping, readOnly }: LinesProps) {
  const { control, register, setValue, getValues, formState: { errors } } = form
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'labor' })
  const rows = useWatch({ control, name: 'labor' })
  const { data: collaborators = [] } = useCollaborators()
  const createCollaborator = useCreateCollaborator()
  const selected = new Set(rows.map((row) => row.collaboratorId))
  const options = collaborators.map((c) => ({
    value: c.id,
    label: c.name,
    detail: Number(c.hourly_rate) > 0 ? `${formatCRC(c.hourly_rate, 0)} / h` : undefined,
    active: c.active,
  }))

  function choose(index: number, id: number | null, name: string, rate: string) {
    setValue(`labor.${index}.collaboratorId`, id, { shouldDirty: true })
    setValue(`labor.${index}.name`, name, { shouldDirty: true, shouldValidate: true })
    // The default rate fills an empty rate; a rate typed for this session stays.
    if (!getValues(`labor.${index}.rate`).trim() && Number(rate) > 0) {
      setValue(`labor.${index}.rate`, toDecimalInput(rate), { shouldDirty: true })
    }
  }

  async function create(index: number, name: string) {
    try {
      const created = await createCollaborator.mutateAsync({ name, hourly_rate: '0', active: true })
      choose(index, created.id, created.name, created.hourly_rate)
      toast.success(`Colaborador «${created.name}» creado.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <LinesTable
        head={
          <>
            <TableHead>Colaborador</TableHead>
            <TableHead className="w-24 text-right">Horas</TableHead>
            <TableHead className="w-36 text-right">Costo por hora</TableHead>
            <TableHead className="w-32 text-right">Total</TableHead>
            <TableHead className="w-10" aria-label="Quitar" />
          </>
        }
        footer={
          report && (
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="num font-medium">{formatQuantity(report.labor_hours, 2)}</TableCell>
              <TableCell />
              <TableCell className="num font-medium">{formatCRC(report.labor_cost)}</TableCell>
              <TableCell />
            </TableRow>
          )
        }
      >
        {fields.map((field, index) => {
          const line = report?.labor[reportIndex(mapping, 'laborIndex', index)]
          const row = rows[index]
          const rowErrors = errors.labor?.[index]
          return (
            <TableRow key={field.id} className="hover:bg-transparent">
              <TableCell className="py-1.5 align-top">
                <SearchSelect
                  options={options.filter((o) => o.value === row?.collaboratorId || (o.active && !selected.has(o.value)))}
                  value={row?.collaboratorId ?? null}
                  fallbackLabel={row?.name || undefined}
                  onChange={(id) => {
                    const collaborator = collaborators.find((c) => c.id === id)
                    if (collaborator) choose(index, collaborator.id, collaborator.name, collaborator.hourly_rate)
                  }}
                  onCreate={(name) => void create(index, name)}
                  placeholder="Elegir colaborador…"
                  searchPlaceholder="Buscar o crear colaborador…"
                  clearable={false}
                />
                {rowErrors?.name && <p className="mt-1 text-xs text-bad">{rowErrors.name.message}</p>}
              </TableCell>
              <TableCell className="py-1.5 align-top">
                <Input inputMode="decimal" placeholder="0" aria-label="Horas" className={numberInput}
                  aria-invalid={!!rowErrors?.hours} {...register(`labor.${index}.hours`)} />
                <FieldError message={rowErrors?.hours?.message} />
              </TableCell>
              <TableCell className="py-1.5 align-top">
                <MoneyInput aria-label="Costo por hora" className="h-8" aria-invalid={!!rowErrors?.rate}
                  {...register(`labor.${index}.rate`)} />
                <FieldError message={rowErrors?.rate?.message} />
              </TableCell>
              <TableCell className="num">{line ? formatCRC(line.total) : '—'}</TableCell>
              <TableCell className="py-1.5">
                <RemoveButton label="Quitar colaborador" hidden={readOnly}
                  onClick={() => (fields.length === 1 ? replace([emptyLaborRow()]) : remove(index))} />
              </TableCell>
            </TableRow>
          )
        })}
      </LinesTable>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => append(emptyLaborRow())}>
          <Plus />
          Agregar colaborador
        </Button>
      )}
    </>
  )
}

// --- Other expenses ------------------------------------------------------------------------

export function ExpenseLines({ form, report, readOnly }: LinesProps) {
  const { control, register, setValue, getValues, formState: { errors } } = form
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'expenses' })
  const rows = useWatch({ control, name: 'expenses' })
  const { data: expenseTypes = [] } = useExpenseTypes()
  const createExpenseType = useCreateExpenseType()
  const selected = new Set(rows.map((row) => row.expenseTypeId))
  const options = expenseTypes.map((e) => ({
    value: e.id,
    label: e.name,
    detail: e.last_amount ? `último ${formatCRC(e.last_amount, 0)}` : undefined,
    active: e.active,
  }))

  function choose(index: number, id: number, name: string, lastAmount: string | null | undefined) {
    setValue(`expenses.${index}.expenseTypeId`, id, { shouldDirty: true })
    setValue(`expenses.${index}.name`, name, { shouldDirty: true, shouldValidate: true })
    if (!getValues(`expenses.${index}.amount`).trim() && lastAmount) {
      setValue(`expenses.${index}.amount`, toDecimalInput(lastAmount), { shouldDirty: true })
    }
  }

  async function create(index: number, name: string) {
    try {
      const created = await createExpenseType.mutateAsync(name)
      choose(index, created.id, created.name, null)
      toast.success(`Gasto «${created.name}» creado.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <LinesTable
        head={
          <>
            <TableHead>Gasto</TableHead>
            <TableHead className="w-40 text-right">Monto</TableHead>
            <TableHead className="w-10" aria-label="Quitar" />
          </>
        }
        footer={
          report && (
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="num font-medium">{formatCRC(report.other_expenses)}</TableCell>
              <TableCell />
            </TableRow>
          )
        }
      >
        {fields.map((field, index) => {
          const row = rows[index]
          const rowErrors = errors.expenses?.[index]
          return (
            <TableRow key={field.id} className="hover:bg-transparent">
              <TableCell className="py-1.5 align-top">
                <SearchSelect
                  options={options.filter((o) => o.value === row?.expenseTypeId || (o.active && !selected.has(o.value)))}
                  value={row?.expenseTypeId ?? null}
                  fallbackLabel={row?.name || undefined}
                  onChange={(id) => {
                    const type = expenseTypes.find((e) => e.id === id)
                    if (type) choose(index, type.id, type.name, type.last_amount)
                  }}
                  onCreate={(name) => void create(index, name)}
                  placeholder="Elegir gasto…"
                  searchPlaceholder="Buscar o crear gasto (ej. Aceite fritura)…"
                  clearable={false}
                />
                {rowErrors?.name && <p className="mt-1 text-xs text-bad">{rowErrors.name.message}</p>}
              </TableCell>
              <TableCell className="py-1.5 align-top">
                <MoneyInput aria-label="Monto" className="h-8" aria-invalid={!!rowErrors?.amount}
                  {...register(`expenses.${index}.amount`)} />
                <FieldError message={rowErrors?.amount?.message} />
              </TableCell>
              <TableCell className="py-1.5">
                <RemoveButton label="Quitar gasto" hidden={readOnly}
                  onClick={() => (fields.length === 1 ? replace([emptyExpenseRow()]) : remove(index))} />
              </TableCell>
            </TableRow>
          )
        })}
      </LinesTable>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => append(emptyExpenseRow())}>
          <Plus />
          Agregar gasto
        </Button>
      )}
    </>
  )
}
