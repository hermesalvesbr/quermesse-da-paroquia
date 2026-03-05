<template>
    <ScrollView>
        <StackLayout class="screen p-4">
            <!-- Auto-reconnect banner -->
            <GridLayout v-if="isAutoReconnecting" columns="auto, *" class="glass-card reconnect-banner" columnGap="10">
                <ActivityIndicator col="0" :busy="true" class="activity-sm" />
                <StackLayout col="1">
                    <Label text="Reconectando automaticamente..." class="font-bold text-sm" />
                    <Label :text="`${selectedPrinterName} (${selectedPrinterAddress})`" class="meta-text" />
                </StackLayout>
            </GridLayout>

            <StackLayout class="glass-card">
                <Label text="Impressora Bluetooth" class="title" />
                <Label text="Modelo alvo: KA-1445 / POS-printer" class="subtitle" />

                <GridLayout columns="auto, *" class="m-t-3 p-3 rounded-xl" :class="isConnected ? 'status-success' : 'status-danger'" columnGap="8">
                    <Label col="0" :text="isConnected ? '🟢' : '🔴'" class="text-lg" />
                    <StackLayout col="1">
                        <Label class="font-bold" :class="isConnected ? 'status-text-online' : 'status-text-offline'" :text="isConnected ? 'Conectada' : 'Desconectada'" />
                        <Label :text="connectedSubtitle" class="text-xs" textWrap="true" />
                    </StackLayout>
                </GridLayout>
            </StackLayout>

            <StackLayout class="glass-card">
                <Label text="Dispositivos pareados" class="section-title" />

                <GridLayout
                    columns="auto, *"
                    class="action-primary"
                    :class="isScanning || isConnecting ? 'opacity-50' : ''"
                    columnGap="10"
                    @tap="scanPrinters"
                >
                    <ActivityIndicator v-if="isScanning" col="0" :busy="true" class="activity-btn" />
                    <Label
                        :col="isScanning ? 1 : 0"
                        :colSpan="isScanning ? 1 : 2"
                        :text="isScanning ? 'Buscando impressoras...' : 'Buscar impressoras Bluetooth'"
                        class="text-center font-bold text-white"
                    />
                </GridLayout>

                <StackLayout v-if="printers.length === 0 && !isScanning" class="m-t-3 soft-panel">
                    <Label text="Nenhuma impressora listada." class="subtitle" />
                    <Label text="Pareie no Android e depois toque em buscar." class="meta-text" />
                </StackLayout>

                <StackLayout v-else-if="printers.length > 0" class="m-t-3 soft-panel">
                    <GridLayout
                        v-for="(item, index) in printers"
                        :key="item.address"
                        columns="*, auto"
                        class="printer-item"
                        :class="{ 'opacity-50': isConnecting && connectingAddress !== item.address }"
                        columnGap="8"
                        @tap="onPrinterSelect(index)"
                    >
                        <StackLayout col="0">
                            <Label :text="item.name" class="item-title" />
                            <Label :text="item.address" class="meta-text" />
                        </StackLayout>

                        <!-- Estado: Conectando esta impressora -->
                        <GridLayout
                            v-if="isConnecting && connectingAddress === item.address"
                            col="1"
                            columns="auto, auto"
                            columnGap="6"
                            verticalAlignment="center"
                        >
                            <ActivityIndicator col="0" :busy="true" class="activity-xs" />
                            <Label col="1" text="Conectando..." class="status-tag-connecting text-xs font-bold" />
                        </GridLayout>

                        <!-- Estado: Conectada -->
                        <Label
                            v-else-if="selectedPrinterAddress === item.address && isConnected"
                            col="1"
                            text="✓ Conectada"
                            class="text-xs font-bold status-tag-online"
                        />

                        <!-- Estado: Disponível -->
                        <Label
                            v-else
                            col="1"
                            text="Conectar"
                            class="text-xs font-bold status-tag-offline"
                        />
                    </GridLayout>
                </StackLayout>
            </StackLayout>

            <GridLayout columns="*, *" columnGap="12" class="m-b-3">
                <GridLayout
                    col="0"
                    columns="auto, *"
                    class="action-warn"
                    :class="(isConnected || isConnecting || selectedPrinterAddress.length === 0) ? 'opacity-50' : ''"
                    columnGap="8"
                    @tap="reconnectPrinter"
                >
                    <ActivityIndicator v-if="isConnecting && !connectingAddress" col="0" :busy="true" class="activity-btn" />
                    <Label
                        :col="isConnecting ? 1 : 0"
                        :colSpan="isConnecting ? 1 : 2"
                        :text="isConnecting ? 'RECONECTANDO...' : 'RECONECTAR'"
                        class="text-center font-bold"
                    />
                </GridLayout>

                <Button
                    col="1"
                    text="DESCONECTAR"
                    @tap="disconnectPrinter"
                    :isEnabled="isConnected && !isConnecting"
                    class="action-danger"
                    :class="!isConnected || isConnecting ? 'opacity-50' : ''"
                />
            </GridLayout>

            <StackLayout class="glass-card">
                <Label text="Teste de impressão" class="section-title" />
                <Label text="Envia um cupom simples para validar a conexão." class="subtitle" />
                <Button text="IMPRIMIR TESTE" class="action-primary m-t-3" :isEnabled="isConnected && !isConnecting" :class="!isConnected || isConnecting ? 'opacity-50' : ''" @tap="printTest" />
            </StackLayout>

            <StackLayout class="soft-panel m-b-6">
                <Label text="Status" class="text-sm font-bold" />
                <Label :text="statusMessage" class="meta-text" textWrap="true" />
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { ApplicationSettings, alert } from '@nativescript/core'
import { computed, onMounted, ref } from 'vue'
import { getBluetoothService, type BluetoothPrinter } from '../services/BluetoothService'
import { ensureBluetoothPermissions } from '../utils/BluetoothPermissions'
import { EscPosBuilder } from '../utils/EscPosBuilder'

