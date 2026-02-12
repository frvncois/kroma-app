<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderItems, type OrderItemWithDetails } from '@/composables/useOrderItems'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatStatus, formatPayment } from '@/lib/formatters'
import { getStatusVariant, getPaymentVariant } from '@/lib/variants'
import type { ItemStatus } from '@/types'
import DataTable from '@/components/DataTable.vue'
import Badge from '@/components/ui/Badge.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import Input from '@/components/ui/Input.vue'
import { Search } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { getItemsByShops } = useOrderItems()
const authStore = useAuthStore()

// Terminal states for archives
const terminalStatuses: ItemStatus[] = ['delivered', 'picked_up', 'canceled']

// Get archived items scoped to user's assigned shops
const archivedItems = computed(() => {
  const shops = authStore.userShops
  if (shops.length === 0) return []
  return getItemsByShops(shops).filter(item => terminalStatuses.includes(item.status))
})

// Search
const searchQuery = ref('')

// Filtered items
const filteredItems = computed(() => {
  let items = archivedItems.value

  // Search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(item => {
      const matchesProduct = item.product_name.toLowerCase().includes(query)
      const matchesOrder = item.order.external_id?.toLowerCase().includes(query) ||
                          item.order.id.toLowerCase().includes(query)
      const matchesCustomer = item.customer.name.toLowerCase().includes(query)
      return matchesProduct || matchesOrder || matchesCustomer
    })
  }

  // Sort by delivery date (newest first)
  return [...items].sort((a, b) => {
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
</script>

<template>
  <div class="h-full w-full">
    <!-- Main Content -->
    <div class="flex h-full flex-col space-y-10 p-10 pt-24">
      <!-- Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">Archives</h1>
          <p class="text-sm text-muted-foreground">
            View your completed and delivered items
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

    <!-- Order Detail Sheet -->
    <OrderDetailSheet
      :order-id="selectedOrderId"
      :is-open="isSheetOpen"
      :show-payment="false"
      :show-addresses="false"
      @update:is-open="isSheetOpen = $event"
    />
  </div>
</template>
