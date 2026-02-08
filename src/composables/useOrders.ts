import { ref, computed } from 'vue'
import { orders, type Order } from '@/data/mock/orders'
import { orderItems, type OrderItem, type ItemStatus } from '@/data/mock/order-items'
import { customers } from '@/data/mock/customers'

export interface OrderWithDetails extends Order {
  customer: typeof customers[0]
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
  if (uniqueStatuses.length === 1) {
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

export function useOrders() {
  const allOrders = ref<Order[]>(orders)
  const allItems = ref<OrderItem[]>(orderItems)

  const ordersWithDetails = computed<OrderWithDetails[]>(() => {
    return allOrders.value.map((order) => {
      const customer = customers.find((c) => c.id === order.customer_id)!
      const items = allItems.value.filter((item) => item.order_id === order.id)
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

  const getOrders = () => {
    return ordersWithDetails.value
  }

  const getOrderById = (id: string) => {
    return ordersWithDetails.value.find((order) => order.id === id)
  }

  const updateItemStatus = (itemId: string, newStatus: ItemStatus) => {
    const item = allItems.value.find((i) => i.id === itemId)
    if (item) {
      const oldStatus = item.status
      item.status = newStatus
      item.updated_at = new Date().toISOString()

      // Auto-set production dates
      if (newStatus === 'in_production' && oldStatus !== 'in_production') {
        console.log(`Auto-setting production_start_date for item ${itemId} to now`)
        // In real app: item.production_start_date = new Date().toISOString()
      }
      if (newStatus === 'ready' && oldStatus !== 'ready') {
        console.log(`Auto-setting production_ready_date for item ${itemId} to now`)
        // In real app: item.production_ready_date = new Date().toISOString()
      }

      console.log(`Updated item ${itemId} status from ${oldStatus} to ${newStatus}`)
      // In real app: await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId)
    }
  }

  const updateOrderItemsStatus = (orderId: string, newStatus: ItemStatus) => {
    const items = allItems.value.filter((item) => item.order_id === orderId)
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated all items in order ${orderId} to status ${newStatus}`)
  }

  const updatePrintshopItemsStatus = (printshopId: string, orderIds: string[], newStatus: ItemStatus) => {
    const items = allItems.value.filter(
      (item) =>
        item.assigned_printshop === printshopId &&
        orderIds.includes(item.order_id)
    )
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated ${items.length} items from printshop ${printshopId} to status ${newStatus}`)
  }

  const updateOrderSource = (orderId: string, newSource: string) => {
    const order = allOrders.value.find((o) => o.id === orderId)
    if (order) {
      const oldSource = order.source
      order.source = newSource as any
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} source from ${oldSource} to ${newSource}`)
      // In real app: await supabase.from('orders').update({ source: newSource }).eq('id', orderId)
    }
  }

  const updateOrderPaymentStatus = (orderId: string, newPaymentStatus: string) => {
    const order = allOrders.value.find((o) => o.id === orderId)
    if (order) {
      const oldPaymentStatus = order.payment_status
      order.payment_status = newPaymentStatus as any
      order.updated_at = new Date().toISOString()
      console.log(`Updated order ${orderId} payment_status from ${oldPaymentStatus} to ${newPaymentStatus}`)
      // In real app: await supabase.from('orders').update({ payment_status: newPaymentStatus }).eq('id', orderId)
    }
  }

  const updateItemPrintshop = (itemId: string, newPrintshopId: string | null) => {
    const item = allItems.value.find((i) => i.id === itemId)
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
      // In real app: await supabase.from('order_items').update({ assigned_printshop: newPrintshopId }).eq('id', itemId)
    }
  }

  return {
    getOrders,
    getOrderById,
    updateItemStatus,
    updateOrderItemsStatus,
    updatePrintshopItemsStatus,
    updateOrderSource,
    updateOrderPaymentStatus,
    updateItemPrintshop,
  }
}
