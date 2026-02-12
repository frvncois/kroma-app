<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrders } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { useOrderStore } from '@/stores/orders'
import { useActivityStore } from '@/stores/activities'
import { useAuthStore } from '@/stores/auth'
import { useDriverStore } from '@/stores/drivers'
import type { RouteStop, DriverRoute } from '@/stores/drivers'
import { generateRoute, recalculateRoute } from '@/lib/route-service'
import type { RouteInput, RouteStopInput } from '@/lib/route-service'
import { useToast } from '@/composables/useToast'
import type { ItemStatus } from '@/types'
import { driverStatusOptions } from '@/lib/constants'
import { formatStatus, formatSource } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import DriverItemList from '@/components/DriverItemList.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import OrderFilters from '@/components/OrderFilters.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import StartRouteDialog from '@/components/StartRouteDialog.vue'
import TransferDialog from '@/components/TransferDialog.vue'
import RouteMap from '@/components/RouteMap.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Label from '@/components/ui/Label.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  Navigation,
  ArrowLeft,
  MapPin,
  Truck,
  CheckCircle2,
  Camera,
  AlertCircle,
  User,
  Phone,
  AlertTriangle,
  XCircle,
  ArrowRightLeft,
  Loader2,
  Eye,
  Plus
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const activityStore = useActivityStore()
const authStore = useAuthStore()
const driverStore = useDriverStore()
const { updateItemStatus } = useOrders()
const { getPrintshopById } = usePrintshops()
const { toast } = useToast()

// Register driver session on mount
onMounted(() => {
  if (authStore.currentUser && authStore.isDriver) {
    driverStore.registerDriverSession(authStore.currentUser.id)
  }
})

onUnmounted(() => {
  // Don't unregister on unmount — only on explicit logout
})

// Route state from store
const currentRoute = computed(() => driverStore.currentDriverRoute)
const routeActive = computed(() => currentRoute.value?.status === 'active')
const isRouteLoading = ref(false)
const routeError = ref<string | null>(null)

// Current stop
const currentStop = computed(() => {
  if (!currentRoute.value) return null
  return currentRoute.value.stops[currentRoute.value.currentStopIndex] || null
})

// Route map ref and summary
const routeMapRef = ref<InstanceType<typeof RouteMap> | null>(null)
const routeSummary = computed(() => currentRoute.value?.aiSummary || null)

// Check if all stops are completed (for showing return leg)
const allStopsCompleted = computed(() => {
  if (!currentRoute.value) return false
  return currentRoute.value.stops.every(s => s.status === 'completed' || s.cancelled)
})

// Orders eligible for delivery — exclude items assigned to other drivers
const deliverableOrders = computed(() => {
  return orderStore.ordersWithDetails.filter(order => {
    if (order.delivery_method !== 'delivery') return false
    return order.items.some(item =>
      (item.status === 'ready' || item.status === 'out_for_delivery') &&
      !driverStore.isItemAssignedToOtherDriver(item.id)
    )
  })
})

// Filters
const statusFilter = ref<string[]>(['all'])
const orderBy = ref('newest')

const filterConfigs = [
  { key: 'status', label: 'Status', options: driverStatusOptions },
  { key: 'orderBy', label: 'Order By', options: [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ]},
]

// Activities filtered to delivery-related
const filteredActivities = computed(() => {
  return activityStore.getActivitiesForRole()
})

// Order detail sheet
const selectedOrderId = ref<string | null>(null)
const isSheetOpen = ref(false)

const openOrderDetail = (orderId: string) => {
  selectedOrderId.value = orderId
  isSheetOpen.value = true
}

const openItemDetail = (itemId: string) => {
  const item = orderStore.orderItems.find(i => i.id === itemId)
  if (item) {
    selectedOrderId.value = item.order_id
    isSheetOpen.value = true
  }
}

// Watch for openOrder query parameter (from search)
watch(
  () => route.query.openOrder,
  (orderId) => {
    if (orderId && typeof orderId === 'string') {
      openOrderDetail(orderId)
      // Clear the query parameter
      router.replace({ query: {} })
    }
  },
  { immediate: true }
)

// Start Route Dialog
const isStartRouteDialogOpen = ref(false)

const openStartRouteDialog = () => {
  isStartRouteDialogOpen.value = true
}

