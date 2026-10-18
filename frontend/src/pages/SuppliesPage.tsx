import { Package } from 'lucide-react'

import { EmptyState } from '@/components/layout/EmptyState'

export function SuppliesPage() {
  return (
    <EmptyState
      icon={Package}
      title="Aún no hay suministros"
      description="Aquí vivirá el catálogo de insumos con su costo por empaque, costo unitario e historial de precios."
    />
  )
}
