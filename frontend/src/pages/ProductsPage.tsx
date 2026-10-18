import { UtensilsCrossed } from 'lucide-react'

import { EmptyState } from '@/components/layout/EmptyState'

export function ProductsPage() {
  return (
    <EmptyState
      icon={UtensilsCrossed}
      title="Aún no hay productos"
      description="Aquí vivirán los productos de venta con su empaque, precio por canal y margen."
    />
  )
}
