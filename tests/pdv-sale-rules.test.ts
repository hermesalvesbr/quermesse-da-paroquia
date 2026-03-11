import { describe, expect, it } from 'vitest'

import { assertSaleCanBeFinalized, buildPreparedSaleLines, calculateSaleTotal } from '../app/services/PdvSaleRules'

describe('PdvSaleRules', () => {
  it('rejeita venda sem itens', () => {
    expect(() => assertSaleCanBeFinalized([], [])).toThrow('Adicione itens para finalizar a venda.')
  })

  it('rejeita venda com estoque insuficiente', () => {
    expect(() => assertSaleCanBeFinalized(
      [{ id: 'coxinha', name: 'Coxinha', price: 8, quantity: 2 }],
      [{ id: 'coxinha', stock: 1 }],
    )).toThrow('Estoque insuficiente para Coxinha.')
  })

  it('monta linhas e calcula total', () => {
    const lines = buildPreparedSaleLines([
      { id: 'coxinha', name: 'Coxinha', price: 8, quantity: 2 },
      { id: 'caldo', name: 'Caldo', price: 12, quantity: 1 },
    ])

    expect(lines).toHaveLength(2)
    expect(lines[0].total).toBe(16)
    expect(calculateSaleTotal(lines)).toBe(28)
  })
})