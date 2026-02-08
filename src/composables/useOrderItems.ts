import { computed } from 'vue'
import type { OrderItem, Order, Customer, ItemStatus } from '@/types'
import { useOrderStore } from '@/stores/orders'
import { useCustomerStore } from '@/stores/customers'

export interface OrderItemWithDetails extends OrderItem {
  order: Order
  customer: Customer
}

/**
 * Thin wrapper around useOrderStore() for item-specific queries.
 * Maintains backward compatibility while delegating to the store.
 */
export function useOrderItems() {
  const orderStore = useOrderStore()
  const customerStore = useCustomerStore()

  const itemsWithDetails = computed<OrderItemWithDetails[]>(() => {
    return orderStore.orderItems.map((item) => {
      const order = orderStore.orders.find((o) => o.id === item.order_id)!
      const customer = customerStore.getCustomerById(order.customer_id)!

      return {
        ...item,
        order,
        customer,
      }
    })
  })

  const getItemsByPrintshop = (printshopId: string | null) => {
    if (!printshopId) {
      // "All" - return items from all shops
      return itemsWithDetails.value
    }
    return itemsWithDetails.value.filter((item) => item.assigned_printshop === printshopId)
  }

  const getItemsByStatus = (status: ItemStatus) => {
    return itemsWithDetails.value.filter((item) => item.status === status)
  }

  const getItemsByPrintshopAndStatus = (printshopId: string | null, status: ItemStatus) => {
    let filtered = itemsWithDetails.value

    // Filter by printshop
    if (printshopId) {
      filtered = filtered.filter((item) => item.assigned_printshop === printshopId)
    }

    // Filter by status
    filtered = filtered.filter((item) => item.status === status)

    return filtered
  }

  const getItemById = (id: string) => {
    return itemsWithDetails.value.find((item) => item.id === id)
  }

  const getItemsByShops = (shopIds: string[]) => {
    return itemsWithDetails.value.filter((item) =>
      item.assigned_printshop && shopIds.includes(item.assigned_printshop)
    )
  }

  return {
    getItemsByPrintshop,
    getItemsByStatus,
    getItemsByPrintshopAndStatus,
    getItemById,
    getItemsByShops,
  }
}
