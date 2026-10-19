import { Check, ChevronsUpDown, X } from 'lucide-react'
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
import { cn, commandFilter } from '@/lib/utils'

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
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const groups = [...new Set(options.map((o) => o.group ?? ''))]

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between bg-surface-card font-normal', !selected && 'text-muted-foreground')}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command filter={commandFilter}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
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
