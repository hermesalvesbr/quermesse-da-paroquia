<template>
    <ScrollView>
        <StackLayout class="screen p-3">
            <!-- Pending print alert -->
            <StackLayout v-if="pendingPrintCount > 0" class="pending-alert">
                <Label :text="`⚠️ ${pendingPrintCount} venda(s) aguardando impressão`" class="pending-alert-text" />
            </StackLayout>

            <Label text="Histórico de Vendas" class="section-title m-b-2" />

            <StackLayout v-if="recentSales.length === 0" class="soft-panel">
                <Label text="Nenhuma venda registrada ainda." class="subtitle" />
            </StackLayout>

            <StackLayout v-else>
                <StackLayout
                    v-for="sale in recentSales"
                    :key="sale.id"
                    class="sale-card"
                >
                    <!-- Header da venda -->
                    <GridLayout columns="auto, *, auto" columnGap="8">
                        <Label col="0" :text="printStatusIcon(sale)" class="text-lg" />
                        <StackLayout col="1">
                            <Label :text="`#${String(sale.orderNumber || 0).padStart(3, '0')} · ${formatDate(sale.createdAt)}`" class="item-title" />
                            <Label :text="`${sale.operatorName} · ${pdvStore.getPaymentLabel(sale.paymentMethod)}`" class="meta-text" />
                        </StackLayout>
                        <StackLayout col="2" verticalAlignment="center">
                            <Label
                                :text="sale.status === 'completed' ? formatMoney(sale.total) : 'Cancelada'"
                                :class="sale.status === 'completed' ? 'sale-total-ok' : 'sale-total-cancel'"
                                class="font-bold"
                            />
                        </StackLayout>
                    </GridLayout>

                    <!-- Linhas de itens com gestão individual -->
                    <StackLayout v-if="sale.status === 'completed'" class="m-t-2">
                        <StackLayout
                            v-for="line in sale.lines"
                            :key="line.id"
                            class="item-line"
                        >
                            <GridLayout columns="*, auto" columnGap="4">
                                <StackLayout col="0">
                                    <Label
                                        :text="formatItemLine(line)"
                                        :class="isLineFullyReturned(line) ? 'meta-text line-through' : 'meta-text'"
                                    />
                                    <Label
                                        v-if="(line.returnedQty || 0) > 0 && !isLineFullyReturned(line)"
                                        :text="`↩ ${line.returnedQty} devolvido(s)`"
                                        class="returned-badge"
                                    />
                                </StackLayout>
                                <!-- Botões de ação por item (só Dinheiro) -->
                                <StackLayout col="1" orientation="horizontal" v-if="canManageItems(sale, line)">
                                    <Button
                                        text="↩"
                                        class="item-action-btn return-btn"
                                        @tap="onReturnItem(sale, line)"
                                    />
                                    <Button
                                        text="🔄"
                                        class="item-action-btn exchange-btn"
                                        @tap="onExchangeItem(sale, line)"
                                    />
                                </StackLayout>
                            </GridLayout>
                        </StackLayout>
                    </StackLayout>

                    <!-- Histórico de devoluções/trocas -->
                    <StackLayout v-if="hasMovements(sale)" class="movements-section">
                        <Label text="Movimentações:" class="movements-title" />
                        <Label
                            v-for="(ret, idx) in (sale.returns || [])"
                            :key="'r-' + idx"
                            :text="`↩ Devolvido ${ret.quantity}x ${ret.itemName} (R$ ${ret.refundAmount.toFixed(2).replace('.', ',')}) - ${ret.operatorName}`"
                            class="movement-text return-text"
                        />
                        <Label
                            v-for="(exc, idx) in (sale.exchanges || [])"
                            :key="'e-' + idx"
                            :text="`🔄 Troca ${exc.quantity}x ${exc.fromItemName} → ${exc.toItemName} - ${exc.operatorName}`"
                            class="movement-text exchange-text"
                        />
                    </StackLayout>

                    <!-- Ações da venda -->
                    <GridLayout v-if="sale.status === 'completed'" columns="*, *" columnGap="8" class="m-t-2">
                        <Button
                            col="0"
                            :text="sale.printStatus === 'pending' ? '🖨️ IMPRIMIR' : '🔄 REIMPRIMIR'"
                            :class="sale.printStatus === 'pending' ? 'reprint-btn-urgent' : 'reprint-btn'"
                            @tap="onReprint(sale)"
                        />
                        <Button
                            col="1"
                            text="❌ CANCELAR"
                            class="cancel-sale-btn"
                            @tap="onCancelSale(sale)"
                        />
                    </GridLayout>
                </StackLayout>
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { alert, action, prompt } from '@nativescript/core'
import { computed } from 'vue'
import { getBluetoothService } from '../services/BluetoothService'
import { pdvStore, type SaleRecord, type SaleLine } from '../services/PdvStoreDirectus'
import { buildItemTickets } from '../utils/EscPosBuilder'

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

