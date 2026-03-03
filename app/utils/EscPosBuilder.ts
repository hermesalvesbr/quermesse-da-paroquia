// Standard ESC/POS commands
export class EscPosBuilder {
    private buffer: number[] = [];

    private toAscii(text: string): string {
        return text
            .replace(/[ÁÀÂÃÄ]/g, 'A')
            .replace(/[áàâãä]/g, 'a')
            .replace(/[ÉÈÊË]/g, 'E')
            .replace(/[éèêë]/g, 'e')
            .replace(/[ÍÌÎÏ]/g, 'I')
            .replace(/[íìîï]/g, 'i')
            .replace(/[ÓÒÔÕÖ]/g, 'O')
            .replace(/[óòôõö]/g, 'o')
            .replace(/[ÚÙÛÜ]/g, 'U')
            .replace(/[úùûü]/g, 'u')
            .replace(/Ç/g, 'C')
            .replace(/ç/g, 'c')
    }

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
        const safeText = this.toAscii(text)
        for (let i = 0; i < safeText.length; i++) {
            this.buffer.push(safeText.charCodeAt(i));
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

// ── Individual Item Tickets Builder ──

export function buildItemTickets(data: TicketData): number[] {
    const b = new EscPosBuilder();
    b.init();

    const formatDatePtBr = (value: string): string => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            return value
        }

        const datePart = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
        const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        return `${datePart}  ${timePart}`
    }

    const printableUpper = (value: string): string => {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036F]/g, '')
            .toUpperCase()
    }

    const eventTitle = printableUpper(data.eventName || 'SAO JOSE')
    const ticketDate = formatDatePtBr(data.dateTime)

    // Expand items by quantity — 2 coxinhas = 2 individual tickets
    const individualItems: Array<{ name: string; unitPrice: number }> = []
    
    for (const item of data.items) {
        const unitPrice = item.total / item.quantity
        for (let i = 0; i < item.quantity; i++) {
            individualItems.push({ name: item.name, unitPrice })
        }
    }

    // Print each item as a separate ticket with full cut
    for (let idx = 0; idx < individualItems.length; idx++) {
        const item = individualItems[idx]
        const priceFormatted = `R$ ${item.unitPrice.toFixed(2).replace('.', ',')}`
        const itemName = printableUpper(item.name)

        b.align(1)
            .bold(true)
            .textLine(eventTitle)
            .bold(false)
            .textLine(ticketDate)
            .separator('-')
            .lf()

            .bold(true)
            .doubleSize(true)
            .textLine(itemName)
            .lf()
            .textLine(priceFormatted)
            .doubleSize(false)
            .bold(false)
            .lf()

            .separator('-')
            .align(0)
            .textLine(`Pagamento: ${data.paymentMethod}`)
            .textLine(`Operador: ${data.operatorName}`)
            .separator('-')
            .lf()

            .bold(true)
            .textLine('Apresente este ticket')
            .bold(false)
            .lf()
            .lf()

        // Full cut after each ticket
        b.cut()
    }

    return b.build();
}
