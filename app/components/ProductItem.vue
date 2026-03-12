<template>
    <GridLayout
        columns="44, *, 120"
        :class="item.quantity > 0 ? 'pi-card-active' : 'pi-card'"
        columnGap="8"
        @tap="$emit('increment', item.id)"
    >
        <!-- Emoji visual identifier -->
        <Label col="0" :text="item.emoji" class="pi-emoji" verticalAlignment="center" />

        <!-- Product info: name + price/subtotal -->
        <StackLayout col="1" verticalAlignment="center">
            <Label :text="item.name" class="pi-name" textWrap="false" />
            <GridLayout columns="auto, auto" columnGap="6" marginTop="2">
                <Label col="0" :text="formatMoney(item.price)" class="pi-price" />
                <Label
                    v-if="item.quantity > 0"
                    col="1"
                    :text="`= ${formatMoney(item.price * item.quantity)}`"
                    class="pi-subtotal"
                />
            </GridLayout>
        </StackLayout>

        <!-- Quantity controls: − qty + -->
        <GridLayout
            col="2"
            columns="44, 32, 44"
            rows="44"
            verticalAlignment="center"
        >
            <Label
                col="0"
                text="–"
                class="pi-btn-minus"
                :style="{ fontSize: 24, fontWeight: 'bold', color: '#3A200C', textAlignment: 'center', verticalTextAlignment: 'middle', lineHeight: 0 }"
                @tap="$emit('decrement', item.id)"
            />
            <Label
                col="1"
                :text="String(item.quantity)"
                :class="item.quantity > 0 ? 'pi-qty-active' : 'pi-qty'"
                horizontalAlignment="center"
                verticalAlignment="center"
            />
            <Label
                col="2"
                text="+"
                class="pi-btn-plus"
                :style="{ fontSize: 24, fontWeight: 'bold', color: '#3A200C', textAlignment: 'center', verticalTextAlignment: 'middle', lineHeight: 0 }"
                @tap="$emit('increment', item.id)"
            />
        </GridLayout>
    </GridLayout>
</template>

<script setup lang="ts">
import type { CartItem } from '../services/PdvStoreDirectus'

defineProps<{ item: CartItem }>()
defineEmits<{
    (e: 'increment', id: string): void
    (e: 'decrement', id: string): void
}>()

function formatMoney(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
}
</script>
