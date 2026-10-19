import {
  formatCRC,
  formatDate,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUnitCost,
  parseDecimalInput,
  roundDecimal,
} from './format'

describe('roundDecimal', () => {
  it('rounds half up without float errors', () => {
    expect(roundDecimal('1.005', 2)).toBe('1.01')
    expect(roundDecimal('2.675', 2)).toBe('2.68')
    expect(roundDecimal('0.004', 2)).toBe('0.00')
    expect(roundDecimal('999.995', 2)).toBe('1000.00')
  })

  it('handles negatives, integers and numbers', () => {
    expect(roundDecimal('-1.235', 2)).toBe('-1.24')
    expect(roundDecimal('-0.001', 2)).toBe('0.00')
    expect(roundDecimal('42', 2)).toBe('42.00')
    expect(roundDecimal(12.5, 0)).toBe('13')
  })

  it('rejects invalid input', () => {
    expect(() => roundDecimal('abc', 2)).toThrow()
    expect(() => roundDecimal('', 2)).toThrow()
  })
})

describe('formatNumber', () => {
  it('uses "." for thousands and "," for decimals', () => {
    expect(formatNumber('1234567.891')).toBe('1.234.567,89')
    expect(formatNumber(0)).toBe('0,00')
    expect(formatNumber('950', 0)).toBe('950')
  })
})

describe('formatCRC', () => {
  it('formats colones as ₡ 1.234,50', () => {
    expect(formatCRC('1234.5')).toBe('₡ 1.234,50')
    expect(formatCRC(3500)).toBe('₡ 3.500,00')
    expect(formatCRC('-10')).toBe('-₡ 10,00')
  })

  it('shows a dash for missing values', () => {
    expect(formatCRC(null)).toBe('—')
    expect(formatCRC(undefined)).toBe('—')
    expect(formatCRC('')).toBe('—')
  })
})

describe('formatPercent', () => {
  it('converts fractions to percent', () => {
    expect(formatPercent('0.3456')).toBe('34,6 %')
    expect(formatPercent('0.13', 0)).toBe('13 %')
    expect(formatPercent(1.5)).toBe('150,0 %')
    expect(formatPercent('-0.05')).toBe('-5,0 %')
  })
})

describe('formatQuantity', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantity('1.360')).toBe('1,36')
    expect(formatQuantity('6')).toBe('6')
    expect(formatQuantity('0.454')).toBe('0,454')
    expect(formatQuantity('10000')).toBe('10.000')
    expect(formatQuantity('2.50')).toBe('2,5')
  })
})

describe('formatDate', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-10-18')).toBe('18/10/2026')
    expect(formatDate('2026-10-18T12:00:00Z')).toBe('18/10/2026')
    expect(formatDate(null)).toBe('—')
  })
})

describe('parseDecimalInput', () => {
  it('accepts comma or dot decimals', () => {
    expect(parseDecimalInput('1,36')).toBe('1.36')
    expect(parseDecimalInput(' 1300 ')).toBe('1300')
    expect(parseDecimalInput('0.454')).toBe('0.454')
  })

  it('rejects invalid input', () => {
    expect(parseDecimalInput('')).toBeNull()
    expect(parseDecimalInput('1.234,5')).toBeNull()
    expect(parseDecimalInput('-3')).toBeNull()
    expect(parseDecimalInput('abc')).toBeNull()
  })
})

describe('formatUnitCost', () => {
  it('shows 4 decimals below ₡ 1 and 2 otherwise', () => {
    expect(formatUnitCost('0.036537')).toBe('₡ 0,0365')
    expect(formatUnitCost('216.6666')).toBe('₡ 216,67')
    expect(formatUnitCost('0.99996')).toBe('₡ 1,00')
    expect(formatUnitCost(null)).toBe('—')
  })
})
