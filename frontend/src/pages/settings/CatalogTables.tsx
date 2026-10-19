import { Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import {
  type MenuGroup,
  type Platform,
  useCreateMenuGroup,
  useCreatePlatform,
  useDeleteMenuGroup,
  useDeletePlatform,
  useMenuGroups,
  usePlatforms,
  useUpdateMenuGroup,
  useUpdatePlatform,
} from '@/api/catalog'
import { errorMessage } from '@/api/client'
import { useSettings } from '@/api/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPercent, percentInputToRate, rateToPercentInput } from '@/lib/format'

/** Text input that saves on blur / Enter when its value changed. */
function InlineInput({
  value,
  onSave,
  label,
  numeric = false,
  placeholder,
}: {
  value: string
  onSave: (value: string) => Promise<void>
  label: string
  numeric?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    // Server value changed (after save or refetch): show it.
    setLastValue(value)
    setDraft(value)
  }

  async function commit() {
    if (draft.trim() === value.trim()) return
    try {
      await onSave(draft)
    } catch (error) {
      toast.error(errorMessage(error))
      setDraft(value)
    }
  }

  return (
    <Input
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      inputMode={numeric ? 'decimal' : undefined}
      className={numeric ? 'h-8 text-right tabular-nums' : 'h-8'}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
    />
  )
}

function parseRate(value: string): string {
  const rate = percentInputToRate(value)
  if (rate === null || Number(rate) > 1) throw new Error('Porcentaje inválido')
  return rate
}

export function MenuGroupsTable() {
  const { data: groups = [] } = useMenuGroups()
  const { data: settings } = useSettings()
  const create = useCreateMenuGroup()
  const update = useUpdateMenuGroup()
  const remove = useDeleteMenuGroup()
  const [name, setName] = useState('')

  const defaultLabel = settings ? `Por defecto (${formatPercent(settings.target_food_cost_rate, 0)})` : 'Por defecto'

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync({ name: name.trim(), position: groups.length })
      setName('')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function saveTarget(group: MenuGroup, value: string) {
    const rate = value.trim() ? parseRate(value) : null
    if (rate === '0') throw new Error('Debe ser mayor que 0')
    await update.mutateAsync({ id: group.id, body: { target_food_cost_rate: rate } })
  }

  return (
    <div className="space-y-3 p-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="w-48 text-right">Food cost objetivo %</TableHead>
              <TableHead className="w-24 text-right">Productos</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                  Aún no hay grupos. Crea los del menú: Hamburguesas, Acompañamientos, Bebidas…
                </TableCell>
              </TableRow>
            )}
            {groups.map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                <TableCell>
                  <InlineInput label={`Nombre de ${group.name}`} value={group.name}
                    onSave={async (v) => void (await update.mutateAsync({ id: group.id, body: { name: v } }))} />
                </TableCell>
                <TableCell>
                  <InlineInput numeric label={`Food cost objetivo de ${group.name}`} placeholder={defaultLabel}
                    value={rateToPercentInput(group.target_food_cost_rate)}
                    onSave={(v) => saveTarget(group, v)} />
                </TableCell>
                <TableCell className="num">{group.product_count}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${group.name}`}
                    onClick={() => remove.mutateAsync(group.id).catch((e) => toast.error(errorMessage(e)))}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo grupo…"
          aria-label="Nombre del nuevo grupo" className="h-8 max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
          <Plus />
          Agregar grupo
        </Button>
      </form>
    </div>
  )
}

export function PlatformsTable() {
  const { data: platforms = [] } = usePlatforms()
  const create = useCreatePlatform()
  const update = useUpdatePlatform()
  const remove = useDeletePlatform()
  const [name, setName] = useState('')
  const [fee, setFee] = useState('')

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      await create.mutateAsync({ name: name.trim(), fee_rate: parseRate(fee || '0'), active: true })
      setName('')
      setFee('')
    } catch (error) {
      toast.error(error instanceof Error && !('status' in error) ? error.message : errorMessage(error))
    }
  }

  async function savePlatform(platform: Platform, body: Parameters<typeof update.mutateAsync>[0]['body']) {
    await update.mutateAsync({ id: platform.id, body })
  }

  return (
    <div className="space-y-3 p-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead className="w-40 text-right">Comisión %</TableHead>
              <TableHead className="w-24">Activa</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {platforms.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                  Aún no hay plataformas. Agrega Uber Eats, Rappi o DiDi Food cuando vendas por ahí.
                </TableCell>
              </TableRow>
            )}
            {platforms.map((platform) => (
              <TableRow key={platform.id} className="hover:bg-transparent">
                <TableCell>
                  <InlineInput label={`Nombre de ${platform.name}`} value={platform.name}
                    onSave={(v) => savePlatform(platform, { name: v })} />
                </TableCell>
                <TableCell>
                  <InlineInput numeric label={`Comisión de ${platform.name}`}
                    value={rateToPercentInput(platform.fee_rate) || '0'}
                    onSave={(v) => savePlatform(platform, { fee_rate: parseRate(v) })} />
                </TableCell>
                <TableCell>
                  <Switch checked={platform.active} aria-label={`${platform.name} activa`}
                    onCheckedChange={(active) =>
                      savePlatform(platform, { active }).catch((e) => toast.error(errorMessage(e)))} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${platform.name}`}
                    onClick={() => remove.mutateAsync(platform.id).catch((e) => toast.error(errorMessage(e)))}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Uber Eats)"
          aria-label="Nombre de la nueva plataforma" className="h-8 max-w-xs" />
        <Input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Comisión %"
          aria-label="Comisión de la nueva plataforma" inputMode="decimal" className="h-8 w-28 text-right" />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
          <Plus />
          Agregar plataforma
        </Button>
      </form>
    </div>
  )
}
