import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/navigation'

import { ApiStatus } from './ApiStatus'

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="grid size-8 place-items-center rounded-md bg-brand-gold text-sm font-extrabold text-brand-black">
          BG
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Badger Grub</div>
          <div className="text-xs text-brand-gold">Costeo</div>
        </div>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-white',
                'focus-visible:ring-2 focus-visible:ring-sidebar-indicator focus-visible:outline-none',
                isActive && 'bg-sidebar-accent font-medium text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-sidebar-indicator" />
                )}
                <Icon className={cn('size-4', isActive ? 'text-brand-gold' : 'text-sidebar-muted')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <ApiStatus />
      </div>
    </aside>
  )
}
