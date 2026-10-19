import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { usePlatforms } from '@/api/catalog'
import { errorMessage } from '@/api/client'
import { useProducts } from '@/api/products'
import { type SalesPeriodDetail, useSaveEntries } from '@/api/sales'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const key = (productId: number, platformId: number | null) => `${productId}:${platformId ?? 'direct'}`

/** Grid of units sold per product (rows) and channel (columns). */
export function SalesEditor({ period }: { period: SalesPeriodDetail }) {
  const { data: products = [] } = useProducts({})
  const { data: platforms = [] } = usePlatforms()
  const save = useSaveEntries()

  const saved = useMemo(
    () => Object.fromEntries(period.entries.map((e) => [key(e.product_id, e.platform_id ?? null), String(e.units)])),
    [period],
  )
  const [values, setValues] = useState<Record<string, string>>(saved)
  const [lastSaved, setLastSaved] = useState(saved)
  if (saved !== lastSaved) {
    // The period was saved or reloaded: show the server values.
    setLastSaved(saved)
    setValues(saved)
  }

  // Channels: direct + active platforms, plus any platform that already has units in this period.
  const usedPlatformIds = new Set(period.entries.map((e) => e.platform_id).filter((id) => id != null))
  const channels = [
    { id: null as number | null, name: 'Venta directa' },
    ...platforms.filter((p) => p.active || usedPlatformIds.has(p.id)).map((p) => ({ id: p.id as number | null, name: p.name })),
  ]
  const visibleProducts = products.filter((p) => p.active || period.entries.some((e) => e.product_id === p.id))
  const groups = new Map<string, typeof visibleProducts>()
  for (const product of visibleProducts) {
    groups.set(product.menu_group_name, [...(groups.get(product.menu_group_name) ?? []), product])
  }

  const invalid = Object.values(values).some((v) => v.trim() !== '' && !/^\d+$/.test(v.trim()))
  const dirty = JSON.stringify(normalize(values)) !== JSON.stringify(normalize(saved))

  async function handleSave() {
    const entries = Object.entries(normalize(values)).map(([k, units]) => {
      const [productId, platform] = k.split(':')
      return { product_id: Number(productId), platform_id: platform === 'direct' ? null : Number(platform), units }
    })
    try {
      await save.mutateAsync({ id: period.id, entries })
      toast.success('Ventas guardadas.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (visibleProducts.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Aún no hay productos activos para registrar ventas.</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              {channels.map((c) => (
                <TableHead key={c.id ?? 'direct'} className="w-36 text-right">
                  {c.name}
                </TableHead>
              ))}
              <TableHead className="w-24 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...groups.entries()].map(([groupName, rows]) => (
              <GroupRows key={groupName} name={groupName} span={channels.length + 2}>
                {rows.map((product) => {
                  const total = channels.reduce((sum, c) => sum + (Number(values[key(product.id, c.id)]) || 0), 0)
                  return (
                    <TableRow key={product.id} className="hover:bg-transparent">
                      <TableCell className="font-medium">{product.name}</TableCell>
                      {channels.map((c) => (
                        <TableCell key={c.id ?? 'direct'}>
                          <Input
                            value={values[key(product.id, c.id)] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [key(product.id, c.id)]: e.target.value }))}
                            inputMode="numeric"
                            placeholder="0"
                            aria-label={`Unidades de ${product.name} en ${c.name}`}
                            className="h-8 text-right tabular-nums"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="num font-medium">{total || ''}</TableCell>
                    </TableRow>
                  )
                })}
              </GroupRows>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={!dirty || invalid || save.isPending}>
          <Save />
          Guardar ventas
        </Button>
        {invalid && <span className="text-xs text-bad">Usa números enteros (unidades).</span>}
        {dirty && !invalid && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
      </div>
    </div>
  )
}

function GroupRows({ name, span, children }: { name: string; span: number; children: React.ReactNode }) {
  return (
    <>
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={span} className="h-8 text-xs font-semibold tracking-wide uppercase">
          {name}
        </TableCell>
      </TableRow>
      {children}
    </>
  )
}

/** Drop empty/zero cells so "" and "0" compare equal to "no entry". */
function normalize(values: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, Number(v.trim() || 0)] as const)
      .filter(([, n]) => Number.isInteger(n) && n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}
