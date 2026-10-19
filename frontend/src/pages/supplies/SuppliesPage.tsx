import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import {
  type Supply,
  type SupplyFilters as Filters,
  useDeleteSupply,
  useSupplies,
  useUpdateSupply,
} from '@/api/supplies'
import { DataTable } from '@/components/tables/DataTable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { NEW_PARAM, SEARCH_PARAM } from '@/navigation'

import { PriceHistorySheet } from './PriceHistorySheet'
import { supplyColumns } from './supplyColumns'
import { type StatusFilter, SupplyFilters } from './SupplyFilters'
import { SupplyFormDialog } from './SupplyFormDialog'

const STATUS_TO_ACTIVE: Record<StatusFilter, boolean | undefined> = {
  active: true,
  inactive: false,
  all: undefined,
}

export function SuppliesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = (searchParams.get('estado') as StatusFilter | null) ?? 'active'
  const filters: Filters = {
    q: searchParams.get(SEARCH_PARAM) || undefined,
    group: searchParams.get('grupo') || undefined,
    supplier: searchParams.get('proveedor') || undefined,
    active: STATUS_TO_ACTIVE[status] ?? undefined,
  }
  const { data: supplies, isPending, isError } = useSupplies(filters)

  const [editing, setEditing] = useState<Supply | null>(null)
  const [historyId, setHistoryId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Supply | null>(null)
  const isCreating = searchParams.get(NEW_PARAM) === '1'

  const { mutateAsync: updateSupply } = useUpdateSupply()
  const deleteSupply = useDeleteSupply()

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

  const columns = useMemo(
    () =>
      supplyColumns({
        onEdit: setEditing,
        onShowPrices: (supply) => setHistoryId(supply.id),
        onToggleActive: async (supply) => {
          try {
            await updateSupply({ id: supply.id, body: { active: !supply.active } })
            toast.success(supply.active ? 'Suministro desactivado.' : 'Suministro activado.')
          } catch (error) {
            toast.error(errorMessage(error))
          }
        },
        onDelete: setDeleting,
      }),
    [updateSupply],
  )

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteSupply.mutateAsync(deleting.id)
      toast.success('Suministro eliminado.')
      if (historyId === deleting.id) setHistoryId(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  const historySupply = supplies?.find((s) => s.id === historyId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SupplyFilters
          group={filters.group ?? null}
          supplier={filters.supplier ?? null}
          status={status}
          onChange={setParam}
          onClear={() =>
            setSearchParams(
              (params) => {
                ;['grupo', 'proveedor', 'estado'].forEach((key) => params.delete(key))
                return params
              },
              { replace: true },
            )
          }
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {supplies ? `${supplies.length} suministro${supplies.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      <section className="overflow-hidden rounded-lg border bg-surface-card">
        {isError ? (
          <p className="p-6 text-center text-sm text-bad">No se pudieron cargar los suministros.</p>
        ) : (
          <DataTable
            columns={columns}
            data={supplies ?? EMPTY}
            initialSorting={[{ id: 'name', desc: false }]}
            getRowId={(supply) => String(supply.id)}
            onRowClick={(supply) => setHistoryId(supply.id)}
            isRowMuted={(supply) => !supply.active}
            emptyMessage={
              isPending
                ? 'Cargando…'
                : filters.q || filters.group || filters.supplier
                  ? 'Ningún suministro coincide con los filtros.'
                  : 'Aún no hay suministros. Crea el primero con "Nuevo suministro".'
            }
          />
        )}
      </section>

      <SupplyFormDialog
        open={isCreating || editing !== null}
        supply={editing}
        onOpenChange={(open) => {
          if (open) return
          setEditing(null)
          if (isCreating) setParam(NEW_PARAM, null)
        }}
        onSaved={(supply) => {
          if (isCreating) setHistoryId(supply.id)
        }}
      />

      <PriceHistorySheet
        supplyId={historyId}
        onOpenChange={(open) => !open && setHistoryId(null)}
        onEdit={() => historySupply && setEditing(historySupply)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará junto con su historial de precios. Si solo ya no lo compras, mejor
              desactívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const EMPTY: Supply[] = []
