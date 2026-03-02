// Standard ESC/POS commands
export class EscPosBuilder {
    private buffer: number[] = [];

    // Initialize printer
    public init(): this {
        this.buffer.push(27, 64); // ESC @
        return this;
    }

    // Line feed
    public lf(): this {
        this.buffer.push(10); // LF
        return this;
    }

    // Print text
    public text(text: string): this {
        // Simple ASCII encoding
        for (let i = 0; i < text.length; i++) {
            this.buffer.push(text.charCodeAt(i));
        }
        return this;
    }

    public textLine(text: string): this {
        this.text(text);
        this.lf();
        return this;
    }

    // Text formatting
    public bold(enable: boolean): this {
        this.buffer.push(27, 69, enable ? 1 : 0); // ESC E n
        return this;
    }

    // Double size (width + height)
    public doubleSize(enable: boolean): this {
        // GS ! n — bit 4 = double height, bit 5 = double width
        this.buffer.push(29, 33, enable ? 0x30 : 0x00);
        return this;
    }

    // Alignment (0 = Left, 1 = Center, 2 = Right)
    public align(align: 0 | 1 | 2): this {
        this.buffer.push(27, 97, align); // ESC a n
        return this;
    }

    // Print a separator line
    public separator(char = '-', width = 32): this {
        this.textLine(char.repeat(width));
        return this;
    }

    // Print two columns (left-aligned and right-aligned)
    public columns(left: string, right: string, width = 32): this {
        const gap = width - left.length - right.length;
        const spaces = gap > 0 ? ' '.repeat(gap) : ' ';
        this.textLine(`${left}${spaces}${right}`);
        return this;
    }

    // Full cut paper
    public cut(): this {
        this.buffer.push(29, 86, 65, 0); // GS V A 0
        return this;
    }

    // Get final byte array
    public build(): number[] {
        return [...this.buffer];
    }
}

// ── Ticket Template Builder ──

interface TicketData {
    eventName: string
    orderNumber: number
    items: Array<{ name: string; quantity: number; total: number }>
    total: number
    paymentMethod: string
    operatorName: string
    dateTime: string
}

export function buildSaleTicket(data: TicketData): number[] {
    const b = new EscPosBuilder();

    b.init()
        .align(1)
        .bold(true)
        .doubleSize(true)
        .textLine(data.eventName)
        .doubleSize(false)
        .bold(false)
        .lf()

        // Order number — BIG
        .bold(true)
        .doubleSize(true)
        .textLine(`PEDIDO #${String(data.orderNumber).padStart(3, '0')}`)
        .doubleSize(false)
        .bold(false)
        .lf()

        .align(0)
        .separator('=')

    // Items
    for (const item of data.items) {
        const qty = `${item.quantity}x`;
        const price = `R$ ${item.total.toFixed(2).replace('.', ',')}`;
        b.columns(`${qty} ${item.name}`, price);
    }

    b.separator('=')
        .align(2)
        .bold(true)
        .doubleSize(true)
        .textLine(`TOTAL R$ ${data.total.toFixed(2).replace('.', ',')}`)
        .doubleSize(false)
        .bold(false)
        .lf()

        .align(1)
        .textLine(`Pagamento: ${data.paymentMethod}`)
        .separator('-')
        .textLine(`Operador: ${data.operatorName}`)
        .textLine(data.dateTime)
        .lf()
        .bold(true)
        .textLine('Apresente este ticket na barraca')
        .textLine('para retirar seu pedido.')
        .bold(false)
        .lf()
        .lf()
        .cut();

    return b.build();
}
