import { Receipt } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { useClosings } from '@/api/closings'
import { useSettings } from '@/api/settings'
import { EmptyState } from '@/components/layout/EmptyState'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent } from '@/lib/format'

import { dateRange, profitClass } from './closingFormat'

export function ClosingStatusBadge({ status }: { status: 'draft' | 'closed' }) {
  return status === 'closed' ? <Badge variant="ok">Cerrado</Badge> : <Badge variant="craft">Borrador</Badge>
}

export function ClosingsPage() {
  const navigate = useNavigate()
  const { data: closings = [], isPending } = useClosings()
  const { data: settings } = useSettings()

  if (!isPending && closings.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Aún no hay cierres"
        description="Registra lo vendido, las horas de cocina y los gastos de una sesión para ver su ganancia neta. Usa «Nuevo cierre» arriba."
      />
    )
  }

  return (
    <section className="rounded-lg border bg-surface-card">
      <header className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Cierres de sesión</h2>
          <p className="text-xs text-muted-foreground">
            Se conservan los últimos {settings?.closings_to_keep ?? '…'} cierres (cámbialo en{' '}
            <Link to="/ajustes" className="text-primary hover:underline">Ajustes</Link>); al crear uno nuevo se elimina
            el más antiguo.
          </p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <Table className="min-w-[48rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Sesión</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Ganancia neta</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closings.map((closing) => (
              <TableRow key={closing.id} className="cursor-pointer" onClick={() => navigate(`/cierres/${closing.id}`)}>
                <TableCell className="font-medium">
                  <Link to={`/cierres/${closing.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {closing.name}
                  </Link>
                  {!closing.complete && (
                    <Badge variant="warn" className="ml-2">Costo incompleto</Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{dateRange(closing.start_date, closing.end_date)}</TableCell>
                <TableCell><ClosingStatusBadge status={closing.status} /></TableCell>
                <TableCell className="num">{formatCRC(closing.billed_amount)}</TableCell>
                <TableCell className="num">{formatCRC(closing.total_expenses)}</TableCell>
                <TableCell className={`num font-medium ${profitClass(closing.net_profit)}`}>
                  {formatCRC(closing.net_profit)}
                </TableCell>
                <TableCell className="num">{formatPercent(closing.net_margin_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
