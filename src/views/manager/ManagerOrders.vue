<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrders } from '@/composables/useOrders'
import { useOrderItems, type OrderItemWithDetails } from '@/composables/useOrderItems'
import { usePrintshops } from '@/composables/usePrintshops'
import { useActivityStore } from '@/stores/activities'
import type { ItemStatus } from '@/types'
import {
  statusOptions,
  sourceOptions,
  paymentOptions,
  orderByOptions,
  kanbanColumns,
  kanbanColumnOptions,
} from '@/lib/constants'
import Button from '@/components/ui/Button.vue'
import DataTable from '@/components/DataTable.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import NewOrderSheet from '@/components/NewOrderSheet.vue'
import DriverTaskSheet from '@/components/DriverTaskSheet.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import StatsCards from '@/components/StatsCards.vue'
import OrderFilters from '@/components/OrderFilters.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import OrderExpandedRow from '@/components/OrderExpandedRow.vue'
import StatsSheet from '@/components/StatsSheet.vue'
import AssignmentDialog from '@/components/AssignmentDialog.vue'
import { createColumns } from './order-columns'
import { Package, Settings, AlertCircle, Truck, CheckCircle, Clock, DollarSign } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { getOrders, updateItemStatus, updateItemPrintshop } = useOrders()
const { getItemsByPrintshop } = useOrderItems()
const { getPrintshops, getPrintshopById } = usePrintshops()
const activityStore = useActivityStore()
const { toast } = useToast()

const orders = computed(() => getOrders())
const allItems = computed(() => getItemsByPrintshop(null))

// Table columns with callbacks
const columns = computed(() => createColumns({
  onOpenDetail: (orderId: string) => openOrderDetail(orderId),
}))

// Activities state (use the store's activities)
const activities = computed(() => activityStore.allActivities)

// Sheet state
const selectedOrderId = ref<string | null>(null)
const isSheetOpen = ref(false)
const orderSheetSide = ref<'left' | 'right'>('right')
const isNewOrderSheetOpen = ref(false)
const isDriverTaskSheetOpen = ref(false)

// Stats sheet state
const isStatsSheetOpen = ref(false)
const statsSheetTitle = ref('')
const statsSheetItems = ref<OrderItemWithDetails[]>([])

// View mode
const viewMode = ref<string>('table')
const viewOptions = [
  { value: 'table', label: 'Table', icon: 'table' },
  { value: 'kanban', label: 'Kanban', icon: 'kanban' },
]

// Filters
const statusFilter = ref<string[]>(['all'])
const sourceFilter = ref<string[]>(['all'])
const paymentFilter = ref<string[]>(['all'])
const printshopFilter = ref<string[]>(['all'])
const orderBy = ref<string>('newest')
const kanbanColumnsFilter = ref<string[]>(['all'])
const searchQuery = ref<string>('')

// Drag and drop state
const draggedItemId = ref<string | null>(null)
const isAssignDialogOpen = ref(false)
const pendingAssignment = ref<{ itemId: string; itemName: string; status: ItemStatus; printshop: string; printshopName: string } | null>(null)

const openOrderDetail = (orderId: string, side: 'left' | 'right' = 'right') => {
  selectedOrderId.value = orderId
  orderSheetSide.value = side
  isSheetOpen.value = true
}

// Handle openOrder query param from command palette
watch(() => route.query.openOrder, (orderId) => {
  if (orderId && typeof orderId === 'string') {
    openOrderDetail(orderId)
    // Clear the query param
    router.replace({ query: { ...route.query, openOrder: undefined } })
  }
}, { immediate: true })

const handleActivityClick = (orderId: string) => {
  openOrderDetail(orderId, 'left')
}

const openNewOrderSheet = () => {
  isNewOrderSheetOpen.value = true
}

const openDriverTaskSheet = () => {
  isDriverTaskSheetOpen.value = true
}

const handleOrderCreated = (orderId: string) => {
  console.log('Order created:', orderId)
}

const handleTaskCreated = (taskId: string) => {
  console.log('Driver task created:', taskId)
}

