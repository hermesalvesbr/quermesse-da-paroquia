import { ApplicationSettings } from '@nativescript/core'
import { reactive } from 'vue'
import { directusService, type PdvProduct, type PdvOperator, type PdvCategory } from './DirectusService'

// Mantém as interfaces originais do PdvStore para compatibilidade
export type ItemCategory = 'comida' | 'bebida'

export interface MenuItem {
  id: string
  name: string
  price: number
  emoji: string
  category: ItemCategory
}

export interface InventoryItem extends MenuItem {
  stock: number
}

export interface CartItem extends MenuItem {
  quantity: number
  category: ItemCategory
}

export interface SaleLine {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export type PaymentMethod = 'cash' | 'pix' | 'card'
export type PrintStatus = 'printed' | 'pending'

export interface SaleRecord {
  id: string
  orderNumber: number
  createdAt: string
  operatorName: string
  paymentMethod: PaymentMethod
  status: 'completed' | 'canceled'
  printStatus: PrintStatus
  lines: SaleLine[]
  total: number
  canceledAt?: string
  cancelReason?: string
}

export interface ReportSummary {
  salesCount: number
  canceledCount: number
  grossTotal: number
  itemsSold: number
  averageTicket: number
  returnedToStock: number
}

export interface TopItemReport {
  id: string
  name: string
  quantity: number
}

export interface PeriodReport {
  summary: ReportSummary
  topItems: TopItemReport[]
}

const CACHE_PRODUCTS_KEY = 'pdv.directus.products'
const CACHE_OPERATORS_KEY = 'pdv.directus.operators'
const SALES_STORAGE_KEY = 'pdv.sales'
const ORDER_COUNTER_KEY = 'pdv.order.counter'
const ORDER_COUNTER_DATE_KEY = 'pdv.order.counter.date'
const SYNC_QUEUE_KEY = 'pdv.sync.queue'

// Mapeamento de categorias Directus → UI
const CATEGORY_MAP: Record<string, { emoji: string, category: ItemCategory }> = {
  'Salgados': { emoji: '🍗', category: 'comida' },
  'Bebidas': { emoji: '🥤', category: 'bebida' },
  'Doces': { emoji: '🍬', category: 'comida' },
  'Caldos': { emoji: '🍲', category: 'comida' },
}

const PRODUCT_EMOJI: Record<string, string> = {
  'Coxinha': '🍗',
  'Pastel': '🥟',
  'Espetinho': '🍖',
  'Cachorro-Quente': '🌭',
  'Tapioca Recheada': '🫓',
  'Milho Cozido': '🌽',
  'Refrigerante Lata': '🥤',
  'Água Mineral': '💧',
  'Cerveja': '🍺',
  'Suco Natural': '🧃',
  'Bolo Caseiro (fatia)': '🍰',
  'Pé de Moleque': '🍬',
  'Cocada': '🥥',
  'Brigadeiro': '🍫',
  'Caldo de Feijão': '🍲',
  'Caldo de Mocotó': '🍖',
}

// Estado reativo
const inventoryItems = reactive<InventoryItem[]>([])
const cartItems = reactive<CartItem[]>([])
const sales = reactive<SaleRecord[]>([])
const operators = reactive<PdvOperator[]>([])
const categories = reactive<PdvCategory[]>([])
let isInitialized = false

// Fila de sincronização offline
interface SyncQueueItem {
  type: 'sale' | 'cancel'
  data: any
  timestamp: string
}

const syncQueue = reactive<SyncQueueItem[]>([])

function getCategoryInfo(categoryName: string): { emoji: string, category: ItemCategory } {
  return CATEGORY_MAP[categoryName] || { emoji: '📦', category: 'comida' }
}

function getProductEmoji(productName: string): string {
  return PRODUCT_EMOJI[productName] || '📦'
}

// Conversão Directus → InventoryItem
function mapProductToInventory(product: PdvProduct, categories: PdvCategory[]): InventoryItem {
  const category = categories.find(cat => cat.id === product.category_id)
  const categoryInfo = category ? getCategoryInfo(category.name) : { emoji: '📦', category: 'comida' as const }
  
  // Log de diagnóstico para produtos mapeados
  if (category && category.name === 'Bebidas') {
    console.log(`PdvStoreDirectus: Produto BEBIDA mapeado: ${product.name} → categoria: ${categoryInfo.category}`)
  }
  
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    emoji: getProductEmoji(product.name),
    stock: product.stock_quantity,
    category: categoryInfo.category,
  }
}

