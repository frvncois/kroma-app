<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOrders } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { useOrderStore } from '@/stores/orders'
import { useActivityStore } from '@/stores/activities'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { OrderItem, ItemStatus, Printshop, Customer } from '@/types'
import type { OrderWithDetails } from '@/composables/useOrders'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import { driverStatusOptions } from '@/lib/constants'
import { formatDistanceToNow } from 'date-fns'
import { formatStatus, formatSource } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import DriverItemList from '@/components/DriverItemList.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import OrderFilters from '@/components/OrderFilters.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import StatsCards from '@/components/StatsCards.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  Navigation,
  ArrowLeft,
  MapPin,
  Truck,
  CheckCircle2,
  Camera,
  Package,
  Settings,
  AlertCircle,
  User,
  Phone,
  AlertTriangle,
  XCircle
} from 'lucide-vue-next'

const orderStore = useOrderStore()
const activityStore = useActivityStore()
const authStore = useAuthStore()
const { updateItemStatus } = useOrders()
const { getPrintshopById } = usePrintshops()
const { toast } = useToast()

// Orders eligible for delivery
// Note: An order is shown if it has at least ONE item that's ready/out_for_delivery
// When building route stops, we filter to only include those specific items
const deliverableOrders = computed(() => {
  return orderStore.ordersWithDetails.filter(order => {
    if (order.delivery_method !== 'delivery') return false
    return order.items.some(item =>
      item.status === 'ready' || item.status === 'out_for_delivery'
    )
  })
})

// Recently delivered orders (last 24h)
const recentlyDelivered = computed(() => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return orderStore.ordersWithDetails.filter(order => {
    if (order.delivery_method !== 'delivery') return false
    return order.items.every(item => item.status === 'delivered') &&
      order.items.some(item => item.delivery_date && item.delivery_date > oneDayAgo)
  })
})

// Filters
const statusFilter = ref<string[]>(['all'])
const orderBy = ref('newest')
const searchQuery = ref('')

const filterConfigs = [
  { key: 'status', label: 'Status', options: driverStatusOptions },
  { key: 'orderBy', label: 'Order By', options: [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ]},
]

// Route state
const selectedOrderIds = ref<Set<string>>(new Set())
const routeActive = ref(false)

// Route stop interface
interface RouteStop {
  id: string
  type: 'pickup' | 'dropoff'
  status: 'pending' | 'current' | 'completed'
  printshop?: Printshop
  order?: OrderWithDetails
  customer?: Customer
  address: string
  items: OrderItemWithDetails[]
  note: string
  photos: string[]
  hasIssue: boolean
  cancelled: boolean
}

const routeStops = ref<RouteStop[]>([])
const currentStopIndex = ref(0)

const currentStop = computed(() => routeStops.value[currentStopIndex.value])

// Activities filtered to delivery-related
const filteredActivities = computed(() => {
  return activityStore.allActivities.filter(a =>
    a.type === 'delivery' || a.type === 'pickup' ||
    (a.type === 'status_change' && a.details.to &&
      ['Out For Delivery', 'Delivered', 'Picked Up'].includes(a.details.to))
  )
})

// Order detail sheet
const selectedOrderId = ref<string | null>(null)
const isSheetOpen = ref(false)

const openOrderDetail = (orderId: string) => {
  selectedOrderId.value = orderId
  isSheetOpen.value = true
}

// Issue reporting modal
const isIssueModalOpen = ref(false)
const issueNote = ref('')
const issueStatus = ref<ItemStatus>('on_hold')
const issuePhotos = ref<string[]>([])

const openIssueModal = () => {
  issueNote.value = ''
  issueStatus.value = 'on_hold'
  issuePhotos.value = []
  isIssueModalOpen.value = true
}

const addIssuePhoto = () => {
  // Mock photo upload - in Phase 2, this will use Supabase Storage
  const photoId = `issue-photo-${Date.now()}.jpg`
  issuePhotos.value.push(photoId)
  toast({ title: 'Photo added', description: 'Photo will be attached to the issue report' })
}

