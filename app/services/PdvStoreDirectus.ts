import { ApplicationSettings } from '@nativescript/core'
import { reactive } from 'vue'
import { buildDirectusAssetUrl, directusService, type PdvProduct, type PdvOperator, type PdvCategory, type PdvProductionPoint } from './DirectusService'
import { assertSaleCanBeFinalized, buildPreparedSaleLines, calculateSaleTotal } from './PdvSaleRules'

// Mantém as interfaces originais do PdvStore para compatibilidade
export type ItemCategory = string

export interface MenuItem {
  id: string
  name: string
  price: number
  emoji: string
  imageUrl?: string | null
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
  returnedQty: number
}

export interface SaleReturn {
  at: string
  operatorName: string
  itemId: string
  itemName: string
  quantity: number
  refundAmount: number
}

export interface SaleExchange {
  at: string
  operatorName: string
  fromItemId: string
  fromItemName: string
  toItemId: string
  toItemName: string
  quantity: number
  priceDifference: number
}

export type PaymentMethod = 'cash' | 'pix' | 'card'
export type PrintStatus = 'printed' | 'pending'

export interface SaleRecord {
  id: string
  directusSaleId?: string
  orderNumber: number
  createdAt: string
  operatorName: string
  operatorId?: string
  paymentMethod: PaymentMethod
  status: 'completed' | 'canceled'
  printStatus: PrintStatus
  lines: SaleLine[]
  total: number
  canceledAt?: string
  cancelReason?: string
  returns?: SaleReturn[]
  exchanges?: SaleExchange[]
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
const CACHE_PRODUCTION_POINTS_KEY = 'pdv.directus.production_points'
const SALES_STORAGE_KEY = 'pdv.sales'
const ORDER_COUNTER_KEY = 'pdv.order.counter'
const ORDER_COUNTER_DATE_KEY = 'pdv.order.counter.date'
const SYNC_QUEUE_KEY = 'pdv.sync.queue'

// Estado reativo
const inventoryItems = reactive<InventoryItem[]>([])
const cartItems = reactive<CartItem[]>([])
const sales = reactive<SaleRecord[]>([])
const operators = reactive<PdvOperator[]>([])
const categories = reactive<PdvCategory[]>([])
const productionPoints = reactive<PdvProductionPoint[]>([])
const uiState = reactive({
  catalogLoading: false,
})
let isInitialized = false

// Fila de sincronização offline
interface SyncQueueItem {
  type: 'sale' | 'cancel' | 'stock-return' | 'mark-printed'
  data: any
  timestamp: string
}

const syncQueue = reactive<SyncQueueItem[]>([])

/**
 * Retorna o role de um ponto de produção.
 * Usa o campo `role` quando disponível (cache novo).
 * Fallback por nome para cache antigo sem campo `role` — impede Lojinha de vazar.
 */
function getProductionPointRole(productionPointId: string): string {
  const pp = productionPoints.find(p => p.id === productionPointId)
  if (pp?.role) return pp.role
  // Fallback para cache gerado antes da adição do campo role
  if (pp?.name.toLowerCase().includes('lojinha')) return 'lojinha'
  return 'pdv'
}

/** Android java.text.Collator for proper pt-BR sorting (handles accents natively). */
let _collator: java.text.Collator | null = null
function getCollator(): java.text.Collator {
  if (!_collator) {
    _collator = java.text.Collator.getInstance(new java.util.Locale('pt', 'BR'))
    _collator.setStrength(java.text.Collator.PRIMARY)
  }
  return _collator
}

function compareItemNames(left: Pick<CartItem, 'name'>, right: Pick<CartItem, 'name'>): number {
  return getCollator().compare(left.name, right.name)
}

// Conversão Directus → InventoryItem
function mapProductToInventory(product: PdvProduct): InventoryItem {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    emoji: product.emoji || '📦',
    imageUrl: buildDirectusAssetUrl(product.imagem),
    stock: product.stock_quantity,
    category: product.production_point_id || '',
  }
}

