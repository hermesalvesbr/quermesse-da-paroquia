export interface SaleCartItemInput {
  id: string
  name: string
  price: number
  quantity: number
}

export interface SaleInventoryItemInput {
  id: string
  stock: number
}

export interface PreparedSaleLine {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  returnedQty: number
}

export function assertSaleCanBeFinalized(
  cartItems: SaleCartItemInput[],
  inventoryItems: SaleInventoryItemInput[],
): void {
  const activeItems = cartItems.filter(item => item.quantity > 0)

  if (activeItems.length === 0) {
    throw new Error('Adicione itens para finalizar a venda.')
  }

  for (const cartItem of activeItems) {
    const stockItem = inventoryItems.find(inv => inv.id === cartItem.id)
    if (!stockItem || stockItem.stock < cartItem.quantity) {
      throw new Error(`Estoque insuficiente para ${cartItem.name}.`)
    }
  }
}

export function buildPreparedSaleLines(cartItems: SaleCartItemInput[]): PreparedSaleLine[] {
  return cartItems
    .filter(item => item.quantity > 0)
    .map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.quantity * item.price,
      returnedQty: 0,
    }))
}

export function calculateSaleTotal(lines: Array<Pick<PreparedSaleLine, 'total'>>): number {
  return lines.reduce((sum, line) => sum + line.total, 0)
}