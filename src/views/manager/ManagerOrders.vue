<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrders } from '@/composables/useOrders'
import { useOrderItems, type OrderItemWithDetails } from '@/composables/useOrderItems'
import { printshops } from '@/data/mock/printshops'
import type { PaymentStatus } from '@/data/mock/orders'
import type { ItemStatus } from '@/data/mock/order-items'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import NewOrderSheet from '@/components/NewOrderSheet.vue'
import DriverTaskSheet from '@/components/DriverTaskSheet.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import DataTable from '@/components/DataTable.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import Sheet from '@/components/ui/Sheet.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { activities as initialActivities } from '@/data/mock/activities'
import { columns } from './order-columns'
import { Package, Settings, AlertCircle, Truck, CheckCircle, Clock, DollarSign, Search, FileText, MessageSquare } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { getOrders, updateItemStatus, updateOrderSource, updateOrderPaymentStatus, updateItemPrintshop } = useOrders()
const { getItemsByPrintshop } = useOrderItems()
const { toast } = useToast()

const orders = computed(() => getOrders())
const allItems = computed(() => getItemsByPrintshop(null))

// Activities state
const activities = ref([...initialActivities])

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
const statsSheetSearchQuery = ref('')

const openOrderDetail = (orderId: string, side: 'left' | 'right' = 'right') => {
  selectedOrderId.value = orderId
  orderSheetSide.value = side
  isSheetOpen.value = true
}

const handleActivityClick = (orderId: string) => {
  openOrderDetail(orderId, 'left')
}

const handleToggleSeen = (activityId: string) => {
  const activity = activities.value.find(a => a.id === activityId)
  if (activity) {
    activity.seen = !activity.seen

    toast({
      title: activity.seen ? 'Marked as seen' : 'Marked as unseen',
      description: activity.details.message,
      variant: 'success',
    })
  }
}

const closeOrderDetail = () => {
  isSheetOpen.value = false
  selectedOrderId.value = null
}

const openNewOrderSheet = () => {
  isNewOrderSheetOpen.value = true
}

const openDriverTaskSheet = () => {
  isDriverTaskSheetOpen.value = true
}

const handleOrderCreated = (orderId: string) => {
  console.log('Order created:', orderId)
  // Optionally open the order detail sheet
  // openOrderDetail(orderId)
}

const handleTaskCreated = (taskId: string) => {
  console.log('Driver task created:', taskId)
}

// Event listeners for DataTable custom events
const handleUpdateOrderSource = (event: Event) => {
  const customEvent = event as CustomEvent
  const { orderId, source } = customEvent.detail
  updateOrderSource(orderId, source)
}

const handleUpdateOrderPayment = (event: Event) => {
  const customEvent = event as CustomEvent
  const { orderId, paymentStatus } = customEvent.detail
  updateOrderPaymentStatus(orderId, paymentStatus)
}

const handleOpenOrderDetail = (event: Event) => {
  const customEvent = event as CustomEvent
  const { orderId } = customEvent.detail
  openOrderDetail(orderId)
}

onMounted(() => {
  window.addEventListener('update-order-source', handleUpdateOrderSource)
  window.addEventListener('update-order-payment', handleUpdateOrderPayment)
  window.addEventListener('open-order-detail', handleOpenOrderDetail)
})

onUnmounted(() => {
  window.removeEventListener('update-order-source', handleUpdateOrderSource)
  window.removeEventListener('update-order-payment', handleUpdateOrderPayment)
  window.removeEventListener('open-order-detail', handleOpenOrderDetail)
})

// View mode (table or kanban)
const viewMode = ref<string>('table')

const viewOptions = [
  { value: 'table', label: 'Table', icon: 'table' },
  { value: 'kanban', label: 'Kanban', icon: 'kanban' },
]

// Filter options
const statusOptions = [
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

const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'impression_quebec', label: 'Imp. Quebec' },
  { value: 'promo_flash', label: 'Promo Flash' },
  { value: 'propaganda', label: 'Propaganda' },
  { value: 'sticker_pusher', label: 'Sticker Pusher' },
  { value: 'studio_c', label: 'Studio C' },
  { value: 'other', label: 'Other' },
]

const paymentOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

const printshopOptions = computed(() => [
  { value: 'all', label: 'All Printshops' },
  ...printshops.map((shop) => ({ value: shop.id, label: shop.name })),
  { value: 'unassigned', label: 'Unassigned' },
])

const orderByOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'customer', label: 'Customer' },
  { value: 'amount', label: 'Amount' },
]

// Item-specific options (without "All" option)
const itemStatusOptions = [
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'canceled', label: 'Canceled' },
]

