import { useHealth } from '@/api/health'
import { cn } from '@/lib/utils'

export function ApiStatus() {
  const { data, isPending, isError } = useHealth()
  const healthy = !isError && data?.database === 'ok'

  const label = isPending ? 'Conectando…' : healthy ? 'API conectada' : 'API sin conexión'

  return (
    <div className="flex items-center gap-2 text-xs text-sidebar-muted" role="status">
      <span
        className={cn(
          'size-2 rounded-full',
          isPending ? 'bg-sidebar-muted' : healthy ? 'bg-emerald-500' : 'bg-red-500',
        )}
      />
      <span>{label}</span>
      {data?.version && <span className="ml-auto tabular-nums">v{data.version}</span>}
    </div>
  )
}
