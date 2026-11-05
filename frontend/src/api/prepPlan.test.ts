import { filenameFromDisposition } from './prepPlan'

describe('filenameFromDisposition', () => {
  it('reads the filename', () => {
    expect(filenameFromDisposition('attachment; filename="badger-plan-20261104.csv"', 'x.csv')).toBe('badger-plan-20261104.csv')
  })

  it('falls back when the header is missing or has no filename', () => {
    expect(filenameFromDisposition(null, 'x.csv')).toBe('x.csv')
    expect(filenameFromDisposition('attachment', 'x.csv')).toBe('x.csv')
  })
})
