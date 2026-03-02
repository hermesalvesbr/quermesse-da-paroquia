import { ApplicationSettings } from '@nativescript/core'
import { reactive } from 'vue'

export interface MenuItem {
    id: string
    name: string
    price: number
    emoji: string
}

export interface InventoryItem extends MenuItem {
    stock: number
}

export interface CartItem extends MenuItem {
    quantity: number
}

export interface SaleLine {
    id: string
    name: string
    quantity: number
    unitPrice: number
    total: number
}

export interface SaleExchange {
    at: string
    operatorName: string
    fromItemId: string
    toItemId: string
    quantity: number
    difference: number
}

export interface SaleRecord {
    id: string
    createdAt: string
    operatorName: string
    paymentMethod: 'cash' | 'pix' | 'card'
    status: 'completed' | 'canceled'
    lines: SaleLine[]
    total: number
    canceledAt?: string
    cancelReason?: string
    exchanges?: SaleExchange[]
}

export interface StockMovement {
    id: string
    createdAt: string
    type: 'sale' | 'cancel' | 'exchange-in' | 'exchange-out' | 'manual-return'
    itemId: string
    quantity: number
    note: string
}

export interface CashMovement {
    id: string
    createdAt: string
    type: 'sale-in' | 'supply-in' | 'withdraw-out'
    amount: number
    note: string
    operatorName: string
}

export interface ShiftSession {
    id: string
    openedAt: string
    openedBy: string
    openingAmount: number
    closedAt?: string
    closedBy?: string
    expectedAmount?: number
    declaredAmount?: number
    difference?: number
}

interface ReportSummary {
    salesCount: number
    canceledCount: number
    grossTotal: number
    itemsSold: number
    averageTicket: number
    returnedToStock: number
}

interface TopItemReport {
    id: string
    name: string
    quantity: number
}

interface PeriodReport {
    summary: ReportSummary
    topItems: TopItemReport[]
}

const INVENTORY_STORAGE_KEY = 'pdv.inventory'
const SALES_STORAGE_KEY = 'pdv.sales'
const STOCK_MOVEMENTS_STORAGE_KEY = 'pdv.stock.movements'
const CASH_MOVEMENTS_STORAGE_KEY = 'pdv.cash.movements'
const SHIFTS_STORAGE_KEY = 'pdv.shifts'

const initialInventory: InventoryItem[] = [
    { id: 'coxinha', name: 'Coxinha', price: 8, emoji: '🍗', stock: 60 },
    { id: 'pastel', name: 'Pastel', price: 10, emoji: '🥟', stock: 55 },
    { id: 'caldo', name: 'Caldo', price: 12, emoji: '🍲', stock: 40 },
    { id: 'milho', name: 'Milho Cozido', price: 7, emoji: '🌽', stock: 45 },
    { id: 'refrigerante', name: 'Refrigerante', price: 6, emoji: '🥤', stock: 80 },
    { id: 'doce', name: 'Doce Caseiro', price: 5, emoji: '🍬', stock: 70 },
]

function parseStoredList<T>(storageKey: string): T[] {
    const raw = ApplicationSettings.getString(storageKey, '')
    if (!raw) {
        return []
    }

    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed as T[] : []
    } catch {
        return []
    }
}

function normalizeInventory(items: unknown[]): InventoryItem[] {
    const map = new Map(initialInventory.map(item => [item.id, item]))
    const normalized: InventoryItem[] = []

    for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') {
            continue
        }

        const value = rawItem as Partial<InventoryItem>
        if (typeof value.id !== 'string') {
            continue
        }

        const base = map.get(value.id)
        if (!base) {
            continue
        }

        normalized.push({
            id: base.id,
            name: typeof value.name === 'string' ? value.name : base.name,
            emoji: typeof value.emoji === 'string' ? value.emoji : base.emoji,
            price: Number.isFinite(value.price) ? Number(value.price) : base.price,
            stock: Number.isFinite(value.stock) ? Math.max(0, Number(value.stock)) : base.stock,
        })
    }

    for (const base of initialInventory) {
        if (!normalized.find(item => item.id === base.id)) {
            normalized.push({ ...base })
        }
    }

    return normalized
}