function formatItemLine(line: SaleLine): string {
    const returnedQty = line.returnedQty || 0
    if (returnedQty > 0 && returnedQty < line.quantity) {
        return `  ${line.quantity}x ${line.name} (${returnedQty} devolvido)`
    }
    if (returnedQty >= line.quantity) {
        return `  ${line.quantity}x ${line.name} (devolvido)`
    }
    return `  ${line.quantity}x ${line.name}`
}

function isLineFullyReturned(line: SaleLine): boolean {
    return (line.returnedQty || 0) >= line.quantity
}

function canManageItems(sale: SaleRecord, line: SaleLine): boolean {
    return sale.paymentMethod === 'cash'
        && sale.status === 'completed'
        && !isLineFullyReturned(line)
}

function hasMovements(sale: SaleRecord): boolean {
    return ((sale.returns?.length || 0) + (sale.exchanges?.length || 0)) > 0
}

function printStatusIcon(sale: SaleRecord): string {
    if (sale.status === 'canceled') return '❌'
    if (sale.printStatus === 'printed') return '✅'
    return '⚠️'
}

// === DEVOLUÇÃO POR ITEM ===
async function onReturnItem(sale: SaleRecord, line: SaleLine): Promise<void> {
    const available = line.quantity - (line.returnedQty || 0)

    if (available === 1) {
        // Só 1 unidade, confirma direto
        const result = await action({
            title: `Devolver ${line.name}?`,
            message: `Valor: ${formatMoney(line.unitPrice)}\nO dinheiro será devolvido ao cliente.`,
            actions: ['Confirmar Devolução'],
            cancelButtonText: 'Cancelar',
        })
        if (result === 'Cancelar') return

        try {
            await pdvStore.returnSaleItem(sale.id, line.id, 1, props.operatorName)
            await alert({
                title: 'Devolução registrada',
                message: `1x ${line.name} devolvido. ${formatMoney(line.unitPrice)} a devolver ao cliente.`,
                okButtonText: 'OK',
            })
        } catch (error) {
            await alert({ title: 'Erro', message: String(error), okButtonText: 'OK' })
        }
    } else {
        // Múltiplas unidades, pergunta a quantidade
        const options: string[] = []
        for (let i = 1; i <= available; i++) {
            options.push(`${i} unidade(s) — ${formatMoney(i * line.unitPrice)}`)
        }

        const choice = await action({
            title: `Devolver ${line.name}`,
            message: `Quantas unidades deseja devolver? (${available} disponíveis)`,
            actions: options,
            cancelButtonText: 'Cancelar',
        })
        if (choice === 'Cancelar') return

        const qty = options.indexOf(choice) + 1
        if (qty <= 0) return

        try {
            await pdvStore.returnSaleItem(sale.id, line.id, qty, props.operatorName)
            const refund = qty * line.unitPrice
            await alert({
                title: 'Devolução registrada',
                message: `${qty}x ${line.name} devolvido(s). ${formatMoney(refund)} a devolver ao cliente.`,
                okButtonText: 'OK',
            })
        } catch (error) {
            await alert({ title: 'Erro', message: String(error), okButtonText: 'OK' })
        }
    }
}

