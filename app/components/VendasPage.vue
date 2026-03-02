<template>
    <ScrollView>
        <StackLayout class="screen p-3">
            <!-- Pending print alert -->
            <StackLayout v-if="pendingPrintCount > 0" class="pending-alert">
                <Label :text="`⚠️ ${pendingPrintCount} venda(s) aguardando impressão`" class="pending-alert-text" />
            </StackLayout>

            <GridLayout columns="*, *" columnGap="10" class="m-b-3">
                <Button col="0" text="CANCELAR ÚLTIMA" class="action-danger-sm" @tap="onCancelLatestSale" />
                <Button col="1" text="TROCA MOCK" class="action-secondary-sm" @tap="onMockExchange" />
            </GridLayout>
            <Button text="RETORNAR 1 DOCE AO ESTOQUE" class="action-secondary-sm m-b-4" @tap="onReturnDoceStock" />

            <Label text="Últimas vendas" class="section-title m-b-2" />

            <StackLayout v-if="recentSales.length === 0" class="soft-panel p-3">
                <Label text="Nenhuma venda registrada ainda." class="subtitle" />
            </StackLayout>

            <StackLayout v-else>
                <StackLayout
                    v-for="sale in recentSales"
                    :key="sale.id"
                    class="sale-card"
                >
                    <GridLayout columns="auto, *, auto" columnGap="8">
                        <Label col="0" :text="printStatusIcon(sale)" class="text-lg" />
                        <StackLayout col="1">
                            <Label :text="`#${String(sale.orderNumber || 0).padStart(3, '0')} · ${formatDate(sale.createdAt)}`" class="item-title" />
                            <Label :text="`${sale.operatorName} · ${pdvStore.getPaymentLabel(sale.paymentMethod)}`" class="meta-text" />
                            <Label
                                v-for="line in sale.lines"
                                :key="line.id"
                                :text="`  ${line.quantity}x ${line.name}`"
                                class="meta-text"
                            />
                        </StackLayout>
                        <StackLayout col="2" verticalAlignment="center">
                            <Label
                                :text="sale.status === 'completed' ? formatMoney(sale.total) : 'Cancelada'"
                                :class="sale.status === 'completed' ? 'sale-total-ok' : 'sale-total-cancel'"
                                class="font-bold"
                            />
                        </StackLayout>
                    </GridLayout>
                    <!-- Reprint button for completed sales -->
                    <Button
                        v-if="sale.status === 'completed'"
                        :text="sale.printStatus === 'pending' ? '🖨️ IMPRIMIR TICKET' : '🔄 REIMPRIMIR'"
                        :class="sale.printStatus === 'pending' ? 'reprint-btn-urgent' : 'reprint-btn'"
                        @tap="onReprint(sale)"
                    />
                </StackLayout>
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { computed } from 'vue'
import { getBluetoothService } from '../services/BluetoothService'
import { pdvStore, type SaleRecord } from '../services/PdvStore'
import { buildSaleTicket } from '../utils/EscPosBuilder'

const props = defineProps<{
    operatorName: string
    printerConnected: boolean
}>()

const recentSales = computed(() => pdvStore.getRecentSales(20))
const pendingPrintCount = computed(() => pdvStore.getPendingPrintSales().length)

function formatMoney(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR')
}

function printStatusIcon(sale: SaleRecord): string {
    if (sale.status === 'canceled') return '❌'
    if (sale.printStatus === 'printed') return '✅'
    return '⚠️'
}

async function onReprint(sale: SaleRecord): Promise<void> {
    const btService = getBluetoothService()

    if (!btService.getConnectedStatus()) {
        await alert({
            title: 'Impressora desconectada',
            message: 'Conecte a impressora antes de imprimir.',
            okButtonText: 'OK',
        })
        return
    }

    try {
        const ticketBytes = buildSaleTicket({
            eventName: 'QUERMESSE SAO JOSE',
            orderNumber: sale.orderNumber || 0,
            items: sale.lines.map(line => ({
                name: line.name,
                quantity: line.quantity,
                total: line.total,
            })),
            total: sale.total,
            paymentMethod: pdvStore.getPaymentLabel(sale.paymentMethod),
            operatorName: sale.operatorName,
            dateTime: new Date(sale.createdAt).toLocaleString('pt-BR'),
        })

        await btService.writeBytes(ticketBytes)
        pdvStore.markAsPrinted(sale.id)
        await alert('Ticket impresso com sucesso!')
    } catch (error) {
        await alert(`Erro ao imprimir: ${error}`)
    }
}

async function onCancelLatestSale(): Promise<void> {
    try {
        const sale = pdvStore.cancelLatestSale('Cancelamento no caixa')
        await alert(`Venda ${sale.id} cancelada e itens retornados ao estoque.`)
    } catch (error) {
        await alert(String(error))
    }
}

async function onMockExchange(): Promise<void> {
    try {
        const sale = pdvStore.exchangeLatestSaleItem('coxinha', 'pastel', 1, props.operatorName)
        await alert(`Troca registrada na venda ${sale.id}: 1 coxinha por 1 pastel.`)
    } catch (error) {
        await alert(String(error))
    }
}

async function onReturnDoceStock(): Promise<void> {
    try {
        pdvStore.returnItemsToStock('doce', 1, 'Retorno balcão')
        await alert('1 doce retornado ao estoque.')
    } catch (error) {
        await alert(String(error))
    }
}
</script>