// Inicialização - carrega dados do Directus
async function initialize(): Promise<void> {
  if (isInitialized) {
    return
  }

  console.log('PdvStoreDirectus: Inicializando...')
  console.log('PdvStoreDirectus: Tentando conectar ao Directus...')

  try {
    // Tenta carregar do Directus
    const [productsData, operatorsData, categoriesData] = await Promise.all([
      directusService.getProducts(),
      directusService.getOperators(),
      directusService.getCategories(),
    ])

    console.log(`PdvStoreDirectus: ✅ Directus ONLINE - ${productsData.length} produtos carregados`)

    // Atualiza categorias
    categories.splice(0, categories.length, ...categoriesData)

    // Atualiza operadores
    operators.splice(0, operators.length, ...operatorsData)

    // Converte e atualiza produtos
    const mappedProducts = productsData.map(p => mapProductToInventory(p, categoriesData))
    inventoryItems.splice(0, inventoryItems.length, ...mappedProducts)

    // Atualiza carrinho
    updateCartFromInventory()

    // Salva cache local
    ApplicationSettings.setString(CACHE_PRODUCTS_KEY, JSON.stringify(productsData))
    ApplicationSettings.setString(CACHE_OPERATORS_KEY, JSON.stringify(operatorsData))

    // Sincroniza vendas pendentes
    await syncPendingSales()

    isInitialized = true
    console.log('PdvStoreDirectus: Inicialização online completa')
  }
  catch (error) {
    console.error('PdvStoreDirectus: ❌ ERRO ao conectar Directus - verificando cache local...', error)
    loadFromCache()
    isInitialized = true
  }

  // Carrega vendas locais
  loadSalesFromStorage()
  loadSyncQueue()

  // Log final de status
  console.log(`PdvStoreDirectus: Inicialização completa - ${inventoryItems.length} produtos disponíveis`)
}

function loadFromCache(): void {
  const cachedProducts = ApplicationSettings.getString(CACHE_PRODUCTS_KEY, '')
  const cachedOperators = ApplicationSettings.getString(CACHE_OPERATORS_KEY, '')
  const cachedCategories = ApplicationSettings.getString('pdv.directus.categories', '')

  if (cachedProducts) {
    try {
      const products: PdvProduct[] = JSON.parse(cachedProducts)
      const cats: PdvCategory[] = cachedCategories ? JSON.parse(cachedCategories) : []
      const mapped = products.map(p => mapProductToInventory(p, cats))
      inventoryItems.splice(0, inventoryItems.length, ...mapped)
      categories.splice(0, categories.length, ...cats)
      console.log(`PdvStoreDirectus: 📦 Cache LOCAL - ${mapped.length} produtos carregados`)
    }
    catch (e) {
      console.error('PdvStoreDirectus: Erro ao parsear cache de produtos', e)
    }
  }
  else {
    console.warn('PdvStoreDirectus: ⚠️ CACHE VAZIO - Nenhum produto disponível. Verifique internet e Directus.')
  }

  if (cachedOperators) {
    try {
      const ops: PdvOperator[] = JSON.parse(cachedOperators)
      operators.splice(0, operators.length, ...ops)
    }
    catch (e) {
      console.error('PdvStoreDirectus: Erro ao parsear cache de operadores', e)
    }
  }

  updateCartFromInventory()
}

function updateCartFromInventory(): void {
  const existingQuantities = new Map(cartItems.map(item => [item.id, item.quantity]))

  cartItems.splice(0, cartItems.length)

  for (const item of inventoryItems) {
    cartItems.push({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      category: item.category,
      quantity: existingQuantities.get(item.id) || 0,
    })
  }

  // Log de diagnóstico
  const comidas = cartItems.filter(i => i.category === 'comida')
  const bebidas = cartItems.filter(i => i.category === 'bebida')
  console.log(`PdvStoreDirectus: Cart atualizado - ${comidas.length} comidas, ${bebidas.length} bebidas (total: ${cartItems.length})`)
  if (bebidas.length > 0) {
    console.log(`PdvStoreDirectus: Bebidas encontradas:`, bebidas.map(b => b.name).join(', '))
  }
}

