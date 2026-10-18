import { useHealth } from '@/api/health'
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

// Sample rows to review density, number alignment and badge colors until real data exists (M3/M4).
const SAMPLE_ROWS = [
  { name: 'Hamburguesa clásica', group: 'Hamburguesas', price: '4500', cost: '1385.75', foodCost: '0.348', status: 'ok' },
  { name: 'Hamburguesa chipotle', group: 'Hamburguesas', price: '5200', cost: '1912.4', foodCost: '0.414', status: 'warn' },
  { name: 'Papas trufadas', group: 'Acompañamientos', price: '2800', cost: '1290', foodCost: '0.521', status: 'bad' },
] as const

const STATUS_LABEL = { ok: 'En objetivo', warn: 'Revisar', bad: 'Bajo umbral' } as const

export function DashboardPage() {
  const { data, isError } = useHealth()

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="Estado de la API" value={isError ? 'Sin conexión' : data ? 'Conectada' : '…'} />
        <Kpi label="Base de datos" value={data?.database === 'ok' ? 'OK' : isError ? '—' : '…'} />
        <Kpi label="Versión" value={data?.version ?? '—'} highlight />
      </section>

      <section className="rounded-lg border bg-surface-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold">Vista previa de estilos</h2>
          <span className="text-xs text-muted-foreground">Datos de ejemplo</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">PVP</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">% costo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ROWS.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant="craft">{row.group}</Badge>
                </TableCell>
                <TableCell className="num">{formatCRC(row.price)}</TableCell>
                <TableCell className="num">{formatCRC(row.cost)}</TableCell>
                <TableCell className="num">{formatPercent(row.foodCost)}</TableCell>
                <TableCell>
                  <Badge variant={row.status}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}

function Kpi({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded-lg bg-brand-black p-4' : 'rounded-lg border bg-surface-card p-4'}>
      <div className={highlight ? 'text-xs text-sidebar-muted' : 'text-xs text-muted-foreground'}>
        {label}
      </div>
      {/* Gold is only used as text on black (contrast rule). */}
      <div className={highlight ? 'mt-1 text-xl font-semibold text-brand-gold tabular-nums' : 'mt-1 text-xl font-semibold'}>
        {value}
      </div>
    </div>
  )
}