// Filtered and sorted orders (for table view)
const filteredOrders = computed(() => {
  let filtered = orders.value.filter((order) => {
    if (viewMode.value === 'table' && !statusFilter.value.includes('all') && !statusFilter.value.includes(order.statusRollup)) {
      return false
    }
    if (!sourceFilter.value.includes('all') && !sourceFilter.value.includes(order.source)) {
      return false
    }
    if (!paymentFilter.value.includes('all') && !paymentFilter.value.includes(order.payment_status)) {
      return false
    }
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      const matchesOrderId = (order.external_id || order.id).toLowerCase().includes(query)
      const matchesCustomer = order.customer.name.toLowerCase().includes(query)
      const matchesCompany = order.customer.company?.toLowerCase().includes(query)
      const matchesProducts = order.items.some((item) =>
        item.product_name.toLowerCase().includes(query)
      )
      if (!matchesOrderId && !matchesCustomer && !matchesCompany && !matchesProducts) {
        return false
      }
    }
    return true
  })

  if (viewMode.value === 'table') {
    filtered = [...filtered].sort((a, b) => {
      switch (orderBy.value) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'due_date':
          const aDate = a.items.map((i) => i.due_date).filter((d) => d).sort()[0] || '9999-12-31'
          const bDate = b.items.map((i) => i.due_date).filter((d) => d).sort()[0] || '9999-12-31'
          return aDate.localeCompare(bDate)
        case 'customer':
          return a.customer.name.localeCompare(b.customer.name)
        case 'amount':
          return b.amount_total - a.amount_total
        default:
          return 0
      }
    })
  }

  return filtered
})

// Filtered items (for kanban view)
const filteredItems = computed(() => {
  return allItems.value.filter((item) => {
    if (!sourceFilter.value.includes('all') && !sourceFilter.value.includes(item.order.source)) {
      return false
    }
    if (!paymentFilter.value.includes('all') && !paymentFilter.value.includes(item.order.payment_status)) {
      return false
    }
    if (!printshopFilter.value.includes('all')) {
      if (printshopFilter.value.includes('unassigned')) {
        if (item.assigned_printshop !== null) return false
      } else {
        if (!printshopFilter.value.includes(item.assigned_printshop || '')) return false
      }
    }
    return true
  })
})

// Kanban search results
const kanbanSearchResults = computed(() => {
  if (!searchQuery.value || viewMode.value !== 'kanban') return []
  const query = searchQuery.value.toLowerCase()
  return allItems.value.filter((item) => {
    const matchesProduct = item.product_name.toLowerCase().includes(query)
    const matchesOrderId = (item.order.external_id || item.order.id).toLowerCase().includes(query)
    const matchesCustomer = item.customer.name.toLowerCase().includes(query)
    const matchesCompany = item.customer.company?.toLowerCase().includes(query)
    return matchesProduct || matchesOrderId || matchesCustomer || matchesCompany
  }).slice(0, 10)
})

// Stats computations
const stats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return {
    waitingProduction: allItems.value.filter((item) => item.status === 'assigned').length,
    inProduction: allItems.value.filter((item) => item.status === 'in_production').length,
    productionLate: allItems.value.filter((item) => {
      if (!item.due_date) return false
      const dueDate = new Date(item.due_date)
      const notComplete = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
      return dueDate < today && notComplete
    }).length,
    readyForDelivery: allItems.value.filter((item) => item.status === 'ready' && item.order.delivery_method === 'delivery').length,
    outForDelivery: allItems.value.filter((item) => item.status === 'out_for_delivery').length,
    deliveryLate: 0,
    unpaid: orders.value.filter((o) => o.payment_status === 'unpaid' || o.payment_status === 'partial').length,
    unassigned: allItems.value.filter((item) => !item.assigned_printshop || item.status === 'new').length,
    completedDelivery: allItems.value.filter((item) => item.status === 'delivered' || item.status === 'picked_up').length,
  }
})