const removeIssuePhoto = (index: number) => {
  issuePhotos.value.splice(index, 1)
}

// Selection handlers
const toggleSelect = (orderId: string) => {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId)
  } else {
    selectedOrderIds.value.add(orderId)
  }
}

const selectAll = () => {
  deliverableOrders.value.forEach(o => selectedOrderIds.value.add(o.id))
}

const deselectAll = () => {
  selectedOrderIds.value.clear()
}

// Build route stops
const buildRouteStops = () => {
  const stops: RouteStop[] = []
  const selectedOrders = [...selectedOrderIds.value]
    .map(id => orderStore.getOrderById(id))
    .filter(Boolean) as OrderWithDetails[]

  // Group items by printshop for pickups (only ready/out_for_delivery items)
  const shopItems = new Map<string, { printshop: Printshop, items: OrderItemWithDetails[] }>()
  for (const order of selectedOrders) {
    for (const item of order.items) {
      // Only include items that are ready or out for delivery
      if ((item.status === 'ready' || item.status === 'out_for_delivery') && item.assigned_printshop) {
        const shop = getPrintshopById(item.assigned_printshop)
        if (shop) {
          if (!shopItems.has(shop.id)) {
            shopItems.set(shop.id, { printshop: shop, items: [] })
          }
          // Enrich item with order and customer
          const enrichedItem: OrderItemWithDetails = {
            ...item,
            order,
            customer: order.customer
          }
          shopItems.get(shop.id)!.items.push(enrichedItem)
        }
      }
    }
  }

  // Create pickup stops
  for (const [, data] of shopItems) {
    stops.push({
      id: `pickup-${data.printshop.id}`,
      type: 'pickup',
      status: 'pending',
      printshop: data.printshop,
      address: data.printshop.address,
      items: data.items,
      note: '',
      photos: [],
      hasIssue: false,
      cancelled: false,
    })
  }

  // Create dropoff stops (only include ready/out_for_delivery items)
  for (const order of selectedOrders) {
    const enrichedItems: OrderItemWithDetails[] = order.items
      .filter(item => item.status === 'ready' || item.status === 'out_for_delivery')
      .map(item => ({
        ...item,
        order,
        customer: order.customer
      }))

    // Only create a dropoff stop if there are deliverable items
    if (enrichedItems.length > 0) {
      stops.push({
        id: `dropoff-${order.id}`,
        type: 'dropoff',
        status: 'pending',
        order,
        customer: order.customer,
        address: order.customer.address,
        items: enrichedItems,
        note: '',
        photos: [],
        hasIssue: false,
        cancelled: false,
      })
    }
  }

  // Mark first stop as current
  if (stops.length > 0 && stops[0]) stops[0].status = 'current'

  routeStops.value = stops
  currentStopIndex.value = 0
}

// Start route
const startRoute = () => {
  if (selectedOrderIds.value.size === 0) return

  buildRouteStops()

  // Mark all items as out_for_delivery
  for (const orderId of selectedOrderIds.value) {
    const order = orderStore.getOrderById(orderId)
    if (order) {
      order.items.forEach(item => {
        if (item.status === 'ready') {
          updateItemStatus(item.id, 'out_for_delivery')
        }
      })
    }
  }

  routeActive.value = true
  toast({ title: 'Route started', description: `${selectedOrderIds.value.size} orders on route` })
}

