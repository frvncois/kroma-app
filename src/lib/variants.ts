import type { ItemStatus, PaymentStatus, OrderSource } from '@/types'

/**
 * Badge variant types used in the UI
 */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'outline'

/**
 * Get badge variant for item status
 */
export function getStatusVariant(status: ItemStatus | 'mixed'): BadgeVariant {
  switch (status) {
    case 'new':
      return 'info'
    case 'assigned':
      return 'secondary'
    case 'in_production':
      return 'warning'
    case 'on_hold':
      return 'secondary'
    case 'ready':
      return 'info'
    case 'out_for_delivery':
      return 'warning'
    case 'delivered':
      return 'success'
    case 'picked_up':
      return 'success'
    case 'canceled':
      return 'destructive'
    case 'mixed':
      return 'secondary'
    default:
      return 'default'
  }
}

/**
 * Get badge variant for payment status
 */
export function getPaymentVariant(status: PaymentStatus): BadgeVariant {
  switch (status) {
    case 'paid':
      return 'success'
    case 'unpaid':
      return 'destructive'
    case 'partial':
      return 'warning'
    default:
      return 'default'
  }
}

/**
 * Get badge variant for order source
 */
export function getSourceVariant(source: OrderSource): BadgeVariant {
  // All sources use outline variant for consistency
  return 'outline'
}

/**
 * Color map for status indicators (kanban cards, status dots, etc.)
 */
export const statusColorMap: Record<ItemStatus, string> = {
  new: 'bg-blue-500',
  assigned: 'bg-blue-500',
  in_production: 'bg-amber-500',
  on_hold: 'bg-zinc-400',
  ready: 'bg-cyan-500',
  out_for_delivery: 'bg-amber-500',
  delivered: 'bg-emerald-500',
  picked_up: 'bg-emerald-500',
  canceled: 'bg-red-500',
}

/**
 * Color map for payment status indicators
 */
export const paymentColorMap: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-500',
  unpaid: 'bg-red-500',
  partial: 'bg-amber-500',
}