const itemPrintshopOptions = computed(() => [
  { value: '', label: 'Unassigned' },
  ...printshops.map((shop) => ({ value: shop.id, label: shop.name })),
])

// Expanded orders (for table view)
const expandedOrders = ref<Set<string>>(new Set())

// Drag and drop state
const draggedItemId = ref<string | null>(null)

// Confirmation dialog state
const isAssignDialogOpen = ref(false)
const pendingAssignment = ref<{ itemId: string; itemName: string; status: ItemStatus; printshop: string; printshopName: string } | null>(null)

const handleDragStart = (itemId: string) => {
  draggedItemId.value = itemId
}

const handleDragEnd = () => {
  draggedItemId.value = null
}

const handleDrop = (newStatus: ItemStatus, printshop: string | null = null) => {
  if (draggedItemId.value) {
    // If dropping into a printshop column (In House or Victor), show confirmation dialog
    if (printshop && (printshop === 'in-house' || printshop === 'victor')) {
      const item = allItems.value.find(i => i.id === draggedItemId.value)
      const shop = printshops.find(s => s.id === printshop)

      if (item && shop) {
        pendingAssignment.value = {
          itemId: draggedItemId.value,
          itemName: item.product_name,
          status: newStatus,
          printshop: printshop,
          printshopName: shop.name
        }
        isAssignDialogOpen.value = true
      }
    } else {
      // For other columns, update immediately
      updateItemStatus(draggedItemId.value, newStatus)
      if (printshop) {
        updateItemPrintshop(draggedItemId.value, printshop)
      }
      draggedItemId.value = null
    }
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

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

// Filters
const statusFilter = ref<string[]>(['all'])
const sourceFilter = ref<string[]>(['all'])
const paymentFilter = ref<string[]>(['all'])
const printshopFilter = ref<string[]>(['all']) // For kanban view
const orderBy = ref<string>('newest')
const kanbanColumnsFilter = ref<string[]>(['all']) // Kanban column visibility

// Search
const searchQuery = ref<string>('')

// Toggle expand/collapse for table rows
const toggleExpand = (orderId: string) => {
  if (expandedOrders.value.has(orderId)) {
    expandedOrders.value.delete(orderId)
  } else {
    expandedOrders.value.add(orderId)
  }
}

// Filtered and sorted orders (for table view)
const filteredOrders = computed(() => {
  let filtered = orders.value.filter((order) => {
    // Status filter (only in table view)
    if (viewMode.value === 'table' && !statusFilter.value.includes('all') && !statusFilter.value.includes(order.statusRollup)) {
      return false
    }
    // Source filter
    if (!sourceFilter.value.includes('all') && !sourceFilter.value.includes(order.source)) {
      return false
    }
    // Payment filter
    if (!paymentFilter.value.includes('all') && !paymentFilter.value.includes(order.payment_status)) {
      return false
    }
    // Search filter
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

  // Sort orders (only in table view)
  if (viewMode.value === 'table') {
    filtered = [...filtered].sort((a, b) => {
      switch (orderBy.value) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'due_date':
          // Get earliest due date from items
          const aDate = a.items
            .map((i) => i.due_date)
            .filter((d) => d)
            .sort()[0] || '9999-12-31'
          const bDate = b.items
            .map((i) => i.due_date)
            .filter((d) => d)
            .sort()[0] || '9999-12-31'
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
    // Source filter (from parent order)
    if (!sourceFilter.value.includes('all') && !sourceFilter.value.includes(item.order.source)) {
      return false
    }
    // Payment filter (from parent order)
    if (!paymentFilter.value.includes('all') && !paymentFilter.value.includes(item.order.payment_status)) {
      return false
    }
    // Printshop filter
    if (!printshopFilter.value.includes('all')) {
      if (printshopFilter.value.includes('unassigned')) {
        if (item.assigned_printshop !== null) return false
      } else {
        if (!printshopFilter.value.includes(item.assigned_printshop || '')) return false
      }
    }
    // Search filter (skip for kanban view - it has its own search dropdown)
    if (searchQuery.value && viewMode.value !== 'kanban') {
      const query = searchQuery.value.toLowerCase()
      const matchesProduct = item.product_name.toLowerCase().includes(query)
      const matchesOrderId = (item.order.external_id || item.order.id).toLowerCase().includes(query)
      const matchesCustomer = item.customer.name.toLowerCase().includes(query)
      const matchesCompany = item.customer.company?.toLowerCase().includes(query)

      if (!matchesProduct && !matchesOrderId && !matchesCustomer && !matchesCompany) {
        return false
      }
    }
    return true
  })
})

// Kanban search results (for dropdown)
const kanbanSearchResults = computed(() => {
  if (!searchQuery.value || viewMode.value !== 'kanban') return []

  const query = searchQuery.value.toLowerCase()
  return allItems.value.filter((item) => {
    const matchesProduct = item.product_name.toLowerCase().includes(query)
    const matchesOrderId = (item.order.external_id || item.order.id).toLowerCase().includes(query)
    const matchesCustomer = item.customer.name.toLowerCase().includes(query)
    const matchesCompany = item.customer.company?.toLowerCase().includes(query)

    return matchesProduct || matchesOrderId || matchesCustomer || matchesCompany
  }).slice(0, 10) // Limit to 10 results
})

// Badge variant helpers
const getStatusVariant = (
  status: ItemStatus | 'mixed'
): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' => {
  switch (status) {
    case 'new':
      return 'info'
    case 'assigned':
    case 'in_production':
      return 'warning'
    case 'on_hold':
      return 'secondary'
    case 'ready':
      return 'info'
    case 'out_for_delivery':
      return 'warning'
    case 'delivered':
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

const getPaymentVariant = (
  status: PaymentStatus
): 'success' | 'destructive' | 'warning' => {
  switch (status) {
    case 'paid':
      return 'success'
    case 'unpaid':
      return 'destructive'
    case 'partial':
      return 'warning'
  }
}

const formatStatus = (status: ItemStatus | 'mixed'): string => {
  if (status === 'mixed') return 'In Progress'
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatPayment = (status: PaymentStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const navigateToOrder = (orderId: string) => {
  openOrderDetail(orderId)
}

// Stats computations
const stats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Waiting production: items assigned but not yet in production
  const waitingProduction = allItems.value.filter(
    (item) => item.status === 'assigned'
  ).length

  // In production: items currently being produced
  const inProduction = allItems.value.filter(
    (item) => item.status === 'in_production'
  ).length

  // Production late: items past due date that aren't ready/delivered/picked up
  const productionLate = allItems.value.filter((item) => {
    if (!item.due_date) return false
    const dueDate = new Date(item.due_date)
    const notComplete = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
    return dueDate < today && notComplete
  }).length

  // Ready for pickup: items ready but not yet out for delivery
  const readyForDelivery = allItems.value.filter(
    (item) => item.status === 'ready' && item.order.delivery_method === 'delivery'
  ).length

  // Out for delivery: items currently being delivered
  const outForDelivery = allItems.value.filter(
    (item) => item.status === 'out_for_delivery'
  ).length

  // Delivery late: items that should have been delivered but haven't
  const deliveryLate = orders.value.filter((order) => {
    if (!order.delivery_date) return false
    const deliveryDate = new Date(order.delivery_date)
    const hasUndelivered = order.items.some(
      (item) => !['delivered', 'picked_up'].includes(item.status)
    )
    return deliveryDate < today && hasUndelivered
  }).length

  // Unpaid: orders with payment_status = unpaid or partial
  const unpaid = orders.value.filter(
    (o) => o.payment_status === 'unpaid' || o.payment_status === 'partial'
  ).length

  // Unassigned: items with no printshop or new status
  const unassigned = allItems.value.filter(
    (item) => !item.assigned_printshop || item.status === 'new'
  ).length

  // Completed delivery: items delivered or picked up
  const completedDelivery = allItems.value.filter(
    (item) => item.status === 'delivered' || item.status === 'picked_up'
  ).length

  return {
    waitingProduction,
    inProduction,
    productionLate,
    readyForDelivery,
    outForDelivery,
    deliveryLate,
    unpaid,
    unassigned,
    completedDelivery,
  }
})

// Filtered stats sheet items based on search
const filteredStatsSheetItems = computed(() => {
  if (!statsSheetSearchQuery.value.trim()) {
    return statsSheetItems.value
  }

  const query = statsSheetSearchQuery.value.toLowerCase()
  return statsSheetItems.value.filter((item) => {
    // Search in product name
    if (item.product_name.toLowerCase().includes(query)) return true

    // Search in description
    if (item.description?.toLowerCase().includes(query)) return true

    // Search in customer name
    if (item.customer.name.toLowerCase().includes(query)) return true

    // Search in company name
    if (item.customer.company?.toLowerCase().includes(query)) return true

    // Search in order ID
    if (item.order.external_id?.toLowerCase().includes(query)) return true
    if (item.order.id.toLowerCase().includes(query)) return true

    // Search in printshop name
    if (item.assigned_printshop) {
      const shop = printshops.find((s) => s.id === item.assigned_printshop)
      if (shop?.name.toLowerCase().includes(query)) return true
    }

    return false
  })
})

// Stats sheet handlers
const showStatsSheet = (type: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (type) {
    case 'waitingProduction':
      statsSheetTitle.value = 'Waiting Production Items'
      statsSheetItems.value = allItems.value.filter(
        (item) => item.status === 'assigned'
      )
      break
    case 'inProduction':
      statsSheetTitle.value = 'In Production Items'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'in_production')
      break
    case 'productionLate':
      statsSheetTitle.value = 'Late Items'
      statsSheetItems.value = allItems.value.filter((item) => {
        if (!item.due_date) return false
        const dueDate = new Date(item.due_date)
        const notComplete = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
        return dueDate < today && notComplete
      })
      break
    case 'readyForDelivery':
      statsSheetTitle.value = 'Waiting for Pickup'
      statsSheetItems.value = allItems.value.filter((item) => {
        const order = orders.value.find((o) => o.id === item.order_id)
        return item.status === 'ready' && order?.delivery_method === 'delivery'
      })
      break
    case 'outForDelivery':
      statsSheetTitle.value = 'Out for Delivery'
      statsSheetItems.value = allItems.value.filter((item) => item.status === 'out_for_delivery')
      break
    case 'deliveryLate':
      statsSheetTitle.value = 'Late Delivery Items'
      statsSheetItems.value = allItems.value.filter((item) => {
        const order = orders.value.find((o) => o.id === item.order_id)
        if (!order?.delivery_date) return false
        const deliveryDate = new Date(order.delivery_date)
        const notDelivered = !['delivered', 'picked_up'].includes(item.status)
        return deliveryDate < today && notDelivered
      })
      break
    case 'completedDelivery':
      statsSheetTitle.value = 'Completed Delivery Items'
      statsSheetItems.value = allItems.value.filter(
        (item) => item.status === 'delivered' || item.status === 'picked_up'
      )
      break
    case 'unpaid':
      statsSheetTitle.value = 'Unpaid Orders'
      statsSheetItems.value = allItems.value.filter((item) => {
        const order = orders.value.find((o) => o.id === item.order_id)
        return order?.payment_status === 'unpaid' || order?.payment_status === 'partial'
      })
      break
    case 'unassigned':
      statsSheetTitle.value = 'Unassigned Items'
      statsSheetItems.value = allItems.value.filter(
        (item) => !item.assigned_printshop || item.status === 'new'
      )
      break
  }

  statsSheetSearchQuery.value = ''
  isStatsSheetOpen.value = true
}

// Kanban columns (for items)
const kanbanColumns = [
  { id: 'new', title: 'New', status: 'new' as ItemStatus, printshop: null },
  { id: 'in-house', title: 'In House', status: 'assigned' as ItemStatus, printshop: 'in-house' },
  { id: 'victor', title: 'Victor', status: 'assigned' as ItemStatus, printshop: 'victor' },
  { id: 'in_production', title: 'In Production', status: 'in_production' as ItemStatus, printshop: null },
  { id: 'on_hold', title: 'On Hold', status: 'on_hold' as ItemStatus, printshop: null },
  { id: 'ready', title: 'Ready', status: 'ready' as ItemStatus, printshop: null },
  { id: 'out_for_delivery', title: 'Out for Delivery', status: 'out_for_delivery' as ItemStatus, printshop: null },
  { id: 'delivered', title: 'Delivered', status: 'delivered' as ItemStatus, printshop: null },
  { id: 'picked_up', title: 'Picked Up', status: 'picked_up' as ItemStatus, printshop: null },
  { id: 'canceled', title: 'Canceled', status: 'canceled' as ItemStatus, printshop: null },
]

const kanbanColumnOptions = [
  { value: 'all', label: 'All Columns' },
  ...kanbanColumns.map(col => ({ value: col.id, label: col.title }))
]

const visibleKanbanColumns = computed(() => {
  if (kanbanColumnsFilter.value.includes('all')) {
    return kanbanColumns
  }
  return kanbanColumns.filter(col => kanbanColumnsFilter.value.includes(col.id))
})

const getColumnItems = (status: ItemStatus, printshop: string | null = null) => {
  return filteredItems.value.filter((item) => {
    if (printshop) {
      // For printshop columns, filter by status AND printshop
      return item.status === status && item.assigned_printshop === printshop
    }
    // For regular columns, filter by status only
    return item.status === status
  })
}

// Helper to check if item is overdue
const isOverdue = (item: OrderItemWithDetails): boolean => {
  if (!item.due_date) return false
  const dueDate = new Date(item.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const notReady = !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(item.status)
  return dueDate < today && notReady
}

// Helper to format printshop name
const formatPrintshop = (printshopId: string | null): string => {
  if (!printshopId) return 'Unassigned'
  const shop = printshops.find((s) => s.id === printshopId)
  return shop ? shop.name : 'Unknown'
}

// Helper to format due date
const formatDueDate = (dateString: string | null): string => {
  if (!dateString) return 'No due date'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper to format relative due date based on status
const formatRelativeDueDate = (item: OrderItemWithDetails): { text: string; isOverdue: boolean } => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const calculateDaysFromNow = (dateString: string) => {
    const date = new Date(dateString)
    date.setHours(0, 0, 0, 0)
    const diffTime = date.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const calculateDaysAgo = (dateString: string) => {
    const date = new Date(dateString)
    date.setHours(0, 0, 0, 0)
    const diffTime = today.getTime() - date.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // If item is new or unassigned, show "Order received X days ago"
  if (item.status === 'new' || !item.assigned_printshop) {
    const receivedDays = calculateDaysAgo(item.order.created_at)
    return { text: `Order received ${receivedDays} ${receivedDays === 1 ? 'day' : 'days'} ago`, isOverdue: false }
  }

  switch (item.status) {
    case 'assigned':
    case 'in_production':
      if (!item.due_date) return { text: 'No due date', isOverdue: false }
      const dueDays = calculateDaysFromNow(item.due_date)
      if (dueDays < 0) {
        const daysAgo = Math.abs(dueDays)
        return { text: `due ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`, isOverdue: true }
      } else if (dueDays === 0) {
        return { text: 'due today', isOverdue: false }
      } else {
        return { text: `due in ${dueDays} ${dueDays === 1 ? 'day' : 'days'}`, isOverdue: false }
      }

    case 'on_hold':
      const createdDays = calculateDaysAgo(item.order.created_at)
      return { text: `created ${createdDays} ${createdDays === 1 ? 'day' : 'days'} ago`, isOverdue: false }

    case 'ready':
      return { text: 'Waiting delivery/pickup', isOverdue: false }

    case 'out_for_delivery':
      if (item.order.delivery_date) {
        const deliveryDays = calculateDaysFromNow(item.order.delivery_date)
        if (deliveryDays < 0) {
          const daysAgo = Math.abs(deliveryDays)
          return { text: `should have been delivered ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`, isOverdue: true }
        } else if (deliveryDays === 0) {
          return { text: 'To be delivered today', isOverdue: false }
        } else {
          return { text: `To be delivered in ${deliveryDays} ${deliveryDays === 1 ? 'day' : 'days'}`, isOverdue: false }
        }
      }
      return { text: 'Out for delivery', isOverdue: false }

    case 'delivered':
      if (item.order.delivery_date) {
        const deliveredDays = calculateDaysAgo(item.order.delivery_date)
        return { text: `Delivered ${deliveredDays} ${deliveredDays === 1 ? 'day' : 'days'} ago`, isOverdue: false }
      }
      return { text: 'Delivered', isOverdue: false }

    case 'picked_up':
      if (item.due_date) {
        const pickedUpDays = calculateDaysAgo(item.due_date)
        return { text: `Picked up ${pickedUpDays} ${pickedUpDays === 1 ? 'day' : 'days'} ago`, isOverdue: false }
      }
      return { text: 'Picked up', isOverdue: false }

    case 'canceled':
      const canceledDays = calculateDaysAgo(item.order.created_at)
      return { text: `Canceled ${canceledDays} ${canceledDays === 1 ? 'day' : 'days'} ago`, isOverdue: false }

    default:
      return { text: 'No date', isOverdue: false }
  }
}
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
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0 pb-10">
      <!-- Manager Card -->
      <Card>
        <CardHeader class="pb-0">
          <div class="flex items-center gap-4">
            <div class="rounded-lg bg-blue-100 dark:bg-blue-950 p-2">
              <svg class="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <CardTitle class="text-sm">Manager</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="space-y-2">
          <div @click="showStatsSheet('unassigned')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <Package class="h-3.5 w-3.5" />
              <span class="text-xs">Unassigned items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.unassigned }}</span>
          </div>
          <div @click="showStatsSheet('unpaid')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <DollarSign class="h-3.5 w-3.5" />
              <span class="text-xs">Unpaid orders</span>
            </div>
            <span class="text-xs font-medium">{{ stats.unpaid }}</span>
          </div>
          <div @click="showStatsSheet('completedDelivery')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <CheckCircle class="h-3.5 w-3.5" />
              <span class="text-xs">Completed delivery items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.completedDelivery }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- Production Card -->
      <Card>
        <CardHeader class="pb-0">
          <div class="flex items-center gap-4">
            <div class="rounded-lg bg-purple-100 dark:bg-purple-950 p-2">
              <svg class="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <CardTitle class="text-sm">Production</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="space-y-2">
          <div @click="showStatsSheet('waitingProduction')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <Clock class="h-3.5 w-3.5" />
              <span class="text-xs">Waiting production items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.waitingProduction }}</span>
          </div>
          <div @click="showStatsSheet('inProduction')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <Settings class="h-3.5 w-3.5" />
              <span class="text-xs">In production items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.inProduction }}</span>
          </div>
          <div @click="showStatsSheet('productionLate')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <AlertCircle class="h-3.5 w-3.5" />
              <span class="text-xs">Late items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.productionLate }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- Delivery Card -->
      <Card>
        <CardHeader class="pb-0">
          <div class="flex items-center gap-4">
            <div class="rounded-lg bg-green-100 dark:bg-green-950 p-2">
              <svg class="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="1" y="3" width="15" height="13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M16 8h5l3 3v5h-2m-4 0H2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="5.5" cy="18.5" r="2.5" stroke-width="2" />
                <circle cx="18.5" cy="18.5" r="2.5" stroke-width="2" />
              </svg>
            </div>
            <CardTitle class="text-sm">Delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="space-y-2">
          <div @click="showStatsSheet('readyForDelivery')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <Package class="h-3.5 w-3.5" />
              <span class="text-xs">Waiting for pickup items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.readyForDelivery }}</span>
          </div>
          <div @click="showStatsSheet('outForDelivery')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <Truck class="h-3.5 w-3.5" />
              <span class="text-xs">Out for delivery items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.outForDelivery }}</span>
          </div>
          <div @click="showStatsSheet('deliveryLate')" class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border">
            <div class="flex items-center gap-4">
              <AlertCircle class="h-3.5 w-3.5" />
              <span class="text-xs">Late delivery items</span>
            </div>
            <span class="text-xs font-medium">{{ stats.deliveryLate }}</span>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Row 3: Filters, Search, and View Toggle -->
    <div class="flex items-end gap-4 flex-shrink-0">
      <!-- Filters -->
      <div class="flex gap-3">
        <!-- Table view filters -->
        <template v-if="viewMode === 'table'">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Status</label>
            <FilterSelect
              v-model="statusFilter"
              :options="statusOptions"
              :multiple="true"
              class="w-40"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Source</label>
            <FilterSelect
              v-model="sourceFilter"
              :options="sourceOptions"
              :multiple="true"
              class="w-40"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Payment</label>
            <FilterSelect
              v-model="paymentFilter"
              :options="paymentOptions"
              :multiple="true"
              class="w-40"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Order By</label>
            <FilterSelect
              v-model="orderBy"
              :options="orderByOptions"
              class="w-40"
            />
          </div>
        </template>

        <!-- Kanban view filters -->
        <template v-else>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Columns</label>
            <FilterSelect
              v-model="kanbanColumnsFilter"
              :options="kanbanColumnOptions"
              :multiple="true"
              class="w-40"
            />
          </div>
        </template>
      </div>

      <!-- Search Input with Results Dropdown -->
      <div class="relative flex-1">
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Search orders, customers, products..."
          class="w-full"
        />

        <!-- Kanban Search Results Dropdown -->
        <div
          v-if="viewMode === 'kanban' && kanbanSearchResults.length > 0"
          class="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-lg border bg-popover shadow-lg"
        >
          <div
            v-for="item in kanbanSearchResults"
            :key="item.id"
            @click="navigateToOrder(item.order_id); searchQuery = ''"
            class="cursor-pointer border-b p-3 transition-colors hover:bg-accent"
          >
            <div class="font-medium text-sm">{{ item.product_name }}</div>
            <div class="text-xs text-muted-foreground mt-1">
              {{ item.customer.name }} • Qty: {{ item.quantity }}
            </div>
            <div class="flex gap-1 mt-1">
              <Badge variant="outline" class="text-[10px] px-1.5 py-0">
                {{ formatPrintshop(item.assigned_printshop) }}
              </Badge>
              <Badge :variant="getPaymentVariant(item.order.payment_status)" class="text-[10px] px-1.5 py-0">
                {{ formatPayment(item.order.payment_status) }}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <!-- View Toggle -->
      <ViewToggle
        v-model="viewMode"
        :options="viewOptions"
        storage-key="kroma_manager_orders_view"
      />
    </div>

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
          <div class="space-y-2">
            <!-- Items List -->
            <div class="space-y-2">
              <div
                v-for="item in row.original.items"
                :key="item.id"
                class="rounded-lg border bg-background px-4 py-3"
              >
                <div class="grid grid-cols-4 gap-10">
                  <!-- Column 1: Item Details -->
                  <div>
                    <div class="font-semibold text-base mb-1">{{ item.product_name }}</div>
                    <div class="text-sm text-muted-foreground mb-1">{{ item.description }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ item.quantity }}x
                      <template v-if="item.specs && Object.keys(item.specs).length > 0">
                        <span v-for="(value, key) in item.specs" :key="key">
                          • {{ key }}: {{ value }}
                        </span>
                      </template>
                    </div>
                  </div>

                  <!-- Column 2: Controls -->
                  <div class="space-y-3">
                    <div>
                      <label class="text-xs text-muted-foreground mb-1 block">Printshop</label>
                      <FilterSelect
                        :model-value="item.assigned_printshop || ''"
                        :options="[{ value: '', label: 'Unassigned' }, ...printshops.map(s => ({ value: s.id, label: s.name }))]"
                        @update:model-value="(value: string | string[]) => updateItemPrintshop(item.id, (typeof value === 'string' ? value : value[0]) || null)"
                        class="w-full text-xs"
                      />
                    </div>
                    <div>
                      <label class="text-xs text-muted-foreground mb-1 block">Status</label>
                      <ItemStatusCombobox
                        :model-value="item.status"
                        :item-id="item.id"
                        @update:model-value="updateItemStatus"
                      />
                    </div>
                  </div>

                  <!-- Column 3: Timeline -->
                  <div class="space-y-2 text-xs">
                    <label class="text-xs text-muted-foreground mb-1 block">Timeline</label>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Received:</span>
                      <span class="font-medium">{{ formatDate(row.original.created_at) }}</span>
                    </div>
                    <div v-if="item.due_date" class="flex justify-between">
                      <span class="text-muted-foreground">Due:</span>
                      <span class="font-medium" :class="isOverdue({ ...item, order: row.original, customer: row.original.customer }) ? 'text-red-600' : ''">{{ formatDate(item.due_date) }}</span>
                    </div>
                    <div v-if="row.original.delivery_date" class="flex justify-between">
                      <span class="text-muted-foreground">Delivery:</span>
                      <span class="font-medium">{{ formatDate(row.original.delivery_date) }}</span>
                    </div>
                    <div v-if="item.production_start_date" class="flex justify-between">
                      <span class="text-muted-foreground">Started:</span>
                      <span class="font-medium">{{ formatDate(item.production_start_date) }}</span>
                    </div>
                    <div v-if="item.production_ready_date" class="flex justify-between">
                      <span class="text-muted-foreground">Ready:</span>
                      <span class="font-medium">{{ formatDate(item.production_ready_date) }}</span>
                    </div>
                    <div class="pt-2 border-t">
                      <span
                        class="text-xs"
                        :class="formatRelativeDueDate({ ...item, order: row.original, customer: row.original.customer }).isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'"
                      >
                        {{ formatRelativeDueDate({ ...item, order: row.original, customer: row.original.customer }).text }}
                      </span>
                    </div>
                  </div>

                  <!-- Column 4: Files & Comments -->
                  <div class="space-y-3">
                    <div>
                      <label class="text-xs text-muted-foreground mb-1 block">Files</label>
                      <div class="flex items-center gap-2 text-xs">
                        <FileText class="h-4 w-4 text-muted-foreground" />
                        <span class="text-muted-foreground">{{ row.original.files_count || 0 }} file(s)</span>
                      </div>
                    </div>
                    <div>
                      <label class="text-xs text-muted-foreground mb-1 block">Comments</label>
                      <div class="flex items-center gap-2 text-xs">
                        <MessageSquare class="h-4 w-4 text-muted-foreground" />
                        <span class="text-muted-foreground">{{ row.original.comments_count || 0 }} comment(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Kanban View -->
    <div v-if="viewMode === 'kanban'" class="flex-1 min-h-0 overflow-hidden max-w-full">
      <div class="h-full overflow-x-auto max-w-full">
        <div class="flex h-full gap-4 pb-4 w-max">
        <!-- Column -->
        <div
          v-for="column in visibleKanbanColumns"
          :key="column.id"
          class="flex flex-col rounded-lg border bg-muted/50 transition-all flex-shrink-0 w-[240px]"
        >
          <!-- Column Header -->
          <div class="border-b bg-background p-2 rounded-t-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">{{ column.title }}</h3>
              <Badge variant="secondary" class="text-xs px-1.5 py-0">
                {{ getColumnItems(column.status, column.printshop).length }}
              </Badge>
            </div>
          </div>

          <!-- Column Items -->
          <div
            @dragover="handleDragOver"
            @drop="handleDrop(column.status, column.printshop)"
            class="flex-1 space-y-2 overflow-auto p-2 transition-colors"
            :class="{ 'bg-accent/20': draggedItemId }"
          >
            <div
              v-for="item in getColumnItems(column.status, column.printshop)"
              :key="item.id"
              draggable="true"
              @dragstart="handleDragStart(item.id)"
              @dragend="handleDragEnd"
              @click="navigateToOrder(item.order_id)"
              class="cursor-move rounded-lg border bg-background p-2 shadow-sm transition-all hover:shadow-md space-y-1"
              :class="{ 'opacity-50': draggedItemId === item.id }"
            >
              <!-- Line 1: Item title -->
              <div class="text-sm font-semibold truncate">{{ item.product_name }}</div>

              <!-- Line 2: Printshop | Due date -->
              <div class="flex items-center justify-between text-[10px]">
                <span class="text-muted-foreground truncate">{{ formatPrintshop(item.assigned_printshop) }}</span>
                <span class="text-muted-foreground" :class="isOverdue(item) ? 'text-red-600 font-semibold' : ''">
                  {{ item.due_date ? formatDueDate(item.due_date) : 'No due date' }}
                </span>
              </div>

              <!-- Line 3: Quantity -->
              <div class="text-xs text-muted-foreground">
                Qty: {{ item.quantity }}
              </div>

              <!-- Line 4: Order number -->
              <div class="text-xs text-muted-foreground truncate">
                #{{ item.order.external_id || item.order.id.slice(0, 8) }}
              </div>

              <!-- Line 5: Client | Payment -->
              <div class="flex items-center justify-between text-[10px]">
                <span class="text-muted-foreground truncate flex-1 mr-1">{{ item.customer.name }}</span>
                <Badge :variant="getPaymentVariant(item.order.payment_status)" class="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {{ formatPayment(item.order.payment_status) }}
                </Badge>
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="getColumnItems(column.status, column.printshop).length === 0"
              class="flex h-32 items-center justify-center text-sm text-muted-foreground"
            >
              No items
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    </div>
    <!-- End Main Content -->

    <!-- Right Sidebar: Activity Feed -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background overflow-y-auto">
      <ActivityFeed :activities="activities" @activity-click="handleActivityClick" @toggle-seen="handleToggleSeen" />
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
    <Sheet :open="isStatsSheetOpen" @update:open="isStatsSheetOpen = $event" :title="statsSheetTitle" side="left">
      <div class="flex flex-col h-full">
        <!-- Search Input -->
        <div class="p-4 border-b bg-background">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="statsSheetSearchQuery"
              type="text"
              placeholder="Search items..."
              class="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <!-- Items List -->
        <div class="flex-1 overflow-auto p-4">
          <div v-if="filteredStatsSheetItems.length === 0" class="text-center text-muted-foreground py-8">
            {{ statsSheetSearchQuery ? 'No items match your search' : 'No items found.' }}
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in filteredStatsSheetItems"
              :key="item.id"
              class="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              @click="openOrderDetail(item.order_id)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-semibold text-lg mb-1">{{ item.product_name }}</div>
                  <div class="text-sm text-muted-foreground mb-2">{{ item.description }}</div>
                  <div class="flex flex-wrap gap-2">
                    <Badge variant="outline">{{ item.customer.name }}</Badge>
                    <Badge variant="outline">Qty: {{ item.quantity }}</Badge>
                    <Badge variant="outline">{{ item.assigned_printshop ? formatPrintshop(item.assigned_printshop) : 'Unassigned' }}</Badge>
                    <Badge :variant="getStatusVariant(item.status)">{{ formatStatus(item.status) }}</Badge>
                    <Badge v-if="item.due_date" variant="outline">Due: {{ formatDate(item.due_date) }}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Sheet>

    <!-- Assignment Confirmation Dialog -->
    <Dialog :open="isAssignDialogOpen" @update:open="isAssignDialogOpen = $event">
      <div class="p-6">
        <h2 class="text-xl font-semibold mb-4">Confirm Assignment</h2>
        <p class="text-muted-foreground mb-6" v-if="pendingAssignment">
          Assign <span class="font-medium text-foreground">{{ pendingAssignment.itemName }}</span> to <span class="font-medium text-foreground">{{ pendingAssignment.printshopName }}</span>?
        </p>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="cancelAssignment">Cancel</Button>
          <Button @click="confirmAssignment">Confirm</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.text-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
</style>