// Build stops from deliverable orders
function buildStopInputsForOrders(orders: typeof deliverableOrders.value): RouteStopInput[] {
  const stops: RouteStopInput[] = []
  const pickupMap = new Map<string, RouteStopInput>()

  for (const order of orders) {
    const deliverableItems = order.items.filter(
      i => (i.status === 'ready' || i.status === 'out_for_delivery') &&
           !driverStore.isItemAssignedToOtherDriver(i.id)
    )

    if (deliverableItems.length === 0) continue

    // Group items by printshop for pickups
    const itemsByShop = new Map<string, typeof deliverableItems>()
    for (const item of deliverableItems) {
      const shopId = item.assigned_printshop || 'in-house'
      const existing = itemsByShop.get(shopId) || []
      existing.push(item)
      itemsByShop.set(shopId, existing)
    }

    // Create pickup stops (one per printshop, aggregated)
    for (const [shopId, items] of itemsByShop) {
      if (!pickupMap.has(shopId)) {
        const shop = getPrintshopById(shopId)
        pickupMap.set(shopId, {
          id: `pickup-${shopId}`,
          type: 'pickup',
          address: shop?.address || driverStore.HOME_BASE.address,
          lat: shop?.lat,
          lng: shop?.lng,
          printshopName: shop?.name || 'Unknown',
          items: [],
          relatedDeliveryStopIds: [],
        })
      }
      const pickupStop = pickupMap.get(shopId)!
      pickupStop.items.push(...items.map(i => ({
        id: i.id,
        name: i.product_name,
        quantity: i.quantity,
      })))
    }

    // Create delivery stop (one per order)
    const deliveryStopId = `delivery-${order.id}`
    const requiresPickups = [...new Set(
      deliverableItems.map(i => `pickup-${i.assigned_printshop || 'in-house'}`)
    )]

    stops.push({
      id: deliveryStopId,
      type: 'dropoff',
      address: order.customer.address,
      lat: order.customer.lat,
      lng: order.customer.lng,
      customerName: order.customer.name,
      customerNotes: order.customer.notes,
      orderExternalId: order.external_id || undefined,
      items: deliverableItems.map(i => ({
        id: i.id,
        name: i.product_name,
        quantity: i.quantity,
      })),
      dueDate: deliverableItems
        .map(i => i.due_date)
        .filter(Boolean)
        .sort()[0] || null,
      priority: 'medium',
      requiresPickupStopIds: requiresPickups,
    })

    // Link pickups to their deliveries
    for (const shopId of new Set(deliverableItems.map(i => i.assigned_printshop || 'in-house'))) {
      const pickup = pickupMap.get(shopId)
      if (pickup) {
        pickup.relatedDeliveryStopIds = pickup.relatedDeliveryStopIds || []
        if (!pickup.relatedDeliveryStopIds.includes(deliveryStopId)) {
          pickup.relatedDeliveryStopIds.push(deliveryStopId)
        }
      }
    }
  }

  return [...pickupMap.values(), ...stops]
}

// Handle route generation
async function handleStartRoute(shiftEndTime: string, selectedOrderIds: string[]) {
  if (!authStore.currentUser) return
  isRouteLoading.value = true
  routeError.value = null

  try {
    // Filter deliverable orders to only selected ones
    const ordersToRoute = deliverableOrders.value.filter(o => selectedOrderIds.includes(o.id))

    if (ordersToRoute.length === 0) {
      toast({ title: 'No stops selected', description: 'Please select at least one delivery to plan.' })
      isRouteLoading.value = false
      return
    }

    const stopInputs = buildStopInputsForOrders(ordersToRoute)

    if (stopInputs.length === 0) {
      toast({ title: 'No stops', description: 'No deliveries are available to plan.' })
      isRouteLoading.value = false
      return
    }

    const input: RouteInput = {
      driverId: authStore.currentUser.id,
      driverName: authStore.currentUser.name,
      startAddress: driverStore.HOME_BASE.address,
      startLat: driverStore.HOME_BASE.lat,
      startLng: driverStore.HOME_BASE.lng,
      endAddress: driverStore.HOME_BASE.address,    // Return to HQ
      endLat: driverStore.HOME_BASE.lat,
      endLng: driverStore.HOME_BASE.lng,
      currentTime: new Date().toISOString(),
      shiftEndTime,
      stops: stopInputs,
    }

    const result = await generateRoute(input)

    // Enrich stops with IDs from our data
    for (const stop of result.stops) {
      if (stop.type === 'pickup') {
        const shopId = stop.id.replace('pickup-', '')
        const shop = getPrintshopById(shopId)
        stop.printshopId = shopId
        stop.printshopName = shop?.name
      } else if (stop.type === 'dropoff') {
        const orderId = stop.id.replace('delivery-', '')
        const order = orderStore.getOrderById(orderId)
        if (order) {
          stop.orderId = order.id
          stop.orderExternalId = order.external_id || undefined
          stop.customerId = order.customer?.id
          stop.customerName = order.customer?.name
          stop.customerPhone = order.customer?.phone
          stop.customerAddress = order.customer?.address
          stop.customerNotes = order.customer?.notes
        }
      }
    }

    // Create the DriverRoute
    const driverRoute: DriverRoute = {
      driverId: authStore.currentUser.id,
      driverName: authStore.currentUser.name,
      status: 'active',
      shiftEndTime,
      startAddress: driverStore.HOME_BASE.address,
      startLat: driverStore.HOME_BASE.lat,
      startLng: driverStore.HOME_BASE.lng,
      stops: result.stops,
      currentStopIndex: 0,
      totalEstimatedMinutes: result.totalMinutes,
      totalDistanceKm: result.totalDistanceKm,
      estimatedFinishTime: undefined,
      stopsOverCapacity: result.stopsOverCapacity,
      aiSummary: result.summary,
      returnToHq: result.returnToHq,
      startedAt: new Date().toISOString(),
      pendingNewItemIds: [],
    }

    driverStore.setDriverRoute(authStore.currentUser.id, driverRoute)

    // Mark items as out_for_delivery
    for (const stop of result.stops) {
      for (const itemId of stop.itemIds) {
        const item = orderStore.orderItems.find(i => i.id === itemId)
        if (item && item.status === 'ready') {
          updateItemStatus(item.id, 'out_for_delivery')
        }
      }
    }

    isStartRouteDialogOpen.value = false
    toast({
      title: 'Route generated! 🚀',
      description: `${result.stops.length} stops planned. ${result.warnings.length > 0 ? result.warnings[0] : ''}`,
    })

  } catch (err: any) {
    console.error('Route generation failed:', err)
    routeError.value = err.message || 'Failed to generate route'
    toast({
      title: 'Route generation failed',
      description: err.message || 'Please try again.',
      variant: 'destructive',
    })
  } finally {
    isRouteLoading.value = false
  }
}

// Watch for new ready items during active route
const previousReadyItemIds = ref<Set<string>>(new Set())