const emit = defineEmits<{
    (e: 'connectionChanged', connected: boolean): void
}>()

const SAVED_PRINTER_KEY = 'bt_last_printer'

const btService = getBluetoothService()
const printers = ref<BluetoothPrinter[]>([])
const isConnected = ref(false)
const selectedPrinterName = ref('')
const selectedPrinterAddress = ref('')
const isScanning = ref(false)
const isConnecting = ref(false)
const connectingAddress = ref('')
const isAutoReconnecting = ref(false)
const statusMessage = ref('Aguardando ação do usuário.')

const connectedSubtitle = computed(() => {
    if (isConnected.value && selectedPrinterName.value) {
        return `${selectedPrinterName.value} (${selectedPrinterAddress.value})`
    }

    if (selectedPrinterAddress.value) {
        return `Última selecionada: ${selectedPrinterAddress.value}`
    }

    return 'Selecione uma impressora para conectar.'
})

/** Salva o endereço e nome da última impressora conectada com sucesso */
function savePrinterToStorage(): void {
    if (selectedPrinterName.value && selectedPrinterAddress.value) {
        ApplicationSettings.setString(
            SAVED_PRINTER_KEY,
            JSON.stringify({ name: selectedPrinterName.value, address: selectedPrinterAddress.value }),
        )
    }
}

/** Carrega a última impressora salva no storage */
function loadSavedPrinter(): { name: string; address: string } | null {
    const raw = ApplicationSettings.getString(SAVED_PRINTER_KEY, '')
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as { name: string; address: string }
        if (parsed.name && parsed.address) return parsed
    } catch {
        // dados corrompidos, limpar
        ApplicationSettings.remove(SAVED_PRINTER_KEY)
    }

    return null
}

onMounted(async () => {
    btService.setStatusHandler((status) => {
        statusMessage.value = status
        isConnected.value = btService.getConnectedStatus()
        emit('connectionChanged', isConnected.value)
    })

    const enabled = await btService.isEnabled()
    if (!enabled) {
        statusMessage.value = 'Bluetooth está desativado. Ative para continuar.'
        return
    }

    isConnected.value = btService.getConnectedStatus()
    emit('connectionChanged', isConnected.value)

    // Auto-reconexão se já conectou no passado
    if (!isConnected.value) {
        const saved = loadSavedPrinter()
        if (saved) {
            selectedPrinterName.value = saved.name
            selectedPrinterAddress.value = saved.address
            isAutoReconnecting.value = true
            statusMessage.value = `Reconectando a ${saved.name}...`

            try {
                await btService.connect(saved.address)
                isConnected.value = true
                emit('connectionChanged', true)
                statusMessage.value = `Reconectado a ${saved.name} automaticamente.`
            } catch {
                statusMessage.value = 'Reconexão automática falhou. Conecte manualmente.'
            } finally {
                isAutoReconnecting.value = false
            }
        }
    }
})

