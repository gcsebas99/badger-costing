import { commandFilter, foldText } from './utils'

describe('foldText / commandFilter', () => {
  it('ignores accents and case', () => {
    expect(foldText('Hamburguesa Clásica')).toBe('hamburguesa clasica')
    expect(commandFilter('Hamburguesa clásica', 'CLASICA')).toBe(1)
    expect(commandFilter('Orégano seco McCormick', 'oregano mcc')).toBe(1)
    expect(commandFilter('Mayo casera', 'chipotle')).toBe(0)
  })
})