function normalizeSales(items: unknown[]): SaleRecord[] {
    const normalized: SaleRecord[] = []

    for (const rawSale of items) {
        if (!rawSale || typeof rawSale !== 'object') {
            continue
        }

        const value = rawSale as Partial<SaleRecord> & { lines?: unknown[] }
        if (typeof value.id !== 'string') {
            continue
        }

        const lines = Array.isArray(value.lines)
            ? value.lines
                .filter(line => line && typeof line === 'object')
                .map((line) => {
                    const typedLine = line as Partial<SaleLine>
                    return {
                        id: typeof typedLine.id === 'string' ? typedLine.id : 'item',
                        name: typeof typedLine.name === 'string' ? typedLine.name : 'Item',
                        quantity: Number.isFinite(typedLine.quantity) ? Math.max(0, Number(typedLine.quantity)) : 0,
                        unitPrice: Number.isFinite(typedLine.unitPrice) ? Math.max(0, Number(typedLine.unitPrice)) : 0,
                        total: Number.isFinite(typedLine.total) ? Math.max(0, Number(typedLine.total)) : 0,
                    }
                })
            : []

        normalized.push({
            id: value.id,
            createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
            operatorName: typeof value.operatorName === 'string' ? value.operatorName : 'Operador',
            paymentMethod: value.paymentMethod === 'pix' || value.paymentMethod === 'card' ? value.paymentMethod : 'cash',
            status: value.status === 'canceled' ? 'canceled' : 'completed',
            lines,
            total: Number.isFinite(value.total) ? Math.max(0, Number(value.total)) : lines.reduce((sum, line) => sum + line.total, 0),
            canceledAt: typeof value.canceledAt === 'string' ? value.canceledAt : undefined,
            cancelReason: typeof value.cancelReason === 'string' ? value.cancelReason : undefined,
            exchanges: Array.isArray(value.exchanges) ? value.exchanges : [],
        })
    }

    return normalized
}

function normalizeStockMovements(items: unknown[]): StockMovement[] {
    const validTypes: StockMovement['type'][] = ['sale', 'cancel', 'exchange-in', 'exchange-out', 'manual-return']
    const normalized: StockMovement[] = []

    for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') {
            continue
        }

        const value = rawItem as Partial<StockMovement>
        if (typeof value.id !== 'string' || typeof value.itemId !== 'string') {
            continue
        }

        const movementType = validTypes.find(type => type === value.type) || 'manual-return'
        normalized.push({
            id: value.id,
            createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
            type: movementType,
            itemId: value.itemId,
            quantity: Number.isFinite(value.quantity) ? Math.max(0, Number(value.quantity)) : 0,
            note: typeof value.note === 'string' ? value.note : '',
        })
    }

    return normalized
}

const persistedInventoryRaw = parseStoredList<unknown>(INVENTORY_STORAGE_KEY)
const persistedSalesRaw = parseStoredList<unknown>(SALES_STORAGE_KEY)
const persistedStockMovementsRaw = parseStoredList<unknown>(STOCK_MOVEMENTS_STORAGE_KEY)

const persistedInventory = normalizeInventory(persistedInventoryRaw)
const persistedSales = normalizeSales(persistedSalesRaw)
const persistedStockMovements = normalizeStockMovements(persistedStockMovementsRaw)
const inventoryItems = reactive<InventoryItem[]>(
    persistedInventory.length > 0 ? persistedInventory : initialInventory.map(item => ({ ...item })),
)
const sales = reactive<SaleRecord[]>(persistedSales)
const stockMovements = reactive<StockMovement[]>(persistedStockMovements)
const cashMovements = reactive<CashMovement[]>(parseStoredList<CashMovement>(CASH_MOVEMENTS_STORAGE_KEY))
const shifts = reactive<ShiftSession[]>(parseStoredList<ShiftSession>(SHIFTS_STORAGE_KEY))
const cartItems = reactive<CartItem[]>(inventoryItems.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    emoji: item.emoji,
    quantity: 0,
})))

function saveState(): void {
    ApplicationSettings.setString(INVENTORY_STORAGE_KEY, JSON.stringify(inventoryItems))
    ApplicationSettings.setString(SALES_STORAGE_KEY, JSON.stringify(sales))
    ApplicationSettings.setString(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(stockMovements))
    ApplicationSettings.setString(CASH_MOVEMENTS_STORAGE_KEY, JSON.stringify(cashMovements))
    ApplicationSettings.setString(SHIFTS_STORAGE_KEY, JSON.stringify(shifts))
}

function getInventoryItem(itemId: string): InventoryItem | undefined {
    return inventoryItems.find(item => item.id === itemId)
}

function addStockMovement(movement: Omit<StockMovement, 'id' | 'createdAt'>): void {
    stockMovements.unshift({
        id: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        ...movement,
    })
}

