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
  /** Label for the top bar "Nuevo" action on this page; omitted when the page has none. */
  newLabel?: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/suministros', label: 'Suministros', icon: Package, newLabel: 'Nuevo suministro' },
  { path: '/recetas', label: 'Recetas', icon: ChefHat, newLabel: 'Nueva receta' },
  { path: '/productos', label: 'Productos', icon: UtensilsCrossed, newLabel: 'Nuevo producto' },
  { path: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )
}
