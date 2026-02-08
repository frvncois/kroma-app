import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, OrderItem, ItemStatus, Customer, OrderSource, PaymentStatus } from '@/types'
import { orders as mockOrders } from '@/data/mock/orders'
import { orderItems as mockOrderItems } from '@/data/mock/order-items'
import { orderFiles as mockOrderFiles } from '@/data/mock/order-files'
import { useCustomerStore } from './customers'

export interface OrderWithDetails extends Order {
  customer: Customer
  items: OrderItem[]
  itemsCount: number
  statusRollup: ItemStatus | 'mixed'
}

// Helper to compute order status rollup based on items
function computeOrderStatus(items: OrderItem[]): ItemStatus | 'mixed' {
  if (items.length === 0) return 'new'

  const nonCanceledItems = items.filter((item) => item.status !== 'canceled')
  if (nonCanceledItems.length === 0) return 'canceled'

  const statuses = nonCanceledItems.map((item) => item.status)
  const uniqueStatuses = [...new Set(statuses)]

  // All items have the same status
  if (uniqueStatuses.length === 1 && uniqueStatuses[0]) {
    return uniqueStatuses[0]
  }

  // Check for specific rollup rules
  if (statuses.some((s) => s === 'new')) return 'new'
  if (statuses.some((s) => s === 'assigned' || s === 'in_production' || s === 'on_hold'))
    return 'in_production'
  if (statuses.every((s) => s === 'ready')) return 'ready'
  if (
    statuses.every((s) => s === 'delivered' || s === 'picked_up' || s === 'out_for_delivery')
  ) {
    if (statuses.every((s) => s === 'delivered')) return 'delivered'
    if (statuses.every((s) => s === 'picked_up')) return 'picked_up'
    if (statuses.some((s) => s === 'out_for_delivery')) return 'out_for_delivery'
  }

  return 'mixed'
}

export const useOrderStore = defineStore('orders', () => {
  // State
  const orders = ref<Order[]>([...mockOrders])
  const orderItems = ref<OrderItem[]>([...mockOrderItems])

  // Getters
  const ordersWithDetails = computed<OrderWithDetails[]>(() => {
    const customerStore = useCustomerStore()

    return orders.value.map((order) => {
      const customer = customerStore.getCustomerById(order.customer_id)!
      const items = orderItems.value.filter((item) => item.order_id === order.id)
      const statusRollup = computeOrderStatus(items)

      return {
        ...order,
        customer,
        items,
        itemsCount: items.length,
        statusRollup,
      }
    })
  })

  function getOrderById(id: string): OrderWithDetails | undefined {
    return ordersWithDetails.value.find((order) => order.id === id)
  }

  function filesCount(orderId: string): number {
    // Get all items for this order
    const items = orderItems.value.filter((item) => item.order_id === orderId)
    const itemIds = items.map((item) => item.id)

    // Count files linked to these items
    return mockOrderFiles.filter((file) => itemIds.includes(file.order_item_id)).length
  }

  function commentsCount(orderId: string): number {
    // Placeholder - will be implemented when notes/comments system is built
    return 0
  }

  // Actions
  function updateItemStatus(itemId: string, newStatus: ItemStatus) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (item) {
      const oldStatus = item.status
      item.status = newStatus
      item.updated_at = new Date().toISOString()

      // Auto-set production dates
      if (newStatus === 'in_production' && oldStatus !== 'in_production') {
        item.production_start_date = new Date().toISOString()
        console.log(`Auto-set production_start_date for item ${itemId}`)
      }
      if (newStatus === 'ready' && oldStatus !== 'ready') {
        item.production_ready_date = new Date().toISOString()
        console.log(`Auto-set production_ready_date for item ${itemId}`)
      }
      if (newStatus === 'delivered' && oldStatus !== 'delivered') {
        item.delivery_date = new Date().toISOString()
        console.log(`Auto-set delivery_date for item ${itemId}`)
      }
      if (newStatus === 'picked_up' && oldStatus !== 'picked_up') {
        item.delivery_date = new Date().toISOString()
        console.log(`Auto-set delivery_date for item ${itemId}`)
      }

      console.log(`Updated item ${itemId} status from ${oldStatus} to ${newStatus}`)
    }
  }

  function updateOrderItemsStatus(orderId: string, newStatus: ItemStatus) {
    const items = orderItems.value.filter((item) => item.order_id === orderId)
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated all items in order ${orderId} to status ${newStatus}`)
  }

  function updatePrintshopItemsStatus(
    printshopId: string,
    orderIds: string[],
    newStatus: ItemStatus
  ) {
    const items = orderItems.value.filter(
      (item) => item.assigned_printshop === printshopId && orderIds.includes(item.order_id)
    )
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated ${items.length} items from printshop ${printshopId} to status ${newStatus}`)
  }

  function updateOrderSource(orderId: string, newSource: OrderSource) {
    const order = orders.value.find((o) => o.id === orderId)
    if (order) {
      const oldSource = order.source
      order.source = newSource
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} source from ${oldSource} to ${newSource}`)
    }
  }

  function updateOrderPaymentStatus(orderId: string, newPaymentStatus: PaymentStatus) {
    const order = orders.value.find((o) => o.id === orderId)
    if (order) {
      const oldPaymentStatus = order.payment_status
      order.payment_status = newPaymentStatus
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} payment_status from ${oldPaymentStatus} to ${newPaymentStatus}`)
    }
  }

  function updateItemPrintshop(itemId: string, newPrintshopId: string | null) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (item) {
      const oldPrintshop = item.assigned_printshop
      item.assigned_printshop = newPrintshopId
      item.updated_at = new Date().toISOString()

      // Auto-set status to 'assigned' when a printshop is assigned
      if (newPrintshopId && item.status === 'new') {
        item.status = 'assigned'
        console.log(`Auto-set item ${itemId} status to 'assigned'`)
      }
      // Reset to 'new' when unassigning printshop
      if (!newPrintshopId && item.status === 'assigned') {
        item.status = 'new'
        console.log(`Auto-reset item ${itemId} status to 'new'`)
      }

      console.log(`Updated item ${itemId} printshop from ${oldPrintshop || 'unassigned'} to ${newPrintshopId || 'unassigned'}`)
    }
  }

  function updateItemDueDate(itemId: string, newDueDate: string | null) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (item) {
      item.due_date = newDueDate
      item.updated_at = new Date().toISOString()
      console.log(`Updated item ${itemId} due_date to ${newDueDate}`)
    }
  }

  return {
    // State
    orders,
    orderItems,
    // Getters
    ordersWithDetails,
    getOrderById,
    filesCount,
    commentsCount,
    // Actions
    updateItemStatus,
    updateOrderItemsStatus,
    updatePrintshopItemsStatus,
    updateOrderSource,
    updateOrderPaymentStatus,
    updateItemPrintshop,
    updateItemDueDate,
  }
})