function loadSalesFromStorage(): void {
  const raw = ApplicationSettings.getString(SALES_STORAGE_KEY, '')
  if (!raw) {
    return
  }

  try {
    const parsed: SaleRecord[] = JSON.parse(raw)
    sales.splice(0, sales.length, ...parsed)
    console.log(`PdvStoreDirectus: ${parsed.length} vendas carregadas do storage`)
  }
  catch (e) {
    console.error('PdvStoreDirectus: Erro ao carregar vendas', e)
  }
}

function saveSalesToStorage(): void {
  ApplicationSettings.setString(SALES_STORAGE_KEY, JSON.stringify(sales))
}

function loadSyncQueue(): void {
  const raw = ApplicationSettings.getString(SYNC_QUEUE_KEY, '')
  if (!raw) {
    return
  }

  try {
    const parsed: SyncQueueItem[] = JSON.parse(raw)
    syncQueue.splice(0, syncQueue.length, ...parsed)
    console.log(`PdvStoreDirectus: ${parsed.length} itens na fila de sincronização`)
  }
  catch (e) {
    console.error('PdvStoreDirectus: Erro ao carregar fila de sync', e)
  }
}

function saveSyncQueue(): void {
  ApplicationSettings.setString(SYNC_QUEUE_KEY, JSON.stringify(syncQueue))
}

function addToSyncQueue(item: SyncQueueItem): void {
  syncQueue.push(item)
  saveSyncQueue()
}

async function syncPendingSales(): Promise<void> {
  if (syncQueue.length === 0) {
    return
  }

  console.log(`PdvStoreDirectus: Sincronizando ${syncQueue.length} operações pendentes...`)

  const toRemove: number[] = []

  for (let i = 0; i < syncQueue.length; i++) {
    const item = syncQueue[i]

    try {
      if (item.type === 'sale') {
        const saleData = item.data
        await directusService.createSale(saleData.sale, saleData.items)
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Venda ${saleData.sale.id} sincronizada`)
      }
      else if (item.type === 'cancel') {
        await directusService.cancelSale(item.data.saleId)
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Cancelamento ${item.data.saleId} sincronizado`)
      }
    }
    catch (error) {
      console.error(`PdvStoreDirectus: Erro ao sincronizar item ${i}`, error)
      // Mantém na fila para tentar depois
    }
  }

  // Remove itens sincronizados
  for (let i = toRemove.length - 1; i >= 0; i--) {
    syncQueue.splice(toRemove[i], 1)
  }

  saveSyncQueue()
}

function getNextOrderNumber(): number {
  const today = new Date().toISOString().slice(0, 10)
  const storedDate = ApplicationSettings.getString(ORDER_COUNTER_DATE_KEY, '')
  let counter = ApplicationSettings.getNumber(ORDER_COUNTER_KEY, 0)

  if (storedDate !== today) {
    counter = 0
    ApplicationSettings.setString(ORDER_COUNTER_DATE_KEY, today)
  }

  counter += 1
  ApplicationSettings.setNumber(ORDER_COUNTER_KEY, counter)
  return counter
}

