<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrders } from '@/composables/useOrders'
import { useOrderItems } from '@/composables/useOrderItems'
import { usePrintshops } from '@/composables/usePrintshops'
import { useActivityStore } from '@/stores/activities'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { ItemStatus } from '@/types'
import {
  printshopStatusOptions,
  orderByOptions,
  printshopKanbanColumns,
} from '@/lib/constants'
import PrintshopItemList from '@/components/PrintshopItemList.vue'
import ItemDetailSheet from '@/components/ItemDetailSheet.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import OrderFilters from '@/components/OrderFilters.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { updateItemStatus } = useOrders()
const { getItemsByShops } = useOrderItems()
const { getPrintshopName } = usePrintshops()
const activityStore = useActivityStore()
const { toast } = useToast()

// Get items scoped to user's assigned shops
// Printshop managers only see items actively in their production queue
const productionStatuses: ItemStatus[] = ['assigned', 'in_production', 'on_hold', 'ready']

const myItems = computed(() => {
  const shops = authStore.userShops
  if (shops.length === 0) return []
  return getItemsByShops(shops).filter(item =>
    productionStatuses.includes(item.status)
  )
})

// Page title (dynamic based on shop count)
const pageTitle = computed(() => {
  const shops = authStore.userShops
  if (shops.length === 1 && shops[0]) {
    return `${getPrintshopName(shops[0]) || 'Unknown'} — Production Queue`
  }
  return 'Production Queue'
})

// Allowed statuses for printshop manager (same as production statuses)
const allowedStatuses: ItemStatus[] = productionStatuses

// Custom status options for printshop (rename "assigned" to "To Do")
const printshopStatusLabels: { value: ItemStatus; label: string }[] = [
  { value: 'assigned', label: 'To Do' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'ready', label: 'Ready' },
]

// Handle status change
const handleStatusChange = (itemId: string, status: ItemStatus) => {
  updateItemStatus(itemId, status)
  toast({
    title: 'Status updated',
    description: `Item status changed successfully`
  })
}

// Filtered activities (only show activities for our items/orders)
const filteredActivities = computed(() => {
  const myItemIds = new Set(myItems.value.map(i => i.id))
  const myOrderIds = new Set(myItems.value.map(i => i.order_id))

  return activityStore.allActivities.filter(activity => {
    // Show if activity is about one of our items
    if (activity.item && myItemIds.has(activity.item.id)) return true
    // Show if activity is about one of our orders
    if (activity.order && myOrderIds.has(activity.order.id)) return true
    return false
  })
})

// Sheet state
const selectedItemId = ref<string | null>(null)
const isSheetOpen = ref(false)

const openItemDetail = (itemId: string) => {
  selectedItemId.value = itemId
  isSheetOpen.value = true
}

// Handle openItem query param (from command palette or deep links)
watch(() => route.query.openItem, (itemId) => {
  if (itemId && typeof itemId === 'string') {
    openItemDetail(itemId)
    router.replace({ query: { ...route.query, openItem: undefined } })
  }
}, { immediate: true })

const handleActivityClick = (orderId: string) => {
  // Find an item in our items that belongs to this order
  const item = myItems.value.find(i => i.order_id === orderId)
  if (item) {
    openItemDetail(item.id)
  }
}

// View mode
const viewMode = ref<'table' | 'kanban'>('table')
const viewOptions = [
  { value: 'table', label: 'Table', icon: 'table' },
  { value: 'kanban', label: 'Kanban', icon: 'kanban' },
]

// Filters
const statusFilter = ref<string[]>(['all'])
const orderBy = ref('newest')
const searchQuery = ref('')
const kanbanColumnsFilter = ref<string[]>(['all'])

// Filter configs for OrderFilters component
const tableFilterConfigs = [
  { key: 'status', label: 'Status', options: printshopStatusOptions },
  { key: 'orderBy', label: 'Order By', options: orderByOptions, multiple: false },
]

const kanbanFilterConfigs = [
  { key: 'kanbanColumns', label: 'Columns', options: printshopKanbanColumns.map(col => ({ value: col.id, label: col.title })) },
]

// Visible kanban columns
const visibleKanbanColumns = computed(() => {
  if (kanbanColumnsFilter.value.includes('all')) {
    return printshopKanbanColumns
  }
  return printshopKanbanColumns.filter(col => kanbanColumnsFilter.value.includes(col.id))
})

// Filtered items
const filteredItems = computed(() => {
  let items = myItems.value

  // Filter by status
  if (!statusFilter.value.includes('all')) {
    items = items.filter(item => statusFilter.value.includes(item.status))
  }

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

  // Sort
  if (orderBy.value === 'newest') {
    items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (orderBy.value === 'oldest') {
    items = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  } else if (orderBy.value === 'due_date') {
    items = [...items].sort((a, b) => {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
  }

  return items
})

// Kanban
const handleItemDrop = (itemId: string, newStatus: ItemStatus) => {
  // Validate status is in allowed list
  if (!allowedStatuses.includes(newStatus)) {
    toast({
      title: 'Invalid status',
      description: 'Cannot move item to this status',
      variant: 'destructive'
    })
    return
  }

  updateItemStatus(itemId, newStatus)
  toast({
    title: 'Status updated',
    description: `Item moved to ${newStatus.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
  })
}

const handleKanbanItemClick = (orderId: string) => {
  const item = myItems.value.find(i => i.order_id === orderId)
  if (item) {
    openItemDetail(item.id)
  }
}
</script>

<template>
  <div class="h-full mr-80 overflow-hidden w-full">
    <!-- Main Content -->
    <div class="flex h-full flex-col space-y-10 p-10 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">{{ pageTitle }}</h1>
          <p class="text-sm text-muted-foreground">
            Manage your production queue
          </p>
        </div>
      </div>

      <!-- Filters -->
      <OrderFilters
        v-model:view-mode="viewMode"
        v-model:status-filter="statusFilter"
        v-model:order-by="orderBy"
        v-model:kanban-columns-filter="kanbanColumnsFilter"
        v-model:search-query="searchQuery"
        :view-options="viewOptions"
        :table-filters="tableFilterConfigs"
        :kanban-filters="kanbanFilterConfigs"
      />

      <!-- Content -->
      <div v-if="viewMode === 'table'" class="flex-1 min-h-0 w-full overflow-auto">
        <PrintshopItemList
          :items="filteredItems"
          :allowed-statuses="allowedStatuses"
          :custom-status-options="printshopStatusLabels"
          @item-click="openItemDetail"
          @update-status="handleStatusChange"
        />
      </div>

      <div v-if="viewMode === 'kanban'" class="flex-1 min-h-0 w-full overflow-auto">
        <KanbanBoard
          :columns="printshopKanbanColumns"
          :items="filteredItems"
          :visible-columns="visibleKanbanColumns"
          @item-drop="handleItemDrop"
          @item-click="handleKanbanItemClick"
        />
      </div>
    </div>

    <!-- Activity Feed Sidebar -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background">
      <ActivityFeed
        :activities="filteredActivities"
        @activity-click="handleActivityClick"
      />
    </div>

    <!-- Item Detail Sheet -->
    <ItemDetailSheet
      :item-id="selectedItemId"
      :is-open="isSheetOpen"
      @update:is-open="isSheetOpen = $event"
    />
  </div>
</template>
