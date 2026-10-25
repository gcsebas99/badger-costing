import {
  formatCRC,
  formatDate,
  formatKitchenQuantity,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUnitCost,
  parseDecimalInput,
  percentInputToRate,
  rateToPercentInput,
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

  it('accepts exponent notation', () => {
    expect(roundDecimal('4.0E+3', 2)).toBe('4000.00')
    expect(roundDecimal('1.5e-2', 3)).toBe('0.015')
    expect(roundDecimal('-2.5E+1', 0)).toBe('-25')
    expect(formatCRC('4.0E+3')).toBe('₡ 4.000,00')
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
    expect(formatUnitCost('0')).toBe('₡ 0,00')
  })
})

describe('percent ↔ rate', () => {
  it('converts rates to percent input text', () => {
    expect(rateToPercentInput('0.13')).toBe('13')
    expect(rateToPercentInput('0.055')).toBe('5,5')
    expect(rateToPercentInput('0')).toBe('')
    expect(rateToPercentInput(null)).toBe('')
  })

  it('converts percent input to exact rate strings', () => {
    expect(percentInputToRate('13')).toBe('0.13')
    expect(percentInputToRate('5,5')).toBe('0.055')
    expect(percentInputToRate('100')).toBe('1')
    expect(percentInputToRate('0,5')).toBe('0.005')
    expect(percentInputToRate('')).toBe('0')
    expect(percentInputToRate('abc')).toBeNull()
  })
})

describe('formatKitchenQuantity', () => {
  it('rounds grams and millilitres to weighable amounts', () => {
    expect(formatKitchenQuantity('288.00', 'g')).toBe('288 g')
    expect(formatKitchenQuantity('316.8', 'g')).toBe('317 g')
    expect(formatKitchenQuantity('2.54', 'g')).toBe('2,5 g')
    expect(formatKitchenQuantity('0.375', 'ml')).toBe('0,38 ml')
  })

  it('keeps up to 3 decimals for kg and L', () => {
    expect(formatKitchenQuantity('1.44', 'kg')).toBe('1,44 kg')
    expect(formatKitchenQuantity('0.0625', 'L')).toBe('0,063 L')
  })

  it('marks fractional pieces as approximate', () => {
    expect(formatKitchenQuantity('3', 'pz')).toBe('3 pz')
    expect(formatKitchenQuantity('2.88', 'pz')).toBe('≈ 2,88 pz')
  })

  it('shows a dash for missing values', () => {
    expect(formatKitchenQuantity(null, 'g')).toBe('—')
  })
})
