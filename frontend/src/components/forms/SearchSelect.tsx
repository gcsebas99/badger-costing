import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import { useState } from 'react'

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
import { cn, commandFilter, foldText } from '@/lib/utils'

export interface SearchOption {
  value: number
  label: string
  detail?: string
  group?: string
}

interface SearchSelectProps {
  id?: string
  options: SearchOption[]
  value: number | null
  onChange: (value: number | null) => void
  placeholder: string
  searchPlaceholder?: string
  clearable?: boolean
  /** Shown when `value` isn't among the options (e.g. a line whose catalog entry was deleted). */
  fallbackLabel?: string
  /** Adds a "Crear «…»" item for the typed text when no option has exactly that name. */
  onCreate?: (name: string) => void
}

/** Searchable single select over numeric ids, grouped by `group`. */
export function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar…',
  clearable = true,
  fallbackLabel,
  onCreate,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = options.find((o) => o.value === value)
  const label = selected?.label ?? fallbackLabel
  const typed = search.trim()
  const canCreate = onCreate !== undefined && typed !== '' && !options.some((o) => foldText(o.label) === foldText(typed))
  const groups = [...new Set(options.map((o) => o.group ?? ''))]

  return (
    <div className="flex gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between bg-surface-card font-normal', !label && 'text-muted-foreground')}
          >
            <span className="truncate">{label ?? placeholder}</span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command filter={commandFilter}>
            <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
            <CommandList>
              {!canCreate && <CommandEmpty>Sin resultados.</CommandEmpty>}
              {groups.map((group) => (
                <CommandGroup key={group} heading={group || undefined}>
                  {options
                    .filter((o) => (o.group ?? '') === group)
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.detail ?? ''} #${option.value}`}
                        onSelect={() => {
                          onChange(option.value)
                          setOpen(false)
                        }}
                      >
                        <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{option.label}</span>
                        {option.detail && (
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{option.detail}</span>
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
              {canCreate && (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`__create__ ${typed}`}
                    onSelect={() => {
                      onCreate(typed)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Plus className="size-4" />
                    <span className="truncate">Crear «{typed}»</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && selected && (
        <Button type="button" variant="ghost" size="icon" aria-label="Quitar selección" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  )
}
