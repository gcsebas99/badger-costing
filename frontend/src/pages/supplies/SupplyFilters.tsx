import { useSupplyFacets } from '@/api/supplies'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = '__all__'

export type StatusFilter = 'active' | 'inactive' | 'all'

interface SupplyFiltersProps {
  group: string | null
  supplier: string | null
  status: StatusFilter
  onChange: (key: 'grupo' | 'proveedor' | 'estado', value: string | null) => void
  onClear: () => void
}

export function SupplyFilters({ group, supplier, status, onChange, onClear }: SupplyFiltersProps) {
  const { data: facets } = useSupplyFacets()
  const hasFilters = group !== null || supplier !== null || status !== 'active'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Grupo"
        value={group}
        options={facets?.groups ?? []}
        onChange={(value) => onChange('grupo', value)}
      />
      <FilterSelect
        label="Proveedor"
        value={supplier}
        options={facets?.suppliers ?? []}
        onChange={(value) => onChange('proveedor', value)}
      />
      <Select
        value={status}
        onValueChange={(value) => onChange('estado', value === 'active' ? null : value)}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="link" size="sm" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: string[]
  onChange: (value: string | null) => void
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger size="sm" className="w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{`${label}: todos`}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
