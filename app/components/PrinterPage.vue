<template>
    <ScrollView>
        <StackLayout class="screen p-4">
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

                <Button
                    :text="isScanning ? 'Buscando impressoras...' : 'Buscar impressoras Bluetooth'"
                    @tap="scanPrinters"
                    :isEnabled="!isScanning"
                    class="action-primary"
                    :class="isScanning ? 'opacity-50' : ''"
                />

                <StackLayout v-if="printers.length === 0" class="m-t-3 p-3 soft-panel">
                    <Label text="Nenhuma impressora listada." class="subtitle" />
                    <Label text="Pareie no Android e depois toque em buscar." class="meta-text" />
                </StackLayout>

                <ListView v-else :items="printers" height="220" class="m-t-3 soft-panel" @itemTap="onPrinterSelect">
                    <template #default="{ item }">
                        <GridLayout columns="*, auto" class="p-3 border-b border-gray-200" columnGap="8">
                            <StackLayout col="0">
                                <Label :text="item.name" class="item-title" />
                                <Label :text="item.address" class="meta-text" />
                            </StackLayout>
                            <Label
                                col="1"
                                :text="selectedPrinterAddress === item.address && isConnected ? 'Conectada' : 'Conectar'"
                                class="text-xs font-bold"
                                :class="selectedPrinterAddress === item.address && isConnected ? 'status-tag-online' : 'status-tag-offline'"
                            />
                        </GridLayout>
                    </template>
                </ListView>
            </StackLayout>

            <GridLayout columns="*, *" columnGap="10" class="m-b-3">
                <Button
                    col="0"
                    text="RECONECTAR"
                    @tap="reconnectPrinter"
                    :isEnabled="!isConnected && selectedPrinterAddress.length > 0"
                    class="action-warn"
                    :class="(isConnected || selectedPrinterAddress.length === 0) ? 'opacity-50' : ''"
                />

                <Button
                    col="1"
                    text="DESCONECTAR"
                    @tap="disconnectPrinter"
                    :isEnabled="isConnected"
                    class="action-danger"
                    :class="!isConnected ? 'opacity-50' : ''"
                />
            </GridLayout>

            <StackLayout class="glass-card">
                <Label text="Teste de impressão" class="section-title" />
                <Label text="Envia um cupom simples para validar a conexão." class="subtitle" />
                <Button text="IMPRIMIR TESTE" class="action-primary m-t-3" :isEnabled="isConnected" :class="!isConnected ? 'opacity-50' : ''" @tap="printTest" />
            </StackLayout>

            <StackLayout class="soft-panel p-3 m-b-6">
                <Label text="Status" class="text-sm font-bold" />
                <Label :text="statusMessage" class="meta-text" textWrap="true" />
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { computed, onMounted, ref } from 'vue'
import { getBluetoothService, type BluetoothPrinter } from '../services/BluetoothService'
import { ensureBluetoothPermissions } from '../utils/BluetoothPermissions'
import { EscPosBuilder } from '../utils/EscPosBuilder'

const emit = defineEmits<{
    (e: 'connectionChanged', connected: boolean): void
}>()

const btService = getBluetoothService()
const printers = ref<BluetoothPrinter[]>([])
const isConnected = ref(false)
const selectedPrinterName = ref('')
const selectedPrinterAddress = ref('')
const isScanning = ref(false)
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

onMounted(async () => {
    btService.setStatusHandler((status) => {
        statusMessage.value = status
        isConnected.value = btService.getConnectedStatus()
        emit('connectionChanged', isConnected.value)
    })

    const enabled = await btService.isEnabled()
    if (!enabled) {
        statusMessage.value = 'Bluetooth está desativado. Ative para continuar.'
    }

    isConnected.value = btService.getConnectedStatus()
    emit('connectionChanged', isConnected.value)
})

async function scanPrinters(): Promise<void> {
    // Guard: verificar permissões Bluetooth antes de buscar
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

async function onPrinterSelect(event: { index: number }): Promise<void> {
    const printer = printers.value[event.index]
    if (!printer) {
        return
    }

    selectedPrinterName.value = printer.name
    selectedPrinterAddress.value = printer.address

    try {
        await btService.connect(printer.address)
        isConnected.value = true
        emit('connectionChanged', true)
        await alert(`Conectado com sucesso a ${printer.name}`)
    } catch (error) {
        isConnected.value = false
        emit('connectionChanged', false)
        await alert(`Erro ao conectar: ${error}`)
    }
}

async function disconnectPrinter(): Promise<void> {
    try {
        await btService.disconnect()
        isConnected.value = false
        emit('connectionChanged', false)
    } catch (error) {
        await alert(`Erro ao desconectar: ${error}`)
    }
}

async function reconnectPrinter(): Promise<void> {
    if (!selectedPrinterAddress.value) {
        await alert('Selecione uma impressora primeiro.')
        return
    }

    try {
        await btService.connect(selectedPrinterAddress.value)
        isConnected.value = true
        emit('connectionChanged', true)
    } catch (error) {
        isConnected.value = false
        emit('connectionChanged', false)
        await alert(`Erro ao reconectar: ${error}`)
    }
}

async function printTest(): Promise<void> {
    if (!isConnected.value) {
        await alert('Impressora não conectada.')
        return
    }

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
