<template>
    <ScrollView>
        <StackLayout class="screen p-4">
            <StackLayout class="glass-card p-4 m-b-4">
                <Label text="Configurações do caixa" class="title" />
                <Label text="Dados do operador atual" class="subtitle" />

                <StackLayout class="soft-panel p-3 m-t-3">
                    <Label :text="`Operador: ${operatorName || 'Não definido'}`" class="item-title" />
                    <Label :text="`Último login: ${operatorLoginAt || '-'}`" class="text-xs text-gray-500 m-t-1" textWrap="true" />
                </StackLayout>

                <Button text="TROCAR OPERADOR" class="action-warn m-t-3" @tap="$emit('requestChangeOperator')" />
            </StackLayout>

            <StackLayout class="glass-card p-4">
                <Label text="Impressora" class="section-title" />
                <Label :text="printerConnected ? 'Status: conectada' : 'Status: desconectada'" :class="printerConnected ? 'text-green-700' : 'text-red-700'" class="m-t-1 font-bold" />
                <Label text="Use o menu para abrir a tela de Impressora Bluetooth." class="subtitle m-t-1" textWrap="true" />
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
defineProps<{
    operatorName: string
    operatorLoginAt: string
    printerConnected: boolean
}>()

defineEmits<{
    (e: 'requestChangeOperator'): void
}>()
</script>
