<template>
    <ScrollView>
        <StackLayout class="screen p-3">
            <StackLayout class="glass-card">
                <Label text="📊 Relatório do dia" class="section-title" />
                <GridLayout columns="*, auto" class="m-t-2">
                    <Label col="0" text="Vendas concluídas" class="subtitle" />
                    <Label col="1" :text="String(dailyReport.summary.salesCount)" class="item-title" />
                </GridLayout>
                <GridLayout columns="*, auto">
                    <Label col="0" text="Canceladas" class="subtitle" />
                    <Label col="1" :text="String(dailyReport.summary.canceledCount)" class="item-title" />
                </GridLayout>
                <GridLayout columns="*, auto">
                    <Label col="0" text="Itens vendidos" class="subtitle" />
                    <Label col="1" :text="String(dailyReport.summary.itemsSold)" class="item-title" />
                </GridLayout>
                <GridLayout columns="*, auto">
                    <Label col="0" text="Retornos ao estoque" class="subtitle" />
                    <Label col="1" :text="String(dailyReport.summary.returnedToStock)" class="item-title" />
                </GridLayout>
                <StackLayout class="report-highlight m-t-2">
                    <Label text="Total bruto" class="meta-text" />
                    <Label :text="formatMoney(dailyReport.summary.grossTotal)" class="report-total" />
                </StackLayout>
                <GridLayout columns="*, auto" class="m-t-1">
                    <Label col="0" text="Ticket médio" class="subtitle" />
                    <Label col="1" :text="formatMoney(dailyReport.summary.averageTicket)" class="item-title" />
                </GridLayout>

                <Label v-if="dailyReport.topItems.length > 0" text="Top itens do dia" class="section-title m-t-3" />
                <GridLayout
                    v-for="(item, idx) in dailyReport.topItems"
                    :key="item.id"
                    columns="auto, *, auto"
                    columnGap="8"
                >
                    <Label col="0" :text="`${idx + 1}.`" class="meta-text" />
                    <Label col="1" :text="item.name" class="subtitle" />
                    <Label col="2" :text="`${item.quantity} un.`" class="item-title" />
                </GridLayout>
            </StackLayout>

            <StackLayout class="glass-card">
                <Label text="📈 Relatório da semana" class="section-title" />
                <GridLayout columns="*, auto" class="m-t-2">
                    <Label col="0" text="Vendas concluídas" class="subtitle" />
                    <Label col="1" :text="String(weeklyReport.summary.salesCount)" class="item-title" />
                </GridLayout>
                <GridLayout columns="*, auto">
                    <Label col="0" text="Canceladas" class="subtitle" />
                    <Label col="1" :text="String(weeklyReport.summary.canceledCount)" class="item-title" />
                </GridLayout>
                <GridLayout columns="*, auto">
                    <Label col="0" text="Itens vendidos" class="subtitle" />
                    <Label col="1" :text="String(weeklyReport.summary.itemsSold)" class="item-title" />
                </GridLayout>
                <StackLayout class="report-highlight m-t-2">
                    <Label text="Total bruto semanal" class="meta-text" />
                    <Label :text="formatMoney(weeklyReport.summary.grossTotal)" class="report-total" />
                </StackLayout>
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { pdvStore } from '../services/PdvStore'

const dailyReport = computed(() => pdvStore.getReport('day'))
const weeklyReport = computed(() => pdvStore.getReport('week'))

function formatMoney(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
}
</script>
