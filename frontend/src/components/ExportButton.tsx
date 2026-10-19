import { Download } from 'lucide-react'

import { type ExportKind, exportUrl } from '@/api/insights'
import { Button } from '@/components/ui/button'

/** Downloads the CSV export (opens in Excel with Spanish separators). */
export function ExportButton({ kind }: { kind: ExportKind }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={exportUrl(kind)} download>
        <Download />
        Exportar CSV
      </a>
    </Button>
  )
}
