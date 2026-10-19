import type { ReactNode } from 'react'

import { BackupsSection } from './BackupsSection'
import { MenuGroupsTable, PlatformsTable } from './CatalogTables'
import { SettingsForm } from './SettingsForm'

export function SettingsPage() {
  return (
    <div className="max-w-5xl space-y-4">
      <Section title="General" description="Impuestos, comisiones y umbrales de alerta para el análisis de precios.">
        <SettingsForm />
      </Section>
      <Section title="Grupos del menú" description="Cada producto pertenece a un grupo; deja el food cost vacío para usar el de por defecto.">
        <MenuGroupsTable />
      </Section>
      <Section title="Plataformas de delivery" description="Su comisión se descuenta del margen en lugar de la comisión bancaria.">
        <PlatformsTable />
      </Section>
      <Section title="Respaldos" description="Copia completa de la base de datos (suministros, recetas, productos y ajustes).">
        <BackupsSection />
      </Section>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-surface-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}