watch(
  () => orderStore.ordersWithDetails,
  (orders) => {
    if (!routeActive.value || !currentRoute.value) return
    if (!authStore.currentUser) return

    // Find all currently ready delivery items
    const currentReadyIds = new Set<string>()
    for (const order of orders) {
      if (order.delivery_method !== 'delivery') continue
      for (const item of order.items) {
        if (item.status === 'ready' && !driverStore.isItemAssignedToOtherDriver(item.id)) {
          currentReadyIds.add(item.id)
        }
      }
    }

    // Find NEW ready items not already in the route
    const routeItemIds = new Set(
      currentRoute.value.stops.flatMap(s => s.itemIds)
    )
    const newItems = [...currentReadyIds].filter(
      id => !routeItemIds.has(id) && !previousReadyItemIds.value.has(id)
    )

    if (newItems.length > 0) {
      driverStore.addPendingItems(authStore.currentUser.id, newItems)
    }

    previousReadyItemIds.value = currentReadyIds
  },
  { deep: true }
)

// Handle adding pending items to route (recalculation)
async function addPendingToRoute() {
  if (!currentRoute.value || !authStore.currentUser) return
  isRouteLoading.value = true

  try {
    const pendingIds = new Set(currentRoute.value.pendingNewItemIds)
    const newStopInputs: RouteStopInput[] = []

    // Build stop inputs for new items
    for (const order of orderStore.ordersWithDetails) {
      if (order.delivery_method !== 'delivery') continue
      const newItems = order.items.filter(i => pendingIds.has(i.id))
      if (newItems.length === 0) continue

      // Create delivery stop
      newStopInputs.push({
        id: `delivery-${order.id}-new`,
        type: 'dropoff',
        address: order.customer.address,
        lat: order.customer.lat,
        lng: order.customer.lng,
        customerName: order.customer.name,
        items: newItems.map(i => ({ id: i.id, name: i.product_name, quantity: i.quantity })),
        dueDate: newItems.map(i => i.due_date).filter(Boolean).sort()[0] || null,
        priority: 'medium',
      })
    }

    const result = await recalculateRoute(
      currentRoute.value,
      newStopInputs,
      new Date().toISOString()
    )

    // Update route
    const updatedRoute: DriverRoute = {
      ...currentRoute.value,
      stops: result.stops,
      currentStopIndex: result.stops.findIndex(s => s.status === 'current'),
      totalEstimatedMinutes: result.totalMinutes,
      totalDistanceKm: result.totalDistanceKm,
      stopsOverCapacity: result.stopsOverCapacity,
      aiSummary: result.summary,
      lastRecalculatedAt: new Date().toISOString(),
      pendingNewItemIds: [],
    }

    driverStore.updateDriverRoute(authStore.currentUser.id, updatedRoute)
    driverStore.clearPendingItems(authStore.currentUser.id)

    toast({ title: 'Route updated', description: `Added ${pendingIds.size} new items to route.` })
  } catch (err: any) {
    toast({ title: 'Recalculation failed', description: err.message, variant: 'destructive' })
  } finally {
    isRouteLoading.value = false
  }
}

// Transfer dialog
const isTransferDialogOpen = ref(false)
const transferItemIds = ref<string[]>([])
const transferItemSummary = ref('')

function openTransferDialog() {
  if (!currentStop.value) return
  transferItemIds.value = [...currentStop.value.itemIds]
  transferItemSummary.value = currentStop.value.itemSummary
  isTransferDialogOpen.value = true
}

function handleTransfer(targetDriverId: string) {
  driverStore.transferItems(transferItemIds.value, targetDriverId)
  isTransferDialogOpen.value = false
  toast({ title: 'Items transferred', description: 'Items sent to the other driver.' })
}

// Add Stop dialog
const isAddStopDialogOpen = ref(false)
const selectedOrderIds = ref<string[]>([])

function openAddStopDialog() {
  selectedOrderIds.value = []
  isAddStopDialogOpen.value = true
}

function toggleOrderSelection(orderId: string) {
  const index = selectedOrderIds.value.indexOf(orderId)
  if (index > -1) {
    selectedOrderIds.value.splice(index, 1)
  } else {
    selectedOrderIds.value.push(orderId)
  }
}

async function handleAddStops() {
  if (selectedOrderIds.value.length === 0) {
    toast({ title: 'No orders selected', description: 'Please select at least one delivery to add.' })
    return
  }

  if (!currentRoute.value || !authStore.currentUser) return
  isRouteLoading.value = true

  try {
    const ordersToAdd = deliverableOrders.value.filter(o => selectedOrderIds.value.includes(o.id))
    const newStopInputs = buildStopInputsForOrders(ordersToAdd)

    const result = await recalculateRoute(
      currentRoute.value,
      newStopInputs,
      new Date().toISOString()
    )

    // Update route
    const updatedRoute: DriverRoute = {
      ...currentRoute.value,
      stops: result.stops,
      currentStopIndex: result.stops.findIndex(s => s.status === 'current'),
      totalEstimatedMinutes: result.totalMinutes,
      totalDistanceKm: result.totalDistanceKm,
      stopsOverCapacity: result.stopsOverCapacity,
      aiSummary: result.summary,
      lastRecalculatedAt: new Date().toISOString(),
    }

    driverStore.updateDriverRoute(authStore.currentUser.id, updatedRoute)

    // Mark items as out_for_delivery
    for (const stop of newStopInputs) {
      for (const item of stop.items || []) {
        const orderItem = orderStore.orderItems.find(i => i.id === item.id)
        if (orderItem && orderItem.status === 'ready') {
          updateItemStatus(item.id, 'out_for_delivery')
        }
      }
    }

    isAddStopDialogOpen.value = false
    selectedOrderIds.value = []
    toast({
      title: 'Stops added! 🚀',
      description: `${selectedOrderIds.value.length} stop${selectedOrderIds.value.length !== 1 ? 's' : ''} added to your route.`
    })
  } catch (err: any) {
    toast({ title: 'Failed to add stops', description: err.message, variant: 'destructive' })
  } finally {
    isRouteLoading.value = false
  }
}