// Inicialização - carrega dados do Directus
async function initialize(): Promise<void> {
  if (isInitialized) {
    return
  }

  uiState.catalogLoading = true

  console.log('PdvStoreDirectus: Inicializando...')
  console.log('PdvStoreDirectus: Tentando conectar ao Directus...')

  try {
    if (!directusService.getConfiguredStatus()) {
      loadFromCache()
      loadSalesFromStorage()
      loadSyncQueue()
      isInitialized = true
      console.warn('PdvStoreDirectus: Directus nao configurado neste build. App operando com cache local quando disponivel.')
      return
    }

    // Tenta carregar do Directus
    const [productsData, operatorsData, categoriesData, productionPointsData] = await Promise.all([
      directusService.getProducts(),
      directusService.getOperators(),
      directusService.getCategories(),
      directusService.getProductionPoints(),
    ])

    if (!directusService.getOnlineStatus() || (productsData.length === 0 && operatorsData.length === 0 && categoriesData.length === 0)) {
      throw new Error('Directus indisponivel ou sem dados iniciais. Usando cache local.')
    }

    console.log(`PdvStoreDirectus: ✅ Directus ONLINE - ${productsData.length} produtos, ${productionPointsData.length} pontos de produção`)

    // Atualiza categorias
    categories.splice(0, categories.length, ...categoriesData)

    // Atualiza pontos de produção
    productionPoints.splice(0, productionPoints.length, ...productionPointsData)

    // Atualiza operadores
    operators.splice(0, operators.length, ...operatorsData)

    // Converte e atualiza produtos
    const mappedProducts = productsData.map(p => mapProductToInventory(p))
    inventoryItems.splice(0, inventoryItems.length, ...mappedProducts)

    // Atualiza carrinho
    updateCartFromInventory()

    // Salva cache local
    ApplicationSettings.setString(CACHE_PRODUCTS_KEY, JSON.stringify(productsData))
    ApplicationSettings.setString(CACHE_OPERATORS_KEY, JSON.stringify(operatorsData))
    ApplicationSettings.setString('pdv.directus.categories', JSON.stringify(categoriesData))
    ApplicationSettings.setString(CACHE_PRODUCTION_POINTS_KEY, JSON.stringify(productionPointsData))

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
  finally {
    uiState.catalogLoading = false
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
  const cachedProductionPoints = ApplicationSettings.getString(CACHE_PRODUCTION_POINTS_KEY, '')

  if (cachedProducts) {
    try {
      const products: PdvProduct[] = JSON.parse(cachedProducts)
      const cats: PdvCategory[] = cachedCategories ? JSON.parse(cachedCategories) : []
      const points: PdvProductionPoint[] = cachedProductionPoints ? JSON.parse(cachedProductionPoints) : []
      const mapped = products.map(p => mapProductToInventory(p))
      inventoryItems.splice(0, inventoryItems.length, ...mapped)
      categories.splice(0, categories.length, ...cats)
      productionPoints.splice(0, productionPoints.length, ...points)
      console.log(`PdvStoreDirectus: 📦 Cache LOCAL - ${mapped.length} produtos, ${points.length} pontos de produção`)
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
      imageUrl: item.imageUrl,
      category: item.category,
      quantity: existingQuantities.get(item.id) || 0,
    })
  }

  cartItems.sort(compareItemNames)

  // Log de diagnóstico
  const byCategory = new Map<string, number>()
  for (const item of cartItems) {
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1)
  }
  const catSummary = Array.from(byCategory.entries(), ([cat, count]) => `${count} ${cat}`).join(', ')
  console.log(`PdvStoreDirectus: Cart atualizado - ${catSummary} (total: ${cartItems.length})`)
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
        const directusSaleId = await directusService.createSale(saleData.sale, saleData.items)
        // Atualiza o directusSaleId na venda local se possível
        if (directusSaleId && saleData.localSaleId) {
          const localSale = sales.find(s => s.id === saleData.localSaleId)
          if (localSale) {
            localSale.directusSaleId = directusSaleId
            saveSalesToStorage()
          }
        }
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Venda ${saleData.localSaleId || 'offline'} sincronizada (${directusSaleId})`)
      }
      else if (item.type === 'cancel') {
        await directusService.cancelSale(item.data.saleId)
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Cancelamento ${item.data.saleId} sincronizado`)
      }
      else if (item.type === 'stock-return') {
        await directusService.updateProductStock(item.data.productId, item.data.newStock)
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Retorno de estoque ${item.data.productId} sincronizado`)
      }
      else if (item.type === 'mark-printed') {
        await directusService.markSalePrinted(item.data.saleId)
        toRemove.push(i)
        console.log(`PdvStoreDirectus: Status impresso ${item.data.saleId} sincronizado`)
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

  if (item) {
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
  assertSaleCanBeFinalized(cartItems, inventoryItems)

  const lines: SaleLine[] = buildPreparedSaleLines(cartItems)
  const total = calculateSaleTotal(lines)

  // Busca ID do operador
  const operator = operators.find(op => op.name === operatorName)
  const operatorId = operator?.id || operators[0]?.id

  if (!operatorId) {
    throw new Error('Nenhum operador configurado no sistema.')
  }

  const sale: SaleRecord = {
    id: `V-${Date.now()}`,
    orderNumber: getNextOrderNumber(),
    createdAt: new Date().toISOString(),
    operatorName: operatorName.trim() || 'Operador',
    operatorId,
    paymentMethod,
    status: 'completed',
    printStatus: 'pending',
    lines,
    total,
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

    const directusSaleId = await directusService.createSale(
      {
        sale_number: sale.orderNumber,
        operator_id: operatorId,
        total_amount: total,
        payment_method: paymentMethodMap[paymentMethod],
        sale_status: 'completed',
        printed: false,
        created_at: sale.createdAt,
        status: 'published',
      },
      saleItems,
    )

    if (directusSaleId) {
      // Gap #2/#3: Guarda o ID do Directus para cancelamento/sync futuro
      sale.directusSaleId = directusSaleId

      // Sucesso - atualiza estoque local
      for (const line of lines) {
        const stockItem = inventoryItems.find(inv => inv.id === line.id)
        if (stockItem) {
          stockItem.stock -= line.quantity
        }
      }

      console.log(`PdvStoreDirectus: Venda ${sale.id} sincronizada com Directus (${directusSaleId})`)
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
        localSaleId: sale.id,
        sale: {
          sale_number: sale.orderNumber,
          operator_id: operatorId,
          total_amount: total,
          payment_method: paymentMethodMap[paymentMethod],
          sale_status: 'completed',
          printed: false,
          created_at: sale.createdAt,
          status: 'published',
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

  // Gap #2: Sincroniza cancelamento com Directus
  if (sale.directusSaleId) {
    try {
      const success = await directusService.cancelSale(sale.directusSaleId)
      if (success) {
        console.log(`PdvStoreDirectus: Venda ${saleId} cancelada no Directus (${sale.directusSaleId})`)
      } else {
        throw new Error('Falha ao cancelar no Directus')
      }
    }
    catch (error) {
      console.error('PdvStoreDirectus: Erro ao cancelar no Directus, adicionando à fila', error)
      addToSyncQueue({
        type: 'cancel',
        data: { saleId: sale.directusSaleId },
        timestamp: new Date().toISOString(),
      })
    }
  } else {
    console.warn(`PdvStoreDirectus: Venda ${saleId} sem directusSaleId — cancelamento apenas local`)
  }

  saveSalesToStorage()
  return sale
}

function markAsPrinted(saleId: string): void {
  const sale = sales.find(entry => entry.id === saleId)
  if (sale) {
    sale.printStatus = 'printed'
    saveSalesToStorage()

    // Gap #4: Sincroniza status de impressão com Directus
    if (sale.directusSaleId) {
      directusService.markSalePrinted(sale.directusSaleId).catch(err => {
        console.warn('PdvStoreDirectus: Falha ao marcar impressão no Directus:', err)
      })
    }
  }
}

function getCartItemsByCategory(category: ItemCategory): CartItem[] {
  return cartItems.filter(item => item.category === category)
}

interface ProductionPointTab {
  key: string
  label: string
  emoji: string
}

function getProductionPointTabs(): ProductionPointTab[] {
  if (productionPoints.length > 0) {
    return productionPoints
      .filter(pp => pp.role !== 'lojinha')
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
      .map(pp => ({
        key: pp.id,
        label: pp.name,
        emoji: pp.emoji || '📦',
      }))
  }

  // Fallback offline sem cache de pontos de produção: deriva tabs das categorias dos itens
  return Array.from(new Set(cartItems.map(item => item.category).filter(Boolean)))
    .map(productionPointId => ({
      key: productionPointId,
      label: productionPointId,
      emoji: '📦',
    }))
}

function getItemsByProductionPoint(productionPointId: string): CartItem[] {
  return cartItems
    .filter(item => item.category === productionPointId)
    .sort(compareItemNames)
}

function getAllItemsExceptOutros(): CartItem[] {
  return cartItems
    .filter((item) => {
      const role = getProductionPointRole(item.category)
      return role !== 'lojinha' && role !== 'outros'
    })
    .sort(compareItemNames)
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
      returnedQty: 0,
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

  // Gap #5: Sincroniza troca com Directus (estoque + itens da venda)
  if (latestCompleted.directusSaleId) {
    // Atualiza estoque de ambos os produtos no Directus
    directusService.updateProductStock(fromItemId, fromInventory.stock).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar estoque (from) no Directus:', err)
    })
    directusService.updateProductStock(toItemId, toInventory.stock).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar estoque (to) no Directus:', err)
    })

    // Atualiza itens da venda no Directus
    const updatedItems = latestCompleted.lines
      .filter(line => line.quantity > 0)
      .map(line => ({
        product_id: line.id,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.total,
      }))

    directusService.updateSaleItems(
      latestCompleted.directusSaleId,
      updatedItems,
      latestCompleted.total,
    ).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar itens da venda no Directus:', err)
    })
  }

  saveSalesToStorage()
  return latestCompleted
}

// === DEVOLUÇÃO POR ITEM ===
// Regra: Só permite devolução em vendas pagas em Dinheiro (cash)
async function returnSaleItem(
  saleId: string,
  lineItemId: string,
  quantity: number,
  operatorName: string,
): Promise<SaleRecord> {
  const sale = sales.find(s => s.id === saleId)
  if (!sale) throw new Error('Venda não encontrada.')
  if (sale.status !== 'completed') throw new Error('Venda não está concluída.')
  if (sale.paymentMethod !== 'cash') throw new Error('Devolução só é permitida para vendas em Dinheiro.')
  if (quantity <= 0) throw new Error('Quantidade inválida.')

  const line = sale.lines.find(l => l.id === lineItemId)
  if (!line) throw new Error('Item não encontrado na venda.')

  const availableQty = line.quantity - (line.returnedQty || 0)
  if (quantity > availableQty) {
    throw new Error(`Só há ${availableQty} unidade(s) disponível(is) para devolução.`)
  }

  // Atualiza estoque local
  const stockItem = inventoryItems.find(inv => inv.id === lineItemId)
  if (stockItem) {
    stockItem.stock += quantity
  }

  // Atualiza linha da venda
  line.returnedQty = (line.returnedQty || 0) + quantity

  // Recalcula total da venda (desconta itens devolvidos)
  const refundAmount = quantity * line.unitPrice
  sale.total -= refundAmount

  // Registra devolução
  if (!sale.returns) sale.returns = []
  sale.returns.push({
    at: new Date().toISOString(),
    operatorName,
    itemId: lineItemId,
    itemName: line.name,
    quantity,
    refundAmount,
  })

  // Sincroniza com Directus
  if (sale.directusSaleId) {
    // Atualiza estoque do produto
    if (stockItem) {
      directusService.updateProductStock(lineItemId, stockItem.stock).catch(err => {
        console.warn('PdvStoreDirectus: Falha ao sincronizar estoque após devolução:', err)
      })
    }

    // Busca o sale_item no Directus para atualizar returned_qty
    directusService.getSaleItems(sale.directusSaleId).then(directusItems => {
      const directusItem = directusItems.find(di => di.product_id === lineItemId)
      if (directusItem && directusItem.id) {
        directusService.updateSaleItemReturnedQty(directusItem.id, line.returnedQty || 0).catch(err => {
          console.warn('PdvStoreDirectus: Falha ao atualizar returned_qty no Directus:', err)
        })
      }
    }).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao buscar itens da venda no Directus:', err)
    })

    // Atualiza total da venda no Directus
    directusService.updateSaleItems(
      sale.directusSaleId,
      sale.lines.filter(l => l.quantity > 0).map(l => ({
        product_id: l.id,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.total,
      })),
      sale.total,
    ).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar total da venda no Directus:', err)
    })
  }

  saveSalesToStorage()
  console.log(`PdvStoreDirectus: Devolução registrada - ${quantity}x ${line.name} (R$ ${refundAmount.toFixed(2)})`)
  return sale
}

// === TROCA POR ITEM ===
// Regra: Só permite troca em vendas pagas em Dinheiro (cash)
async function exchangeSaleItem(
  saleId: string,
  fromLineItemId: string,
  toItemId: string,
  quantity: number,
  operatorName: string,
): Promise<{ sale: SaleRecord; priceDifference: number }> {
  const sale = sales.find(s => s.id === saleId)
  if (!sale) throw new Error('Venda não encontrada.')
  if (sale.status !== 'completed') throw new Error('Venda não está concluída.')
  if (sale.paymentMethod !== 'cash') throw new Error('Troca só é permitida para vendas em Dinheiro.')
  if (quantity <= 0) throw new Error('Quantidade inválida.')

  const fromLine = sale.lines.find(l => l.id === fromLineItemId)
  if (!fromLine) throw new Error('Item de origem não encontrado na venda.')

  const availableQty = fromLine.quantity - (fromLine.returnedQty || 0)
  if (quantity > availableQty) {
    throw new Error(`Só há ${availableQty} unidade(s) disponível(is) para troca.`)
  }

  const toInventory = inventoryItems.find(inv => inv.id === toItemId)
  const fromInventory = inventoryItems.find(inv => inv.id === fromLineItemId)
  if (!toInventory) throw new Error('Produto destino não encontrado.')

  const priceDifference = (toInventory.price - fromLine.unitPrice) * quantity

  // Ajusta estoque localmente
  if (fromInventory) fromInventory.stock += quantity
  toInventory.stock -= quantity

  // Marca quantidade trocada no item original
  fromLine.returnedQty = (fromLine.returnedQty || 0) + quantity

  // Adiciona ou incrementa o item novo na venda
  const existingToLine = sale.lines.find(l => l.id === toItemId)
  if (existingToLine) {
    existingToLine.quantity += quantity
    existingToLine.total = existingToLine.quantity * existingToLine.unitPrice
  } else {
    sale.lines.push({
      id: toItemId,
      name: toInventory.name,
      quantity,
      unitPrice: toInventory.price,
      total: quantity * toInventory.price,
      returnedQty: 0,
    })
  }

  // Recalcula total
  sale.total = sale.lines.reduce((sum, l) => {
    const activeQty = l.quantity - (l.returnedQty || 0)
    return sum + activeQty * l.unitPrice
  }, 0)

  // Registra troca
  if (!sale.exchanges) sale.exchanges = []
  sale.exchanges.push({
    at: new Date().toISOString(),
    operatorName,
    fromItemId: fromLineItemId,
    fromItemName: fromLine.name,
    toItemId,
    toItemName: toInventory.name,
    quantity,
    priceDifference,
  })

  // Sincroniza com Directus
  if (sale.directusSaleId) {
    if (fromInventory) {
      directusService.updateProductStock(fromLineItemId, fromInventory.stock).catch(err => {
        console.warn('PdvStoreDirectus: Falha ao atualizar estoque (from) na troca:', err)
      })
    }
    directusService.updateProductStock(toItemId, toInventory.stock).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar estoque (to) na troca:', err)
    })

    // Atualiza returned_qty no Directus
    directusService.getSaleItems(sale.directusSaleId).then(directusItems => {
      const directusItem = directusItems.find(di => di.product_id === fromLineItemId)
      if (directusItem && directusItem.id) {
        directusService.updateSaleItemReturnedQty(directusItem.id, fromLine.returnedQty || 0).catch(err => {
          console.warn('PdvStoreDirectus: Falha ao atualizar returned_qty na troca:', err)
        })
      }
    }).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao buscar itens para troca:', err)
    })

    // Atualiza itens da venda no Directus
    const updatedItems = sale.lines
      .filter(l => l.quantity > 0)
      .map(l => ({
        product_id: l.id,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.total,
      }))

    directusService.updateSaleItems(
      sale.directusSaleId,
      updatedItems,
      sale.total,
    ).catch(err => {
      console.warn('PdvStoreDirectus: Falha ao atualizar itens da venda na troca:', err)
    })
  }

  saveSalesToStorage()
  console.log(`PdvStoreDirectus: Troca registrada - ${quantity}x ${fromLine.name} → ${toInventory.name} (diff: R$ ${priceDifference.toFixed(2)})`)
  return { sale, priceDifference }
}

function returnItemsToStock(itemId: string, quantity: number, note: string): void {
  if (quantity <= 0) {
    throw new Error('Quantidade inválida para retorno ao estoque.')
  }

  const stockItem = inventoryItems.find(inv => inv.id === itemId)
  if (!stockItem) {
    throw new Error('Item não encontrado no estoque.')
  }

  stockItem.stock += quantity

  // Gap #6: Sincroniza estoque com Directus e registra auditoria
  directusService.updateProductStock(itemId, stockItem.stock)
    .then(success => {
      if (success) {
        console.log(`PdvStoreDirectus: Estoque de ${stockItem.name} atualizado no Directus: +${quantity} (${note || 'retorno manual'})`)
      }
    })
    .catch(err => {
      console.warn('PdvStoreDirectus: Falha ao sincronizar retorno de estoque:', err)
      // Adiciona à fila de sync para tentar depois
      addToSyncQueue({
        type: 'stock-return' as SyncQueueItem['type'],
        data: { productId: itemId, newStock: stockItem.stock, note },
        timestamp: new Date().toISOString(),
      })
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
  uiState,
  inventoryItems,
  cartItems,
  sales,
  operators,
  categories,
  productionPoints,
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
  returnSaleItem,
  exchangeSaleItem,
  returnItemsToStock,
  markAsPrinted,
  getCartItemsByCategory,
  getProductionPointTabs,
  getItemsByProductionPoint,
  getAllItemsExceptOutros,
  getRecentSales,
  getPendingPrintSales,
  getPaymentLabel,
  getReport,
  syncPendingSales,
}
