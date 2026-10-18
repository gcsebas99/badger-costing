import { ChefHat } from 'lucide-react'

import { EmptyState } from '@/components/layout/EmptyState'

export function RecipesPage() {
  return (
    <EmptyState
      icon={ChefHat}
      title="Aún no hay recetas"
      description="Aquí vivirán las recetas y sub-recetas con su costo total, por unidad y por porción."
    />
  )
}
