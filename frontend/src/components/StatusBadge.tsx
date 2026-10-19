import type { AlertLevel } from '@/api/products'
import { Badge } from '@/components/ui/badge'

/** Colored badge for an alert level; children is the value shown (e.g. "34,5 %"). */
export function StatusBadge({ level, children, title }: { level: AlertLevel; children: React.ReactNode; title?: string }) {
  return (
    <Badge variant={level} title={title} className="tabular-nums">
      {children}
    </Badge>
  )
}

/** Suggested price: gold on black (gold is never text on white). */
export function SuggestedPrice({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded bg-brand-black px-1.5 py-0.5 text-xs font-medium text-brand-gold tabular-nums">
      {children}
    </span>
  )
}
