import type { ItemStatus, PaymentStatus, OrderSource } from '@/types'

/**
 * Badge variant types used in the UI
 */
export type BadgeVariant =
  | 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'
  | 'slate' | 'blue' | 'amber' | 'orange' | 'cyan' | 'violet' | 'emerald' | 'teal' | 'red'

/**
 * Get badge variant for item status
 */
export function getStatusVariant(status: ItemStatus | 'mixed'): BadgeVariant {
  switch (status) {
    case 'new':              return 'slate'
    case 'assigned':         return 'blue'
    case 'in_production':    return 'amber'
    case 'on_hold':          return 'orange'
    case 'ready':            return 'cyan'
    case 'out_for_delivery': return 'violet'
    case 'delivered':        return 'emerald'
    case 'picked_up':        return 'teal'
    case 'canceled':         return 'red'
    case 'mixed':            return 'secondary'
    default:                 return 'default'
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
  new:              'bg-slate-600',
  assigned:         'bg-blue-600',
  in_production:    'bg-amber-600',
  on_hold:          'bg-orange-600',
  ready:            'bg-cyan-600',
  out_for_delivery: 'bg-violet-600',
  delivered:        'bg-emerald-600',
  picked_up:        'bg-teal-600',
  canceled:         'bg-red-600',
}

/**
 * Color map for payment status indicators
 */
export const paymentColorMap: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-500',
  unpaid: 'bg-red-500',
  partial: 'bg-amber-500',
}
