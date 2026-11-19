import { Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import {
  useCollaborators,
  useCreateCollaborator,
  useCreateExpenseType,
  useDeleteCollaborator,
  useDeleteExpenseType,
  useExpenseTypes,
  useUpdateCollaborator,
  useUpdateExpenseType,
} from '@/api/closings'
import { errorMessage } from '@/api/client'
import { useSettings, useUpdateSettings } from '@/api/settings'
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
import { formatCRC, parseDecimalInput, toDecimalInput } from '@/lib/format'

import { InlineInput } from './CatalogTables'

function parseRate(value: string): string {
  const parsed = value.trim() ? parseDecimalInput(value) : '0'
  if (parsed === null) throw new Error('Monto inválido.')
  return parsed
}

const showError = (error: unknown) =>
  toast.error(error instanceof Error && !('status' in error) ? error.message : errorMessage(error))

export function ClosingsToKeep() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  if (!settings) return null

  async function save(value: string) {
    const keep = Number(value.trim())
    if (!Number.isInteger(keep) || keep < 1 || keep > 100) throw new Error('Entre 1 y 100.')
    await update.mutateAsync({ closings_to_keep: keep })
    toast.success('Ajuste guardado.')
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-4 text-sm">
      <span>Cierres a conservar</span>
      <div className="w-20">
        <InlineInput numeric label="Cierres a conservar" value={String(settings.closings_to_keep)}
          onSave={save} />
      </div>
      <span className="text-xs text-muted-foreground">Al crear uno nuevo por encima de este número se elimina el más antiguo.</span>
    </div>
  )
}

export function CollaboratorsTable() {
  const { data: collaborators = [] } = useCollaborators()
  const create = useCreateCollaborator()
  const update = useUpdateCollaborator()
  const remove = useDeleteCollaborator()
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      await create.mutateAsync({ name: name.trim(), hourly_rate: parseRate(rate), active: true })
      setName('')
      setRate('')
    } catch (error) {
      showError(error)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-medium">Colaboradores</h3>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-44 text-right">Costo por hora</TableHead>
              <TableHead className="w-24">Activo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {collaborators.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                  Aún no hay colaboradores. También puedes crearlos desde un cierre.
                </TableCell>
              </TableRow>
            )}
            {collaborators.map((c) => (
              <TableRow key={c.id} className="hover:bg-transparent">
                <TableCell>
                  <InlineInput label={`Nombre de ${c.name}`} value={c.name}
                    onSave={async (v) => void (await update.mutateAsync({ id: c.id, body: { name: v } }))} />
                </TableCell>
                <TableCell>
                  <InlineInput numeric label={`Costo por hora de ${c.name}`} placeholder={formatCRC(0, 0)}
                    value={Number(c.hourly_rate) === 0 ? '' : toDecimalInput(c.hourly_rate)}
                    onSave={async (v) => void (await update.mutateAsync({ id: c.id, body: { hourly_rate: parseRate(v) } }))} />
                </TableCell>
                <TableCell>
                  <Switch checked={c.active} aria-label={`${c.name} activo`}
                    onCheckedChange={(active) => update.mutateAsync({ id: c.id, body: { active } }).catch(showError)} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${c.name}`}
                    title="Los cierres guardados conservan su nombre y tarifa"
                    onClick={() => remove.mutateAsync(c.id).catch(showError)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre"
          aria-label="Nombre del nuevo colaborador" className="h-8 max-w-xs" />
        <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="₡ por hora"
          aria-label="Costo por hora del nuevo colaborador" inputMode="decimal" className="h-8 w-32 text-right" />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
          <Plus />
          Agregar colaborador
        </Button>
      </form>
    </div>
  )
}

export function ExpenseTypesTable() {
  const { data: expenseTypes = [] } = useExpenseTypes()
  const create = useCreateExpenseType()
  const update = useUpdateExpenseType()
  const remove = useDeleteExpenseType()
  const [name, setName] = useState('')

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      await create.mutateAsync(name.trim())
      setName('')
    } catch (error) {
      showError(error)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-medium">Otros gastos</h3>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gasto</TableHead>
              <TableHead className="w-44 text-right">Último monto</TableHead>
              <TableHead className="w-24">Activo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseTypes.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                  Aún no hay gastos. Ej.: aceite de fritura, electricidad, agua, gas.
                </TableCell>
              </TableRow>
            )}
            {expenseTypes.map((e) => (
              <TableRow key={e.id} className="hover:bg-transparent">
                <TableCell>
                  <InlineInput label={`Nombre de ${e.name}`} value={e.name}
                    onSave={async (v) => void (await update.mutateAsync({ id: e.id, body: { name: v } }))} />
                </TableCell>
                <TableCell className="num">{formatCRC(e.last_amount)}</TableCell>
                <TableCell>
                  <Switch checked={e.active} aria-label={`${e.name} activo`}
                    onCheckedChange={(active) => update.mutateAsync({ id: e.id, body: { active } }).catch(showError)} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${e.name}`}
                    title="Los cierres guardados conservan el nombre y el monto"
                    onClick={() => remove.mutateAsync(e.id).catch(showError)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Nuevo gasto…"
          aria-label="Nombre del nuevo gasto" className="h-8 max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
          <Plus />
          Agregar gasto
        </Button>
      </form>
    </div>
  )
}
