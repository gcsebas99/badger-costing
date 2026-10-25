import { Calculator, ChefHat, type LucideIcon, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'

import { errorMessage, type Schemas } from '@/api/client'
import {
  type IngredientOption,
  type ItemCost,
  type RecipeScaled,
  useIngredientOptions,
  useRecipe,
  useScaledRecipe,
} from '@/api/recipes'
import { PrintPreviewDialog } from '@/components/PrintPreviewDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  formatCRC,
  formatKitchenQuantity,
  formatPercent,
  formatQuantity,
  parseDecimalInput,
  toDecimalInput,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import { kitchenSheetUrl, ONE_BATCH, type ScaleSelection, scaleToQuery } from './kitchenScale'

const MULTIPLIERS = ['0.5', '2', '3', '4'] as const

type Tool = 'sheet' | 'multiply' | 'adjust'
type Unit = Schemas['Unit']

/** Kitchen sheet and batch tools for a saved recipe. Disabled while the editor has unsaved changes. */
export function KitchenTools({ recipeId, disabled }: { recipeId: number; disabled: boolean }) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [factor, setFactor] = useState<string>('2')
  // Last anchor selection the API accepted: the preview keeps showing it while the input is invalid.
  const [anchored, setAnchored] = useState<ScaleSelection>(ONE_BATCH)
  const close = (open: boolean) => !open && setTool(null)
  const multiplied: ScaleSelection = { mode: 'factor', factor }

  return (
    <>
      <ToolButton icon={ChefHat} label="Ficha para cocina" disabled={disabled} onClick={() => setTool('sheet')} />
      <ToolButton icon={Calculator} label="Multiplicar" disabled={disabled} onClick={() => setTool('multiply')} />
      <ToolButton icon={Scale} label="Ajustar a ingrediente" disabled={disabled} onClick={() => {
        setAnchored(ONE_BATCH) // the form restarts on the first line at ×1
        setTool('adjust')
      }} />

      <PrintPreviewDialog
        open={tool === 'sheet'}
        onOpenChange={close}
        title="Ficha para cocina"
        description="Ingredientes de una tanda y pasos de preparación."
        src={kitchenSheetUrl(recipeId, ONE_BATCH)}
      />
      <PrintPreviewDialog
        open={tool === 'multiply'}
        onOpenChange={close}
        title="Multiplicar receta"
        description="Cantidades ajustadas al multiplicador. No se guarda nada."
        src={kitchenSheetUrl(recipeId, multiplied)}
        controls={<MultiplyControls recipeId={recipeId} factor={factor} onChange={setFactor} />}
      />
      <PrintPreviewDialog
        open={tool === 'adjust'}
        onOpenChange={close}
        title="Ajustar a ingrediente"
        description="Indica cuánto tienes de un ingrediente; los demás se ajustan en proporción. No se guarda nada."
        src={kitchenSheetUrl(recipeId, anchored)}
        controls={<AdjustControls recipeId={recipeId} onValid={setAnchored} />}
      />
    </>
  )
}

function ToolButton({ icon: Icon, label, disabled, onClick }: {
  icon: LucideIcon; label: string; disabled: boolean; onClick: () => void
}) {
  const button = (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      <Icon />
      {label}
    </Button>
  )
  if (!disabled) return button
  return (
    <Tooltip>
      {/* Disabled buttons don't fire pointer events; the wrapper shows the hint. */}
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>Guarda los cambios primero</TooltipContent>
    </Tooltip>
  )
}

function MultiplyControls({ recipeId, factor, onChange }: {
  recipeId: number; factor: string; onChange: (factor: string) => void
}) {
  const scaled = useScaledRecipe(recipeId, { factor })
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div role="radiogroup" aria-label="Multiplicador" className="inline-flex rounded-md border bg-surface-card p-0.5">
        {MULTIPLIERS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={factor === option}
            onClick={() => onChange(option)}
            className={cn(
              'h-8 min-w-14 rounded-sm px-3 text-sm font-semibold tabular-nums transition-colors',
              factor === option ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            ×{formatQuantity(option, 1)}
          </button>
        ))}
      </div>
      {scaled.data && <ScaledSummary data={scaled.data} isFetching={scaled.isFetching} />}
    </div>
  )
}

