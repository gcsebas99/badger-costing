import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/layout/EmptyState'

export function NotFoundPage() {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={FileQuestion}
        title="Página no encontrada"
        description="La dirección que abriste no existe."
      />
      <p className="text-center text-sm">
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          Volver al Dashboard
        </Link>
      </p>
    </div>
  )
}
