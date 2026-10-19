import {
  ChefHat,
  FlaskConical,
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
  /** If set, "Nuevo" navigates here instead of adding `?nuevo=1` (full-page editors). */
  newPath?: string
  /** Placeholder for the top bar search; the page reads the term from `?q=`. */
  searchPlaceholder?: string
  /** Not shown in the sidebar (reached from other pages), but titled in the top bar. */
  hidden?: boolean
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
  {
    path: '/recetas',
    label: 'Recetas',
    icon: ChefHat,
    newLabel: 'Nueva receta',
    newPath: '/recetas/nueva',
    searchPlaceholder: 'Buscar receta…',
  },
  {
    path: '/productos',
    label: 'Productos',
    icon: UtensilsCrossed,
    newLabel: 'Nuevo producto',
    newPath: '/productos/nuevo',
    searchPlaceholder: 'Buscar producto…',
  },
  { path: '/ajustes', label: 'Ajustes', icon: Settings },
  { path: '/simulador', label: 'Simulador de impacto', icon: FlaskConical, hidden: true },
]

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )
}

export const NEW_PARAM = 'nuevo'
export const SEARCH_PARAM = 'q'
