import { isSheetReadyMessage } from './printReady'

const ORIGIN = 'http://localhost:5173'
const frame = {} as Window
const signal = { data: 'badger:sheet-ready', origin: ORIGIN, source: frame }

describe('isSheetReadyMessage', () => {
  it('accepts the signal from the previewed frame', () => {
    expect(isSheetReadyMessage(signal, frame, ORIGIN)).toBe(true)
  })

  it('rejects other messages, frames and origins', () => {
    expect(isSheetReadyMessage({ ...signal, data: 'otro' }, frame, ORIGIN)).toBe(false)
    expect(isSheetReadyMessage({ ...signal, source: {} as Window }, frame, ORIGIN)).toBe(false)
    expect(isSheetReadyMessage({ ...signal, origin: 'http://evil.test' }, frame, ORIGIN)).toBe(false)
    expect(isSheetReadyMessage(signal, null, ORIGIN)).toBe(false)
  })
})
