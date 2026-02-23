import { isAndroid } from '@nativescript/core';

export interface BluetoothPrinter {
    name: string;
    address: string;
}

type StatusHandler = (message: string) => void;

export class BluetoothService {
    private readonly sppUuid = java.util.UUID.fromString('00001101-0000-1000-8000-00805F9B34FB');
    private readonly reconnectDelayMs = 2500;
    private readonly maxReconnectAttempts = 5;

    private bluetoothAdapter: android.bluetooth.BluetoothAdapter | null = null;
    private socket: android.bluetooth.BluetoothSocket | null = null;
    private outputStream: java.io.OutputStream | null = null;

    private isConnected = false;
    private connectedAddress: string | null = null;
    private reconnectAttempts = 0;
    private reconnectTimeout: number | null = null;
    private statusHandler: StatusHandler | null = null;
    private manualDisconnect = false;

    constructor() {
        if (isAndroid) {
            this.bluetoothAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
        }
    }

    public setStatusHandler(handler: StatusHandler): void {
        this.statusHandler = handler;
    }

    private notifyStatus(message: string): void {
        if (this.statusHandler) {
            this.statusHandler(message);
        }
        console.log(`[BluetoothService] ${message}`);
    }

    public async isEnabled(): Promise<boolean> {
        if (!isAndroid || !this.bluetoothAdapter) {
            return false;
        }
        return this.bluetoothAdapter.isEnabled();
    }

    public async startScanning(onDeviceDiscovered: (device: BluetoothPrinter) => void): Promise<void> {
        if (!isAndroid || !this.bluetoothAdapter) {
            throw new Error('Bluetooth clássico SPP suportado apenas em Android neste app.');
        }

        this.notifyStatus('Carregando impressoras pareadas...');
        const bondedDevices = this.bluetoothAdapter.getBondedDevices();
        const devices = bondedDevices
            ? Array.from(bondedDevices.toArray() as android.bluetooth.BluetoothDevice[])
            : [];

        for (const device of devices) {
            const name = device.getName() || 'Dispositivo sem nome';
            const address = device.getAddress();

            if (address) {
                onDeviceDiscovered({ name, address });
            }
        }

        this.notifyStatus('Busca concluída.');
    }

    public async stopScanning(): Promise<void> {
    }

    public async connect(address: string): Promise<boolean> {
        if (!isAndroid || !this.bluetoothAdapter) {
            throw new Error('Bluetooth clássico SPP suportado apenas em Android neste app.');
        }

        this.manualDisconnect = false;
        this.clearReconnectTimer();
        this.closeCurrentConnection(false);
        this.connectedAddress = address;

        const remoteDevice = this.bluetoothAdapter.getRemoteDevice(address);
        if (!remoteDevice) {
            throw new Error(`Dispositivo ${address} não encontrado.`);
        }

        this.notifyStatus(`Conectando em ${remoteDevice.getName() || address}...`);

        try {
            if (this.bluetoothAdapter.isDiscovering()) {
                this.bluetoothAdapter.cancelDiscovery();
            }

            const socket = remoteDevice.createRfcommSocketToServiceRecord(this.sppUuid);
            socket.connect();

            this.socket = socket;
            this.outputStream = socket.getOutputStream();
            this.isConnected = true;
            this.reconnectAttempts = 0;

            this.notifyStatus(`Conectado a ${remoteDevice.getName() || address}.`);
            return true;
        } catch (error) {
            this.closeCurrentConnection(false);
            this.notifyStatus(`Falha ao conectar em ${address}.`);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        this.manualDisconnect = true;
        this.clearReconnectTimer();
        this.closeCurrentConnection(true);
        this.notifyStatus('Desconectado.');
    }

    public async reconnectLastPrinter(): Promise<boolean> {
        if (!this.connectedAddress) {
            throw new Error('Nenhuma impressora conhecida para reconectar.');
        }

        this.manualDisconnect = false;
        return this.connect(this.connectedAddress);
    }

    public getConnectedStatus(): boolean {
        return this.isConnected;
    }

    public getConnectedAddress(): string | null {
        return this.connectedAddress;
    }

    public async writeBytes(bytes: number[]): Promise<boolean> {
        if (!this.isConnected || !this.outputStream || !this.connectedAddress) {
            throw new Error('Não conectado à impressora Bluetooth.');
        }

        try {
            const payload = Array.create('byte', bytes.length);
            for (let index = 0; index < bytes.length; index += 1) {
                payload[index] = bytes[index] & 0xFF;
            }

            this.outputStream.write(payload);
            this.outputStream.flush();
            this.notifyStatus('Impressão enviada para a impressora.');
            return true;
        } catch (err) {
            this.isConnected = false;
            this.notifyStatus('Falha ao enviar impressão. Tentando reconectar...');
            this.scheduleReconnect();
            throw err;
        }
    }

    private scheduleReconnect(): void {
        if (this.manualDisconnect || !this.connectedAddress || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.notifyStatus('Reconexão automática esgotada.');
            }
            return;
        }

        this.clearReconnectTimer();
        this.reconnectAttempts += 1;

        this.reconnectTimeout = setTimeout(async () => {
            const targetAddress = this.connectedAddress;
            if (!targetAddress) {
                return;
            }

            try {
                this.notifyStatus(`Tentando reconexão (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                await this.connect(targetAddress);
            } catch {
                this.scheduleReconnect();
            }
        }, this.reconnectDelayMs) as unknown as number;
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimeout !== null) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    private cleanupSocketResources(): void {
        try {
            if (this.outputStream) {
                this.outputStream.close();
            }
        } catch (error) {
            console.warn('Falha ao fechar outputStream:', error);
        }

        try {
            if (this.socket) {
                this.socket.close();
            }
        } catch (error) {
            console.warn('Falha ao fechar socket Bluetooth:', error);
        }

        this.outputStream = null;
        this.socket = null;
    }

    private closeCurrentConnection(clearAddress: boolean): void {
        this.cleanupSocketResources();
        this.isConnected = false;
        if (clearAddress) {
            this.connectedAddress = null;
        }
    }
}