// Complete current stop
const completeCurrentStop = () => {
  const stop = routeStops.value[currentStopIndex.value]
  if (!stop) return

  stop.status = 'completed'

  if (stop.type === 'dropoff') {
    // Mark all items as delivered
    stop.items.forEach(item => {
      updateItemStatus(item.id, 'delivered')
    })
    toast({
      title: 'Delivery completed',
      description: `Delivered to ${stop.customer?.name}`
    })
  } else {
    toast({
      title: 'Pickup completed',
      description: `Picked up from ${stop.printshop?.name}`
    })
  }

  // Auto-advance to next pending stop
  const nextIndex = routeStops.value.findIndex((s, i) => i > currentStopIndex.value && s.status !== 'completed')
  if (nextIndex !== -1) {
    currentStopIndex.value = nextIndex
    const nextStop = routeStops.value[nextIndex]
    if (nextStop) {
      nextStop.status = 'current'
    }
  } else {
    toast({
      title: 'Route completed! 🎉',
      description: 'All stops have been completed'
    })
  }
}

// Submit issue report
const submitIssue = () => {
  const stop = routeStops.value[currentStopIndex.value]
  if (!stop || !issueNote.value.trim()) return

  // 1. Build note with driver context and status label
  const statusLabels: Record<ItemStatus, string> = {
    delivered: 'DELIVERED WITH ISSUE',
    canceled: 'CANCELLED',
    on_hold: 'ON HOLD',
    new: 'NEW',
    assigned: 'ASSIGNED',
    in_production: 'IN PRODUCTION',
    ready: 'READY',
    out_for_delivery: 'OUT FOR DELIVERY',
    picked_up: 'PICKED UP'
  }

  const notePrefix = `[ISSUE - ${stop.type === 'pickup' ? 'PICKUP' : 'DELIVERY'} ${statusLabels[issueStatus.value]}]`

  // 2. Create activity with the note
  if (stop.items.length > 0) {
    const firstItem = stop.items[0]
    if (!firstItem) return

    const order = stop.order || orderStore.ordersWithDetails.find(o =>
      o.items.some(i => i.id === firstItem.id)
    )

    // Add as a note_added activity
    activityStore.addActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'note_added',
      timestamp: new Date().toISOString(),
      user: authStore.currentUser?.name || 'Driver',
      seen: false,
      important: false,
      item: {
        id: firstItem.id,
        name: firstItem.product_name,
        orderId: firstItem.order_id,
      },
      order: order ? {
        id: order.id,
        externalId: order.external_id || undefined,
        customer: stop.customer?.name || order.customer?.name || 'Unknown',
      } : undefined,
      details: {
        message: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} issue reported by driver - Status: ${formatStatus(issueStatus.value)}${issuePhotos.value.length > 0 ? ` (${issuePhotos.value.length} photo${issuePhotos.value.length !== 1 ? 's' : ''} attached)` : ''}`,
        note: issueNote.value.trim(),
      },
    })
  }

  // 3. Attach photos to the stop
  if (issuePhotos.value.length > 0) {
    stop.photos.push(...issuePhotos.value)
  }

  // 4. Set all items at this stop to the selected status
  stop.items.forEach(item => {
    updateItemStatus(item.id, issueStatus.value)
  })

  // 5. Mark stop as completed (or cancelled if status is canceled/on_hold)
  stop.status = 'completed'
  stop.cancelled = issueStatus.value === 'canceled' || issueStatus.value === 'on_hold'

  // 6. Show appropriate toast
  const statusMessages: Record<ItemStatus, { title: string; description: string; variant?: 'default' | 'destructive' }> = {
    delivered: {
      title: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} completed with issue`,
      description: 'Items marked as delivered. Issue has been logged.',
    },
    canceled: {
      title: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} cancelled`,
      description: 'Items cancelled. Issue has been logged.',
      variant: 'destructive',
    },
    on_hold: {
      title: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} put on hold`,
      description: 'Items set to on hold. Issue has been logged.',
      variant: 'destructive',
    },
    new: { title: 'Status updated', description: 'Items set to new' },
    assigned: { title: 'Status updated', description: 'Items assigned' },
    in_production: { title: 'Status updated', description: 'Items in production' },
    ready: { title: 'Status updated', description: 'Items ready' },
    out_for_delivery: { title: 'Status updated', description: 'Items out for delivery' },
    picked_up: { title: 'Status updated', description: 'Items picked up' },
  }

  const message = statusMessages[issueStatus.value]
  toast({
    title: message.title,
    description: message.description,
    variant: message.variant,
  })

  // 7. Auto-advance to next stop
  const nextIndex = routeStops.value.findIndex((s, i) =>
    i > currentStopIndex.value && s.status !== 'completed'
  )
  if (nextIndex !== -1) {
    currentStopIndex.value = nextIndex
    const nextStop = routeStops.value[nextIndex]
    if (nextStop) {
      nextStop.status = 'current'
    }
  } else if (routeStops.value.every(s => s.status === 'completed')) {
    toast({ title: 'Route completed! 🎉', description: 'All stops handled' })
  }

  // 8. Close modal and clear form
  isIssueModalOpen.value = false
  issueNote.value = ''
  issuePhotos.value = []
}

