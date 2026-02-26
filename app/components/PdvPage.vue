<template>
    <ScrollView>
        <StackLayout class="screen p-4">
            <GridLayout columns="*, auto" class="glass-card p-4 m-b-4" columnGap="8">
                <StackLayout col="0">
                    <Label text="PDV Quermesse" class="title" />
                    <Label :text="`Operador: ${operatorName || 'Não identificado'}`" class="subtitle" />
                </StackLayout>
                <Label col="1" :text="printerConnected ? '🟢 Impressora ON' : '🔴 Impressora OFF'" class="chip" :class="printerConnected ? 'chip-success' : 'chip-danger'" />
            </GridLayout>

            <Label text="Cardápio" class="section-title m-b-2" />
            <StackLayout>
                <GridLayout
                    v-for="item in pdvStore.cartItems"
                    :key="item.id"
                    columns="auto, *, auto"
                    class="glass-card p-3 m-b-2"
                    columnGap="10"
                >
                    <Label col="0" :text="item.emoji" class="emoji" />
                    <StackLayout col="1">
                        <Label :text="item.name" class="item-title" />
                        <Label :text="formatMoney(item.price)" class="item-price" />
                        <Label :text="`Estoque: ${pdvStore.getStock(item.id)}`" class="text-xs text-gray-500" />
                    </StackLayout>
                    <StackLayout col="2" class="qty-box">
                        <GridLayout columns="auto, auto, auto" class="qty-controls" columnGap="8">
                            <Button col="0" text="-" class="qty-btn" @tap="pdvStore.decrementItem(item.id)" />
                            <Label col="1" :text="String(item.quantity)" class="qty-label" />
                            <Button col="2" text="+" class="qty-btn" @tap="pdvStore.incrementItem(item.id)" :isEnabled="item.quantity < pdvStore.getStock(item.id)" :class="item.quantity >= pdvStore.getStock(item.id) ? 'opacity-40' : ''" />
                        </GridLayout>
                        <Label :text="`Subtotal: ${formatMoney(item.price * item.quantity)}`" class="subtotal" />
                    </StackLayout>
                </GridLayout>
            </StackLayout>

            <StackLayout class="glass-card p-4 m-t-2 m-b-2">
                <Label text="Resumo do pedido" class="section-title" />
                <Label :text="`Itens: ${totalItems}`" class="subtitle m-t-1" />
                <Label :text="`Total: ${formatMoney(total)}`" class="total" />
            </StackLayout>

            <GridLayout columns="*, *" columnGap="10" class="m-t-2 m-b-2">
                <Button col="0" text="LIMPAR" class="action-secondary" @tap="onClear" />
                <Button col="1" text="FINALIZAR" class="action-primary" :isEnabled="totalItems > 0" @tap="onFinalize" :class="totalItems === 0 ? 'opacity-50' : ''" />
            </GridLayout>

            <GridLayout columns="*, *" columnGap="10" class="m-b-2">
                <Button col="0" text="CANCELAR ÚLTIMA" class="action-danger" @tap="onCancelLatestSale" />
                <Button col="1" text="TROCA MOCK" class="action-warn" @tap="onMockExchange" />
            </GridLayout>

            <Button text="RETORNAR 1 DOCE AO ESTOQUE" class="action-secondary m-b-4" @tap="onReturnDoceStock" />

            <StackLayout class="glass-card p-4 m-b-3">
                <Label text="Relatório do dia" class="section-title" />
                <Label :text="`Vendas: ${dailyReport.summary.salesCount}`" class="subtitle m-t-1" />
                <Label :text="`Canceladas: ${dailyReport.summary.canceledCount}`" class="subtitle" />
                <Label :text="`Itens vendidos: ${dailyReport.summary.itemsSold}`" class="subtitle" />
                <Label :text="`Retornos ao estoque: ${dailyReport.summary.returnedToStock}`" class="subtitle" />
                <Label :text="`Bruto: ${formatMoney(dailyReport.summary.grossTotal)}`" class="subtitle" />
                <Label :text="`Ticket médio: ${formatMoney(dailyReport.summary.averageTicket)}`" class="subtitle" />
            </StackLayout>

            <StackLayout class="glass-card p-4 m-b-3">
                <Label text="Relatório da semana" class="section-title" />
                <Label :text="`Vendas: ${weeklyReport.summary.salesCount}`" class="subtitle m-t-1" />
                <Label :text="`Canceladas: ${weeklyReport.summary.canceledCount}`" class="subtitle" />
                <Label :text="`Itens vendidos: ${weeklyReport.summary.itemsSold}`" class="subtitle" />
                <Label :text="`Bruto: ${formatMoney(weeklyReport.summary.grossTotal)}`" class="subtitle" />
            </StackLayout>

            <StackLayout class="glass-card p-4 m-b-6">
                <Label text="Últimas vendas" class="section-title m-b-2" />
                <StackLayout v-if="recentSales.length === 0">
                    <Label text="Nenhuma venda registrada ainda." class="subtitle" />
                </StackLayout>
                <StackLayout v-else>
                    <GridLayout v-for="sale in recentSales" :key="sale.id" columns="*, auto" class="p-b-2 m-b-2 border-b border-gray-200" columnGap="8">
                        <StackLayout col="0">
                            <Label :text="`${sale.id} • ${formatDate(sale.createdAt)}`" class="text-xs text-gray-500" />
                            <Label :text="`Operador: ${sale.operatorName}`" class="text-xs text-gray-500" />
                        </StackLayout>
                        <Label col="1" :text="sale.status === 'completed' ? formatMoney(sale.total) : 'Cancelada'" :class="sale.status === 'completed' ? 'text-green-700' : 'text-red-700'" class="font-bold text-sm" />
                    </GridLayout>
                </StackLayout>
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { computed } from 'vue'
import { pdvStore } from '../services/PdvStore'

const props = defineProps<{
    operatorName: string
    printerConnected: boolean
}>()

const total = computed(() => pdvStore.getTotal())
const totalItems = computed(() => pdvStore.getTotalItems())
const dailyReport = computed(() => pdvStore.getReport('day'))
const weeklyReport = computed(() => pdvStore.getReport('week'))
const recentSales = computed(() => pdvStore.getRecentSales(6))

function formatMoney(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR')
}

async function onClear(): Promise<void> {
    pdvStore.clearCart()
    await alert('Pedido limpo.')
}

async function onFinalize(): Promise<void> {
    try {
        const sale = pdvStore.finalizeSale(props.operatorName)
        const lines = sale.lines.map(item => `${item.quantity}x ${item.name} - ${formatMoney(item.total)}`)
        await alert({
            title: 'Venda finalizada',
            message: `${lines.join('\n')}\n\nTotal: ${formatMoney(sale.total)}`,
            okButtonText: 'OK',
        })
    } catch (error) {
        await alert(String(error))
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