// Stats card configuration
const statsCards = computed(() => [
  {
    title: 'Manager',
    icon: 'manager',
    iconColor: 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
    items: [
      { label: 'Unassigned items', icon: Package, count: stats.value.unassigned, statKey: 'unassigned' },
      { label: 'Unpaid orders', icon: DollarSign, count: stats.value.unpaid, statKey: 'unpaid' },
      { label: 'Completed delivery items', icon: CheckCircle, count: stats.value.completedDelivery, statKey: 'completedDelivery' },
    ],
  },
  {
    title: 'Production',
    icon: 'production',
    iconColor: 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
    items: [
      { label: 'Waiting production items', icon: Clock, count: stats.value.waitingProduction, statKey: 'waitingProduction' },
      { label: 'In production items', icon: Settings, count: stats.value.inProduction, statKey: 'inProduction' },
      { label: 'Late items', icon: AlertCircle, count: stats.value.productionLate, statKey: 'productionLate' },
    ],
  },
  {
    title: 'Delivery',
    icon: 'delivery',
    iconColor: 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400',
    items: [
      { label: 'Waiting for pickup items', icon: Package, count: stats.value.readyForDelivery, statKey: 'readyForDelivery' },
      { label: 'Out for delivery items', icon: Truck, count: stats.value.outForDelivery, statKey: 'outForDelivery' },
      { label: 'Late delivery items', icon: AlertCircle, count: stats.value.deliveryLate, statKey: 'deliveryLate' },
    ],
  },
])

// Stats sheet handlers
const showStatsSheet = (type: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const statHandlers: Record<string, () => void> = {
    waitingProduction: () => {
      statsSheetTitle.value = 'Waiting Production Items'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'assigned')
    },
    inProduction: () => {
      statsSheetTitle.value = 'In Production Items'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'in_production')
    },
    productionLate: () => {
      statsSheetTitle.value = 'Late Items'
      statsSheetItems.value = allItems.value.filter((item) => {
        if (!item.due_date) return false
        const dueDate = new Date(item.due_date)
        const notComplete = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
        return dueDate < today && notComplete
      })
    },
    readyForDelivery: () => {
      statsSheetTitle.value = 'Waiting for Pickup'
      statsSheetItems.value = allItems.value.filter((item) => {
        return item.status === 'ready' && item.order.delivery_method === 'delivery'
      })
    },
    outForDelivery: () => {
      statsSheetTitle.value = 'Out for Delivery'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'out_for_delivery')
    },
    deliveryLate: () => {
      statsSheetTitle.value = 'Late Delivery Items'
      statsSheetItems.value = []
    },
    completedDelivery: () => {
      statsSheetTitle.value = 'Completed Delivery Items'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'delivered' || item.status === 'picked_up')
    },
    unpaid: () => {
      statsSheetTitle.value = 'Unpaid Orders'
      statsSheetItems.value = allItems.value.filter((item) => {
        return item.order.payment_status === 'unpaid' || item.order.payment_status === 'partial'
      })
    },
    unassigned: () => {
      statsSheetTitle.value = 'Unassigned Items'
      statsSheetItems.value = allItems.value.filter((item) => !item.assigned_printshop || item.status === 'new')
    },
  }

  statHandlers[type]?.()
  isStatsSheetOpen.value = true
}

// Kanban columns
const visibleKanbanColumns = computed(() => {
  if (kanbanColumnsFilter.value.includes('all')) {
    return kanbanColumns
  }
  return kanbanColumns.filter(col => kanbanColumnsFilter.value.includes(col.id))
})

// Drag and drop handlers
const handleItemDrop = (itemId: string, newStatus: ItemStatus, printshop: string | null) => {
  if (!itemId || !newStatus) {
    draggedItemId.value = itemId
    return
  }

  if (printshop && (printshop === 'in-house' || printshop === 'victor')) {
    const item = allItems.value.find(i => i.id === itemId)
    const shop = getPrintshopById(printshop)

    if (item && shop) {
      pendingAssignment.value = {
        itemId: itemId,
        itemName: item.product_name,
        status: newStatus,
        printshop: printshop,
        printshopName: shop.name
      }
      isAssignDialogOpen.value = true
    }
  } else {
    updateItemStatus(itemId, newStatus)
    if (printshop) {
      updateItemPrintshop(itemId, printshop)
    }
    draggedItemId.value = null
  }
}

const confirmAssignment = () => {
  if (pendingAssignment.value) {
    updateItemStatus(pendingAssignment.value.itemId, pendingAssignment.value.status)
    updateItemPrintshop(pendingAssignment.value.itemId, pendingAssignment.value.printshop)

    toast({
      title: 'Item assigned',
      description: `${pendingAssignment.value.itemName} assigned to ${pendingAssignment.value.printshopName}`,
      variant: 'success',
    })

    draggedItemId.value = null
  }
  isAssignDialogOpen.value = false
  pendingAssignment.value = null
}

const cancelAssignment = () => {
  draggedItemId.value = null
  isAssignDialogOpen.value = false
  pendingAssignment.value = null
}