// Cancel route
const confirmCancelRoute = () => {
  const hasCompleted = routeStops.value.some(s => s.status === 'completed')
  if (hasCompleted) {
    if (!confirm('Some stops are already completed. End the route?')) return
  }
  routeActive.value = false
  selectedOrderIds.value.clear()
  routeStops.value = []
  currentStopIndex.value = 0
}

// Mock photo upload
const mockAddPhoto = () => {
  const stop = routeStops.value[currentStopIndex.value]
  if (!stop) return

  stop.photos.push(`photo-${Date.now()}.jpg`)
  toast({ title: 'Photo added' })
}

// Jump to stop
const jumpToStop = (index: number) => {
  const currentStop = routeStops.value[currentStopIndex.value]
  if (currentStop?.status === 'current') {
    currentStop.status = 'pending'
  }
  currentStopIndex.value = index
  const newStop = routeStops.value[index]
  if (newStop) {
    newStop.status = 'current'
  }
}

const handleActivityClick = (orderId: string) => {
  openOrderDetail(orderId)
}

const handleToggleSeen = (activityId: string) => {
  activityStore.toggleSeen(activityId)
}

const handleToggleImportant = (activityId: string) => {
  activityStore.toggleImportant(activityId)
}

</script>

<template>
  <!-- QUEUE MODE -->
  <div v-if="!routeActive" class="h-full mr-80 overflow-hidden w-full">
    <div class="flex h-full flex-col space-y-10 p-10 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">Deliveries</h1>
          <p class="text-sm text-muted-foreground">
            {{ selectedOrderIds.size }} order{{ selectedOrderIds.size !== 1 ? 's' : '' }} selected
          </p>
        </div>
        <div class="flex gap-3">
          <Button
            size="lg"
            :disabled="selectedOrderIds.size === 0"
            @click="startRoute"
            class="gap-2"
          >
            <Navigation class="h-4 w-4" />
            Start Route ({{ selectedOrderIds.size }})
          </Button>
        </div>
      </div>

      <!-- Filters -->
      <OrderFilters
        v-model:status-filter="statusFilter"
        v-model:order-by="orderBy"
        v-model:search-query="searchQuery"
        :table-filters="filterConfigs"
      />

      <!-- Content -->
      <div class="flex-1 min-h-0 w-full overflow-auto">
        <DriverItemList
          :orders="deliverableOrders"
          :selected-ids="selectedOrderIds"
          @toggle-select="toggleSelect"
          @order-click="openOrderDetail"
          @select-all="selectAll"
          @deselect-all="deselectAll"
        />
      </div>
    </div>

    <!-- Activity Feed Sidebar -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background overflow-y-auto">
      <ActivityFeed
        :activities="filteredActivities"
        @activity-click="handleActivityClick"
        @toggle-seen="handleToggleSeen"
        @toggle-important="handleToggleImportant"
      />
    </div>
  </div>

  <!-- ROUTE MODE -->
  <div v-else class="h-full w-full overflow-hidden">
    <!-- Top Bar -->
    <div class="flex items-center justify-between border-b p-4 bg-background">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="sm" @click="confirmCancelRoute">
          <ArrowLeft class="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 class="text-lg font-semibold">Route in Progress</h2>
      </div>
      <div class="text-sm text-muted-foreground">
        Stop {{ currentStopIndex + 1 }} of {{ routeStops.length }}
      </div>
    </div>

    <!-- Route Content -->
    <div class="flex h-[calc(100vh-8rem)]">
      <!-- Left: Stop Progress List -->
      <div class="w-72 border-r overflow-y-auto p-4 space-y-2">
        <div
          v-for="(stop, i) in routeStops"
          :key="stop.id"
          @click="jumpToStop(i)"
          :class="[
            'p-3 rounded-lg border cursor-pointer transition-colors',
            stop.status === 'completed' ? 'bg-green-50 dark:bg-green-950/30 border-green-200' :
            stop.status === 'current' ? 'bg-accent border-primary ring-1 ring-primary' :
            'hover:bg-accent/50'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
              stop.cancelled ? 'bg-destructive text-destructive-foreground' :
              stop.status === 'completed' ? 'bg-green-500 text-white' :
              stop.status === 'current' ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            ]">
              <XCircle v-if="stop.cancelled" class="h-4 w-4" />
              <CheckCircle2 v-else-if="stop.status === 'completed'" class="h-4 w-4" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium flex items-center gap-1">
                <MapPin v-if="stop.type === 'pickup'" class="h-3 w-3 text-blue-500" />
                <Truck v-else class="h-3 w-3 text-green-500" />
                {{ stop.type === 'pickup' ? `Pickup: ${stop.printshop?.name}` : `Deliver: ${stop.customer?.name}` }}
                <AlertTriangle v-if="stop.hasIssue && stop.status !== 'completed'" class="h-3 w-3 text-amber-500 flex-shrink-0" />
              </div>
              <div class="text-xs text-muted-foreground truncate">{{ stop.address }}</div>
              <div class="text-xs text-muted-foreground">{{ stop.items.length }} item(s)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Current Stop Detail -->
      <div v-if="currentStop" class="flex-1 p-6 overflow-y-auto space-y-6">
        <!-- Stop Header -->
        <div>
          <Badge :variant="currentStop.type === 'pickup' ? 'default' : 'secondary'" class="mb-2">
            {{ currentStop.type === 'pickup' ? 'PICKUP' : 'DELIVERY' }}
          </Badge>
          <h2 class="text-2xl font-bold mb-1">
            {{ currentStop.type === 'pickup' ? currentStop.printshop?.name : currentStop.customer?.name }}
          </h2>
          <p class="text-muted-foreground mb-2">{{ currentStop.address }}</p>
        </div>

        <!-- Issue Banner -->
        <div v-if="currentStop.hasIssue" class="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-3 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span class="text-sm text-amber-700 dark:text-amber-300">An issue has been reported for this stop</span>
        </div>

        <!-- Customer Info (dropoff only) -->
        <Card v-if="currentStop.type === 'dropoff' && currentStop.customer">
          <CardContent class="p-4 space-y-3">
            <h3 class="text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Customer
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Name</Label>
                <div class="text-sm font-medium">{{ currentStop.customer.name }}</div>
                <div v-if="currentStop.customer.company" class="text-xs text-muted-foreground">
                  {{ currentStop.customer.company }}
                </div>
              </div>
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Contact</Label>
                <a :href="`tel:${currentStop.customer.phone}`" class="text-sm text-primary hover:underline flex items-center gap-1">
                  <Phone class="h-3 w-3" />
                  {{ currentStop.customer.phone }}
                </a>
                <a :href="`mailto:${currentStop.customer.email}`" class="text-xs text-muted-foreground hover:underline">
                  {{ currentStop.customer.email }}
                </a>
              </div>
              <div class="col-span-2">
                <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address</Label>
                <div class="text-sm">{{ currentStop.customer.address }}</div>
              </div>
              <div v-if="currentStop.customer.notes" class="col-span-2 border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-1 block">Customer Notes</Label>
                <div class="text-sm text-muted-foreground italic">{{ currentStop.customer.notes }}</div>
              </div>
            </div>
            <div v-if="currentStop.order" class="flex items-center gap-3 text-sm pt-2 border-t">
              <span class="font-medium">Order #{{ currentStop.order.external_id || currentStop.order.id.slice(0, 8) }}</span>
              <Badge variant="outline">{{ formatSource(currentStop.order.source) }}</Badge>
              <Badge variant="default">Delivery</Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Pickup Location Info (pickup only) -->
        <Card v-if="currentStop.type === 'pickup' && currentStop.printshop">
          <CardContent class="p-4 space-y-3">
            <h3 class="text-sm font-semibold flex items-center gap-2">
              <MapPin class="h-4 w-4" />
              Pickup Location
            </h3>
            <div class="text-sm font-medium">{{ currentStop.printshop.name }}</div>
            <div class="text-sm text-muted-foreground">{{ currentStop.printshop.address }}</div>
          </CardContent>
        </Card>

        <!-- Items at this Stop -->
        <Card>
          <CardContent class="p-0">
            <div
              v-for="item in currentStop.items"
              :key="item.id"
              class="flex items-center justify-between p-4 border-b last:border-0"
            >
              <div>
                <div class="text-sm font-medium">{{ item.product_name }}</div>
                <div class="text-xs text-muted-foreground">Qty: {{ item.quantity }}</div>
              </div>
              <Badge :variant="getStatusVariant(item.status)">{{ formatStatus(item.status) }}</Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Driver Note -->
        <div>
          <Label class="text-sm font-medium mb-2 block">Add Note</Label>
          <Textarea
            v-model="currentStop.note"
            placeholder="Any issues, customer instructions, access codes..."
            :rows="3"
          />
        </div>

        <!-- Photo Upload -->
        <div>
          <Label class="text-sm font-medium mb-2 block">Photos</Label>
          <div class="border-2 border-dashed rounded-lg p-8 text-center">
            <Camera class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p class="text-sm text-muted-foreground">Photo upload coming in Phase 2</p>
            <Button variant="outline" size="sm" class="mt-3" @click="mockAddPhoto">
              Simulate Photo
            </Button>
          </div>
          <div v-if="currentStop.photos.length" class="flex gap-2 mt-3">
            <div
              v-for="(photo, i) in currentStop.photos"
              :key="i"
              class="w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground"
            >
              📷 Photo {{ i + 1 }}
            </div>
          </div>
        </div>

        <!-- Complete Stop Button -->
        <div class="sticky bottom-0 bg-background pt-4 border-t space-y-3">
          <template v-if="currentStop.status !== 'completed'">
            <!-- Primary action -->
            <Button size="lg" class="w-full gap-2" @click="completeCurrentStop">
              <CheckCircle2 class="h-5 w-5" />
              {{ currentStop.type === 'pickup' ? 'Confirm Pickup' : 'Confirm Delivery' }}
            </Button>
            <!-- Report Issue -->
            <Button variant="outline" size="lg" class="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" @click="openIssueModal">
              <AlertTriangle class="h-5 w-5" />
              Report Issue
            </Button>
          </template>
          <div v-else class="text-center text-green-600 font-medium py-3">
            ✓ Stop completed
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Report Issue Modal -->
  <Teleport to="body">
    <div v-if="isIssueModalOpen && currentStop" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="isIssueModalOpen = false" />

      <!-- Modal -->
      <div class="relative bg-background rounded-lg border shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-destructive" />
            Report Issue
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            {{ currentStop.type === 'pickup'
              ? `Report an issue with pickup at ${currentStop.printshop?.name}`
              : `Report an issue with delivery to ${currentStop.customer?.name}` }}
          </p>
        </div>

        <!-- Status Selection -->
        <div class="space-y-2">
          <Label class="text-sm font-medium">What status should these items be set to?</Label>
          <div class="space-y-2">
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="issueStatus === 'delivered' ? 'border-green-500 bg-green-500/5' : 'hover:bg-accent/50'">
              <input type="radio" v-model="issueStatus" value="delivered"
                class="mt-0.5 accent-green-500" />
              <div>
                <div class="text-sm font-medium">
                  Delivered (with issue)
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ currentStop.type === 'pickup'
                    ? 'Items were picked up, but there was a problem. Log the issue for follow-up.'
                    : 'Items were delivered, but there was a problem. Log the issue for follow-up.' }}
                </div>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="issueStatus === 'canceled' ? 'border-destructive bg-destructive/5' : 'hover:bg-accent/50'">
              <input type="radio" v-model="issueStatus" value="canceled"
                class="mt-0.5 accent-destructive" />
              <div>
                <div class="text-sm font-medium">
                  Cancelled
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ currentStop.type === 'pickup'
                    ? 'Items cannot be picked up. Order will be cancelled.'
                    : 'Cannot deliver to customer. Order will be cancelled.' }}
                </div>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="issueStatus === 'on_hold' ? 'border-amber-500 bg-amber-500/5' : 'hover:bg-accent/50'">
              <input type="radio" v-model="issueStatus" value="on_hold"
                class="mt-0.5 accent-amber-500" />
              <div>
                <div class="text-sm font-medium">
                  On Hold
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ currentStop.type === 'pickup'
                    ? 'Items not ready yet. Put on hold for later pickup attempt.'
                    : 'Cannot deliver now. Put on hold for later delivery attempt.' }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Note (required) -->
        <div>
          <Label class="text-sm font-medium mb-2 block">
            Details <span class="text-destructive">*</span>
          </Label>
          <Textarea
            v-model="issueNote"
            placeholder="Describe the issue: customer not available, wrong address, items damaged, access problem..."
            :rows="4"
            class="w-full"
          />
        </div>

        <!-- Photo Upload -->
        <div>
          <Label class="text-sm font-medium mb-2 block">Photos (Optional)</Label>
          <Button
            variant="outline"
            size="sm"
            class="w-full gap-2"
            type="button"
            @click="addIssuePhoto"
          >
            <Camera class="h-4 w-4" />
            Add Photo
          </Button>
          <div v-if="issuePhotos.length > 0" class="flex flex-wrap gap-2 mt-3">
            <div
              v-for="(photo, i) in issuePhotos"
              :key="i"
              class="relative w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground group"
            >
              <div class="text-center">
                📷
                <div class="text-[10px]">Photo {{ i + 1 }}</div>
              </div>
              <button
                @click="removeIssuePhoto(i)"
                class="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                type="button"
                title="Remove photo"
              >
                ×
              </button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Photo capture will be available in Phase 2. This is a simulation.
          </p>
        </div>

        <!-- Modal Actions -->
        <div class="flex gap-3 pt-2">
          <Button variant="outline" class="flex-1" @click="isIssueModalOpen = false">
            Go Back
          </Button>
          <Button
            :variant="issueStatus === 'canceled' ? 'destructive' : issueStatus === 'delivered' ? 'default' : 'default'"
            class="flex-1"
            :disabled="!issueNote.trim()"
            @click="submitIssue"
          >
            {{ issueStatus === 'delivered' ? 'Mark as Delivered' :
               issueStatus === 'canceled' ? 'Cancel & Continue' :
               'Put On Hold & Continue' }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Order Detail Sheet -->
  <OrderDetailSheet
    :order-id="selectedOrderId"
    :is-open="isSheetOpen"
    :show-payment="false"
    :show-files="false"
    @update:is-open="isSheetOpen = $event"
  />
</template>
