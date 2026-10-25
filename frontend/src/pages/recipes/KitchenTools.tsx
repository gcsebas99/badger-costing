import { Calculator, ChefHat, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { useScaledRecipe } from '@/api/recipes'
import { PrintPreviewDialog } from '@/components/PrintPreviewDialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCRC, formatKitchenQuantity, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'

import { kitchenSheetUrl, ONE_BATCH, type ScaleSelection, scaleToQuery } from './kitchenScale'

const MULTIPLIERS = ['0.5', '2', '3', '4'] as const

type Tool = 'sheet' | 'multiply'

/** Kitchen sheet and batch tools for a saved recipe. Disabled while the editor has unsaved changes. */
export function KitchenTools({ recipeId, disabled }: { recipeId: number; disabled: boolean }) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [factor, setFactor] = useState<string>('2')
  const close = (open: boolean) => !open && setTool(null)
  const multiplied: ScaleSelection = { mode: 'factor', factor }

  return (
    <>
      <ToolButton icon={ChefHat} label="Ficha para cocina" disabled={disabled} onClick={() => setTool('sheet')} />
      <ToolButton icon={Calculator} label="Multiplicar" disabled={disabled} onClick={() => setTool('multiply')} />

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
        controls={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <MultiplierPicker value={factor} onChange={setFactor} />
            <ScaledSummary recipeId={recipeId} selection={multiplied} />
          </div>
        }
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

function MultiplierPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Multiplicador" className="inline-flex rounded-md border bg-surface-card p-0.5">
      {MULTIPLIERS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'h-8 min-w-14 rounded-sm px-3 text-sm font-semibold tabular-nums transition-colors',
            value === option ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
          )}
        >
          ×{formatQuantity(option, 1)}
        </button>
      ))}
    </div>
  )
}

/** New yield, portions and the scaled batch cost (screen only; the printed sheet has no prices). */
export function ScaledSummary({ recipeId, selection }: { recipeId: number; selection: ScaleSelection | null }) {
  const scaled = useScaledRecipe(recipeId, selection ? scaleToQuery(selection) : null)
  if (!selection || !scaled.data) return null
  const { cost, factor } = scaled.data
  return (
    <dl className={cn('flex flex-wrap gap-x-5 gap-y-1 text-sm', scaled.isFetching && 'opacity-60')}>
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
