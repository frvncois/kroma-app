import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useOrderStore } from './orders'
import type { User } from '@/types'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'

// ─── Types ───────────────────────────────────────────────────────────────

export interface RouteStop {
  id: string
  type: 'pickup' | 'dropoff' | 'task'
  status: 'pending' | 'current' | 'completed'
  address: string
  lat?: number
  lng?: number
  // Printshop context (pickup)
  printshopId?: string
  printshopName?: string
  // Customer/order context (dropoff)
  orderId?: string
  orderExternalId?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  customerNotes?: string
  // Items at this stop
  itemIds: string[]
  itemSummary: string               // e.g. "Business Cards (500x), Flyers (100x)"
  confirmedItemIds: string[]        // Items that have been confirmed (pickup/delivered)
  // Task info (ad-hoc tasks from DriverTaskSheet)
  taskTitle?: string
  taskDetails?: string
  taskPriority?: 'low' | 'medium' | 'high' | 'urgent'
  // Route metadata from AI
  estimatedArrival?: string          // "09:15 AM"
  estimatedDeparture?: string        // "09:30 AM"
  travelMinutesFromPrevious?: number
  distanceKmFromPrevious?: number
  stopDurationMinutes: number        // default 15
  fitsInShift: boolean               // does this stop fit before shift end?
  aiNotes?: string                   // AI reasoning
  // Completion data
  note: string
  photos: string[]
  hasIssue: boolean
  cancelled: boolean
  completedAt?: string
}

export interface DriverRoute {
  driverId: string
  driverName: string
  status: 'idle' | 'planning' | 'active' | 'completed'
  // Shift
  shiftEndTime: string               // ISO time the driver wants to stop (e.g. "17:00")
  startAddress: string
  startLat: number
  startLng: number
  // Stops
  stops: RouteStop[]
  currentStopIndex: number
  // AI summary
  totalEstimatedMinutes?: number
  totalDistanceKm?: number
  estimatedFinishTime?: string
  stopsOverCapacity: number          // stops that won't fit in shift
  aiSummary?: string                 // AI's description of the route
  // Return to HQ
  returnToHq: {
    travelMinutes: number
    distanceKm: number
    estimatedArrival: string
  }
  // Timestamps
  startedAt?: string
  completedAt?: string
  lastRecalculatedAt?: string
  // Pending new items that arrived AFTER route started
  pendingNewItemIds: string[]
}

