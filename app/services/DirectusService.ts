import { createDirectus, rest, staticToken, readItems, createItem, updateItem, deleteItems, type DirectusClient, type RestClient } from '@directus/sdk'

// Schemas das collections Directus
interface PdvOperator {
  id: string
  name: string
  active: boolean
  status: string
}

interface PdvCategory {
  id: string
  name: string
  icon: string
  sort_order: number
  active: boolean
  status: string
}

interface _PdvProductionPoint {
  id: string
  name: string
  active: boolean
  status: string
}

interface PdvProduct {
  id: string
  name: string
  price: number
  stock_quantity: number
  active: boolean
  sort_order: number
  status: string
  category_id: string
  production_point_id: string
}

interface PdvSale {
  id?: string
  sale_number?: number
  operator_id: string
  total_amount: number
  payment_method: 'dinheiro' | 'pix' | 'cartao'
  sale_status: 'completed' | 'cancelled' | 'pending_print'
  printed: boolean
  created_at?: string
}

interface PdvSaleItem {
  id?: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
}

// Schema completo do Directus
// NOTA: Declarado como `any` para compatibilidade com @directus/sdk v21
type DirectusSchema = any

class DirectusService {
  private client: DirectusClient<DirectusSchema> & RestClient<DirectusSchema>
  private isOnline = true

  constructor() {
    const DIRECTUS_URL = 'https://capela.softagon.app'
    const DIRECTUS_TOKEN = 'oemH4mkn7q-bAHJ9MX2b3ba3BclI6thS'

    this.client = createDirectus<DirectusSchema>(DIRECTUS_URL)
      .with(staticToken(DIRECTUS_TOKEN))
      .with(rest()) as DirectusClient<DirectusSchema> & RestClient<DirectusSchema>
  }

  // ----- OPERATORS -----
  async getOperators(): Promise<PdvOperator[]> {
    try {
      const operators = await this.client.request(
        readItems('pdv_operators', {
          filter: { active: { _eq: true } },
          sort: ['name'],
        }),
      )
      this.isOnline = true
      return operators as PdvOperator[]
    }
    catch (error) {
      console.error('DirectusService: Erro ao buscar operadores', error)
      this.isOnline = false
      return []
    }
  }

  // ----- CATEGORIES -----
  async getCategories(): Promise<PdvCategory[]> {
    try {
      const categories = await this.client.request(
        readItems('pdv_categories', {
          filter: { active: { _eq: true } },
          sort: ['sort_order'],
        }),
      )
      this.isOnline = true
      return categories as PdvCategory[]
    }
    catch (error) {
      console.error('DirectusService: Erro ao buscar categorias', error)
      this.isOnline = false
      return []
    }
  }

  // ----- PRODUCTS -----
  async getProducts(): Promise<PdvProduct[]> {
    try {
      const products = await this.client.request(
        readItems('pdv_products', {
          filter: { active: { _eq: true } },
          sort: ['sort_order'],
        }),
      )
      this.isOnline = true
      return products as PdvProduct[]
    }
    catch (error) {
      console.error('DirectusService: Erro ao buscar produtos', error)
      this.isOnline = false
      return []
    }
  }

  async updateProductStock(productId: string, newQuantity: number): Promise<boolean> {
    try {
      await this.client.request(
        updateItem('pdv_products', productId, {
          stock_quantity: newQuantity,
        }),
      )
      this.isOnline = true
      return true
    }
    catch (error) {
      console.error('DirectusService: Erro ao atualizar estoque', error)
      this.isOnline = false
      return false
    }
  }

  // ----- SALES -----
  async createSale(sale: Omit<PdvSale, 'id'>, items: Omit<PdvSaleItem, 'id' | 'sale_id'>[]): Promise<string | null> {
    try {
      // 1. Criar a venda
      const createdSale = await this.client.request(
        createItem('pdv_sales', sale),
      )

      const saleId = createdSale.id!

      // 2. Criar os itens da venda
      for (const item of items) {
        await this.client.request(
          createItem('pdv_sale_items', {
            ...item,
            sale_id: saleId,
          }),
        )
      }

      // 3. Atualizar estoque dos produtos
      for (const item of items) {
        const product = await this.client.request(
          readItems('pdv_products', {
            filter: { id: { _eq: item.product_id } },
            fields: ['id', 'stock_quantity'],
            limit: 1,
          }),
        )

        if (product.length > 0) {
          const currentStock = product[0].stock_quantity
          await this.updateProductStock(item.product_id, currentStock - item.quantity)
        }
      }

      this.isOnline = true
      return saleId
    }
    catch (error) {
      console.error('DirectusService: Erro ao criar venda', error)
      this.isOnline = false
      return null
    }
  }

