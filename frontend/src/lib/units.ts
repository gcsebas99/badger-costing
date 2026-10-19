import type { Unit } from '@/api/supplies'

export const UNITS: { value: Unit; label: string }[] = [
  { value: 'g', label: 'g (gramos)' },
  { value: 'kg', label: 'kg (kilogramos)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'L', label: 'L (litros)' },
  { value: 'pz', label: 'pz (piezas)' },
]

export const EQUIVALENCE_UNITS = UNITS.filter((u) => u.value !== 'pz')
