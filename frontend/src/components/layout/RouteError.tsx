import { AlertTriangle } from 'lucide-react'
import { Link, useRouteError } from 'react-router'

/** Shown instead of a blank page when a screen throws while rendering. */
export function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-lg border bg-surface-card p-6 text-center">
      <AlertTriangle className="mx-auto size-6 text-bad" />
      <h2 className="text-sm font-semibold">Algo salió mal en esta pantalla</h2>
      <p className="text-xs break-words text-muted-foreground">{message}</p>
      <div className="flex justify-center gap-3 text-sm">
        <button type="button" className="text-primary hover:underline" onClick={() => window.location.reload()}>
          Recargar
        </button>
        <Link to="/" className="text-primary hover:underline">
          Ir al Dashboard
        </Link>
      </div>
    </div>
  )
}
