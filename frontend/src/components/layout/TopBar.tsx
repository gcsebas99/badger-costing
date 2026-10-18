import { Plus, Search } from 'lucide-react'
import { useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findNavItem } from '@/navigation'

export function TopBar() {
  const { pathname } = useLocation()
  const current = findNavItem(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-surface-card px-6">
      <h1 className="text-base font-semibold">{current?.label ?? 'Página no encontrada'}</h1>

      <div className="relative ml-auto w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" placeholder="Buscar…" className="h-8 pl-8" aria-label="Buscar" />
      </div>

      {current?.newLabel && (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper keeps the tooltip working on a disabled button */}
            <span tabIndex={0}>
              <Button size="sm" disabled>
                <Plus />
                {current.newLabel}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponible próximamente</TooltipContent>
        </Tooltip>
      )}
    </header>
  )
}
