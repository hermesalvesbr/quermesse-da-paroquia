<template>
    <GridLayout rows="auto, auto, *, auto" class="screen">
        <!-- Row 0: Directus connection warning -->
        <StackLayout row="0" v-if="!hasProducts" class="printer-warning-banner" style="background-color: rgba(255, 152, 0, 0.9);">
            <Label text="⚠️ SEM PRODUTOS — Verifique: 1) Internet ativa 2) Directus online 3) Cache local" class="printer-warning-text" textWrap="true" />
        </StackLayout>

        <!-- Row 1: Printer warning banner -->
        <StackLayout row="1" v-if="!printerConnected" class="printer-warning-banner">
            <Label text="⚠️ IMPRESSORA DESCONECTADA — conecte para finalizar vendas" class="printer-warning-text" textWrap="true" />
        </StackLayout>

        <!-- Row 2: TabView with dynamic category tabs -->
        <TabView
            row="2"
            tabBackgroundColor="rgba(255,248,222,0.95)"
            tabTextColor="#7A4A28"
            selectedTabTextColor="#5A3418"
            androidSelectedTabHighlightColor="#F5C542"
            :tabTextFontSize="14"
        >
            <TabViewItem v-for="tab in categoryTabs" :key="tab.key" :title="`${tab.emoji} ${tab.label}`">
                <ScrollView>
                    <StackLayout class="p-3">
                        <StackLayout v-if="getFilteredItems(tab.key).length === 0" class="soft-panel">
                            <Label text="📦 Nenhum produto disponível" class="item-title" textAlign="center" />
                            <Label text="Verifique sua conexão com a internet e estado do servidor Directus." class="meta-text" textAlign="center" textWrap="true" />
                            <Label text="Se o Directus estiver OK, aguarde sincronização ou reinicie o app." class="meta-text" textAlign="center" textWrap="true" />
                        </StackLayout>
                        <GridLayout
                            v-for="item in getFilteredItems(tab.key)"
                            :key="item.id"
                            columns="auto, *, auto"
                            class="menu-item-card"
                            columnGap="12"
                        >
                            <Label col="0" :text="item.emoji" class="emoji" />
                            <StackLayout col="1">
                                <Label :text="item.name" class="item-title" />
                                <Label :text="`${formatMoney(item.price)} · Est: ${pdvStore.getStock(item.id)}`" class="meta-text" />
                            </StackLayout>
                            <StackLayout col="2" class="qty-box">
                                <GridLayout columns="auto, auto, auto" class="qty-controls" columnGap="6">
                                    <Button col="0" text="−" class="qty-btn" @tap="pdvStore.decrementItem(item.id)" />
                                    <Label col="1" :text="String(item.quantity)" class="qty-label" />
                                    <Button
                                        col="2"
                                        text="+"
                                        class="qty-btn-add"
                                        @tap="pdvStore.incrementItem(item.id)"
                                        :isEnabled="item.quantity < pdvStore.getStock(item.id)"
                                        :class="item.quantity >= pdvStore.getStock(item.id) ? 'opacity-40' : ''"
                                    />
                                </GridLayout>
                                <Label
                                    v-if="item.quantity > 0"
                                    :text="`= ${formatMoney(item.price * item.quantity)}`"
                                    class="subtotal"
                                />
                            </StackLayout>
                        </GridLayout>
                    </StackLayout>
                </ScrollView>
            </TabViewItem>
        </TabView>

        <!-- Row 3: Fixed bottom bar — cart summary + payment + finalize -->
        <StackLayout row="3" class="bottom-bar" rowGap="12">
            <!-- Cart summary -->
            <GridLayout columns="auto, *, auto">
                <Label col="0" :text="`${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`" class="bottom-count" />
                <Label col="2" :text="formatMoney(total)" class="bottom-total" />
            </GridLayout>

            <!-- Payment method selector — only when cart has items -->
            <GridLayout v-if="totalItems > 0" columns="*, *, *" columnGap="8" class="m-t-2">
                <Button
                    col="0"
                    text="💵 Dinheiro"
                    :class="selectedPayment === 'cash' ? 'pay-btn-active' : 'pay-btn'"
                    @tap="selectedPayment = 'cash'"
                />
                <Button
                    col="1"
                    text="📱 PIX"
                    :class="selectedPayment === 'pix' ? 'pay-btn-active' : 'pay-btn'"
                    @tap="selectedPayment = 'pix'"
                />
                <Button
                    col="2"
                    text="💳 Cartão"
                    :class="selectedPayment === 'card' ? 'pay-btn-active' : 'pay-btn'"
                    @tap="selectedPayment = 'card'"
                />
            </GridLayout>

            <!-- Action buttons -->
            <GridLayout columns="auto, *" columnGap="12" class="m-t-4">
                <Button col="0" text="LIMPAR" class="clear-btn" @tap="onClear" />
                <Button
                    col="1"
                    :text="isProcessing ? 'PROCESSANDO...' : '✅ FINALIZAR VENDA'"
                    class="finalize-btn"
                    @tap="onFinalize"
                    :isEnabled="canFinalize"
                    :class="!canFinalize ? 'opacity-40' : ''"
                />
            </GridLayout>
        </StackLayout>
    </GridLayout>