function addCashMovement(movement: Omit<CashMovement, 'id' | 'createdAt'>): void {
    cashMovements.unshift({
        id: `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        ...movement,
    })
}

function getOpenShift(): ShiftSession | null {
    return shifts.find(shift => !shift.closedAt) || null
}

function incrementItem(itemId: string): void {
    const item = cartItems.find(entry => entry.id === itemId)
    const stockItem = getInventoryItem(itemId)

    if (item && stockItem && item.quantity < stockItem.stock) {
        item.quantity += 1
    }
}

function decrementItem(itemId: string): void {
    const item = cartItems.find(entry => entry.id === itemId)
    if (item && item.quantity > 0) {
        item.quantity -= 1
    }
}

function clearCart(): void {
    for (const item of cartItems) {
        item.quantity = 0
    }
}

function getStock(itemId: string): number {
    const stockItem = getInventoryItem(itemId)
    return stockItem ? stockItem.stock : 0
}

function getTotal(): number {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

function getTotalItems(): number {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0)
}

function getPrintableItems(): Array<{ name: string, quantity: number, total: number }> {
    return cartItems
        .filter(item => item.quantity > 0)
        .map(item => ({
            name: item.name,
            quantity: item.quantity,
            total: item.quantity * item.price,
        }))
}

function buildCurrentSaleLines(): SaleLine[] {
    return cartItems
        .filter(item => item.quantity > 0)
        .map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.quantity * item.price,
        }))
}

function finalizeSale(operatorName: string, paymentMethod: 'cash' | 'pix' | 'card' = 'cash'): SaleRecord {
    if (getTotalItems() <= 0) {
        throw new Error('Adicione itens para finalizar a venda.')
    }

    for (const cartItem of cartItems) {
        if (cartItem.quantity <= 0) {
            continue
        }

        const stockItem = getInventoryItem(cartItem.id)
        if (!stockItem || stockItem.stock < cartItem.quantity) {
            throw new Error(`Estoque insuficiente para ${cartItem.name}.`)
        }
    }

    const lines = buildCurrentSaleLines()
    for (const line of lines) {
        const stockItem = getInventoryItem(line.id)
        if (stockItem) {
            stockItem.stock -= line.quantity
            addStockMovement({
                type: 'sale',
                itemId: line.id,
                quantity: line.quantity,
                note: `Venda ${line.name}`,
            })
        }
    }

    const sale: SaleRecord = {
        id: `V-${Date.now()}`,
        createdAt: new Date().toISOString(),
        operatorName: operatorName.trim() || 'Operador',
        paymentMethod,
        status: 'completed',
        lines,
        total: lines.reduce((sum, line) => sum + line.total, 0),
        exchanges: [],
    }

    addCashMovement({
        type: 'sale-in',
        amount: sale.total,
        note: `Venda ${sale.id} (${paymentMethod})`,
        operatorName: sale.operatorName,
    })

    sales.unshift(sale)
    clearCart()
    saveState()
    return sale
}

function cancelSale(saleId: string, reason: string): SaleRecord {
    const sale = sales.find(entry => entry.id === saleId)
    if (!sale) {
        throw new Error('Venda não encontrada.')
    }

    if (sale.status !== 'completed') {
        throw new Error('Somente vendas concluídas podem ser canceladas.')
    }

    for (const line of sale.lines) {
        const stockItem = getInventoryItem(line.id)
        if (stockItem) {
            stockItem.stock += line.quantity
            addStockMovement({
                type: 'cancel',
                itemId: line.id,
                quantity: line.quantity,
                note: `Cancelamento ${sale.id}`,
            })
        }
    }

    sale.status = 'canceled'
    sale.canceledAt = new Date().toISOString()
    sale.cancelReason = reason.trim() || 'Cancelada no caixa'
    saveState()
    return sale
}

function cancelLatestSale(reason: string): SaleRecord {
    const latestCompleted = sales.find(entry => entry.status === 'completed')
    if (!latestCompleted) {
        throw new Error('Não há venda concluída para cancelar.')
    }

    return cancelSale(latestCompleted.id, reason)
}

function exchangeSaleItem(
    saleId: string,
    fromItemId: string,
    toItemId: string,
    quantity: number,
    operatorName: string,
): SaleRecord {
    if (quantity <= 0) {
        throw new Error('Quantidade inválida para troca.')
    }

    const sale = sales.find(entry => entry.id === saleId)
    if (!sale || sale.status !== 'completed') {
        throw new Error('Troca permitida apenas para venda concluída.')
    }

    const fromLine = sale.lines.find(line => line.id === fromItemId)
    if (!fromLine || fromLine.quantity < quantity) {
        throw new Error('Item de origem insuficiente para troca.')
    }

    const toInventory = getInventoryItem(toItemId)
    const fromInventory = getInventoryItem(fromItemId)
    if (!toInventory || !fromInventory) {
        throw new Error('Item inválido para troca.')
    }

    if (toInventory.stock < quantity) {
        throw new Error(`Estoque insuficiente para ${toInventory.name}.`)
    }

    fromInventory.stock += quantity
    toInventory.stock -= quantity

    addStockMovement({
        type: 'exchange-in',
        itemId: fromItemId,
        quantity,
        note: `Troca entrada ${sale.id}`,
    })
    addStockMovement({
        type: 'exchange-out',
        itemId: toItemId,
        quantity,
        note: `Troca saída ${sale.id}`,
    })

    fromLine.quantity -= quantity
    fromLine.total = fromLine.quantity * fromLine.unitPrice
    if (fromLine.quantity === 0) {
        sale.lines = sale.lines.filter(line => line.id !== fromItemId)
    }

    const toLine = sale.lines.find(line => line.id === toItemId)
    if (toLine) {
        toLine.quantity += quantity
        toLine.total = toLine.quantity * toLine.unitPrice
    } else {
        sale.lines.push({
            id: toInventory.id,
            name: toInventory.name,
            quantity,
            unitPrice: toInventory.price,
            total: toInventory.price * quantity,
        })
    }

    sale.total = sale.lines.reduce((sum, line) => sum + line.total, 0)
    const difference = (toInventory.price - fromInventory.price) * quantity

    if (!sale.exchanges) {
        sale.exchanges = []
    }

    sale.exchanges.push({
        at: new Date().toISOString(),
        operatorName: operatorName.trim() || 'Operador',
        fromItemId,
        toItemId,
        quantity,
        difference,
    })

    saveState()
    return sale
}

function exchangeLatestSaleItem(fromItemId: string, toItemId: string, quantity: number, operatorName: string): SaleRecord {
    const latestCompleted = sales.find(entry => entry.status === 'completed')
    if (!latestCompleted) {
        throw new Error('Não há venda concluída para troca.')
    }

    return exchangeSaleItem(latestCompleted.id, fromItemId, toItemId, quantity, operatorName)
}

function returnItemsToStock(itemId: string, quantity: number, note: string): void {
    if (quantity <= 0) {
        throw new Error('Quantidade inválida para retorno ao estoque.')
    }

    const stockItem = getInventoryItem(itemId)
    if (!stockItem) {
        throw new Error('Item não encontrado no estoque.')
    }

    stockItem.stock += quantity
    addStockMovement({
        type: 'manual-return',
        itemId,
        quantity,
        note: note.trim() || 'Retorno manual ao estoque',
    })
    saveState()
}

function getStartOfWeek(referenceDate: Date): Date {
    const day = referenceDate.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const result = new Date(referenceDate)
    result.setDate(referenceDate.getDate() + diff)
    result.setHours(0, 0, 0, 0)
    return result
}

function getEndOfWeek(referenceDate: Date): Date {
    const start = getStartOfWeek(referenceDate)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
}

function getReport(period: 'day' | 'week', referenceDate: Date = new Date()): PeriodReport {
    const dateStart = new Date(referenceDate)
    const dateEnd = new Date(referenceDate)

    if (period === 'day') {
        dateStart.setHours(0, 0, 0, 0)
        dateEnd.setHours(23, 59, 59, 999)
    } else {
        const start = getStartOfWeek(referenceDate)
        const end = getEndOfWeek(referenceDate)
        dateStart.setTime(start.getTime())
        dateEnd.setTime(end.getTime())
    }

    const completedSales = sales.filter((sale) => {
        if (sale.status !== 'completed') {
            return false
        }

        const saleDate = new Date(sale.createdAt)
        return saleDate >= dateStart && saleDate <= dateEnd
    })

    const canceledSales = sales.filter((sale) => {
        if (sale.status !== 'canceled') {
            return false
        }

        const canceledDate = sale.canceledAt ? new Date(sale.canceledAt) : new Date(sale.createdAt)
        return canceledDate >= dateStart && canceledDate <= dateEnd
    })

    const grossTotal = completedSales.reduce((sum, sale) => sum + sale.total, 0)
    const itemsSold = completedSales.reduce(
        (sum, sale) => sum + sale.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
        0,
    )

    const returnMovements = stockMovements.filter((movement) => {
        const movementDate = new Date(movement.createdAt)
        const isInside = movementDate >= dateStart && movementDate <= dateEnd
        const isReturnType = movement.type === 'cancel' || movement.type === 'exchange-in' || movement.type === 'manual-return'
        return isInside && isReturnType
    })

    const returnedToStock = returnMovements.reduce((sum, movement) => sum + movement.quantity, 0)

    const topItemMap: Record<string, TopItemReport> = {}
    for (const sale of completedSales) {
        for (const line of sale.lines) {
            if (!topItemMap[line.id]) {
                topItemMap[line.id] = {
                    id: line.id,
                    name: line.name,
                    quantity: 0,
                }
            }
            topItemMap[line.id].quantity += line.quantity
        }
    }

    const topItems = Object.values(topItemMap)
        .sort((itemA, itemB) => itemB.quantity - itemA.quantity)
        .slice(0, 5)

    return {
        summary: {
            salesCount: completedSales.length,
            canceledCount: canceledSales.length,
            grossTotal,
            itemsSold,
            averageTicket: completedSales.length > 0 ? grossTotal / completedSales.length : 0,
            returnedToStock,
        },
        topItems,
    }
}

function getRecentSales(limit = 10): SaleRecord[] {
    return sales.slice(0, limit)
}

function openShift(openingAmount: number, operatorName: string): ShiftSession {
    if (openingAmount < 0) {
        throw new Error('Valor de abertura inválido.')
    }

    const existingOpenShift = getOpenShift()
    if (existingOpenShift) {
        throw new Error('Já existe um turno aberto.')
    }

    const shift: ShiftSession = {
        id: `T-${Date.now()}`,
        openedAt: new Date().toISOString(),
        openedBy: operatorName.trim() || 'Operador',
        openingAmount,
    }

    shifts.unshift(shift)
    addCashMovement({
        type: 'supply-in',
        amount: openingAmount,
        note: `Abertura de caixa ${shift.id}`,
        operatorName: shift.openedBy,
    })
    saveState()
    return shift
}

function addCashSupply(amount: number, note: string, operatorName: string): void {
    if (amount <= 0) {
        throw new Error('Valor de suprimento inválido.')
    }

    addCashMovement({
        type: 'supply-in',
        amount,
        note: note.trim() || 'Suprimento de caixa',
        operatorName: operatorName.trim() || 'Operador',
    })
    saveState()
}

function addCashWithdrawal(amount: number, note: string, operatorName: string): void {
    if (amount <= 0) {
        throw new Error('Valor de sangria inválido.')
    }

    addCashMovement({
        type: 'withdraw-out',
        amount,
        note: note.trim() || 'Sangria de caixa',
        operatorName: operatorName.trim() || 'Operador',
    })
    saveState()
}

function getCashBalance(): number {
    return cashMovements.reduce((sum, movement) => {
        if (movement.type === 'withdraw-out') {
            return sum - movement.amount
        }
        return sum + movement.amount
    }, 0)
}

function closeShift(declaredAmount: number, operatorName: string): ShiftSession {
    const shift = getOpenShift()
    if (!shift) {
        throw new Error('Não há turno aberto para fechamento.')
    }

    if (declaredAmount < 0) {
        throw new Error('Valor declarado inválido.')
    }

    const expectedAmount = getCashBalance()

    shift.closedAt = new Date().toISOString()
    shift.closedBy = operatorName.trim() || 'Operador'
    shift.expectedAmount = expectedAmount
    shift.declaredAmount = declaredAmount
    shift.difference = declaredAmount - expectedAmount
    saveState()
    return shift
}

function getLatestShift(): ShiftSession | null {
    return shifts.length > 0 ? shifts[0] : null
}

export const pdvStore = {
    inventoryItems,
    cartItems,
    sales,
    stockMovements,
    cashMovements,
    shifts,
    incrementItem,
    decrementItem,
    clearCart,
    getStock,
    getTotal,
    getTotalItems,
    getPrintableItems,
    finalizeSale,
    cancelSale,
    cancelLatestSale,
    exchangeSaleItem,
    exchangeLatestSaleItem,
    returnItemsToStock,
    getReport,
    getRecentSales,
    openShift,
    closeShift,
    getOpenShift,
    getLatestShift,
    addCashSupply,
    addCashWithdrawal,
    getCashBalance,
}
