import {
  ChefHat,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  UtensilsCrossed,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Label for the top bar "Nuevo" action; the page opens its form on `?nuevo=1`. */
  newLabel?: string
  /** Placeholder for the top bar search; the page reads the term from `?q=`. */
  searchPlaceholder?: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    path: '/suministros',
    label: 'Suministros',
    icon: Package,
    newLabel: 'Nuevo suministro',
    searchPlaceholder: 'Buscar suministro o marca…',
  },
  { path: '/recetas', label: 'Recetas', icon: ChefHat },
  { path: '/productos', label: 'Productos', icon: UtensilsCrossed },
  { path: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )
}

export const NEW_PARAM = 'nuevo'
export const SEARCH_PARAM = 'q'
