import { ref, computed } from 'vue'
import { orderItems, type OrderItem, type ItemStatus } from '@/data/mock/order-items'
import { orders } from '@/data/mock/orders'
import { customers } from '@/data/mock/customers'

export interface OrderItemWithDetails extends OrderItem {
  order: typeof orders[0]
  customer: typeof customers[0]
}

export function useOrderItems() {
  const allItems = ref<OrderItem[]>(orderItems)

  const itemsWithDetails = computed<OrderItemWithDetails[]>(() => {
    return allItems.value.map((item) => {
      const order = orders.find((o) => o.id === item.order_id)!
      const customer = customers.find((c) => c.id === order.customer_id)!

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

  const getItemsByPrintshopAndStatus = (
    printshopId: string | null,
    status: ItemStatus
  ) => {
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

  return {
    getItemsByPrintshop,
    getItemsByStatus,
    getItemsByPrintshopAndStatus,
    getItemById,
  }
}
