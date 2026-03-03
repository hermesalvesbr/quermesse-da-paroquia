/**
 * Utilitários de normalização e validação de nome de operador.
 *
 * Regras:
 * - Remove espaços extras (início, fim, duplicados).
 * - Converte para Title Case (primeira letra maiúscula, restante minúscula).
 * - Exige pelo menos duas palavras, cada uma com ≥ 2 caracteres.
 */

/**
 * Normaliza o nome do operador:
 * 1. Trim e colapsa espaços duplicados.
 * 2. Converte cada palavra para Title Case.
 *
 * @example
 * normalizeOperatorName('  hermes   alves  ') // 'Hermes Alves'
 * normalizeOperatorName('HERMES ALVES')       // 'Hermes Alves'
 */
export function normalizeOperatorName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Valida se o nome normalizado atende aos requisitos:
 * - Pelo menos 2 palavras.
 * - Cada palavra com ≥ 2 caracteres.
 *
 * Deve ser chamado **após** `normalizeOperatorName`.
 */
export function validateOperatorName(normalizedName: string): boolean {
  const words = normalizedName.split(' ').filter(w => w.length > 0)

  if (words.length < 2) {
    return false
  }

  return words.every(word => word.length >= 2)
}

/** Mensagem de erro padrão para nome inválido. */
export const OPERATOR_NAME_VALIDATION_MSG =
  'Informe nome e sobrenome (ex: Hermes Alves).'
