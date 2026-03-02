/**
 * BluetoothPermissions.ts
 *
 * Utilitário para verificar e solicitar permissões Bluetooth em tempo de execução.
 * Obrigatório no Android 12+ (API 31) que separou as permissões em:
 *   - BLUETOOTH_CONNECT  (necessária para getBondedDevices, connect, etc.)
 *   - BLUETOOTH_SCAN     (necessária para discovery)
 */
import type { AndroidActivityRequestPermissionsEventData } from '@nativescript/core/application/application-interfaces'
import { Application, Utils, isAndroid } from '@nativescript/core'

// ── Constantes ──────────────────────────────────────────────────────────────────
const BLUETOOTH_CONNECT = 'android.permission.BLUETOOTH_CONNECT'
const BLUETOOTH_SCAN = 'android.permission.BLUETOOTH_SCAN'
const PERMISSION_GRANTED = 0 // android.content.pm.PackageManager.PERMISSION_GRANTED
const BT_PERMISSION_REQUEST_CODE = 5001

// ── Tipos ───────────────────────────────────────────────────────────────────────
export interface BluetoothPermissionStatus {
    /** Permissão BLUETOOTH_CONNECT concedida */
    connect: boolean
    /** Permissão BLUETOOTH_SCAN concedida */
    scan: boolean
    /** Todas as permissões Bluetooth concedidas */
    allGranted: boolean
    /** Dispositivo requer solicitação em tempo de execução (API >= 31) */
    needsRuntimeRequest: boolean
}

// ── Funções públicas ────────────────────────────────────────────────────────────

/**
 * Retorna true se o dispositivo roda Android 12+ (API 31) e precisa
 * de solicitação em tempo de execução para permissões Bluetooth.
 */
export function needsRuntimeBluetoothPermissions(): boolean {
    if (!isAndroid) return false
    return android.os.Build.VERSION.SDK_INT >= 31
}

/**
 * Verifica o estado atual das permissões Bluetooth.
 * Em dispositivos com API < 31, retorna tudo como concedido.
 */
export function checkBluetoothPermissions(): BluetoothPermissionStatus {
    if (!isAndroid) {
        return { connect: false, scan: false, allGranted: false, needsRuntimeRequest: false }
    }

    if (!needsRuntimeBluetoothPermissions()) {
        // Android < 12: permissões concedidas na instalação
        return { connect: true, scan: true, allGranted: true, needsRuntimeRequest: false }
    }

    const ctx = Utils.android.getApplicationContext()
    const connect =
        androidx.core.content.ContextCompat.checkSelfPermission(ctx, BLUETOOTH_CONNECT) ===
        PERMISSION_GRANTED
    const scan =
        androidx.core.content.ContextCompat.checkSelfPermission(ctx, BLUETOOTH_SCAN) ===
        PERMISSION_GRANTED

    return {
        connect,
        scan,
        allGranted: connect && scan,
        needsRuntimeRequest: true,
    }
}

/**
 * Solicita ao usuário as permissões Bluetooth pendentes.
 * Retorna true se todas foram concedidas, false caso contrário.
 *
 * Não faz nada (retorna true) se o dispositivo não exige runtime permissions
 * ou se todas já estão concedidas.
 */
export function requestBluetoothPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!isAndroid) {
            resolve(false)
            return
        }

        if (!needsRuntimeBluetoothPermissions()) {
            resolve(true)
            return
        }

        const status = checkBluetoothPermissions()
        if (status.allGranted) {
            resolve(true)
            return
        }

        const activity = Application.android.foregroundActivity || Application.android.startActivity
        if (!activity) {
            console.error('[BluetoothPermissions] Nenhuma activity disponível para solicitar permissões.')
            resolve(false)
            return
        }

        // Monta lista das permissões ainda não concedidas
        const pending: string[] = []
        if (!status.connect) pending.push(BLUETOOTH_CONNECT)
        if (!status.scan) pending.push(BLUETOOTH_SCAN)

        // Listener para capturar o resultado da solicitação
        const onResult = (args: AndroidActivityRequestPermissionsEventData) => {
            if (args.requestCode !== BT_PERMISSION_REQUEST_CODE) return

            Application.android.off('activityRequestPermissions', onResult)

            const results: number[] = []
            if (args.grantResults && args.grantResults.length) {
                for (let i = 0; i < args.grantResults.length; i++) {
                    results.push(args.grantResults[i])
                }
            }

            const allGranted =
                results.length > 0 && results.every((r) => r === PERMISSION_GRANTED)
            resolve(allGranted)
        }

        Application.android.on('activityRequestPermissions', onResult)

        // Cria array Java de strings com as permissões pendentes
        const javaPermissions = Array.create(java.lang.String, pending.length)
        for (let i = 0; i < pending.length; i++) {
            javaPermissions[i] = pending[i]
        }

        androidx.core.app.ActivityCompat.requestPermissions(
            activity,
            javaPermissions,
            BT_PERMISSION_REQUEST_CODE,
        )
    })
}

/**
 * Verifica permissões e, se necessário, solicita automaticamente.
 * Ideal para usar como guard antes de operações Bluetooth.
 *
 * @returns true se as permissões estão (ou foram) concedidas.
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
    const status = checkBluetoothPermissions()

    if (!status.needsRuntimeRequest || status.allGranted) {
        return true
    }

    return requestBluetoothPermissions()
}
