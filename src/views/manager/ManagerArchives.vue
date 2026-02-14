<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderItems, type OrderItemWithDetails } from '@/composables/useOrderItems'
import { useActivityStore } from '@/stores/activities'
import { formatDate, formatStatus, formatPrintshop, formatPayment } from '@/lib/formatters'
import { getStatusVariant, getPaymentVariant } from '@/lib/variants'
import type { ItemStatus } from '@/types'
import DataTable from '@/components/DataTable.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import Input from '@/components/ui/Input.vue'
import { Search, Eye } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { getAllItems } = useOrderItems()
const activityStore = useActivityStore()

// Activities (role-scoped)
const activities = computed(() => activityStore.getActivitiesForRole())

// Terminal states for archives
const terminalStatuses: ItemStatus[] = ['delivered', 'picked_up', 'canceled']

// Get all archived items
const archivedItems = computed(() => {
  return getAllItems().filter(item => terminalStatuses.includes(item.status))
})

// Search
const searchQuery = ref('')

// Filtered items
const filteredItems = computed(() => {
  let items = archivedItems.value

  // Search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter((item: OrderItemWithDetails) => {
      const matchesProduct = item.product_name.toLowerCase().includes(query)
      const matchesOrder = item.order.external_id?.toLowerCase().includes(query) ||
                          item.order.id.toLowerCase().includes(query)
      const matchesCustomer = item.customer.name.toLowerCase().includes(query)
      const matchesPrintshop = item.assigned_printshop?.toLowerCase().includes(query)
      return matchesProduct || matchesOrder || matchesCustomer || matchesPrintshop
    })
  }

  // Sort by delivery date (newest first)
  return [...items].sort((a: OrderItemWithDetails, b: OrderItemWithDetails) => {
    const aDate = a.delivery_date || a.updated_at
    const bDate = b.delivery_date || b.updated_at
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })
})

// Table columns
const columns = [
  {
    accessorKey: 'product_name',
    header: 'Item',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return `${item.product_name} (${item.quantity}x)`
    }
  },
  {
    accessorKey: 'order',
    header: 'Order',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return item.order.external_id || `#${item.order.id.slice(0, 8)}`
    }
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return item.customer.name
    }
  },
  {
    accessorKey: 'assigned_printshop',
    header: 'Printshop',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return formatPrintshop(item.assigned_printshop)
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return h(Badge, { variant: getStatusVariant(item.status) }, () => formatStatus(item.status))
    }
  },
  {
    accessorKey: 'payment_status',
    header: 'Payment',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return h(Badge, { variant: getPaymentVariant(item.order.payment_status) }, () =>
        formatPayment(item.order.payment_status)
      )
    }
  },
  {
    accessorKey: 'delivery_date',
    header: 'Completed',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      const date = item.delivery_date || item.updated_at
      return formatDate(date)
    }
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }: any) => {
      const item = row.original as OrderItemWithDetails
      return h(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick: (e: Event) => {
            e.stopPropagation()
            openOrderDetail(item.order_id)
          },
        },
        () => [
          h(Eye, { class: 'h-4 w-4 mr-2' }),
          'View order'
        ]
      )
    },
  }
]

// Sheet state
const selectedOrderId = ref<string | null>(null)
const isSheetOpen = ref(false)

const openOrderDetail = (orderId: string) => {
  selectedOrderId.value = orderId
  isSheetOpen.value = true
}

const handleRowClick = (item: OrderItemWithDetails) => {
  openOrderDetail(item.order_id)
}

// Activity handlers
const handleActivityClick = (activityId: string) => {
  const activity = activities.value.find((a) => a.id === activityId)
  if (activity?.order_id) {
    openOrderDetail(activity.order_id)
  }
}

const handleToggleSeen = (activityId: string) => {
  activityStore.toggleSeen(activityId)
}

const handleToggleImportant = (activityId: string) => {
  activityStore.toggleImportant(activityId)
}
</script>

<template>
  <div class="h-full mr-80 w-full">
    <!-- Main Content -->
    <div class="flex h-full flex-col space-y-10 p-10 pt-24">
      <!-- Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">Archives</h1>
          <p class="text-sm text-muted-foreground">
            View completed, delivered, and picked up items
          </p>
        </div>
        <div class="text-sm text-muted-foreground">
          {{ filteredItems.length }} archived item{{ filteredItems.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Search -->
      <div class="relative flex-shrink-0 max-w-md">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Search items, orders, customers..."
          class="pl-9"
        />
      </div>

      <!-- Table -->
      <div class="flex-1 min-h-0 overflow-auto">
        <DataTable
          :data="filteredItems"
          :columns="columns"
          @row-click="handleRowClick"
        />
      </div>
    </div>
    <!-- End Main Content -->

    <!-- Right Sidebar: Activity Feed -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background overflow-y-auto">
      <ActivityFeed
        :activities="activities"
        @activity-click="handleActivityClick"
        @toggle-seen="handleToggleSeen"
        @toggle-important="handleToggleImportant"
      />
    </div>

    <!-- Order Detail Sheet -->
    <OrderDetailSheet
      :order-id="selectedOrderId"
      :is-open="isSheetOpen"
      @update:is-open="isSheetOpen = $event"
    />
  </div>
</template>
