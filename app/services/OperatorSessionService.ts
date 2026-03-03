import { ApplicationSettings } from '@nativescript/core'
import {
  normalizeOperatorName,
  OPERATOR_NAME_VALIDATION_MSG,
  validateOperatorName,
} from '../utils/OperatorNameUtils'
import { directusService, type PdvOperator } from './DirectusService'

const OPERATOR_NAME_KEY = 'pdv.operator.name'
const OPERATOR_LOGIN_AT_KEY = 'pdv.operator.loginAt'
const OPERATOR_ID_KEY = 'pdv.operator.id'

export interface OperatorSession {
    name: string
    loginAt: string
    operatorId?: string
}

export class OperatorSessionService {
    getCurrentOperator(): OperatorSession | null {
        const name = ApplicationSettings.getString(OPERATOR_NAME_KEY, '').trim()
        const loginAt = ApplicationSettings.getString(OPERATOR_LOGIN_AT_KEY, '')
        const operatorId = ApplicationSettings.getString(OPERATOR_ID_KEY, '')

        if (!name) {
            return null
        }

        return {
            name,
            loginAt,
            operatorId: operatorId || undefined,
        }
    }

    /**
     * Fluxo completo de login do operador:
     * 1. Normaliza o nome (Title Case, trim, colapsa espaços).
     * 2. Valida (≥ 2 palavras, cada uma ≥ 2 chars).
     * 3. Busca no Directus por nome exato; se existir, reusa.
     * 4. Se não existir, cria novo registro.
     * 5. Persiste sessão localmente.
     */
    async loginOperator(rawName: string): Promise<OperatorSession> {
        const normalizedName = normalizeOperatorName(rawName)

        if (!validateOperatorName(normalizedName)) {
            throw new Error(OPERATOR_NAME_VALIDATION_MSG)
        }

        // Integração com Directus — findOrCreate
        const operator: PdvOperator = await directusService.findOrCreateOperator(normalizedName)

        const loginAt = new Date().toISOString()

        ApplicationSettings.setString(OPERATOR_NAME_KEY, operator.name)
        ApplicationSettings.setString(OPERATOR_LOGIN_AT_KEY, loginAt)
        ApplicationSettings.setString(OPERATOR_ID_KEY, operator.id)

        return {
            name: operator.name,
            loginAt,
            operatorId: operator.id,
        }
    }

    /**
     * @deprecated Use `loginOperator()` para o fluxo completo com Directus.
     * Mantido apenas para compatibilidade temporária.
     */
    saveOperator(name: string): OperatorSession {
        const normalizedName = normalizeOperatorName(name)
        if (!validateOperatorName(normalizedName)) {
            throw new Error(OPERATOR_NAME_VALIDATION_MSG)
        }

        const loginAt = new Date().toISOString()

        ApplicationSettings.setString(OPERATOR_NAME_KEY, normalizedName)
        ApplicationSettings.setString(OPERATOR_LOGIN_AT_KEY, loginAt)

        return {
            name: normalizedName,
            loginAt,
        }
    }

    clearOperator(): void {
        ApplicationSettings.remove(OPERATOR_NAME_KEY)
        ApplicationSettings.remove(OPERATOR_LOGIN_AT_KEY)
        ApplicationSettings.remove(OPERATOR_ID_KEY)
    }
}