function incrementItem(itemId: string): void {
  const item = cartItems.find(entry => entry.id === itemId)
  const stockItem = inventoryItems.find(inv => inv.id === itemId)

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

async function finalizeSale(operatorName: string, paymentMethod: PaymentMethod = 'cash'): Promise<SaleRecord> {
  if (getTotalItems() <= 0) {
    throw new Error('Adicione itens para finalizar a venda.')
  }

  // Valida estoque
  for (const cartItem of cartItems) {
    if (cartItem.quantity <= 0) {
      continue
    }

    const stockItem = inventoryItems.find(inv => inv.id === cartItem.id)
    if (!stockItem || stockItem.stock < cartItem.quantity) {
      throw new Error(`Estoque insuficiente para ${cartItem.name}.`)
    }
  }

  const lines: SaleLine[] = cartItems
    .filter(item => item.quantity > 0)
    .map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.quantity * item.price,
    }))

  const total = lines.reduce((sum, line) => sum + line.total, 0)

  const sale: SaleRecord = {
    id: `V-${Date.now()}`,
    orderNumber: getNextOrderNumber(),
    createdAt: new Date().toISOString(),
    operatorName: operatorName.trim() || 'Operador',
    paymentMethod,
    status: 'completed',
    printStatus: 'pending',
    lines,
    total,
  }

  // Busca ID do operador
  const operator = operators.find(op => op.name === operatorName)
  const operatorId = operator?.id || operators[0]?.id

  if (!operatorId) {
    throw new Error('Nenhum operador configurado no sistema.')
  }

  // Mapeia método de pagamento
  const paymentMethodMap: Record<PaymentMethod, 'dinheiro' | 'pix' | 'cartao'> = {
    cash: 'dinheiro',
    pix: 'pix',
    card: 'cartao',
  }

  // Tenta sincronizar com Directus
  try {
    const saleItems = lines.map(line => ({
      product_id: line.id,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_price: line.total,
    }))

    const saleId = await directusService.createSale(
      {
        operator_id: operatorId,
        total_amount: total,
        payment_method: paymentMethodMap[paymentMethod],
        sale_status: 'completed',
        printed: false,
        created_at: sale.createdAt,
      },
      saleItems,
    )

    if (saleId) {
      // Sucesso - atualiza estoque local
      for (const line of lines) {
        const stockItem = inventoryItems.find(inv => inv.id === line.id)
        if (stockItem) {
          stockItem.stock -= line.quantity
        }
      }

      console.log(`PdvStoreDirectus: Venda ${sale.id} sincronizada com Directus (${saleId})`)
    }
    else {
      throw new Error('Falha ao criar venda no Directus')
    }
  }
  catch (error) {
    console.error('PdvStoreDirectus: Erro ao sincronizar venda, adicionando à fila', error)

    // Adiciona à fila de sincronização
    addToSyncQueue({
      type: 'sale',
      data: {
        sale: {
          operator_id: operatorId,
          total_amount: total,
          payment_method: paymentMethodMap[paymentMethod],
          sale_status: 'completed',
          printed: false,
          created_at: sale.createdAt,
        },
        items: lines.map(line => ({
          product_id: line.id,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          total_price: line.total,
        })),
      },
      timestamp: new Date().toISOString(),
    })

    // Atualiza estoque local mesmo offline
    for (const line of lines) {
      const stockItem = inventoryItems.find(inv => inv.id === line.id)
      if (stockItem) {
        stockItem.stock -= line.quantity
      }
    }
  }

  sales.unshift(sale)
  clearCart()
  saveSalesToStorage()
  return sale
}

async function cancelSale(saleId: string, reason: string): Promise<SaleRecord> {
  const sale = sales.find(entry => entry.id === saleId)
  if (!sale) {
    throw new Error('Venda não encontrada.')
  }

  if (sale.status !== 'completed') {
    throw new Error('Somente vendas concluídas podem ser canceladas.')
  }

  // Retorna ao estoque local
  for (const line of sale.lines) {
    const stockItem = inventoryItems.find(inv => inv.id === line.id)
    if (stockItem) {
      stockItem.stock += line.quantity
    }
  }

  sale.status = 'canceled'
  sale.canceledAt = new Date().toISOString()
  sale.cancelReason = reason.trim() || 'Cancelada no caixa'

  // Tenta sincronizar com Directus
  try {
    // Nota: precisaríamos do saleId do Directus, não temos ainda
    // Por ora, apenas marca como cancelada localmente
    console.log(`PdvStoreDirectus: Venda ${saleId} cancelada localmente`)
  }
  catch (error) {
    console.error('PdvStoreDirectus: Erro ao cancelar no Directus', error)
  }

  saveSalesToStorage()
  return sale
}

function markAsPrinted(saleId: string): void {
  const sale = sales.find(entry => entry.id === saleId)
  if (sale) {
    sale.printStatus = 'printed'
    saveSalesToStorage()
  }
}

function getCartItemsByCategory(category: ItemCategory): CartItem[] {
  return cartItems.filter(item => item.category === category)
}

function getRecentSales(limit = 10): SaleRecord[] {
  return sales.slice(0, limit)
}