function AdjustControls({ recipeId, onValid }: { recipeId: number; onValid: (selection: ScaleSelection) => void }) {
  const { data: recipe } = useRecipe(recipeId)
  const { data: options } = useIngredientOptions(recipeId)
  if (!recipe || !options) return <p className="text-sm text-muted-foreground">Cargando…</p>
  const lines = recipe.cost.items.filter((item) => item.id !== null)
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">La receta no tiene ingredientes.</p>
  return <AnchorForm lines={lines} options={options} recipeId={recipeId} onValid={onValid} />
}

function AnchorForm({ lines, options, recipeId, onValid }: {
  lines: ItemCost[]
  options: IngredientOption[]
  recipeId: number
  onValid: (selection: ScaleSelection) => void
}) {
  // Starts on the first line at its recipe quantity (×1).
  const [itemId, setItemId] = useState(lines[0].id!)
  const [quantity, setQuantity] = useState(toDecimalInput(lines[0].quantity))
  const [unit, setUnit] = useState<Unit>(lines[0].unit)
  const line = lines.find((item) => item.id === itemId)!

  function selectLine(id: number) {
    const next = lines.find((item) => item.id === id)!
    setItemId(id)
    setQuantity(toDecimalInput(next.quantity))
    setUnit(next.unit)
  }

  const allowedUnits = options.find((o) => o.item_type === line.item_type && o.id === line.ref_id)?.allowed_units
    ?? [line.unit]

  const parsed = parseDecimalInput(quantity)
  const candidate: ScaleSelection | null =
    parsed !== null && Number(parsed) > 0
      ? { mode: 'anchor', itemId, quantity: parsed, unit }
      : null
  const debounced = useDebouncedValue(candidate ? JSON.stringify(candidate) : null, 300)
  const selection = debounced ? (JSON.parse(debounced) as ScaleSelection) : null
  const scaled = useScaledRecipe(recipeId, selection ? scaleToQuery(selection) : null)
  const accepted = selection !== null && scaled.isSuccess && !scaled.isPlaceholderData

  useEffect(() => {
    if (accepted && debounced) onValid(JSON.parse(debounced) as ScaleSelection)
  }, [accepted, debounced, onValid])

  const waste = Number(line.waste_rate)
  const error = candidate === null && quantity !== ''
    ? 'Ingresa una cantidad mayor que 0.'
    : selection !== null && scaled.isError ? errorMessage(scaled.error) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Ingrediente base</span>
          <Select value={String(itemId)} onValueChange={(value) => selectLine(Number(value))}>
            <SelectTrigger className="w-64" aria-label="Ingrediente base">
              <SelectValue placeholder="Elige un ingrediente" />
            </SelectTrigger>
            <SelectContent>
              {lines.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name} · {formatKitchenQuantity(item.quantity, item.unit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Cantidad disponible</span>
          <div className="flex gap-2">
            <Input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              className="w-28 text-right tabular-nums"
              aria-label="Cantidad disponible"
              aria-invalid={!!error}
            />
            <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
              <SelectTrigger className="w-20" aria-label="Unidad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedUnits.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </label>
        {scaled.data && !error && <ScaledSummary data={scaled.data} isFetching={scaled.isFetching} />}
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
      {!error && candidate?.mode === 'anchor' && waste > 0 && (
        <p className="text-xs text-muted-foreground">
          Cantidad neta (ya limpia). Con merma de {formatPercent(line.waste_rate, 0)} equivale a{' '}
          {formatKitchenQuantity(String(Number(candidate.quantity) * (1 + waste)), unit)} en bruto.
        </p>
      )}
    </div>
  )
}

/** Factor, new yield, portions and the scaled batch cost (screen only; the printed sheet has no prices). */
function ScaledSummary({ data, isFetching }: { data: RecipeScaled; isFetching: boolean }) {
  const { cost, factor } = data
  return (
    <dl className={cn('flex flex-wrap gap-x-5 gap-y-1 self-center text-sm', isFetching && 'opacity-60')}>
      {[
        ['Factor', `×${formatQuantity(factor, 3)}`],
        ['Rendimiento', formatKitchenQuantity(cost.yield_qty, cost.yield_unit)],
        ['Porciones', formatQuantity(cost.portions, 2)],
        ['Costo de la tanda', formatCRC(cost.total_cost)],
      ].map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