// === TROCA POR ITEM ===
async function onExchangeItem(sale: SaleRecord, line: SaleLine): Promise<void> {
    const available = line.quantity - (line.returnedQty || 0)

    // Monta lista de produtos disponíveis para troca (excluindo o próprio item)
    const availableProducts = pdvStore.inventoryItems.filter(
        inv => inv.id !== line.id && inv.stock > 0
    )

    if (availableProducts.length === 0) {
        await alert({
            title: 'Sem estoque',
            message: 'Nenhum produto com estoque disponível para troca.',
            okButtonText: 'OK',
        })
        return
    }

    // Seleciona produto destino
    const productNames = availableProducts.map(p => `${p.name} (${formatMoney(p.price)})`)
    const productChoice = await action({
        title: `Trocar ${line.name}`,
        message: 'Selecione o novo produto:',
        actions: productNames,
        cancelButtonText: 'Cancelar',
    })
    if (productChoice === 'Cancelar') return

    const productIdx = productNames.indexOf(productChoice)
    if (productIdx < 0) return
    const targetProduct = availableProducts[productIdx]

    // Seleciona quantidade
    const maxQty = Math.min(available, targetProduct.stock)
    let qty = 1

    if (maxQty > 1) {
        const qtyOptions: string[] = []
        for (let i = 1; i <= maxQty; i++) {
            const diff = (targetProduct.price - line.unitPrice) * i
            const diffLabel = diff > 0 ? ` (+${formatMoney(diff)})` : diff < 0 ? ` (${formatMoney(diff)})` : ''
            qtyOptions.push(`${i} unidade(s)${diffLabel}`)
        }

        const qtyChoice = await action({
            title: 'Quantidade',
            message: `Quantas unidades de ${line.name} trocar por ${targetProduct.name}?`,
            actions: qtyOptions,
            cancelButtonText: 'Cancelar',
        })
        if (qtyChoice === 'Cancelar') return

        qty = qtyOptions.indexOf(qtyChoice) + 1
        if (qty <= 0) return
    }

    // Confirma a troca
    const priceDiff = (targetProduct.price - line.unitPrice) * qty
    let diffMessage = ''
    if (priceDiff > 0) {
        diffMessage = `\nCliente deve pagar mais ${formatMoney(priceDiff)}.`
    } else if (priceDiff < 0) {
        diffMessage = `\nDevolver ${formatMoney(Math.abs(priceDiff))} ao cliente.`
    }

    const confirm = await action({
        title: 'Confirmar troca',
        message: `${qty}x ${line.name} → ${qty}x ${targetProduct.name}${diffMessage}`,
        actions: ['Confirmar Troca'],
        cancelButtonText: 'Cancelar',
    })
    if (confirm === 'Cancelar') return

    try {
        const result = await pdvStore.exchangeSaleItem(sale.id, line.id, targetProduct.id, qty, props.operatorName)
        let msg = `Troca realizada: ${qty}x ${line.name} → ${qty}x ${targetProduct.name}.`
        if (result.priceDifference > 0) {
            msg += `\nCobrar ${formatMoney(result.priceDifference)} do cliente.`
        } else if (result.priceDifference < 0) {
            msg += `\nDevolver ${formatMoney(Math.abs(result.priceDifference))} ao cliente.`
        }
        await alert({ title: 'Troca registrada', message: msg, okButtonText: 'OK' })
    } catch (error) {
        await alert({ title: 'Erro', message: String(error), okButtonText: 'OK' })
    }
}

// === REIMPRESSÃO ===
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
        const ticketBytes = buildItemTickets({
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
        await alert('Tickets impressos com sucesso!')
    } catch (error) {
        await alert(`Erro ao imprimir: ${error}`)
    }
}

// === CANCELAMENTO ===
async function onCancelSale(sale: SaleRecord): Promise<void> {
    const result = await prompt({
        title: 'Cancelar venda',
        message: `Cancelar venda #${String(sale.orderNumber || 0).padStart(3, '0')}?\nTodos os itens retornarão ao estoque.`,
        okButtonText: 'Cancelar Venda',
        cancelButtonText: 'Voltar',
        defaultText: 'Cancelamento no caixa',
    })

    if (!result.result) return

    try {
        await pdvStore.cancelSale(sale.id, result.text || 'Cancelamento no caixa')
        await alert({
            title: 'Venda cancelada',
            message: `Venda #${String(sale.orderNumber || 0).padStart(3, '0')} cancelada. Itens retornados ao estoque.`,
            okButtonText: 'OK',
        })
    } catch (error) {
        await alert({ title: 'Erro', message: String(error), okButtonText: 'OK' })
    }
}
</script>

<style scoped>
.item-line {
    padding: 4 0;
    border-bottom-width: 0.5;
    border-bottom-color: #e0e0e0;
}

.line-through {
    text-decoration: line-through;
    color: #999;
}

.returned-badge {
    font-size: 11;
    color: #e65100;
    margin-left: 16;
}

.item-action-btn {
    min-width: 36;
    height: 32;
    font-size: 14;
    padding: 4 8;
    margin: 0 2;
    border-radius: 4;
}

.return-btn {
    background-color: #fff3e0;
    color: #e65100;
    border-width: 1;
    border-color: #e65100;
}

.exchange-btn {
    background-color: #e3f2fd;
    color: #1565c0;
    border-width: 1;
    border-color: #1565c0;
}

.cancel-sale-btn {
    background-color: #ffebee;
    color: #c62828;
    font-size: 12;
    border-radius: 6;
    height: 36;
}

.movements-section {
    margin-top: 8;
    padding: 6 8;
    background-color: #fafafa;
    border-radius: 4;
}

.movements-title {
    font-size: 11;
    font-weight: bold;
    color: #666;
    margin-bottom: 2;
}

.movement-text {
    font-size: 11;
    color: #555;
    margin-left: 4;
}

.return-text {
    color: #e65100;
}

.exchange-text {
    color: #1565c0;
}
</style>