// Open confirmation modal
function openConfirmModal(itemId: string) {
  confirmItemId.value = itemId
  confirmNote.value = ''
  confirmPhotos.value = []
  isConfirmModalOpen.value = true
}

// Add photo to confirmation
function addConfirmPhoto() {
  const photoId = `confirm-photo-${Date.now()}.jpg`
  confirmPhotos.value.push(photoId)
  toast({ title: 'Photo added', description: 'Photo will be attached to the confirmation' })
}

// Remove photo from confirmation
function removeConfirmPhoto(index: number) {
  confirmPhotos.value.splice(index, 1)
}

// Submit confirmation with notes and photos
function submitConfirmation() {
  const stop = currentStop.value
  if (!stop || !confirmItemId.value) return

  const itemId = confirmItemId.value
  const item = orderStore.orderItems.find(i => i.id === itemId)
  if (!item) return

  // Add to confirmed items
  if (!stop.confirmedItemIds.includes(itemId)) {
    stop.confirmedItemIds.push(itemId)
  }

  // Create activity note if note or photos provided
  if (confirmNote.value.trim() || confirmPhotos.value.length > 0) {
    const order = orderStore.ordersWithDetails.find(o =>
      o.items.some(i => i.id === itemId)
    )

    activityStore.addActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'note_added',
      timestamp: new Date().toISOString(),
      user: authStore.currentUser?.name || 'Driver',
      seen: false,
      important: false,
      item: {
        id: item.id,
        name: item.product_name,
        orderId: item.order_id,
      },
      order: order ? {
        id: order.id,
        externalId: order.external_id || undefined,
        customer: stop.customerName || order.customer?.name || 'Unknown',
      } : undefined,
      details: {
        message: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} completed${confirmPhotos.value.length > 0 ? ` (${confirmPhotos.value.length} photo${confirmPhotos.value.length !== 1 ? 's' : ''} attached)` : ''}`,
        note: confirmNote.value.trim() || undefined,
      },
    })
  }

  // If pickup, lock the item
  if (stop.type === 'pickup') {
    driverStore.lockItemsAtStop(stop.id)
  }

  // If dropoff, mark item delivered
  if (stop.type === 'dropoff') {
    updateItemStatus(itemId, 'delivered')
  }

  toast({ title: 'Item confirmed', description: 'Item has been confirmed.' })

  // Close modal and reset
  isConfirmModalOpen.value = false
  confirmItemId.value = null
  confirmNote.value = ''
  confirmPhotos.value = []
}

// Unconfirm an item (allow corrections)
function unconfirmItem(itemId: string) {
  const stop = currentStop.value
  if (!stop) return

  // Remove from confirmed items
  const index = stop.confirmedItemIds.indexOf(itemId)
  if (index > -1) {
    stop.confirmedItemIds.splice(index, 1)
  }

  // Revert status based on stop type
  if (stop.type === 'dropoff') {
    updateItemStatus(itemId, 'out_for_delivery')
  }

  toast({ title: 'Item unconfirmed', description: 'You can now re-confirm or report an issue.' })
}

// Check if item is confirmed
function isItemConfirmed(itemId: string): boolean {
  return currentStop.value?.confirmedItemIds.includes(itemId) || false
}

// Compute button text based on stop position
const nextStopButtonText = computed(() => {
  if (!currentRoute.value) return 'Next Stop'

  const currentIndex = currentRoute.value.currentStopIndex

  // First stop (starting the route)
  if (currentIndex === 0 && currentStop.value?.status !== 'completed') {
    return 'Start Route'
  }

  // Check if this is the last stop before returning to HQ
  const remainingStops = currentRoute.value.stops.filter(
    (s, i) => i > currentIndex && s.status !== 'completed' && !s.cancelled
  )

  // Last stop before ending
  if (remainingStops.length === 0) {
    return 'End Route'
  }

  // Middle stops
  return 'Next Stop'
})

// Go to next stop (manual advance)
function goToNextStop() {
  if (!currentRoute.value || !authStore.currentUser) return

  const stop = currentStop.value
  if (!stop) return

  // Mark current stop as completed
  stop.status = 'completed'
  stop.completedAt = new Date().toISOString()

  // Find next stop
  const nextIndex = currentRoute.value.stops.findIndex(
    (s, i) => i > currentRoute.value!.currentStopIndex && s.status !== 'completed' && !s.cancelled
  )

  if (nextIndex !== -1) {
    currentRoute.value.currentStopIndex = nextIndex
    currentRoute.value.stops[nextIndex]!.status = 'current'
    toast({ title: 'Moving to next stop', description: 'Ready for the next stop!' })
  } else {
    // Route completed
    currentRoute.value.status = 'completed'
    currentRoute.value.completedAt = new Date().toISOString()
    toast({ title: 'Route completed! 🎉', description: 'All stops have been handled.' })
  }
}

// Confirmation modal (per item - for adding notes/photos)
const isConfirmModalOpen = ref(false)
const confirmItemId = ref<string | null>(null)
const confirmNote = ref('')
const confirmPhotos = ref<string[]>([])

// Issue reporting modal (per item)
const isIssueModalOpen = ref(false)
const issueItemId = ref<string | null>(null)
const issueNote = ref('')
const issueStatus = ref<ItemStatus>('on_hold')
const issuePhotos = ref<string[]>([])
const rescheduleDate = ref('')

const openIssueModal = (itemId: string) => {
  issueItemId.value = itemId
  issueNote.value = ''
  issueStatus.value = 'on_hold'
  issuePhotos.value = []
  rescheduleDate.value = ''
  isIssueModalOpen.value = true
}

const addIssuePhoto = () => {
  const photoId = `issue-photo-${Date.now()}.jpg`
  issuePhotos.value.push(photoId)
  toast({ title: 'Photo added', description: 'Photo will be attached to the issue report' })
}

const removeIssuePhoto = (index: number) => {
  issuePhotos.value.splice(index, 1)
}

// Submit issue report (for single item)
const submitIssue = () => {
  const stop = currentStop.value
  if (!stop || !issueNote.value.trim() || !issueItemId.value) return

  const itemId = issueItemId.value
  const item = orderStore.orderItems.find(i => i.id === itemId)
  if (!item) return

  const order = orderStore.ordersWithDetails.find(o =>
    o.items.some(i => i.id === itemId)
  )

  // Create activity with the note
  activityStore.addActivity({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'note_added',
    timestamp: new Date().toISOString(),
    user: authStore.currentUser?.name || 'Driver',
    seen: false,
    important: false,
    item: {
      id: item.id,
      name: item.product_name,
      orderId: item.order_id,
    },
    order: order ? {
      id: order.id,
      externalId: order.external_id || undefined,
      customer: stop.customerName || order.customer?.name || 'Unknown',
    } : undefined,
    details: {
      message: `${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} issue reported by driver - Status: ${formatStatus(issueStatus.value)}${issuePhotos.value.length > 0 ? ` (${issuePhotos.value.length} photo${issuePhotos.value.length !== 1 ? 's' : ''} attached)` : ''}${rescheduleDate.value ? ` - Rescheduled for: ${rescheduleDate.value}` : ''}`,
      note: issueNote.value.trim(),
    },
  })

  // Set item status
  updateItemStatus(itemId, issueStatus.value)

  // Mark this item as having an issue
  stop.hasIssue = true

  const statusMessages: Record<ItemStatus, { title: string; description: string; variant?: 'default' | 'destructive' }> = {
    delivered: {
      title: 'Item marked delivered with issue',
      description: 'Issue has been logged.',
    },
    canceled: {
      title: 'Item cancelled',
      description: 'Issue has been logged.',
      variant: 'destructive',
    },
    on_hold: {
      title: 'Item put on hold',
      description: 'Issue has been logged.',
      variant: 'destructive',
    },
    new: { title: 'Status updated', description: 'Item set to new' },
    assigned: { title: 'Status updated', description: 'Item assigned' },
    in_production: { title: 'Status updated', description: 'Item in production' },
    ready: { title: 'Status updated', description: 'Item ready' },
    out_for_delivery: { title: 'Status updated', description: 'Item out for delivery' },
    picked_up: { title: 'Status updated', description: 'Item picked up' },
  }

  const message = statusMessages[issueStatus.value]
  toast({
    title: message.title,
    description: message.description,
    variant: message.variant,
  })

  isIssueModalOpen.value = false
  issueItemId.value = null
  issueNote.value = ''
  issuePhotos.value = []
  rescheduleDate.value = ''
}

// Cancel route
const confirmCancelRoute = () => {
  if (!authStore.currentUser || !currentRoute.value) return
  const hasCompleted = currentRoute.value.stops.some(s => s.status === 'completed')
  if (hasCompleted) {
    if (!confirm('Some stops are already completed. End the route?')) return
  }
  driverStore.endRoute(authStore.currentUser.id)
}

// Mock photo upload
const mockAddPhoto = () => {
  const stop = currentStop.value
  if (!stop) return
  stop.photos.push(`photo-${Date.now()}.jpg`)
  toast({ title: 'Photo added' })
}

// Jump to stop
const jumpToStop = (index: number) => {
  if (!currentRoute.value) return
  const current = currentRoute.value.stops[currentRoute.value.currentStopIndex]
  if (current?.status === 'current') {
    current.status = 'pending'
  }
  currentRoute.value.currentStopIndex = index
  const newStop = currentRoute.value.stops[index]
  if (newStop) {
    newStop.status = 'current'
  }

  // Fly map to the new stop
  nextTick(() => {
    routeMapRef.value?.flyToStop(index)
  })
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
    <div class="flex h-full flex-col space-y-10 p-10 overflow-hidden pt-24">
      <!-- Header -->
      <div class="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">Deliveries</h1>
          <p class="text-sm text-muted-foreground">
            {{ deliverableOrders.length }} order{{ deliverableOrders.length !== 1 ? 's' : '' }} ready for delivery
          </p>
        </div>
        <Button
          size="lg"
          :disabled="deliverableOrders.length === 0"
          @click="openStartRouteDialog"
          class="gap-2"
        >
          <Navigation class="h-4 w-4" />
          Start Route
        </Button>
      </div>

      <!-- Filters -->
      <OrderFilters
        v-model:status-filter="statusFilter"
        v-model:order-by="orderBy"
        :table-filters="filterConfigs"
        :show-search="false"
      />

      <!-- Content -->
      <div class="flex-1 min-h-0 w-full overflow-auto">
        <DriverItemList
          :orders="deliverableOrders"
          @order-click="openOrderDetail"
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
  <div v-else class="h-full w-full overflow-hidden pt-[4rem]">

    <!-- Route Content -->
    <div class="flex h-[calc(100vh-4rem)]">
      <!-- Left: Stop Progress List -->
      <div class="w-72 border-r overflow-y-auto p-6 space-y-2">
        <!-- Pending New Items Banner -->
        <div
          v-if="currentRoute?.pendingNewItemIds.length"
          class="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertCircle class="h-4 w-4" />
            {{ currentRoute.pendingNewItemIds.length }} new item{{ currentRoute.pendingNewItemIds.length !== 1 ? 's' : '' }} available
          </div>
          <p class="text-xs text-amber-600 dark:text-amber-500 mt-1">
            New items are ready for delivery. Add them to recalculate your route.
          </p>
          <Button size="sm" variant="outline" class="mt-2 w-full" @click="addPendingToRoute" :disabled="isRouteLoading">
            <Loader2 v-if="isRouteLoading" class="h-3 w-3 mr-1 animate-spin" />
            Add to Route
          </Button>
        </div>

        <!-- Stop List -->
        <div
          v-for="(stop, i) in currentRoute?.stops"
          :key="stop.id"
          @click="jumpToStop(i)"
          :class="[
            'p-3 rounded-lg border cursor-pointer transition-colors',
            stop.status === 'completed' ? 'bg-green-50 dark:bg-green-950/30 border-green-200' :
            stop.hasIssue && stop.status !== 'completed' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300' :
            stop.status === 'current' ? 'bg-accent border-primary ring-1 ring-primary' :
            'hover:bg-accent/50'
          ]"
        >
          <div class="flex items-start gap-3">

            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium flex items-center gap-1 pb-1.5">
                <MapPin v-if="stop.type === 'pickup'" class="h-3 w-3 text-blue-500" />
                <Truck v-else class="h-3 w-3 text-green-500" />
                {{ stop.type === 'pickup' ? `Pickup: ${stop.printshopName}` : `Deliver: ${stop.customerName}` }}
                <AlertTriangle v-if="stop.hasIssue && stop.status !== 'completed'" class="h-3 w-3 text-amber-500 flex-shrink-0" />
                <AlertCircle v-if="!stop.fitsInShift" class="h-3 w-3 text-red-500 flex-shrink-0" title="May not fit in shift" />
              </div>
              <div class="text-xs text-muted-foreground truncate">{{ stop.address }}</div>
              <div class="text-xs text-muted-foreground">{{ stop.itemIds.length }} item(s)</div>
              <div v-if="stop.travelMinutesFromPrevious != null && stop.distanceKmFromPrevious != null" class="text-xs text-muted-foreground">
                {{ stop.travelMinutesFromPrevious }} min · {{ stop.distanceKmFromPrevious.toFixed(1) }} km
              </div>
              <div v-if="stop.estimatedArrival" class="text-xs text-blue-600 dark:text-blue-400">
                ETA: {{ stop.estimatedArrival }}
              </div>
            </div>
          </div>
        </div>

        <!-- Add Stop Button -->
        <Button
          variant="outline"
          size="sm"
          class="w-full gap-2"
          @click="openAddStopDialog"
        >
          <Plus class="h-4 w-4" />
          Add a Stop
        </Button>

        <!-- Return to HQ Card -->
        <div
          v-if="currentRoute?.returnToHq"
          :class="[
            'p-3 rounded-lg border transition-colors',
            allStopsCompleted ? 'bg-green-50 dark:bg-green-950/30 border-green-200' : 'bg-muted/50 border-dashed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
              allStopsCompleted ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            ]">
              <CheckCircle2 v-if="allStopsCompleted" class="h-4 w-4" />
              <span v-else>🏠</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">Return to HQ</div>
              <div class="text-xs text-muted-foreground truncate">{{ driverStore.HOME_BASE.address }}</div>
              <div class="text-xs text-blue-600 dark:text-blue-400">
                {{ currentRoute.returnToHq.travelMinutes }} min · {{ currentRoute.returnToHq.distanceKm.toFixed(1) }} km
              </div>
              <div v-if="currentRoute.returnToHq.estimatedArrival" class="text-xs text-blue-600 dark:text-blue-400">
                ETA: {{ currentRoute.returnToHq.estimatedArrival }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Map and Details Side-by-Side -->
      <div class="flex-1 flex">

        <!-- Left: Map Section -->
        <div class="w-1/2 p-6">
          <div class="h-full rounded-lg overflow-hidden">
            <RouteMap
              ref="routeMapRef"
              :stops="currentRoute?.stops || []"
              :current-stop-index="currentRoute?.currentStopIndex || 0"
              :start-address="driverStore.HOME_BASE.address"
              :start-lat="driverStore.HOME_BASE.lat"
              :start-lng="driverStore.HOME_BASE.lng"
              :return-to-hq-data="currentRoute?.returnToHq"
              @stop-click="jumpToStop"
            />
          </div>
        </div>

        <!-- Right: Current Stop Detail -->
        <div class="w-1/2 overflow-y-auto p-6 border-l">
          <div v-if="currentStop" class="space-y-6">
          <!-- Stop Header -->
        <div>
          <Badge
            :variant="currentStop.type === 'pickup' ? 'default' : 'secondary'"
            :class="currentStop.type === 'pickup'
              ? 'mb-2 bg-green-100 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-400'
              : 'mb-2 bg-blue-100 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-400'"
          >
            {{ currentStop.type === 'pickup' ? 'Pickup' : 'Delivery' }}
          </Badge>
          <h2 class="text-2xl font-bold mb-1">
            {{ currentStop.type === 'pickup' ? currentStop.printshopName : currentStop.customerName }}
          </h2>
        </div>

        <!-- Issue Banner -->
        <div v-if="currentStop.hasIssue" class="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-3 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span class="text-sm text-amber-700 dark:text-amber-300">An issue has been reported for this stop</span>
        </div>

        <!-- Customer Info (dropoff only) -->
        <Card v-if="currentStop.type === 'dropoff' && currentStop.customerName">
          <CardContent class="p-4 space-y-3">
            <h3 class="text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Customer
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Name</Label>
                <div class="text-sm font-medium">{{ currentStop.customerName }}</div>
              </div>
              <div v-if="currentStop.customerPhone">
                <Label class="text-xs text-muted-foreground mb-1 block">Contact</Label>
                <a :href="`tel:${currentStop.customerPhone}`" class="text-sm text-primary hover:underline flex items-center gap-1">
                  <Phone class="h-3 w-3" />
                  {{ currentStop.customerPhone }}
                </a>
              </div>
              <div class="col-span-2">
                <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address</Label>
                <div class="text-sm">{{ currentStop.customerAddress }}</div>
              </div>
              <div v-if="currentStop.customerNotes" class="col-span-2 border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-1 block">Customer Notes</Label>
                <div class="text-sm text-muted-foreground italic">{{ currentStop.customerNotes }}</div>
              </div>
            </div>
            <div v-if="currentStop.orderExternalId" class="flex items-center gap-3 text-sm pt-2 border-t">
              <span class="font-medium">Order #{{ currentStop.orderExternalId }}</span>
              <Badge variant="default">Delivery</Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Pickup Location Info (pickup only) -->
        <Card v-if="currentStop.type === 'pickup' && currentStop.printshopName">
          <CardContent class="p-4">
            <h3 class="text-sm font-semibold flex items-center gap-2 pb-4">
              <MapPin class="h-4 w-4" />
              Pickup Location
            </h3>
            <div class="text-sm font-medium">{{ currentStop.printshopName }}</div>
            <div class="text-sm text-muted-foreground">{{ currentStop.address }}</div>
          </CardContent>
        </Card>

        <!-- Items at this Stop (with per-item controls) -->
        <Card>
          <CardContent class="p-0">
            <div
              v-for="itemId in currentStop.itemIds"
              :key="itemId"
              class="p-4 flex justify-start border-b last:border-0 flex gap-4"
            >

                            <Badge
                  :variant="isItemConfirmed(itemId) ? 'default' : 'outline'"
                  :class="isItemConfirmed(itemId)
                    ? 'bg-green-300/30 border-green-500 text-green-600'
                    : currentStop.type === 'pickup'
                      ? 'bg-green-100 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-400'
                      : 'bg-blue-100 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-400'"
                >
                  {{ isItemConfirmed(itemId) ? '✓ Confirmed' : currentStop.type === 'pickup' ? 'Pickup' : 'Delivery' }}
                </Badge>


              <!-- Item Info -->
              <div class="flex flex-col items-start justify-between">
                  <div class="text-sm font-medium">{{ orderStore.orderItems.find(i => i.id === itemId)?.product_name || 'Unknown' }}</div>
                  <div class="text-xs text-muted-foreground">Qty: {{ orderStore.orderItems.find(i => i.id === itemId)?.quantity || 0 }}</div>
              </div>

              <!-- Per-item Action Buttons -->
              <div class="flex gap-2 ml-auto">
                <template v-if="!isItemConfirmed(itemId)">
                  <Button variant="outline" class="flex-1 gap-1" @click="openItemDetail(itemId)">
                    <Eye class="h-3.5 w-3.5" />
                    Details
                  </Button>
                  <Button variant="outline" class="flex-1 gap-1 text-destructive border-destructive/30 hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10" @click="openIssueModal(itemId)">
                    <AlertTriangle class="h-3.5 w-3.5" />
                    Issue
                  </Button>
                  <Button class="flex-1 gap-1" @click="openConfirmModal(itemId)">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Confirm
                  </Button>
                </template>
                <template v-else>
                  <Button variant="outline" class="flex-1 gap-1" @click="openItemDetail(itemId)">
                    <Eye class="h-3.5 w-3.5" />
                    Details
                  </Button>
                  <Button variant="outline" class="flex-1 gap-1" @click="unconfirmItem(itemId)">
                    <XCircle class="h-3.5 w-3.5" />
                    Unconfirm
                  </Button>
                </template>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Transfer & Next Stop Actions -->
        <div class="bg-background pt-4 space-y-3">
          <!-- Transfer Button -->
          <Button
            v-if="driverStore.otherActiveDrivers.length > 0 && currentStop.status !== 'completed'"
            variant="outline"
            size="lg"
            class="w-full gap-2"
            @click="openTransferDialog"
          >
            <ArrowRightLeft class="h-4 w-4" />
            Transfer to Driver
          </Button>
          <!-- Next Stop Button -->
          <Button
            v-if="currentStop.status !== 'completed'"
            variant="default"
            size="lg"
            class="w-full gap-2"
            @click="goToNextStop"
          >
            <Navigation class="h-5 w-5" />
            {{ nextStopButtonText }}
          </Button>
        </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Confirmation Modal (per item) -->
  <Teleport to="body">
    <div v-if="isConfirmModalOpen && currentStop" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="isConfirmModalOpen = false" />

      <!-- Modal -->
      <div class="relative bg-background rounded-lg border shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 class="h-5 w-5 text-green-600" />
            Confirm {{ currentStop.type === 'pickup' ? 'Pickup' : 'Delivery' }}
          </h2>
          <p class="text-sm font-medium mt-1">
            {{ confirmItemId ? orderStore.orderItems.find(i => i.id === confirmItemId)?.product_name : 'Unknown Item' }}
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ currentStop.type === 'pickup'
              ? `At ${currentStop.printshopName}`
              : `To ${currentStop.customerName}` }}
          </p>
        </div>

        <!-- Note (optional) -->
        <div>
          <Label class="text-sm font-medium mb-2 block">
            Add Note (Optional)
          </Label>
          <Textarea
            v-model="confirmNote"
            placeholder="Any additional notes: customer instructions, access codes, special requests..."
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
            @click="addConfirmPhoto"
          >
            <Camera class="h-4 w-4" />
            Add Photo
          </Button>
          <div v-if="confirmPhotos.length > 0" class="flex flex-wrap gap-2 mt-3">
            <div
              v-for="(photo, i) in confirmPhotos"
              :key="i"
              class="relative w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground group"
            >
              <div class="text-center">
                📷
                <div class="text-[10px]">Photo {{ i + 1 }}</div>
              </div>
              <button
                @click="removeConfirmPhoto(i)"
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
          <Button variant="outline" class="flex-1" @click="isConfirmModalOpen = false">
            Cancel
          </Button>
          <Button
            variant="default"
            class="flex-1 bg-green-600 hover:bg-green-700"
            @click="submitConfirmation"
          >
            <CheckCircle2 class="h-4 w-4 mr-2" />
            Confirm
          </Button>
        </div>
      </div>
    </div>
  </Teleport>

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
            Report Issue for Item
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            <strong>{{ issueItemId ? orderStore.orderItems.find(i => i.id === issueItemId)?.product_name : 'Unknown Item' }}</strong>
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ currentStop.type === 'pickup'
              ? `Pickup at ${currentStop.printshopName}`
              : `Delivery to ${currentStop.customerName}` }}
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

        <!-- Reschedule Date (optional) -->
        <div v-if="issueStatus === 'on_hold' || issueStatus === 'canceled'">
          <Label class="text-sm font-medium mb-2 block">Reschedule Date (Optional)</Label>
          <Input
            type="date"
            v-model="rescheduleDate"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground mt-1">
            {{ issueStatus === 'canceled'
              ? 'Set a new date for rescheduled delivery/pickup'
              : 'Set a new date for retry attempt' }}
          </p>
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

  <!-- Start Route Dialog -->
  <StartRouteDialog
    :is-open="isStartRouteDialogOpen"
    :is-loading="isRouteLoading"
    :deliverable-orders="deliverableOrders"
    @update:is-open="isStartRouteDialogOpen = $event"
    @confirm="handleStartRoute"
  />

  <!-- Transfer Dialog -->
  <TransferDialog
    :is-open="isTransferDialogOpen"
    :item-ids="transferItemIds"
    :item-summary="transferItemSummary"
    :active-drivers="driverStore.otherActiveDrivers"
    @update:is-open="isTransferDialogOpen = $event"
    @confirm="handleTransfer"
  />

  <!-- Add Stop Dialog -->
  <Teleport to="body">
    <div v-if="isAddStopDialogOpen" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="isAddStopDialogOpen = false" />

      <!-- Modal -->
      <div class="relative bg-background rounded-lg border shadow-xl w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <Plus class="h-5 w-5" />
            Add a Stop to Your Route
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            Add an available order or create a custom stop
          </p>
        </div>

        <!-- Available Orders/Items -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">Available Deliveries</h3>
            <span v-if="selectedOrderIds.length > 0" class="text-xs text-muted-foreground">
              {{ selectedOrderIds.length }} selected
            </span>
          </div>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="order in deliverableOrders"
              :key="order.id"
              :class="[
                'p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3',
                selectedOrderIds.includes(order.id)
                  ? 'bg-primary/10 border-primary ring-1 ring-primary'
                  : 'hover:bg-accent'
              ]"
              @click="toggleOrderSelection(order.id)"
            >
              <input
                type="checkbox"
                :checked="selectedOrderIds.includes(order.id)"
                class="mt-0.5 h-4 w-4 rounded border-gray-300"
                @click.stop="toggleOrderSelection(order.id)"
              />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm">#{{ order.external_id || order.id.slice(0, 8) }}</div>
                <div class="text-xs text-muted-foreground">{{ order.customer.name }} • {{ order.items.length }} item(s)</div>
                <div class="text-xs text-muted-foreground truncate">{{ order.customer.address }}</div>
              </div>
            </div>
            <div v-if="deliverableOrders.length === 0" class="text-center py-8 text-sm text-muted-foreground">
              No available deliveries
            </div>
          </div>
        </div>

        <div class="border-t pt-4">
          <h3 class="text-sm font-semibold mb-3">Or Create Custom Stop</h3>
          <div class="space-y-3">
            <div>
              <Label class="text-sm">Stop Type</Label>
              <div class="flex gap-2 mt-2">
                <Button variant="outline" class="flex-1" size="sm">
                  <MapPin class="h-3.5 w-3.5 mr-1" />
                  Pickup
                </Button>
                <Button variant="outline" class="flex-1" size="sm">
                  <Truck class="h-3.5 w-3.5 mr-1" />
                  Delivery
                </Button>
              </div>
            </div>
            <div>
              <Label class="text-sm">Address</Label>
              <Input placeholder="Enter address..." class="mt-1" />
            </div>
            <div>
              <Label class="text-sm">Notes (Optional)</Label>
              <Textarea placeholder="Additional details..." :rows="2" class="mt-1" />
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex gap-3 pt-2 border-t">
          <Button variant="outline" class="flex-1" @click="isAddStopDialogOpen = false">
            Cancel
          </Button>
          <Button
            variant="default"
            class="flex-1"
            :disabled="selectedOrderIds.length === 0 || isRouteLoading"
            @click="handleAddStops"
          >
            <Loader2 v-if="isRouteLoading" class="h-4 w-4 mr-2 animate-spin" />
            <Plus v-else class="h-4 w-4 mr-2" />
            {{ selectedOrderIds.length === 0
              ? 'Select Deliveries'
              : `Add ${selectedOrderIds.length} Stop${selectedOrderIds.length !== 1 ? 's' : ''}` }}
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
