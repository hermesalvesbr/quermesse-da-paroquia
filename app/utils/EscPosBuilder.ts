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

    // Alignment (0 = Left, 1 = Center, 2 = Right)
    public align(align: 0 | 1 | 2): this {
        this.buffer.push(27, 97, align); // ESC a n
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
