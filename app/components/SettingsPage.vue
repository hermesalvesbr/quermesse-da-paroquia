<template>
    <ScrollView>
        <StackLayout class="screen p-4">
            <StackLayout class="glass-card">
                <Label text="Configurações do caixa" class="title" />
                <Label text="Dados do operador atual" class="subtitle" />

                <StackLayout class="soft-panel">
                    <Label :text="`Operador: ${operatorName || 'Não definido'}`" class="item-title" />
                    <Label :text="`Último login: ${operatorLoginAt || '-'}`" class="meta-text m-t-1" textWrap="true" />
                </StackLayout>

                <Button text="TROCAR OPERADOR" class="action-warn m-t-3" @tap="$emit('requestChangeOperator')" />
            </StackLayout>

            <!-- ── Permissões Bluetooth (Android 12+) ── -->
            <StackLayout class="glass-card">
                <Label text="Permissões Bluetooth" class="section-title" />
                <Label
                    text="Android 12+ exige permissões em tempo de execução para usar Bluetooth."
                    class="subtitle"
                    textWrap="true"
                />

                <StackLayout v-if="!permissionStatus.needsRuntimeRequest" class="soft-panel m-t-2">
                    <Label
                        text="✅ Seu dispositivo não exige permissões em tempo de execução."
                        class="item-title"
                        textWrap="true"
                    />
                </StackLayout>

                <StackLayout v-else class="m-t-2">
                    <GridLayout columns="auto, *" class="soft-panel m-b-3" columnGap="8">
                        <Label col="0" :text="permissionStatus.connect ? '✅' : '❌'" class="text-lg" />
                        <StackLayout col="1">
                            <Label text="BLUETOOTH_CONNECT" class="item-title" />
                            <Label text="Necessária para listar e conectar dispositivos pareados." class="meta-text" textWrap="true" />
                        </StackLayout>
                    </GridLayout>

                    <GridLayout columns="auto, *" class="soft-panel m-b-3" columnGap="8">
                        <Label col="0" :text="permissionStatus.scan ? '✅' : '❌'" class="text-lg" />
                        <StackLayout col="1">
                            <Label text="BLUETOOTH_SCAN" class="item-title" />
                            <Label text="Necessária para buscar novos dispositivos por perto." class="meta-text" textWrap="true" />
                        </StackLayout>
                    </GridLayout>

                    <Label
                        v-if="permissionStatus.allGranted"
                        text="Todas as permissões Bluetooth concedidas."
                        class="status-text-online font-bold m-t-1"
                    />
                    <Label
                        v-else
                        text="Permissões pendentes. Toque abaixo para solicitar."
                        class="status-text-offline font-bold m-t-1"
                        textWrap="true"
                    />

                    <Button
                        v-if="!permissionStatus.allGranted"
                        text="SOLICITAR PERMISSÕES BLUETOOTH"
                        class="action-primary m-t-3"
                        :isEnabled="!isRequesting"
                        :class="isRequesting ? 'opacity-50' : ''"
                        @tap="onRequestPermissions"
                    />

                    <Button
                        text="VERIFICAR PERMISSÕES"
                        class="action-warn m-t-2"
                        @tap="refreshPermissions"
                    />
                </StackLayout>
            </StackLayout>

            <StackLayout class="glass-card">
                <Label text="Impressora" class="section-title" />
                <Label :text="printerConnected ? 'Status: conectada' : 'Status: desconectada'" :class="printerConnected ? 'status-text-online' : 'status-text-offline'" class="m-t-1 font-bold" />
                <Label text="Use o menu para abrir a tela de Impressora Bluetooth." class="subtitle m-t-1" textWrap="true" />
            </StackLayout>

            <StackLayout class="glass-card">
                <Label text="Conectividade crítica" class="section-title" />
                <Label
                    :text="internetConnected ? 'Internet: conectada' : 'Internet: desconectada'"
                    :class="internetConnected ? 'status-text-online' : 'status-text-offline'"
                    class="m-t-1 font-bold"
                />
                <Label
                    :text="bluetoothEnabled ? 'Bluetooth do aparelho: ligado' : 'Bluetooth do aparelho: desligado'"
                    :class="bluetoothEnabled ? 'status-text-online' : 'status-text-offline'"
                    class="m-t-1 font-bold"
                />
                <Label
                    text="Se internet ou Bluetooth estiverem indisponíveis, o caixa opera com limitações."
                    class="subtitle m-t-1"
                    textWrap="true"
                />
            </StackLayout>
        </StackLayout>
    </ScrollView>
</template>

<script setup lang="ts">
import { alert } from '@nativescript/core'
import { onMounted, ref } from 'vue'
import {
    checkBluetoothPermissions,
    requestBluetoothPermissions,
    type BluetoothPermissionStatus,
} from '../utils/BluetoothPermissions'

defineProps<{
    operatorName: string
    operatorLoginAt: string
    printerConnected: boolean
    internetConnected: boolean
    bluetoothEnabled: boolean
}>()

defineEmits<{
    (e: 'requestChangeOperator'): void
}>()

// ── Estado de permissões ────────────────────────────────────────────────────────
const permissionStatus = ref<BluetoothPermissionStatus>({
    connect: false,
    scan: false,
    allGranted: false,
    needsRuntimeRequest: false,
})
const isRequesting = ref(false)

function refreshPermissions(): void {
    permissionStatus.value = checkBluetoothPermissions()
}

async function onRequestPermissions(): Promise<void> {
    isRequesting.value = true
    try {
        const granted = await requestBluetoothPermissions()
        refreshPermissions()

        if (granted) {
            await alert('Permissões Bluetooth concedidas com sucesso!')
        } else {
            await alert(
                'Algumas permissões foram negadas. Verifique as configurações do app no Android se necessário.',
            )
        }
    } catch (error) {
        await alert(`Erro ao solicitar permissões: ${error}`)
    } finally {
        isRequesting.value = false
    }
}

onMounted(() => {
    refreshPermissions()
})
</script>
