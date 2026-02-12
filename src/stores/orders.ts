import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, OrderItem, ItemStatus, Customer, OrderSource, PaymentStatus, PaymentMethod, Activity } from '@/types'
import { orders as mockOrders } from '@/data/mock/orders'
import { orderItems as mockOrderItems } from '@/data/mock/order-items'
import { orderFiles as mockOrderFiles } from '@/data/mock/order-files'
import { useCustomerStore } from './customers'
import { useActivityStore } from './activities'
import { usePrintshopStore } from './printshops'
import { useAuthStore } from './auth'

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

  // Get all items with order and customer details enriched
  function getAllItems() {
    const customerStore = useCustomerStore()

    return orderItems.value.map((item) => {
      const order = orders.value.find((o) => o.id === item.order_id)!
      const customer = customerStore.getCustomerById(order.customer_id)!

      return {
        ...item,
        order,
        customer,
      }
    })
  }

  // Helper to create activity entries
  function createActivity(
    type: Activity['type'],
    message: string,
    item?: OrderItem,
    orderId?: string,
    extra?: Partial<Activity['details']>
  ): Activity {
    const authStore = useAuthStore()
    const customerStore = useCustomerStore()

    // Find the order for context
    const order = orderId ? orders.value.find(o => o.id === orderId) :
      item ? orders.value.find(o => o.id === item.order_id) : undefined
    const customer = order ? customerStore.getCustomerById(order.customer_id) : undefined

    return {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      user: authStore.currentUser?.name || 'System',
      seen: false,
      important: false,
      item: item ? {
        id: item.id,
        name: `${item.product_name}${item.quantity > 1 ? ` - ${item.quantity}x` : ''}`,
        orderId: item.order_id,
      } : undefined,
      order: order ? {
        id: order.id,
        externalId: order.external_id || undefined,
        customer: customer?.name || 'Unknown',
      } : undefined,
      details: {
        message,
        ...extra,
      },
    }
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

      // Create activity entry
      const activityStore = useActivityStore()

      // Determine activity type based on the new status
      let activityType: Activity['type'] = 'status_change'
      if (newStatus === 'delivered') activityType = 'delivery'
      if (newStatus === 'picked_up') activityType = 'pickup'
      if (newStatus === 'out_for_delivery') activityType = 'delivery'

      // Build descriptive message
      const formatStatusLabel = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const message = activityType === 'status_change'
        ? 'Status updated'
        : activityType === 'delivery' && newStatus === 'out_for_delivery'
          ? 'Out for delivery'
          : activityType === 'delivery'
            ? 'Successfully delivered'
            : 'Item marked as picked up'

      activityStore.addActivity(
        createActivity(activityType, message, item, undefined, {
          from: formatStatusLabel(oldStatus),
          to: formatStatusLabel(newStatus),
        })
      )
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

      // Create activity entry
      const activityStore = useActivityStore()
      const formatSource = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

      activityStore.addActivity(
        createActivity('status_change', `Order source updated to ${formatSource(newSource)}`, undefined, orderId, {
          from: formatSource(oldSource),
          to: formatSource(newSource),
        })
      )
    }
  }

  function updateOrderPaymentStatus(orderId: string, newPaymentStatus: PaymentStatus) {
    const order = orders.value.find((o) => o.id === orderId)
    if (order) {
      const oldPaymentStatus = order.payment_status
      order.payment_status = newPaymentStatus
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} payment_status from ${oldPaymentStatus} to ${newPaymentStatus}`)

      // Create activity entry
      const activityStore = useActivityStore()
      const formatLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

      activityStore.addActivity(
        createActivity('status_change', `Payment updated to ${formatLabel(newPaymentStatus)}`, undefined, orderId, {
          from: formatLabel(oldPaymentStatus),
          to: formatLabel(newPaymentStatus),
        })
      )
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

      // Create activity entry for printshop assignment
      if (newPrintshopId) {
        const activityStore = useActivityStore()
        const printshopStore = usePrintshopStore()
        const shopName = printshopStore.getPrintshopName(newPrintshopId)

        activityStore.addActivity(
          createActivity('assignment', `Assigned to ${shopName}`, item)
        )
      }
    }
  }

  function updateItemDueDate(itemId: string, newDueDate: string | null) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (item) {
      item.due_date = newDueDate
      item.updated_at = new Date().toISOString()
      console.log(`Updated item ${itemId} due_date to ${newDueDate}`)

      // Create activity entry
      const activityStore = useActivityStore()
      const formatDate = (date: string | null) => {
        if (!date) return 'cleared'
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }

      activityStore.addActivity(
        createActivity('status_change', `Due date ${newDueDate ? 'set to ' + formatDate(newDueDate) : 'cleared'}`, item)
      )
    }
  }

  function updateOrderPaymentMethod(orderId: string, newMethod: PaymentMethod) {
    const order = orders.value.find((o) => o.id === orderId)
    if (order) {
      order.payment_method = newMethod
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} payment_method to ${newMethod}`)

      // Create activity entry
      const activityStore = useActivityStore()
      activityStore.addActivity(
        createActivity('status_change', `Payment method changed to ${newMethod}`, undefined, orderId)
      )
    }
  }

  function getOrdersByCustomerId(customerId: string): OrderWithDetails[] {
    return ordersWithDetails.value
      .filter((order) => order.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return {
    // State
    orders,
    orderItems,
    // Getters
    ordersWithDetails,
    getOrderById,
    getOrdersByCustomerId,
    getAllItems,
    filesCount,
    commentsCount,
    // Actions
    updateItemStatus,
    updateOrderItemsStatus,
    updatePrintshopItemsStatus,
    updateOrderSource,
    updateOrderPaymentStatus,
    updateOrderPaymentMethod,
    updateItemPrintshop,
    updateItemDueDate,
  }
})
