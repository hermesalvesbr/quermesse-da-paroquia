<template>
    <Page class="app-root" actionBarHidden="true">
        <GridLayout rows="auto, *">
            <!-- Row 0: Custom top bar with hamburger -->
            <GridLayout row="0" columns="auto, *, auto" class="custom-topbar" columnGap="8">
                <Label col="0" text="☰" class="hamburger-btn" @tap="toggleMenu" />
                <Label col="1" :text="pageTitle" class="topbar-title" />
                <Label
                    col="2"
                    :text="printerConnected ? '🟢' : '🔴'"
                    class="topbar-printer-dot"
                    @tap="selectPage('printer')"
                />
            </GridLayout>

            <!-- Row 1: Content -->
            <GridLayout row="1" rows="*">
                <!-- Layer 0: Content — always full width -->
                <GridLayout row="0" rows="*" class="content-area">
                    <PdvPage
                        v-show="activePage === 'pdv'"
                        :operatorName="operatorName"
                        :printerConnected="printerConnected"
                    />

                    <PrinterPage
                        v-show="activePage === 'printer'"
                        @connectionChanged="onPrinterConnectionChanged"
                    />

                    <VendasPage
                        v-show="activePage === 'vendas'"
                        :operatorName="operatorName"
                        :printerConnected="printerConnected"
                    />

                    <RelatoriosPage
                        v-show="activePage === 'relatorios'"
                    />

                    <SettingsPage
                        v-show="activePage === 'settings'"
                        :operatorName="operatorName"
                        :operatorLoginAt="operatorLoginAt"
                        :printerConnected="printerConnected"
                        @requestChangeOperator="openOperatorModal"
                    />
                </GridLayout>

                <!-- Layer 1: Drawer overlay — on top of content -->
                <GridLayout v-if="isMenuOpen" row="0" columns="280, *">
                    <StackLayout col="0" class="drawer">
                        <StackLayout class="drawer-header">
                            <Image src="~/assets/logo.png" stretch="aspectFit" height="54" class="m-b-2" />
                            <Label text="PDV Quermesse" class="drawer-title" />
                            <Label :text="operatorLabel" class="drawer-subtitle" textWrap="true" />
                        </StackLayout>

                        <Label text="NAVEGAÇÃO" class="drawer-section-label" />
                        <Button text="🍽️  PDV" class="drawer-item" :class="activePage === 'pdv' ? 'drawer-item-active' : ''" @tap="selectPage('pdv')" />
                        <Button text="📋 Vendas" class="drawer-item" :class="activePage === 'vendas' ? 'drawer-item-active' : ''" @tap="selectPage('vendas')" />
                        <Button text="📊  Relatórios" class="drawer-item" :class="activePage === 'relatorios' ? 'drawer-item-active' : ''" @tap="selectPage('relatorios')" />

                        <StackLayout class="drawer-divider" />

                        <Label text="SISTEMA" class="drawer-section-label" />
                        <Button text="🖨 Impressora" class="drawer-item" :class="activePage === 'printer' ? 'drawer-item-active' : ''" @tap="selectPage('printer')" />
                        <Button text="⚙️  Configurações" class="drawer-item" :class="activePage === 'settings' ? 'drawer-item-active' : ''" @tap="selectPage('settings')" />

                        <StackLayout class="drawer-divider" />

                        <Label text="OPERADOR" class="drawer-section-label" />
                        <Button text="🔄  Mudar Operador" class="drawer-item" @tap="onDrawerChangeOperator" />
                    </StackLayout>
                    <StackLayout col="1" class="drawer-backdrop" @tap="toggleMenu" />
                </GridLayout>

                <!-- Layer 2: Operator modal -->
                <GridLayout v-if="showOperatorModal" row="0" class="modal-overlay p-4">
                    <StackLayout class="modal-card">
                        <Image src="~/assets/softagon.png" stretch="aspectFit" height="44" class="m-b-4" horizontalAlignment="center" />
                        <Label text="Quem está operando o caixa?" class="title text-center m-b-2" />
                        <Label text="Informe o nome para iniciar o PDV." class="subtitle text-center m-b-4" />
                        <TextField
                            v-model="operatorInput"
                            hint="Nome do operador"
                            class="operator-input"
                        />
                        <Button text="INICIAR CAIXA" class="action-primary" @tap="saveOperator" />
                    </StackLayout>
                </GridLayout>
            </GridLayout>
        </GridLayout>
    </Page>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { computed, onMounted, ref } from 'vue'
import { getBluetoothService } from '../services/BluetoothService'
import { OperatorSessionService } from '../services/OperatorSessionService'
import PdvPage from './PdvPage.vue'
import PrinterPage from './PrinterPage.vue'
import RelatoriosPage from './RelatoriosPage.vue'
import SettingsPage from './SettingsPage.vue'
import VendasPage from './VendasPage.vue'

type ActivePage = 'pdv' | 'printer' | 'settings' | 'vendas' | 'relatorios'

const sessionService = new OperatorSessionService()

const isMenuOpen = ref(false)
const activePage = ref<ActivePage>('pdv')
const showOperatorModal = ref(false)
const operatorInput = ref('')
const operatorName = ref('')
const operatorLoginAt = ref('')
const printerConnected = ref(false)

const pageTitle = computed(() => {
    if (activePage.value === 'printer') {
        return 'Impressora Bluetooth'
    }

    if (activePage.value === 'settings') {
        return 'Configurações'
    }

    if (activePage.value === 'vendas') {
        return 'Histórico de Vendas'
    }

    if (activePage.value === 'relatorios') {
        return 'Relatórios'
    }

    return 'PDV Quermesse'
})

const operatorLabel = computed(() => {
    return operatorName.value ? `Operador: ${operatorName.value}` : 'Operador não identificado'
})

onMounted(() => {
    loadOperator()

    // Wire up global BT status tracking
    const btService = getBluetoothService()
    btService.setStatusHandler((status) => {
        console.log(`[AppShell BT] ${status}`)
        printerConnected.value = btService.getConnectedStatus()
    })
    printerConnected.value = btService.getConnectedStatus()
})

function toggleMenu(): void {
    isMenuOpen.value = !isMenuOpen.value
}

function selectPage(page: ActivePage): void {
    activePage.value = page
    isMenuOpen.value = false
}

function loadOperator(): void {
    const operator = sessionService.getCurrentOperator()

    if (!operator) {
        showOperatorModal.value = true
        return
    }

    operatorName.value = operator.name
    operatorLoginAt.value = formatDate(operator.loginAt)
}

function openOperatorModal(): void {
    operatorInput.value = operatorName.value
    showOperatorModal.value = true
}

function onDrawerChangeOperator(): void {
    isMenuOpen.value = false
    openOperatorModal()
}

async function saveOperator(): Promise<void> {
    try {
        const session = sessionService.saveOperator(operatorInput.value)
        operatorName.value = session.name
        operatorLoginAt.value = formatDate(session.loginAt)
        operatorInput.value = ''
        showOperatorModal.value = false
    } catch (error) {
        await alert(String(error))
    }
}

function onPrinterConnectionChanged(connected: boolean): void {
    printerConnected.value = connected
}

function formatDate(isoDate: string): string {
    if (!isoDate) {
        return '-'
    }

    const date = new Date(isoDate)
    return date.toLocaleString('pt-BR')
}
</script>
