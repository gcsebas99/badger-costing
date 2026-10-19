/**
 * Display formatting. Money arrives from the API as decimal strings; we round with string/BigInt
 * arithmetic (half-up) so display never introduces float errors.
 * Spanish (Costa Rica) style: thousands ".", decimals ",", e.g. ₡ 1.234,50.
 */

export type NumericInput = string | number | null | undefined

const EMPTY = '—'

/** Round a decimal value half-up to `decimals` places. Returns a plain decimal string ("1234.50"). */
export function roundDecimal(value: string | number, decimals: number): string {
  const raw = typeof value === 'number' ? numberToPlainString(value) : value.trim()
  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(raw)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error(`Invalid decimal value: ${value}`)
  }
  const negative = match[1] === '-'
  const intPart = match[2] || '0'
  const fracPart = match[3] ?? ''

  const padded = (fracPart + '0'.repeat(decimals + 1)).slice(0, decimals + 1)
  let scaled = BigInt(intPart + padded.slice(0, decimals))
  if (Number(padded[decimals]) >= 5) scaled += 1n

  const digits = scaled.toString().padStart(decimals + 1, '0')
  const whole = digits.slice(0, digits.length - decimals)
  const frac = decimals > 0 ? digits.slice(-decimals) : ''
  const isZero = scaled === 0n
  return `${negative && !isZero ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Invalid decimal value: ${value}`)
  // Avoid exponent notation for very small/large numbers.
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** 1234.5 → "1.234,50" */
export function formatNumber(value: NumericInput, decimals = 2): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const rounded = roundDecimal(value, decimals)
  const negative = rounded.startsWith('-')
  const [whole, frac] = (negative ? rounded.slice(1) : rounded).split('.')
  return `${negative ? '-' : ''}${groupThousands(whole)}${frac ? `,${frac}` : ''}`
}

/** 1234.5 → "₡ 1.234,50"; -10 → "-₡ 10,00" */
export function formatCRC(value: NumericInput, decimals = 2): string {
  const formatted = formatNumber(value, decimals)
  if (formatted === EMPTY) return EMPTY
  return formatted.startsWith('-') ? `-₡ ${formatted.slice(1)}` : `₡ ${formatted}`
}

/** Unit costs: 4 decimals below ₡ 1 so tiny costs (e.g. a napkin at ₡ 0,0365) stay visible. */
export function formatUnitCost(value: NumericInput): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const magnitude = roundDecimal(value, 4).replace('-', '')
  return formatCRC(value, magnitude.startsWith('0.') ? 4 : 2)
}

/** Fraction to percent: 0.3456 → "34,6 %" */
export function formatPercent(value: NumericInput, decimals = 1): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const asString = typeof value === 'number' ? numberToPlainString(value) : value
  return `${formatNumber(shiftDecimal(asString, 2), decimals)} %`
}

/** Multiply a decimal string by 10^places without floats. */
function shiftDecimal(value: string, places: number): string {
  const negative = value.trim().startsWith('-')
  const [whole, frac = ''] = value.trim().replace(/^[+-]/, '').split('.')
  const paddedFrac = frac.padEnd(places, '0')
  const newWhole = (whole + paddedFrac.slice(0, places)).replace(/^0+(?=\d)/, '')
  const rest = paddedFrac.slice(places)
  return `${negative ? '-' : ''}${newWhole}${rest ? `.${rest}` : ''}`
}

/** Quantities: up to `maxDecimals`, trailing zeros trimmed. "1.360" → "1,36"; "6" → "6". */
export function formatQuantity(value: NumericInput, maxDecimals = 3): string {
  const formatted = formatNumber(value, maxDecimals)
  if (formatted === EMPTY || !formatted.includes(',')) return formatted
  return formatted.replace(/,?0+$/, '')
}

/** ISO date "2026-10-18" → "18/10/2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

/** Today's date as ISO "YYYY-MM-DD" in local time (for date inputs). */
export function todayISO(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Parse user input that may use "," as decimal separator: "1,36" → "1.36". Returns null if invalid. */
export function parseDecimalInput(value: string): string | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null
}
