<template>
    <Page class="app-root">
        <ActionBar class="app-actionbar" :title="pageTitle">
            <ActionItem text="☰" ios.position="left" android.position="actionBar" @tap="toggleMenu" />
        </ActionBar>

        <GridLayout columns="auto, *" rows="*">
            <StackLayout col="0" class="drawer" :class="isMenuOpen ? '' : 'drawer-collapsed'">
                <StackLayout class="drawer-header p-4">
                    <Image src="~/assets/logo.png" stretch="aspectFit" height="62" class="m-b-2" />
                    <Label text="PDV Quermesse" class="drawer-title" />
                    <Label :text="operatorLabel" class="drawer-subtitle" textWrap="true" />
                </StackLayout>

                <Button text="🍽️  PDV" class="drawer-item" @tap="selectPage('pdv')" />
                <Button text="🖨️  Impressora" class="drawer-item" @tap="selectPage('printer')" />
                <Button text="⚙️  Configurações" class="drawer-item" @tap="selectPage('settings')" />
            </StackLayout>

            <GridLayout col="1" rows="*" class="content-area">
                <PdvPage
                    v-show="activePage === 'pdv'"
                    :operatorName="operatorName"
                    :printerConnected="printerConnected"
                />

                <PrinterPage
                    v-show="activePage === 'printer'"
                    @connectionChanged="onPrinterConnectionChanged"
                />

                <SettingsPage
                    v-show="activePage === 'settings'"
                    :operatorName="operatorName"
                    :operatorLoginAt="operatorLoginAt"
                    :printerConnected="printerConnected"
                    @requestChangeOperator="openOperatorModal"
                />
            </GridLayout>
        </GridLayout>

        <GridLayout v-if="showOperatorModal" class="modal-overlay p-4">
            <StackLayout class="modal-card p-4">
                <Image src="~/assets/softagon.png" stretch="aspectFit" height="44" class="m-b-2" />
                <Label text="Quem está operando o caixa?" class="title text-center" />
                <Label text="Informe o nome para iniciar o PDV." class="subtitle text-center m-b-3" />
                <TextField
                    v-model="operatorInput"
                    hint="Nome do operador"
                    class="operator-input"
                />
                <Button text="INICIAR CAIXA" class="action-primary m-t-3" @tap="saveOperator" />
            </StackLayout>
        </GridLayout>
    </Page>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { computed, onMounted, ref } from 'vue'
import { OperatorSessionService } from '../services/OperatorSessionService'
import PdvPage from './PdvPage.vue'
import PrinterPage from './PrinterPage.vue'
import SettingsPage from './SettingsPage.vue'

type ActivePage = 'pdv' | 'printer' | 'settings'

const sessionService = new OperatorSessionService()

const isMenuOpen = ref(true)
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

    return 'PDV Quermesse'
})

const operatorLabel = computed(() => {
    return operatorName.value ? `Operador: ${operatorName.value}` : 'Operador não identificado'
})

onMounted(() => {
    loadOperator()
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