async function scanPrinters(): Promise<void> {
    if (isScanning.value || isConnecting.value) return

    const hasPermission = await ensureBluetoothPermissions()
    if (!hasPermission) {
        await alert('Permissões Bluetooth não concedidas. Vá em Configurações para solicitá-las.')
        return
    }

    printers.value = []
    isScanning.value = true

    try {
        await btService.startScanning((device) => {
            if (!printers.value.find(printer => printer.address === device.address)) {
                printers.value.push(device)
            }
        })

        if (printers.value.length === 0) {
            await alert('Nenhuma impressora pareada encontrada.')
        }
    } catch (error) {
        await alert(`Erro ao buscar impressoras: ${error}`)
    } finally {
        isScanning.value = false
    }
}

async function onPrinterSelect(index: number): Promise<void> {
    if (isConnecting.value || isScanning.value) return

    const printer = printers.value[index]
    if (!printer) return

    // Se já está conectada nesta impressora, não fazer nada
    if (selectedPrinterAddress.value === printer.address && isConnected.value) return

    selectedPrinterName.value = printer.name
    selectedPrinterAddress.value = printer.address
    isConnecting.value = true
    connectingAddress.value = printer.address

    try {
        await btService.connect(printer.address)
        isConnected.value = true
        emit('connectionChanged', true)
        savePrinterToStorage()
        await alert(`Conectado com sucesso a ${printer.name}`)
    } catch (error) {
        isConnected.value = false
        emit('connectionChanged', false)
        await alert(`Erro ao conectar: ${error}`)
    } finally {
        isConnecting.value = false
        connectingAddress.value = ''
    }
}

async function disconnectPrinter(): Promise<void> {
    if (isConnecting.value) return

    try {
        await btService.disconnect()
        isConnected.value = false
        emit('connectionChanged', false)
    } catch (error) {
        await alert(`Erro ao desconectar: ${error}`)
    }
}

async function reconnectPrinter(): Promise<void> {
    if (isConnecting.value || isConnected.value) return

    if (!selectedPrinterAddress.value) {
        await alert('Selecione uma impressora primeiro.')
        return
    }

    isConnecting.value = true
    connectingAddress.value = ''

    try {
        await btService.connect(selectedPrinterAddress.value)
        isConnected.value = true
        emit('connectionChanged', true)
        savePrinterToStorage()
    } catch (error) {
        isConnected.value = false
        emit('connectionChanged', false)
        await alert(`Erro ao reconectar: ${error}`)
    } finally {
        isConnecting.value = false
    }
}

async function printTest(): Promise<void> {
    if (!isConnected.value || isConnecting.value) return

    try {
        const builder = new EscPosBuilder()
        const payload = builder
            .init()
            .align(1)
            .bold(true)
            .textLine('QUERMESSE - TESTE')
            .bold(false)
            .lf()
            .align(0)
            .textLine(`Data: ${new Date().toLocaleString()}`)
            .textLine('Conexão Bluetooth OK')
            .lf()
            .align(1)
            .textLine('KA-1445')
            .lf()
            .lf()
            .cut()
            .build()

        await btService.writeBytes(payload)
        await alert('Teste de impressão enviado.')
    } catch (error) {
        await alert(`Erro ao imprimir teste: ${error}`)
    }
}
</script>

<style scoped>
.reconnect-banner {
    background-color: #1565C0;
    padding: 12;
    border-radius: 12;
    margin-bottom: 8;
}

.reconnect-banner Label {
    color: #ffffff;
}

.printer-item {
    border-bottom-width: 1;
    border-bottom-color: #e0e0e0;
    margin-bottom: 8;
    padding: 8 0;
}

.status-tag-connecting {
    color: #FB8C00;
}

.activity-sm {
    width: 24;
    height: 24;
    color: #ffffff;
}

.activity-btn {
    width: 18;
    height: 18;
    color: #ffffff;
}

.activity-xs {
    width: 14;
    height: 14;
    color: #FB8C00;
}
</style>