  async cancelSale(saleId: string): Promise<boolean> {
    try {
      // 1. Buscar itens da venda para retornar ao estoque
      const saleItems = await this.client.request(
        readItems('pdv_sale_items', {
          filter: { sale_id: { _eq: saleId } },
        }),
      )

      // 2. Retornar produtos ao estoque
      for (const item of saleItems) {
        const product = await this.client.request(
          readItems('pdv_products', {
            filter: { id: { _eq: item.product_id } },
            fields: ['id', 'stock_quantity'],
            limit: 1,
          }),
        )

        if (product.length > 0) {
          const currentStock = product[0].stock_quantity
          await this.updateProductStock(item.product_id, currentStock + item.quantity)
        }
      }

      // 3. Marcar venda como cancelada
      await this.client.request(
        updateItem('pdv_sales', saleId, {
          sale_status: 'cancelled',
        }),
      )

      this.isOnline = true
      return true
    }
    catch (error) {
      console.error('DirectusService: Erro ao cancelar venda', error)
      this.isOnline = false
      return false
    }
  }

  // Gap #4: Atualiza status de impressão no Directus
  async markSalePrinted(saleId: string): Promise<boolean> {
    try {
      await this.client.request(
        updateItem('pdv_sales', saleId, {
          printed: true,
        }),
      )
      this.isOnline = true
      return true
    }
    catch (error) {
      console.error('DirectusService: Erro ao marcar venda como impressa', error)
      this.isOnline = false
      return false
    }
  }

  // Gap #5: Atualiza itens de uma venda após troca
  async updateSaleItems(
    saleId: string,
    newItems: Omit<PdvSaleItem, 'id' | 'sale_id'>[],
    newTotal: number,
  ): Promise<boolean> {
    try {
      // 1. Remove itens antigos da venda
      await this.client.request(
        deleteItems('pdv_sale_items', {
          filter: { sale_id: { _eq: saleId } },
        }),
      )

      // 2. Cria os novos itens
      for (const item of newItems) {
        await this.client.request(
          createItem('pdv_sale_items', {
            ...item,
            sale_id: saleId,
          }),
        )
      }

      // 3. Atualiza total da venda
      await this.client.request(
        updateItem('pdv_sales', saleId, {
          total_amount: newTotal,
        }),
      )

      this.isOnline = true
      return true
    }
    catch (error) {
      console.error('DirectusService: Erro ao atualizar itens da venda', error)
      this.isOnline = false
      return false
    }
  }

  async getSales(filters?: { startDate?: string, endDate?: string, operatorId?: string }): Promise<PdvSale[]> {
    try {
      const filterObj: any = { status: { _eq: 'published' } }

      if (filters?.startDate) {
        filterObj.created_at = { _gte: filters.startDate }
      }
      if (filters?.endDate) {
        filterObj.created_at = { ...filterObj.created_at, _lte: filters.endDate }
      }
      if (filters?.operatorId) {
        filterObj.operator_id = { _eq: filters.operatorId }
      }

      const sales = await this.client.request(
        readItems('pdv_sales', {
          filter: filterObj,
          sort: ['-created_at'],
        }),
      )

      this.isOnline = true
      return sales as PdvSale[]
    }
    catch (error) {
      console.error('DirectusService: Erro ao buscar vendas', error)
      this.isOnline = false
      return []
    }
  }

  // Status de conectividade
  getOnlineStatus(): boolean {
    return this.isOnline
  }
}

// Singleton
export const directusService = new DirectusService()
export type { PdvCategory, PdvOperator, PdvProduct, PdvSale, PdvSaleItem }
