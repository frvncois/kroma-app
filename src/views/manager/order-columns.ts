import type { ColumnDef } from '@tanstack/vue-table'
import type { OrderWithDetails } from '@/composables/useOrders'
import type { PaymentStatus, ItemStatus } from '@/types'
import { h } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import HoverCard from '@/components/ui/HoverCard.vue'
import { formatSource, formatPayment } from '@/lib/formatters'
import { getPaymentVariant, statusColorMap } from '@/lib/variants'
import { sourceOptionsWithoutAll, paymentOptionsWithoutAll } from '@/lib/constants'

// Use options without 'all' for column filters
const sourceOptions = sourceOptionsWithoutAll
const paymentOptions = paymentOptionsWithoutAll

/**
 * Column callbacks interface
 */
export interface ColumnCallbacks {
  onOpenDetail: (orderId: string) => void
}

/**
 * Creates table columns with callbacks for actions
 */
export function createColumns(callbacks: ColumnCallbacks): ColumnDef<OrderWithDetails>[] {
  return [
  {
    id: 'expand',
    header: () => '',
    cell: ({ row }) => {
      return h(
        'button',
        {
          onClick: () => row.toggleExpanded(),
          class: 'p-2 rounded transition-colors',
        },
        h('svg', {
          class: `h-4 w-4 transition-transform ${row.getIsExpanded() ? 'rotate-90' : ''}`,
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
        }, [
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M9 5l7 7-7 7',
          })
        ])
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'external_id',
    header: 'Order #',
    cell: ({ row }) => {
      const order = row.original
      const orderId = order.external_id || order.id.toUpperCase().slice(0, 8)
      return h(
        'div',
        { class: 'font-medium truncate' },
        orderId.slice(0, 10)
      )
    },
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => {
      const customer = row.original.customer
      return h('div', { class: 'flex flex-col' }, [
        h('div', { class: 'font-medium' }, customer.name),
        customer.company
          ? h('div', { class: 'text-xs text-muted-foreground' }, customer.company)
          : null,
      ])
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const order = row.original
      const sourceLabel = sourceOptions.find(opt => opt.value === order.source)?.label || order.source
      return h(Badge, { variant: 'outline' }, () => sourceLabel)
    },
  },
  {
    accessorKey: 'items',
    header: 'Items',
    cell: ({ row }) => {
      const count = row.original.items.length
      return h(Badge, { variant: 'outline' }, () => `${count} ${count === 1 ? 'item' : 'items'}`)
    },
  },
  {
    accessorKey: 'files_count',
    header: 'Files',
    cell: ({ row }) => {
      // TODO: Compute files_count from order_files table
      const filesCount = 0
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('svg', {
          class: 'h-4 w-4 text-muted-foreground',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
        }, [
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
          })
        ]),
        h('span', { class: 'text-sm' }, filesCount)
      ])
    },
  },
  {
    accessorKey: 'comments_count',
    header: 'Notes',
    cell: ({ row }) => {
      // TODO: Compute comments_count from notes/comments
      const commentsCount = 0
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('svg', {
          class: 'h-4 w-4 text-muted-foreground',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
        }, [
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
          })
        ]),
        h('span', { class: 'text-sm' }, commentsCount)
      ])
    },
  },
  {
    accessorKey: 'statusRollup',
    header: 'Status',
    cell: ({ row }) => {
      const items = row.original.items

      // Use color map from lib/variants
      const colorMap = statusColorMap

      // Group items by status
      const statusGroups = items.reduce((acc, item) => {
        if (!acc[item.status]) {
          acc[item.status] = []
        }
        acc[item.status].push(item)
        return acc
      }, {} as Record<ItemStatus, typeof items>)

      const uniqueStatuses = Object.keys(statusGroups) as ItemStatus[]

      return h('div', { class: 'flex gap-1.5' },
        uniqueStatuses.map(status => {
          const statusItems = statusGroups[status]
          const statusLabel = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

          return h(HoverCard, {}, {
            trigger: () => h('div', {
              class: `h-3 w-3 rounded-full ${colorMap[status] || 'bg-zinc-400'} cursor-pointer transition-transform hover:scale-125`
            }),
            content: () => h('div', { class: 'space-y-2' }, [
              h('div', { class: 'font-semibold text-foreground' }, statusLabel),
              h('div', { class: 'space-y-1' },
                statusItems.map(item =>
                  h('div', { class: 'text-xs text-muted-foreground' }, `• ${item.product_name}`)
                )
              )
            ])
          })
        })
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => {
      const date = new Date(row.original.created_at)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      return h(
        'div',
        { class: 'text-sm text-muted-foreground' },
        `${day}/${month}/${year}`
      )
    },
  },
  {
    accessorKey: 'payment_status',
    header: 'Payment',
    cell: ({ row }) => {
      const order = row.original
      const paymentLabel = formatPayment(order.payment_status)
      return h(Badge, { variant: getPaymentVariant(order.payment_status) }, () => paymentLabel)
    },
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) => {
      const order = row.original
      return h(
        'button',
        {
          onClick: () => callbacks.onOpenDetail(order.id),
          class: 'p-2 hover:bg-accent rounded-md transition-colors',
        },
        h('svg', {
          class: 'h-5 w-5',
          fill: 'currentColor',
          viewBox: '0 0 24 24',
        }, [
          h('circle', { cx: '12', cy: '5', r: '2' }),
          h('circle', { cx: '12', cy: '12', r: '2' }),
          h('circle', { cx: '12', cy: '19', r: '2' }),
        ])
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
  ]
}
