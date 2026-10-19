import { AlertTriangle, UtensilsCrossed } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { useMenuGroups } from '@/api/catalog'
import { type ProductSummary, useProducts } from '@/api/products'
import { useSettings } from '@/api/settings'
import { EmptyState } from '@/components/layout/EmptyState'
import { StatusBadge, SuggestedPrice } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCRC, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SEARCH_PARAM } from '@/navigation'

const ALL = '__all__'

export function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupId = searchParams.get('grupo')
  const onlyAlerts = searchParams.get('alertas') === '1'
  const showInactive = searchParams.get('inactivos') === '1'

  const { data: products, isPending, isError } = useProducts({
    q: searchParams.get(SEARCH_PARAM) || undefined,
    menu_group_id: groupId ? Number(groupId) : undefined,
    active: showInactive ? undefined : true,
  })
  const { data: groups = [] } = useMenuGroups()
  const { data: settings } = useSettings()

  function setParam(key: string, value: string | null) {
    setSearchParams(
      (params) => {
        if (value) params.set(key, value)
        else params.delete(key)
        return params
      },
      { replace: true },
    )
  }

  const visible = (products ?? []).filter((p) => !onlyAlerts || p.status !== 'ok')
  const byGroup = new Map<string, ProductSummary[]>()
  for (const product of visible) {
    byGroup.set(product.menu_group_name, [...(byGroup.get(product.menu_group_name) ?? []), product])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={groupId ?? ALL} onValueChange={(v) => setParam('grupo', v === ALL ? null : v)}>
          <SelectTrigger size="sm" className="w-48" aria-label="Grupo del menú">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Grupo: todos</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyAlerts} onCheckedChange={(v) => setParam('alertas', v ? '1' : null)} />
          Solo con alertas
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={(v) => setParam('inactivos', v ? '1' : null)} />
          Incluir inactivos
        </label>
        {settings && (
          <span className="ml-auto text-xs text-muted-foreground">
            IVA {formatPercent(settings.vat_rate, 0)} · Margen mínimo {formatPercent(settings.margin_alert_rate, 0)} ·{' '}
            <Link to="/ajustes" className="text-primary hover:underline">
              Ajustes
            </Link>
          </span>
        )}
      </div>

      {isError ? (
        <p className="rounded-lg border bg-surface-card p-6 text-center text-sm text-bad">
          No se pudieron cargar los productos.
        </p>
      ) : isPending ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Primero crea los grupos del menú"
          description="En Ajustes → Grupos del menú (Hamburguesas, Acompañamientos, Bebidas…). Luego crea productos con “Nuevo producto”."
        />
      ) : byGroup.size === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={onlyAlerts ? 'Ningún producto con alertas' : 'Aún no hay productos'}
          description={onlyAlerts ? 'Todos los precios están dentro de los objetivos.' : 'Crea el primero con “Nuevo producto”.'}
        />
      ) : (
        [...byGroup.entries()].map(([groupName, rows]) => (
          <section key={groupName} className="overflow-hidden rounded-lg border bg-surface-card">
            <h2 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
              {groupName}
              <span className="text-xs font-normal text-muted-foreground">
                food cost objetivo {formatPercent(rows[0].target_food_cost_rate, 0)}
              </span>
            </h2>
            <div className="overflow-x-auto">
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">PVP</TableHead>
                    <TableHead className="text-right">Sin IVA</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">% Costo</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">% Margen</TableHead>
                    <TableHead className="text-right">Precio sugerido</TableHead>
                    <TableHead className="text-right">Desviación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((product) => (
                    <ProductRows key={product.id} product={product} onOpen={() => navigate(`/productos/${product.id}`)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function ProductRows({ product, onOpen }: { product: ProductSummary; onOpen: () => void }) {
  const span = Math.max(product.channels.length, 1)
  const productCells = (
    <TableCell rowSpan={span} className="align-top">
      <div className="flex items-center gap-2 py-2.5">
        <StatusDot level={product.status} />
        <span className="font-medium">{product.name}</span>
        {!product.active && <Badge variant="outline">Inactivo</Badge>}
      </div>
      {product.recipe_name && <div className="-mt-1.5 pb-2 pl-4 text-xs text-muted-foreground">{product.recipe_name}</div>}
    </TableCell>
  )
  const trailingCells = (
    <>
      <TableCell rowSpan={span} className="num align-top">
        <div className="py-2.5">
          {product.suggested_price ? <SuggestedPrice>{formatCRC(product.suggested_price, 0)}</SuggestedPrice> : '—'}
        </div>
      </TableCell>
      <TableCell rowSpan={span} className="num align-top">
        <div className="py-2.5">
          {product.deviation == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <StatusBadge level={product.deviation_status} title={`Costo teórico ${formatCRC(product.target_cost)}`}>
              {Number(product.deviation) > 0 ? '+' : ''}
              {formatPercent(product.deviation)}
            </StatusBadge>
          )}
        </div>
      </TableCell>
    </>
  )
  const costCell = (
    <span className="inline-flex items-center gap-1">
      {!product.complete && <AlertTriangle className="size-3.5 text-warn" aria-label="Costo incompleto" />}
      {formatCRC(product.total_cost)}
    </span>
  )

  if (product.channels.length === 0) {
    return (
      <TableRow className="cursor-pointer" onClick={onOpen}>
        {productCells}
        <TableCell colSpan={3} className="text-muted-foreground">
          Sin precio de venta
        </TableCell>
        <TableCell className="num">{costCell}</TableCell>
        <TableCell colSpan={4} />
        {trailingCells}
      </TableRow>
    )
  }

  return (
    <>
      {product.channels.map((channel, index) => (
        <TableRow key={channel.platform_id ?? 'direct'} className="cursor-pointer" onClick={onOpen}>
          {index === 0 && productCells}
          <TableCell>
            <span className={cn(channel.kind === 'platform' && 'text-muted-foreground')}>{channel.name}</span>
          </TableCell>
          <TableCell className="num">{formatCRC(channel.price)}</TableCell>
          <TableCell className="num text-muted-foreground">{formatCRC(channel.price_ex_vat)}</TableCell>
          <TableCell className="num">{costCell}</TableCell>
          <TableCell className="num">
            <StatusBadge level={channel.food_cost_status}>{formatPercent(channel.food_cost_rate)}</StatusBadge>
          </TableCell>
          <TableCell className="num text-muted-foreground">
            {formatCRC(channel.fee)}
            <span className="ml-1 text-xs">({formatPercent(channel.fee_rate)})</span>
          </TableCell>
          <TableCell className="num font-medium">{formatCRC(channel.margin)}</TableCell>
          <TableCell className="num">
            <StatusBadge level={channel.margin_status}>{formatPercent(channel.margin_rate)}</StatusBadge>
          </TableCell>
          {index === 0 && trailingCells}
        </TableRow>
      ))}
    </>
  )
}

function StatusDot({ level }: { level: ProductSummary['status'] }) {
  const color = level === 'bad' ? 'bg-bad' : level === 'warn' ? 'bg-warn' : 'bg-ok'
  const label = level === 'bad' ? 'Requiere revisión' : level === 'warn' ? 'Revisar' : 'En objetivo'
  return <span className={cn('size-2 shrink-0 rounded-full', color)} title={label} aria-label={label} />
}
