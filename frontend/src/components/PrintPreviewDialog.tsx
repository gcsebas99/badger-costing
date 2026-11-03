import { ExternalLink, Printer } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isSheetReadyMessage } from '@/lib/printReady'

interface PrintPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Printable page (same origin), e.g. `/recetas/3/cocina?factor=2`. */
  src: string
  /** Selectors shown above the preview (multiplier, anchor ingredient…). */
  controls?: ReactNode
  /** Keep printing disabled until the page signals `notifySheetReady()` (it loads its data after the iframe's `load`). */
  waitForReady?: boolean
}

/**
 * Shows a printable page in an iframe ("PDF preview") and prints exactly that page through the
 * browser's dialog, where "Guardar como PDF" is available.
 */
export function PrintPreviewDialog({ open, onOpenChange, title, description, src, controls, waitForReady = false }: PrintPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Mounted only while open, so each opening starts a fresh preview. */}
        <PreviewBody src={src} title={title} controls={controls} waitForReady={waitForReady} />
      </DialogContent>
    </Dialog>
  )
}

function withEmbed(src: string): string {
  return `${src}${src.includes('?') ? '&' : '?'}embed=1`
}

function PreviewBody({ src, title, controls, waitForReady }: {
  src: string
  title: string
  controls?: ReactNode
  waitForReady: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  // The iframe loads once; later selections update its URL in place (no reload, no flash).
  const [initialSrc] = useState(() => withEmbed(src))
  const [loaded, setLoaded] = useState(false)
  const [signaled, setSignaled] = useState(false)
  const canPrint = loaded && (!waitForReady || signaled)

  useEffect(() => {
    if (!waitForReady) return
    function onMessage(event: MessageEvent) {
      if (isSheetReadyMessage(event, frameRef.current?.contentWindow, window.location.origin)) setSignaled(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [waitForReady])

  useEffect(() => {
    const frameWindow = frameRef.current?.contentWindow
    if (!loaded || !frameWindow) return
    const next = withEmbed(src)
    if (frameWindow.location.pathname + frameWindow.location.search === next) return
    // The embedded app's router follows popstate, like a browser back/forward.
    frameWindow.history.replaceState(null, '', next)
    frameWindow.dispatchEvent(new PopStateEvent('popstate'))
  }, [src, loaded])

  return (
    <>
      {controls}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted">
        {!loaded && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Cargando vista previa…</p>
        )}
        <iframe
          ref={frameRef}
          src={initialSrc}
          title={`Vista previa: ${title}`}
          className="size-full bg-white"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <DialogFooter>
        <Button asChild variant="outline" size="sm">
          <a href={src} target="_blank" rel="noreferrer">
            <ExternalLink />
            Abrir en pestaña
          </a>
        </Button>
        <DialogClose asChild>
          <Button variant="outline" size="sm">Cerrar</Button>
        </DialogClose>
        <Button size="sm" disabled={!canPrint} onClick={() => frameRef.current?.contentWindow?.print()}>
          <Printer />
          Imprimir / guardar PDF
        </Button>
      </DialogFooter>
    </>
  )
}
