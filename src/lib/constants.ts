import type { ItemStatus } from '@/types'
import type { Printshop } from '@/types'

/**
 * Status filter options with 'All Statuses' option
 */
export const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'canceled', label: 'Canceled' },
]

/**
 * Status options without 'all' - for use in dropdowns where all isn't applicable
 */
export const statusOptionsWithoutAll: { value: ItemStatus; label: string }[] = statusOptions.filter((opt) => opt.value !== 'all') as { value: ItemStatus; label: string }[]

/**
 * Source filter options with 'All Sources' option
 */
export const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'impression_quebec', label: 'Imp. Quebec' },
  { value: 'promo_flash', label: 'Promo Flash' },
  { value: 'propaganda', label: 'Propaganda' },
  { value: 'sticker_pusher', label: 'Sticker Pusher' },
  { value: 'studio_c', label: 'Studio C' },
  { value: 'other', label: 'Other' },
]

/**
 * Source options without 'all' - for use in dropdowns where all isn't applicable
 */
export const sourceOptionsWithoutAll = sourceOptions.filter((opt) => opt.value !== 'all')

/**
 * Payment filter options with 'All Statuses' option
 */
export const paymentOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

/**
 * Payment options without 'all' - for use in dropdowns where all isn't applicable
 */
export const paymentOptionsWithoutAll = paymentOptions.filter((opt) => opt.value !== 'all')

/**
 * Payment method options
 */
export const paymentMethodOptions = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'etransfer', label: 'E-Transfer' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
]

/**
 * Delivery method options
 */
export const deliveryMethodOptions = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'customer_pickup', label: 'Customer Pickup' },
]

/**
 * Order by options for sorting
 */
export const orderByOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'payment', label: 'Payment Status' },
]

/**
 * Helper to generate printshop filter options from printshops array
 * @param printshops - Array of printshop objects
 * @param includeUnassigned - Whether to include an 'Unassigned' option
 * @returns Filter options array with 'all' option
 */
export function printshopOptions(printshops: Printshop[], includeUnassigned = true) {
  const options = [
    { value: 'all', label: 'All Shops' },
    ...printshops.map((shop) => ({
      value: shop.id,
      label: shop.name,
    })),
  ]

  if (includeUnassigned) {
    options.push({ value: 'unassigned', label: 'Unassigned' })
  }

  return options
}

/**
 * Kanban column definitions for Manager view
 * Each column represents a status or printshop-specific queue
 */
export const kanbanColumns = [
  { id: 'new', title: 'New', status: 'new' as ItemStatus, printshop: null },
  { id: 'in-house', title: 'In House', status: 'assigned' as ItemStatus, printshop: 'in-house' },
  { id: 'victor', title: 'Victor', status: 'assigned' as ItemStatus, printshop: 'victor' },
  {
    id: 'studio-c',
    title: 'Studio C',
    status: 'assigned' as ItemStatus,
    printshop: 'studio-c',
  },
  {
    id: 'in_production',
    title: 'In Production',
    status: 'in_production' as ItemStatus,
    printshop: null,
  },
  { id: 'on_hold', title: 'On Hold', status: 'on_hold' as ItemStatus, printshop: null },
  { id: 'ready', title: 'Ready', status: 'ready' as ItemStatus, printshop: null },
  {
    id: 'out_for_delivery',
    title: 'Out for Delivery',
    status: 'out_for_delivery' as ItemStatus,
    printshop: null,
  },
  { id: 'delivered', title: 'Delivered', status: 'delivered' as ItemStatus, printshop: null },
  { id: 'picked_up', title: 'Picked Up', status: 'picked_up' as ItemStatus, printshop: null },
  { id: 'canceled', title: 'Canceled', status: 'canceled' as ItemStatus, printshop: null },
]

/**
 * Kanban column filter options (for column visibility toggle)
 */
export const kanbanColumnOptions = [
  { value: 'all', label: 'All Columns' },
  ...kanbanColumns.map((col) => ({ value: col.id, label: col.title })),
]
