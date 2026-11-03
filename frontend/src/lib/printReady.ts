const SHEET_READY = 'badger:sheet-ready'

/** Tells the print preview dialog that an embedded sheet finished rendering its data. */
export function notifySheetReady(): void {
  window.parent.postMessage(SHEET_READY, window.location.origin)
}

/** True only for the ready signal sent by the given frame, from this app's origin. */
export function isSheetReadyMessage(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  frame: Window | null | undefined,
  origin: string,
): boolean {
  return event.data === SHEET_READY && event.origin === origin && !!frame && event.source === frame
}