export const useDriverStore = defineStore('drivers', () => {

  // ─── State ─────────────────────────────────────────────────────────

  // Active driver sessions: userId → login ISO timestamp
  const activeDriverSessions = ref<Map<string, string>>(new Map())

  // Routes per driver: driverId → DriverRoute
  const driverRoutes = ref<Map<string, DriverRoute>>(new Map())

  // Item → driver assignment: itemId → driverId
  // When a route is generated, all items in the route are assigned to that driver
  const itemDriverAssignments = ref<Map<string, string>>(new Map())

  // Locked items = physically picked up from printshop, cannot be unassigned
  // Can only be transferred to another active driver
  const lockedItemIds = ref<Set<string>>(new Set())

  // ─── Constants ─────────────────────────────────────────────────────

  const HOME_BASE = {
    address: '4641 Av. Papineau, Montréal, QC H2H 1V3',
    lat: 45.5270,
    lng: -73.5740,
  }

  // ─── Getters ───────────────────────────────────────────────────────

  const activeDrivers = computed(() => {
    const drivers: { id: string; name: string; isOnRoute: boolean; loginTime: string }[] = []
    for (const [userId, loginTime] of activeDriverSessions.value) {
      const route = driverRoutes.value.get(userId)
      drivers.push({
        id: userId,
        name: userId, // Will be resolved to real name by components
        isOnRoute: route?.status === 'active',
        loginTime,
      })
    }
    return drivers
  })

  const currentDriverRoute = computed(() => {
    const authStore = useAuthStore()
    if (!authStore.currentUser) return null
    return driverRoutes.value.get(authStore.currentUser.id) || null
  })

  const isCurrentDriverOnRoute = computed(() => {
    return currentDriverRoute.value?.status === 'active'
  })

  // Items assigned to another driver (not current)
  function isItemAssignedToOtherDriver(itemId: string): boolean {
    const authStore = useAuthStore()
    const assignedTo = itemDriverAssignments.value.get(itemId)
    return !!assignedTo && assignedTo !== authStore.currentUser?.id
  }

  function isItemLocked(itemId: string): boolean {
    return lockedItemIds.value.has(itemId)
  }

  function getItemAssignedDriver(itemId: string): string | undefined {
    return itemDriverAssignments.value.get(itemId)
  }

  // Other active drivers (for transfer)
  const otherActiveDrivers = computed(() => {
    const authStore = useAuthStore()
    return activeDrivers.value.filter(d => d.id !== authStore.currentUser?.id)
  })

  // ─── Actions ───────────────────────────────────────────────────────

  // Called when a driver logs in
  function registerDriverSession(userId: string) {
    activeDriverSessions.value.set(userId, new Date().toISOString())
  }

  // Called when a driver logs out
  function unregisterDriverSession(userId: string) {
    activeDriverSessions.value.delete(userId)
    // Don't clear route — they might log back in
    // But DO unassign items that aren't locked
    for (const [itemId, driverId] of itemDriverAssignments.value) {
      if (driverId === userId && !lockedItemIds.value.has(itemId)) {
        itemDriverAssignments.value.delete(itemId)
      }
    }
  }

  // Set the route for a driver (after AI generates it)
  function setDriverRoute(driverId: string, route: DriverRoute) {
    driverRoutes.value.set(driverId, route)
    // Assign all items in the route to this driver
    for (const stop of route.stops) {
      for (const itemId of stop.itemIds) {
        itemDriverAssignments.value.set(itemId, driverId)
      }
    }
  }

  // Update route after recalculation (preserves completed stops)
  function updateDriverRoute(driverId: string, updatedRoute: DriverRoute) {
    driverRoutes.value.set(driverId, updatedRoute)
    // Reassign items
    for (const stop of updatedRoute.stops) {
      for (const itemId of stop.itemIds) {
        itemDriverAssignments.value.set(itemId, driverId)
      }
    }
  }

  // Lock items at a pickup stop (driver physically has them)
  function lockItemsAtStop(stopId: string) {
    const authStore = useAuthStore()
    const route = currentDriverRoute.value
    if (!route) return
    const stop = route.stops.find(s => s.id === stopId)
    if (!stop) return
    for (const itemId of stop.itemIds) {
      lockedItemIds.value.add(itemId)
    }
  }

  // Transfer items from current driver to another active driver
  function transferItems(itemIds: string[], toDriverId: string): boolean {
    // Verify target driver is active
    if (!activeDriverSessions.value.has(toDriverId)) return false

    const authStore = useAuthStore()
    const fromDriverId = authStore.currentUser?.id
    if (!fromDriverId) return false

    for (const itemId of itemIds) {
      itemDriverAssignments.value.set(itemId, toDriverId)
    }

    // Add to target driver's pending items for recalculation
    const targetRoute = driverRoutes.value.get(toDriverId)
    if (targetRoute && targetRoute.status === 'active') {
      targetRoute.pendingNewItemIds.push(...itemIds)
    }

    // Remove from current driver's route (remaining stops only)
    const currentRoute = driverRoutes.value.get(fromDriverId)
    if (currentRoute) {
      for (const stop of currentRoute.stops) {
        if (stop.status !== 'completed') {
          stop.itemIds = stop.itemIds.filter(id => !itemIds.includes(id))
        }
      }
      // Remove stops that now have 0 items
      currentRoute.stops = currentRoute.stops.filter(
        s => s.status === 'completed' || s.itemIds.length > 0
      )
    }

    return true
  }

  // Add new items to pending list (called when watcher detects new ready items)
  function addPendingItems(driverId: string, itemIds: string[]) {
    const route = driverRoutes.value.get(driverId)
    if (!route) return
    const newIds = itemIds.filter(id => !route.pendingNewItemIds.includes(id))
    route.pendingNewItemIds.push(...newIds)
  }

  // Clear pending after recalculation
  function clearPendingItems(driverId: string) {
    const route = driverRoutes.value.get(driverId)
    if (route) {
      route.pendingNewItemIds = []
    }
  }

  // Complete current stop
  function completeStop(driverId: string) {
    const route = driverRoutes.value.get(driverId)
    if (!route) return
    const stop = route.stops[route.currentStopIndex]
    if (!stop) return
    stop.status = 'completed'
    stop.completedAt = new Date().toISOString()

    // Auto-advance
    const nextIndex = route.stops.findIndex(
      (s, i) => i > route.currentStopIndex && s.status !== 'completed' && !s.cancelled
    )
    if (nextIndex !== -1) {
      route.currentStopIndex = nextIndex
      route.stops[nextIndex]!.status = 'current'
    } else {
      route.status = 'completed'
      route.completedAt = new Date().toISOString()
    }
  }

  // Cancel/end route
  function endRoute(driverId: string) {
    const route = driverRoutes.value.get(driverId)
    if (route) {
      route.status = 'completed'
      route.completedAt = new Date().toISOString()
    }
    // Unlock and unassign non-completed items
    for (const [itemId, assignedDriver] of itemDriverAssignments.value) {
      if (assignedDriver === driverId && !lockedItemIds.value.has(itemId)) {
        itemDriverAssignments.value.delete(itemId)
      }
    }
  }

  return {
    // State
    activeDriverSessions,
    driverRoutes,
    itemDriverAssignments,
    lockedItemIds,
    // Constants
    HOME_BASE,
    // Getters
    activeDrivers,
    currentDriverRoute,
    isCurrentDriverOnRoute,
    otherActiveDrivers,
    // Functions
    isItemAssignedToOtherDriver,
    isItemLocked,
    getItemAssignedDriver,
    // Actions
    registerDriverSession,
    unregisterDriverSession,
    setDriverRoute,
    updateDriverRoute,
    lockItemsAtStop,
    transferItems,
    addPendingItems,
    clearPendingItems,
    completeStop,
    endRoute,
  }
})
