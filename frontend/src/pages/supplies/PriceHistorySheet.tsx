import { Pencil, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import { useSettings } from '@/api/settings'
import { useAddPrice, useDeletePrice, useSupply, useSupplyUsages } from '@/api/supplies'
import { FormField } from '@/components/forms/FormField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCRC,
  formatDate,
  formatQuantity,
  formatUnitCost,
  parseDecimalInput,
  todayISO,
} from '@/lib/format'

interface PriceHistorySheetProps {
  supplyId: number | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}

export function PriceHistorySheet({ supplyId, onOpenChange, onEdit }: PriceHistorySheetProps) {
  const { data: supply } = useSupply(supplyId)
  const { data: usages = [] } = useSupplyUsages(supplyId)
  const { data: settings } = useSettings()
  const deletePrice = useDeletePrice()

  const modeLabel =
    settings?.cost_mode === 'latest'
      ? 'Costo vigente: precio más reciente.'
      : 'Costo vigente: promedio de los últimos 3 precios (o de los que haya).'

  async function handleDelete(priceId: number) {
    if (supplyId === null) return
    try {
      await deletePrice.mutateAsync({ supplyId, priceId })
      toast.success('Precio eliminado.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Sheet open={supplyId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="pr-6">{supply?.name ?? 'Cargando…'}</SheetTitle>
          <SheetDescription>
            {supply &&
              [supply.brand, supply.group, `${formatQuantity(supply.pack_qty)} ${supply.pack_unit} por empaque`]
                .filter(Boolean)
                .join(' · ')}
          </SheetDescription>
          {supply && (
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={onEdit}>
              <Pencil />
              Editar suministro
            </Button>
          )}
        </SheetHeader>

        {supply && (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Costo por empaque" value={formatCRC(supply.current_price)} />
              <Stat
                label={`Costo por ${supply.reference_unit}`}
                value={formatUnitCost(supply.reference_unit_cost)}
                highlight
              />
            </div>
            <p className="text-xs text-muted-foreground">{modeLabel}</p>
            {supply.equivalence && (
              <p className="text-xs text-muted-foreground">
                Equivalencia: 1 pz = {formatQuantity(supply.equivalence.quantity)} {supply.equivalence.unit}
              </p>
            )}

            {usages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Se usa en:{' '}
                {usages.map((recipe, index) => (
                  <span key={`${recipe.kind}-${recipe.id}`}>
                    {index > 0 && ', '}
                    <Link
                      to={recipe.kind === 'product' ? `/productos/${recipe.id}` : `/recetas/${recipe.id}`}
                      className="text-primary hover:underline"
                    >
                      {recipe.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}

            <AddPriceForm supplyId={supply.id} defaultSupplier={supply.supplier ?? ''} />

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supply.prices.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                        Sin precios registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supply.prices.map((price) => (
                      <TableRow key={price.id}>
                        <TableCell className="tabular-nums">{formatDate(price.purchased_on)}</TableCell>
                        <TableCell>{price.supplier ?? '—'}</TableCell>
                        <TableCell className="num">{formatCRC(price.amount)}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {price.in_effect && <Badge variant="ok">Vigente</Badge>}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Eliminar precio del ${formatDate(price.purchased_on)}`}
                              onClick={() => handleDelete(price.id)}
                              disabled={deletePrice.isPending}
                            >
                              <Trash2 />
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded-md bg-brand-black p-3' : 'rounded-md border bg-surface-card p-3'}>
      <div className={highlight ? 'text-xs text-sidebar-muted' : 'text-xs text-muted-foreground'}>{label}</div>
      <div
        className={
          highlight
            ? 'mt-0.5 text-lg font-semibold text-brand-gold tabular-nums'
            : 'mt-0.5 text-lg font-semibold tabular-nums'
        }
      >
        {value}
      </div>
    </div>
  )
}

function AddPriceForm({ supplyId, defaultSupplier }: { supplyId: number; defaultSupplier: string }) {
  const addPrice = useAddPrice()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [supplier, setSupplier] = useState(defaultSupplier)
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseDecimalInput(amount)
    if (parsed === null) {
      setError('Ingresa un monto válido.')
      return
    }
    setError(undefined)
    try {
      await addPrice.mutateAsync({
        supplyId,
        body: { amount: parsed, purchased_on: date || todayISO(), supplier: supplier || null },
      })
      setAmount('')
      toast.success('Precio agregado.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-muted/40 p-3">
      <h3 className="text-sm font-semibold">Agregar precio</h3>
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <FormField label="Monto del empaque (₡)" htmlFor="price-amount" error={error}>
          <Input
            id="price-amount"
            inputMode="decimal"
            className="text-right tabular-nums"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={!!error}
          />
        </FormField>
        <FormField label="Fecha" htmlFor="price-date">
          <Input
            id="price-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormField label="Proveedor" htmlFor="price-supplier" className="col-span-2">
          <Input
            id="price-supplier"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
          />
        </FormField>
      </div>
      <Button type="submit" size="sm" disabled={addPrice.isPending}>
        Agregar precio
      </Button>
    </form>
  )
}