// Filter configurations
const tableFilterConfigs = [
  { key: 'status', label: 'Status', options: statusOptions },
  { key: 'source', label: 'Source', options: sourceOptions },
  { key: 'payment', label: 'Payment', options: paymentOptions },
  { key: 'orderBy', label: 'Order By', options: orderByOptions, multiple: false },
]

const kanbanFilterConfigs = [
  { key: 'kanbanColumns', label: 'Columns', options: kanbanColumnOptions },
]
</script>

<template>
  <div class="h-full mr-80 overflow-hidden w-full">
    <!-- Main Content -->
    <div class="flex h-full flex-col space-y-10 p-10 overflow-hidden">
      <!-- Row 1: Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <h1 class="text-3xl font-medium">General Manager</h1>
        <div class="flex gap-2">
          <Button variant="outline" @click="openDriverTaskSheet">+ Driver Task</Button>
          <Button @click="openNewOrderSheet">+ New Order</Button>
        </div>
      </div>

      <!-- Row 2: Stats Cards -->
      <StatsCards :cards="statsCards" @stat-click="showStatsSheet" />

      <!-- Row 3: Filters, Search, and View Toggle -->
      <OrderFilters
        v-model:view-mode="viewMode"
        v-model:status-filter="statusFilter"
        v-model:source-filter="sourceFilter"
        v-model:payment-filter="paymentFilter"
        v-model:printshop-filter="printshopFilter"
        v-model:order-by="orderBy"
        v-model:kanban-columns-filter="kanbanColumnsFilter"
        v-model:search-query="searchQuery"
        :view-options="viewOptions"
        :table-filters="tableFilterConfigs"
        :kanban-filters="kanbanFilterConfigs"
        :kanban-search-results="kanbanSearchResults"
        @search-result-click="openOrderDetail"
      />

      <!-- Row 4: Content -->
      <div v-if="viewMode === 'table'" class="flex-1 min-h-0 w-full overflow-auto">
        <DataTable
          :columns="columns"
          :data="filteredOrders"
          search-key="external_id"
          search-placeholder="Search orders..."
          grid-template-columns="0.25fr 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.25fr"
        >
          <template #expanded-row="{ row }">
            <OrderExpandedRow
              :order="row.original"
              :printshops="getPrintshops()"
              @update-status="updateItemStatus"
              @update-printshop="updateItemPrintshop"
              @open-detail="openOrderDetail"
            />
          </template>
        </DataTable>
      </div>

      <!-- Kanban View -->
      <KanbanBoard
        v-if="viewMode === 'kanban'"
        :columns="kanbanColumns"
        :visible-columns="visibleKanbanColumns"
        :items="filteredItems"
        @item-drop="handleItemDrop"
        @item-click="openOrderDetail"
      />
    </div>
    <!-- End Main Content -->

    <!-- Right Sidebar: Activity Feed -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background overflow-y-auto">
      <ActivityFeed :activities="activities" @activity-click="handleActivityClick" />
    </div>

    <!-- Order Detail Sheet -->
    <OrderDetailSheet
      :order-id="selectedOrderId"
      :is-open="isSheetOpen"
      :show-payment="true"
      :side="orderSheetSide"
      @update:is-open="isSheetOpen = $event"
    />

    <!-- New Order Sheet -->
    <NewOrderSheet
      :is-open="isNewOrderSheetOpen"
      @update:is-open="isNewOrderSheetOpen = $event"
      @order-created="handleOrderCreated"
    />

    <!-- Driver Task Sheet -->
    <DriverTaskSheet
      :open="isDriverTaskSheetOpen"
      @update:open="isDriverTaskSheetOpen = $event"
      @task-created="handleTaskCreated"
    />

    <!-- Stats Sheet -->
    <StatsSheet
      :is-open="isStatsSheetOpen"
      :title="statsSheetTitle"
      :items="statsSheetItems"
      @update:is-open="isStatsSheetOpen = $event"
      @item-click="openOrderDetail"
    />

    <!-- Assignment Confirmation Dialog -->
    <AssignmentDialog
      :is-open="isAssignDialogOpen"
      :item-name="pendingAssignment?.itemName || ''"
      :printshop-name="pendingAssignment?.printshopName || ''"
      @update:is-open="isAssignDialogOpen = $event"
      @confirm="confirmAssignment"
      @cancel="cancelAssignment"
    />
  </div>
</template>
