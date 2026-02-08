import { useOrderStore } from '@/stores/orders'

// Re-export type for backward compatibility
export type { OrderWithDetails } from '@/stores/orders'

/**
 * Thin wrapper around useOrderStore() for backward compatibility.
 * Components can continue using this composable while the store
 * handles all state management internally.
 */
export function useOrders() {
  const store = useOrderStore()

  return {
    getOrders: () => store.ordersWithDetails,
    getOrderById: (id: string) => store.getOrderById(id),
    updateItemStatus: (itemId: string, newStatus: any) => store.updateItemStatus(itemId, newStatus),
    updateOrderItemsStatus: (orderId: string, newStatus: any) => store.updateOrderItemsStatus(orderId, newStatus),
    updatePrintshopItemsStatus: (printshopId: string, orderIds: string[], newStatus: any) =>
      store.updatePrintshopItemsStatus(printshopId, orderIds, newStatus),
    updateOrderSource: (orderId: string, newSource: any) => store.updateOrderSource(orderId, newSource),
    updateOrderPaymentStatus: (orderId: string, newPaymentStatus: any) =>
      store.updateOrderPaymentStatus(orderId, newPaymentStatus),
    updateOrderPaymentMethod: (orderId: string, newMethod: any) =>
      store.updateOrderPaymentMethod(orderId, newMethod),
    updateItemPrintshop: (itemId: string, newPrintshopId: string | null) =>
      store.updateItemPrintshop(itemId, newPrintshopId),
    updateItemDueDate: (itemId: string, newDueDate: string | null) =>
      store.updateItemDueDate(itemId, newDueDate),
  }
}
