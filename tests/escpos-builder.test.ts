import { describe, expect, it } from 'vitest'

import { buildItemTickets } from '../app/utils/EscPosBuilder'

describe('EscPosBuilder', () => {
  it('remove acentos e gera um corte por ticket individual', () => {
    const bytes = buildItemTickets({
      eventName: 'Quermesse Sao Jose',
      orderNumber: 12,
      items: [
        { name: 'Coxinha', quantity: 2, total: 16 },
        { name: 'Caldo de Feijao', quantity: 1, total: 12 },
      ],
      total: 28,
      paymentMethod: 'Dinheiro',
      operatorName: 'Hermes Alves',
      dateTime: '2026-03-11T18:30:00.000Z',
    })

    const cutSequence = [29, 86, 65, 0]
    let cuts = 0

    for (let index = 0; index <= bytes.length - cutSequence.length; index++) {
      const matches = cutSequence.every((value, offset) => bytes[index + offset] === value)
      if (matches) {
        cuts += 1
      }
    }

    expect(cuts).toBe(3)
    expect(bytes).toContain('C'.charCodeAt(0))
  })
})