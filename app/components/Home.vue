<template>
    <Page>
        <ActionBar>
            <Label text="Integração PDV Bluetooth"/>
        </ActionBar>

        <GridLayout rows="auto, auto, auto, *, auto, auto, auto" class="p-4 bg-gray-100 h-full">
            <!-- Connection Status -->
            <StackLayout row="0" class="m-b-4 p-4 rounded-lg shadow-sm" :class="isConnected ? 'bg-green-100' : 'bg-red-100'">
                <Label class="text-xl font-bold text-center" :class="isConnected ? 'text-green-800' : 'text-red-800'" 
                       :text="isConnected ? 'Conectado: ' + selectedPrinterName : 'Impressora Desconectada'" />
            </StackLayout>

            <!-- Device Selection -->
            <StackLayout row="1" class="m-b-4">
                <Button :text="isScanning ? 'Buscando...' : 'Buscar Impressoras Bluetooth'" @tap="scanPrinters" :isEnabled="!isScanning" class="bg-blue-500 text-white p-4 rounded-lg font-bold" :class="isScanning ? 'opacity-50' : ''" />
                
                <ListView v-if="printers.length > 0" :items="printers" height="150" class="bg-white m-t-2 rounded-lg" @itemTap="onPrinterSelect">
                    <template #default="{ item }">
                        <StackLayout class="p-3 border-b border-gray-200">
                            <Label :text="item.name" class="font-bold text-lg" />
                            <Label :text="item.address" class="text-sm text-gray-500" />
                        </StackLayout>
                    </template>
                </ListView>
            </StackLayout>

            <!-- Sales Input -->
            <StackLayout row="2" class="p-4 bg-white rounded-lg shadow-sm m-b-4">
                <Label text="Detalhes da Venda" class="text-xl font-bold m-b-2" />
                
                <Label text="Valor Total (R$):" class="text-sm text-gray-600 m-b-1" />
                <TextField v-model="saleAmount" keyboardType="number" hint="0.00" class="border p-2 rounded m-b-4 text-lg" />
                
                <Label text="Cliente/Observação:" class="text-sm text-gray-600 m-b-1" />
                <TextField v-model="saleNote" hint="Nome do cliente" class="border p-2 rounded text-lg" />
            </StackLayout>

            <StackLayout row="4">
                <Button text="IMPRIMIR RECIBO" @tap="printReceipt" 
                        :isEnabled="isConnected && saleAmount.length > 0"
                        class="bg-green-600 text-white p-4 rounded-lg font-bold text-xl h-16" 
                        :class="(!isConnected || saleAmount.length == 0) ? 'opacity-50' : ''" />
            </StackLayout>

            <GridLayout row="5" columns="*, *" class="m-t-3" columnGap="8">
                <Button col="0" text="RECONECTAR" @tap="reconnectPrinter"
                        :isEnabled="!isConnected && selectedPrinterAddress.length > 0"
                        class="bg-yellow-600 text-white p-3 rounded-lg font-bold"
                        :class="(isConnected || selectedPrinterAddress.length == 0) ? 'opacity-50' : ''" />

                <Button col="1" text="DESCONECTAR" @tap="disconnectPrinter"
                        :isEnabled="isConnected"
                        class="bg-red-600 text-white p-3 rounded-lg font-bold"
                        :class="!isConnected ? 'opacity-50' : ''" />
            </GridLayout>

            <Label row="6" :text="statusMessage" class="text-center text-sm text-gray-700 m-t-3" textWrap="true" />
        </GridLayout>
    </Page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BluetoothService, type BluetoothPrinter } from '../services/BluetoothService';
import { EscPosBuilder } from '../utils/EscPosBuilder';

const btService = new BluetoothService();

const printers = ref<BluetoothPrinter[]>([]);
const isConnected = ref(false);
const selectedPrinterName = ref('');
const selectedPrinterAddress = ref('');

const saleAmount = ref('');
const saleNote = ref('');

const isScanning = ref(false);
const statusMessage = ref('Aguardando ação do usuário.');

onMounted(async () => {
    btService.setStatusHandler((status) => {
        statusMessage.value = status;
        isConnected.value = btService.getConnectedStatus();
    });

    // Check if adapter is ready
    const enabled = await btService.isEnabled();
    if (!enabled) {
        statusMessage.value = 'Bluetooth está desativado. Ative para continuar.';
    }
});

async function scanPrinters() {
    printers.value = [];
    isScanning.value = true;
    try {
        await btService.startScanning((device) => {
            if (!printers.value.find(p => p.address === device.address)) {
                printers.value.push(device);
            }
        });
        if (printers.value.length === 0) {
            alert("Nenhuma impressora pareada encontrada. Faça o pareamento da impressora no Android e tente novamente.");
        }
    } catch (err) {
        alert("Erro ao escanear: " + err);
    } finally {
        isScanning.value = false;
    }
}

async function onPrinterSelect(event: any) {
    const printer = printers.value[event.index];
    try {
        selectedPrinterName.value = printer.name;
        selectedPrinterAddress.value = printer.address;
        
        console.log(`Conectando a ${printer.name}...`);

        await btService.connect(printer.address);
        isConnected.value = true;
        
        alert(`Conectado com sucesso a ${printer.name}`);
    } catch (err) {
        isConnected.value = false;
        alert(`Erro ao conectar: ${err}`);
    }
}

async function printReceipt() {
    if (!isConnected.value) {
        alert("Impressora não conectada!");
        return;
    }

    try {
        const builder = new EscPosBuilder();
        
        // Build receipt
        const escposBytes = builder
            .init()
            .align(1) // Center
            .bold(true)
            .textLine("NOME DA SUA LOJA")
            .bold(false)
            .lf()
            .align(0) // Left
            .textLine(`Data: ${new Date().toLocaleString()}`)
            .textLine("--------------------------------")
            .textLine("QTD  ITEM                VALOR")
            .textLine(`1    VENDA DIVERSA       R$ ${saleAmount.value}`)
            .textLine("--------------------------------")
            .align(2) // Right
            .bold(true)
            .textLine(`TOTAL: R$ ${saleAmount.value}`)
            .bold(false)
            .align(0)
            .lf()
            .textLine(`Obs: ${saleNote.value || 'N/A'}`)
            .lf()
            .align(1)
            .textLine("Obrigado pela preferência!")
            .lf()
            .lf()
            .lf()
            .cut() // Cut paper
            .build();

        await btService.writeBytes(escposBytes);
        console.log("Recibo impresso com sucesso!");
        
        // Reset form
        saleAmount.value = '';
        saleNote.value = '';
        
    } catch (err) {
        alert(`Erro na impressão: ${err}`);
        isConnected.value = btService.getConnectedStatus();
    }
}

async function disconnectPrinter() {
    try {
        await btService.disconnect();
        isConnected.value = false;
    } catch (err) {
        alert(`Erro ao desconectar: ${err}`);
    }
}

async function reconnectPrinter() {
    try {
        if (!selectedPrinterAddress.value) {
            alert('Selecione uma impressora primeiro.');
            return;
        }

        await btService.connect(selectedPrinterAddress.value);
        isConnected.value = true;
    } catch (err) {
        isConnected.value = false;
        alert(`Erro ao reconectar: ${err}`);
    }
}
</script>
