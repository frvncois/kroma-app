import type { ItemStatus, PaymentStatus, OrderSource } from '@/types'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import { usePrintshopStore } from '@/stores/printshops'

/**
 * Format date as DD/MM/YY
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

/**
 * Format date with full month name and time (e.g., "Jan 23, 2024 14:30")
 */
export function formatDateDisplay(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format currency as USD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Format item status as human-readable label
 */
export function formatStatus(status: ItemStatus | 'mixed'): string {
  if (status === 'mixed') return 'In Progress'

  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format printshop ID to printshop name or 'Unassigned'
 */
export function formatPrintshop(printshopId: string | null): string {
  if (!printshopId) return 'Unassigned'
  const printshopStore = usePrintshopStore()
  const shop = printshopStore.getPrintshopById(printshopId)
  return shop ? shop.name : 'Unknown'
}

/**
 * Format payment status as human-readable label
 */
export function formatPayment(paymentStatus: PaymentStatus): string {
  return paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)
}

/**
 * Format order source as human-readable label
 */
export function formatSource(source: OrderSource): string {
  const sourceMap: Record<OrderSource, string> = {
    impression_quebec: 'Imp. Quebec',
    promo_flash: 'Promo Flash',
    propaganda: 'Propaganda',
    sticker_pusher: 'Sticker Pusher',
    studio_c: 'Studio C',
    other: 'Other',
  }
  return sourceMap[source] || source
}

/**
 * Calculate days ago from a date string
 */
export function calculateDaysAgo(dateString: string): number {
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = today.getTime() - date.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calculate days from now to a date string
 */
function calculateDaysFromNow(dateString: string): number {
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = date.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if an item is overdue based on due date and status
 */
export function isOverdue(item: OrderItemWithDetails): boolean {
  if (!item.due_date) return false
  const dueDate = new Date(item.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const notReady = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
  return dueDate < today && notReady
}

/**
 * Format relative due date based on item status
 * Returns descriptive text and whether the item is overdue
 */
export function formatRelativeDueDate(
  item: OrderItemWithDetails
): { text: string; isOverdue: boolean } {
  // If item is new or unassigned, show "Order received X days ago"
  if (item.status === 'new' || !item.assigned_printshop) {
    const receivedDays = calculateDaysAgo(item.order.created_at)
    return {
      text: `Order received ${receivedDays} ${receivedDays === 1 ? 'day' : 'days'} ago`,
      isOverdue: false,
    }
  }

  switch (item.status) {
    case 'assigned':
    case 'in_production':
      if (!item.due_date) return { text: 'No due date', isOverdue: false }
      const dueDays = calculateDaysFromNow(item.due_date)
      if (dueDays < 0) {
        const daysAgo = Math.abs(dueDays)
        return {
          text: `due ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`,
          isOverdue: true,
        }
      } else if (dueDays === 0) {
        return { text: 'due today', isOverdue: false }
      } else {
        return {
          text: `due in ${dueDays} ${dueDays === 1 ? 'day' : 'days'}`,
          isOverdue: false,
        }
      }

    case 'on_hold':
      const createdDays = calculateDaysAgo(item.order.created_at)
      return {
        text: `created ${createdDays} ${createdDays === 1 ? 'day' : 'days'} ago`,
        isOverdue: false,
      }

    case 'ready':
      return { text: 'Waiting delivery/pickup', isOverdue: false }

    case 'out_for_delivery':
      if (item.delivery_date) {
        const deliveryDays = calculateDaysFromNow(item.delivery_date)
        if (deliveryDays < 0) {
          const daysAgo = Math.abs(deliveryDays)
          return {
            text: `should have been delivered ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`,
            isOverdue: true,
          }
        } else if (deliveryDays === 0) {
          return { text: 'To be delivered today', isOverdue: false }
        } else {
          return {
            text: `To be delivered in ${deliveryDays} ${deliveryDays === 1 ? 'day' : 'days'}`,
            isOverdue: false,
          }
        }
      }
      return { text: 'Out for delivery', isOverdue: false }

    case 'delivered':
      if (item.delivery_date) {
        const deliveredDays = calculateDaysAgo(item.delivery_date)
        return {
          text: `Delivered ${deliveredDays} ${deliveredDays === 1 ? 'day' : 'days'} ago`,
          isOverdue: false,
        }
      }
      return { text: 'Delivered', isOverdue: false }

    case 'picked_up':
      if (item.due_date) {
        const pickedUpDays = calculateDaysAgo(item.due_date)
        return {
          text: `Picked up ${pickedUpDays} ${pickedUpDays === 1 ? 'day' : 'days'} ago`,
          isOverdue: false,
        }
      }
      return { text: 'Picked up', isOverdue: false }

    case 'canceled':
      const canceledDays = calculateDaysAgo(item.order.created_at)
      return {
        text: `Canceled ${canceledDays} ${canceledDays === 1 ? 'day' : 'days'} ago`,
        isOverdue: false,
      }

    default:
      return { text: 'No date', isOverdue: false }
  }
}
