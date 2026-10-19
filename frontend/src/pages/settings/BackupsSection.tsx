import { DatabaseBackup, Download } from 'lucide-react'
import { toast } from 'sonner'

import { errorMessage } from '@/api/client'
import { backupUrl, useBackups, useCreateBackup } from '@/api/insights'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const dateTime = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' })

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function BackupsSection() {
  const { data: backups = [] } = useBackups()
  const create = useCreateBackup()

  async function backupNow() {
    try {
      const backup = await create.mutateAsync()
      toast.success(`Respaldo creado: ${backup.name}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={backupNow} disabled={create.isPending}>
          <DatabaseBackup />
          Crear respaldo ahora
        </Button>
        <p className="text-xs text-muted-foreground">
          Se guardan en <code>data/backups/</code>. Descarga una copia y guárdala fuera de la computadora
          (o usa <code>make backup BACKUP_DIR=…</code>).
        </p>
      </div>
      {backups.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Respaldo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Tamaño</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.slice(0, 10).map((backup) => (
                <TableRow key={backup.name}>
                  <TableCell className="font-mono text-xs">{backup.name}</TableCell>
                  <TableCell>{dateTime.format(new Date(backup.created_at))}</TableCell>
                  <TableCell className="num">{formatSize(backup.size)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="link" size="sm">
                      <a href={backupUrl(backup.name)} download>
                        <Download />
                        Descargar
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
