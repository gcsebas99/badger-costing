import { Settings } from 'lucide-react'

import { EmptyState } from '@/components/layout/EmptyState'

export function SettingsPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Ajustes"
      description="Aquí se configurarán el IVA, la comisión bancaria, las plataformas, los umbrales de margen y el % de food cost objetivo."
    />
  )
}
