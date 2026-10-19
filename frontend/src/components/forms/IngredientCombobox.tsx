import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import type { IngredientOption } from '@/api/recipes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatUnitCost } from '@/lib/format'
import { cn, commandFilter } from '@/lib/utils'

export interface IngredientRef {
  item_type: IngredientOption['item_type']
  id: number
}

interface IngredientComboboxProps {
  options: IngredientOption[]
  value: IngredientRef | null
  onChange: (option: IngredientOption) => void
  invalid?: boolean
  id?: string
}

const optionKey = (o: IngredientRef) => `${o.item_type}-${o.id}`

/** Searchable picker over supplies and sub-recipes. */
export function IngredientCombobox({ options, value, onChange, invalid, id }: IngredientComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? options.find((o) => optionKey(o) === optionKey(value)) : undefined
  const supplies = options.filter((o) => o.item_type === 'supply')
  const subrecipes = options.filter((o) => o.item_type === 'recipe')

  function renderOption(option: IngredientOption) {
    const isSelected = selected !== undefined && optionKey(option) === optionKey(selected)
    return (
      <CommandItem
        key={optionKey(option)}
        // cmdk filters on `value`; include name and detail so brand/category are searchable.
        value={`${option.name} ${option.detail ?? ''} ${optionKey(option)}`}
        onSelect={() => {
          onChange(option)
          setOpen(false)
        }}
      >
        <Check className={cn('size-4', isSelected ? 'opacity-100' : 'opacity-0')} />
        <span className="truncate">{option.name}</span>
        {option.detail && <span className="truncate text-xs text-muted-foreground">{option.detail}</span>}
        {!option.active && <Badge variant="outline">Inactivo</Badge>}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {option.reference_unit_cost === null
            ? 'sin precio'
            : `${formatUnitCost(option.reference_unit_cost)} / ${option.reference_unit}`}
        </span>
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            'h-8 w-full justify-between bg-surface-card px-2 font-normal',
            !selected && 'text-muted-foreground',
            invalid && 'border-destructive',
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{selected ? selected.name : 'Elegir ingrediente…'}</span>
            {selected?.item_type === 'recipe' && <Badge variant="craft">Sub-receta</Badge>}
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[28rem] p-0" align="start">
        <Command filter={commandFilter}>
          <CommandInput placeholder="Buscar suministro o sub-receta…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {subrecipes.length > 0 && <CommandGroup heading="Sub-recetas">{subrecipes.map(renderOption)}</CommandGroup>}
            <CommandGroup heading="Suministros">{supplies.map(renderOption)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
