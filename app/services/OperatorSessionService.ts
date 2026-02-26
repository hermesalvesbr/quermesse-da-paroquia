import { ApplicationSettings } from '@nativescript/core'

const OPERATOR_NAME_KEY = 'pdv.operator.name'
const OPERATOR_LOGIN_AT_KEY = 'pdv.operator.loginAt'

export interface OperatorSession {
    name: string
    loginAt: string
}

export class OperatorSessionService {
    getCurrentOperator(): OperatorSession | null {
        const name = ApplicationSettings.getString(OPERATOR_NAME_KEY, '').trim()
        const loginAt = ApplicationSettings.getString(OPERATOR_LOGIN_AT_KEY, '')

        if (!name) {
            return null
        }

        return {
            name,
            loginAt,
        }
    }

    saveOperator(name: string): OperatorSession {
        const normalizedName = name.trim()
        if (!normalizedName) {
            throw new Error('Informe o nome do operador.')
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
    }
}