</template>

<script setup lang="ts">
import { alert, confirm } from '@nativescript/core'
import { computed, ref } from 'vue'
import { getBluetoothService } from '../services/BluetoothService'
import { pdvStore, type PaymentMethod } from '../services/PdvStoreDirectus'
import { buildItemTickets } from '../utils/EscPosBuilder'

const props = defineProps<{
    operatorName: string
    printerConnected: boolean
}>()

const selectedPayment = ref<PaymentMethod>('cash')
const isProcessing = ref(false)

// Tabs dinâmicas baseadas nas categorias do Directus
const categoryTabs = computed(() => pdvStore.getCategoryTabs())
function getFilteredItems(categoryKey: string) {
  return pdvStore.getItemsByCategory(categoryKey)
}
const total = computed(() => pdvStore.getTotal())
const totalItems = computed(() => pdvStore.getTotalItems())
const canFinalize = computed(() => totalItems.value > 0 && !isProcessing.value)
const hasProducts = computed(() => pdvStore.cartItems.length > 0)

function formatMoney(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
}

async function onClear(): Promise<void> {
    if (totalItems.value === 0) return
    const yes = await confirm({
        title: 'Limpar pedido',
        message: 'Deseja remover todos os itens do pedido?',
        okButtonText: 'Sim, limpar',
        cancelButtonText: 'Não',
    })
    if (yes) {
        pdvStore.clearCart()
    }
}

async function onFinalize(): Promise<void> {
    if (isProcessing.value) return

    // Step 1: Validate printer
    if (!props.printerConnected) {
        await alert({
            title: '🔴 Impressora desconectada',
            message: 'Conecte a impressora Bluetooth antes de finalizar a venda. Use o menu ☰ > Impressora.',
            okButtonText: 'Entendi',
        })
        return
    }

    isProcessing.value = true

    try {
        // Step 2: Finalize sale (deduct stock, register)
        const sale = await pdvStore.finalizeSale(props.operatorName, selectedPayment.value)

        // Step 3: Attempt print
        try {
            const btService = getBluetoothService()
            const ticketBytes = buildItemTickets({
                eventName: 'QUERMESSE SAO JOSE',
                orderNumber: sale.orderNumber,
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

            await alert({
                title: `✅ Pedido #${String(sale.orderNumber).padStart(3, '0')}`,
                message: `Venda finalizada e ticket impresso!\n\nTotal: ${formatMoney(sale.total)}\nPagamento: ${pdvStore.getPaymentLabel(sale.paymentMethod)}`,
                okButtonText: 'OK',
            })
        } catch (printError) {
            // Sale is saved but print failed — offer retry from Vendas
            await alert({
                title: '⚠️ Venda registrada, impressão falhou',
                message: `Pedido #${String(sale.orderNumber).padStart(3, '0')} salvo.\n\nUse o menu ☰ > Vendas para reimprimir o ticket.\n\nErro: ${printError}`,
                okButtonText: 'Entendi',
            })
        }
    } catch (error) {
        await alert({
            title: 'Erro na venda',
            message: String(error),
            okButtonText: 'OK',
        })
    } finally {
        isProcessing.value = false
    }
}
</script>
