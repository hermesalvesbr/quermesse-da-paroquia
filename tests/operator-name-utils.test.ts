import { describe, expect, it } from 'vitest'

import { OPERATOR_NAME_VALIDATION_MSG, normalizeOperatorName, validateOperatorName } from '../app/utils/OperatorNameUtils'

describe('OperatorNameUtils', () => {
  it('normaliza espacos e title case', () => {
    expect(normalizeOperatorName('  hERMES   aLVES  ')).toBe('Hermes Alves')
  })

  it('valida nome e sobrenome com pelo menos duas letras', () => {
    expect(validateOperatorName('Hermes Alves')).toBe(true)
    expect(validateOperatorName('H A')).toBe(false)
    expect(OPERATOR_NAME_VALIDATION_MSG).toContain('nome e sobrenome')
  })
})