function getPendingPrintSales(): SaleRecord[] {
  return sales.filter(sale => sale.status === 'completed' && sale.printStatus === 'pending')
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
}

function getPaymentLabel(method: PaymentMethod): string {
  return PAYMENT_LABELS[method] || method
}

// Função para forçar reload do Directus
async function reloadFromDirectus(): Promise<void> {
  isInitialized = false
  await initialize()
}

function getStock(itemId: string): number {
  const stockItem = inventoryItems.find(inv => inv.id === itemId)
  return stockItem ? stockItem.stock : 0
}

async function cancelLatestSale(reason: string): Promise<SaleRecord> {
  const latestCompleted = sales.find(entry => entry.status === 'completed')
  if (!latestCompleted) {
    throw new Error('Não há venda concluída para cancelar.')
  }

  return await cancelSale(latestCompleted.id, reason)
}

function exchangeLatestSaleItem(fromItemId: string, toItemId: string, quantity: number, _operatorName: string): SaleRecord {
  const latestCompleted = sales.find(entry => entry.status === 'completed')
  if (!latestCompleted) {
    throw new Error('Não há venda concluída para troca.')
  }

  if (quantity <= 0) {
    throw new Error('Quantidade inválida para troca.')
  }

  const fromLine = latestCompleted.lines.find(line => line.id === fromItemId)
  if (!fromLine || fromLine.quantity < quantity) {
    throw new Error('Item de origem insuficiente para troca.')
  }

  const toInventory = inventoryItems.find(inv => inv.id === toItemId)
  const fromInventory = inventoryItems.find(inv => inv.id === fromItemId)
  if (!toInventory || !fromInventory) {
    throw new Error('Item inválido para troca.')
  }

  if (toInventory.stock < quantity) {
    throw new Error(`Estoque insuficiente para ${toInventory.name}.`)
  }

  // Ajusta estoque localmente
  fromInventory.stock += quantity
  toInventory.stock -= quantity

  // Ajusta linhas da venda
  fromLine.quantity -= quantity
  fromLine.total = fromLine.quantity * fromLine.unitPrice

  const existingToLine = latestCompleted.lines.find(line => line.id === toItemId)
  if (existingToLine) {
    existingToLine.quantity += quantity
    existingToLine.total = existingToLine.quantity * existingToLine.unitPrice
  } else {
    latestCompleted.lines.push({
      id: toItemId,
      name: toInventory.name,
      quantity,
      unitPrice: toInventory.price,
      total: quantity * toInventory.price,
    })
  }

  // Remove linha zerada se necessário
  if (fromLine.quantity === 0) {
    const index = latestCompleted.lines.indexOf(fromLine)
    if (index > -1) {
      latestCompleted.lines.splice(index, 1)
    }
  }

  // Recalcula total
  latestCompleted.total = latestCompleted.lines.reduce((sum, line) => sum + line.total, 0)

  saveSalesToStorage()
  return latestCompleted
}

function returnItemsToStock(itemId: string, quantity: number, _note: string): void {
  if (quantity <= 0) {
    throw new Error('Quantidade inválida para retorno ao estoque.')
  }

  const stockItem = inventoryItems.find(inv => inv.id === itemId)
  if (!stockItem) {
    throw new Error('Item não encontrado no estoque.')
  }

  stockItem.stock += quantity
  // Sincroniza estoque com Directus se possível
  directusService.updateProductStock(itemId, stockItem.stock).catch(err => {
    console.warn('Não foi possível sincronizar estoque:', err)
  })
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() - day
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function getEndOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() + (6 - day)
  result.setDate(diff)
  result.setHours(23, 59, 59, 999)
  return result
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
      returnedToStock: 0, // TODO: Implementar tracking de retornos
    },
    topItems,
  }
}

export const pdvStore = {
  inventoryItems,
  cartItems,
  sales,
  operators,
  categories,
  initialize,
  reloadFromDirectus,
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
  exchangeLatestSaleItem,
  returnItemsToStock,
  markAsPrinted,
  getCartItemsByCategory,
  getRecentSales,
  getPendingPrintSales,
  getPaymentLabel,
  getReport,
  syncPendingSales,
}
