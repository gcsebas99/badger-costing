import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { type Control, Controller, type FieldErrors, useFieldArray, useWatch } from 'react-hook-form'

import type { IngredientOption, ItemCost, RecipeCost } from '@/api/recipes'
import { IngredientCombobox } from '@/components/forms/IngredientCombobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  formatCRC,
  formatPercent,
  formatQuantity,
  formatUnitCost,
  parseDecimalInput,
  percentInputToRate,
} from '@/lib/format'

import { emptyRow, type RecipeFormValues, type RecipeRowValues } from './recipeFormSchema'

interface IngredientRowsProps {
  control: Control<RecipeFormValues>
  errors: FieldErrors<RecipeFormValues>
  options: IngredientOption[]
  cost: RecipeCost | undefined
  previewIndex: (number | null)[]
}

const optionFor = (options: IngredientOption[], row: RecipeRowValues) =>
  options.find((o) => o.item_type === row.itemType && o.id === row.refId)

function grossQuantity(row: RecipeRowValues): string | null {
  const quantity = parseDecimalInput(row.quantity)
  const waste = percentInputToRate(row.waste)
  if (quantity === null || waste === null) return null
  return String(Number(quantity) * (1 + Number(waste)))
}

export function IngredientRows({ control, errors, options, cost, previewIndex }: IngredientRowsProps) {
  const { fields, append, remove, move, update } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' })
  const rows = useWatch({ control, name: 'items' })

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[60rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-right">#</TableHead>
              <TableHead className="min-w-64">Ingrediente</TableHead>
              <TableHead className="w-24 text-right">Cant. neta</TableHead>
              <TableHead className="w-24">Unidad</TableHead>
              <TableHead className="w-20 text-right">Merma %</TableHead>
              <TableHead className="w-24 text-right">Cant. bruta</TableHead>
              <TableHead className="w-32 text-right">Costo unitario</TableHead>
              <TableHead className="w-28 text-right">Costo</TableHead>
              <TableHead className="w-16 text-right">%</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="h-16 text-center text-muted-foreground">
                  Sin ingredientes.
                </TableCell>
              </TableRow>
            )}
            {fields.map((field, index) => {
              const row = rows?.[index] ?? field
              const option = optionFor(options, row)
              const rowErrors = errors.items?.[index]
              const costIndex = previewIndex[index]
              const itemCost = costIndex == null ? undefined : cost?.items[costIndex]
              const gross = grossQuantity(row)
              return (
                <TableRow key={field.fieldKey} className="h-11 hover:bg-transparent">
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.refId`}
                      render={() => (
                        <IngredientCombobox
                          options={options}
                          value={row.itemType && row.refId ? { item_type: row.itemType, id: row.refId } : null}
                          invalid={!!rowErrors?.refId}
                          onChange={(picked) => {
                            const keepUnit = row.unit && picked.allowed_units.includes(row.unit)
                            update(index, {
                              ...row,
                              itemType: picked.item_type,
                              refId: picked.id,
                              unit: keepUnit ? row.unit : picked.base_unit,
                            })
                          }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.quantity`}
                      render={({ field: input }) => (
                        <Input
                          {...input}
                          inputMode="decimal"
                          aria-label={`Cantidad neta, fila ${index + 1}`}
                          aria-invalid={!!rowErrors?.quantity}
                          className="h-8 text-right tabular-nums"
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.unit`}
                      render={({ field: input }) => (
                        <Select value={input.value ?? ''} onValueChange={input.onChange} disabled={!option}>
                          <SelectTrigger
                            size="sm"
                            className="w-full"
                            aria-label={`Unidad, fila ${index + 1}`}
                            aria-invalid={!!rowErrors?.unit}
                          >
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(option?.allowed_units ?? []).map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.waste`}
                      render={({ field: input }) => (
                        <Input
                          {...input}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`Merma %, fila ${index + 1}`}
                          aria-invalid={!!rowErrors?.waste}
                          className="h-8 text-right tabular-nums"
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell className="num text-muted-foreground">
                    {gross === null ? '—' : `${formatQuantity(gross)} ${row.unit ?? ''}`}
                  </TableCell>
                  <TableCell className="num">
                    {option?.reference_unit_cost == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        {formatUnitCost(itemCost?.reference_unit_cost ?? option.reference_unit_cost)}
                        <span className="ml-1 text-xs text-muted-foreground">/ {option.reference_unit}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="num font-medium">
                    <ItemCostCell item={itemCost} />
                  </TableCell>
                  <TableCell className="num text-xs text-muted-foreground">
                    {itemCost?.share == null ? '' : formatPercent(itemCost.share, 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Subir"
                        disabled={index === 0} onClick={() => move(index, index - 1)}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Bajar"
                        disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Quitar fila ${index + 1}`}
                        onClick={() => remove(index)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => append(emptyRow())}>
        <Plus />
        Agregar ingrediente
      </Button>
    </div>
  )
}

function ItemCostCell({ item }: { item: ItemCost | undefined }) {
  if (!item) return <span className="text-muted-foreground">—</span>
  if (item.status === 'ok') return <>{formatCRC(item.cost)}</>

  const label =
    item.status === 'missing_price'
      ? 'Sin precio'
      : item.status === 'incomplete_subrecipe'
        ? 'Incompleta'
        : item.status === 'not_found'
          ? 'No existe'
          : 'Unidad inválida'
  const variant = item.status === 'conversion_error' || item.status === 'not_found' ? 'bad' : 'warn'
  return (
    <span className="inline-flex items-center gap-1.5">
      {item.cost !== null && <span>{formatCRC(item.cost)}</span>}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Badge variant={variant}>{label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>{item.message}</TooltipContent>
      </Tooltip>
    </span>
  )
}
