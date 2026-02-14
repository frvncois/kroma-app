import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Activity } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'
import { useOrderStore } from './orders'
import { useCustomerStore } from './customers'
import pingSound from '@/assets/ping.mp3'

export const useActivityStore = defineStore('activities', () => {
  // State
  const activities = ref<Activity[]>([])
  const seenIds = ref<Set<string>>(new Set())
  const importantIds = ref<Set<string>>(new Set())
  const lastSoundPlayedAt = ref<number>(0)
  const initialLoadComplete = ref(false)
  let realtimeChannel: any = null

  // Load/Save LocalStorage
  function loadFromLocalStorage() {
    try {
      const seenData = localStorage.getItem('kroma-seen-activities')
      if (seenData) {
        seenIds.value = new Set(JSON.parse(seenData))
      }

      const importantData = localStorage.getItem('kroma-important-activities')
      if (importantData) {
        importantIds.value = new Set(JSON.parse(importantData))
      }
    } catch (error) {
      console.error('Failed to load activity preferences:', error)
    }
  }

  function saveSeenToLocalStorage() {
    try {
      localStorage.setItem('kroma-seen-activities', JSON.stringify([...seenIds.value]))
    } catch (error) {
      console.error('Failed to save seen activities:', error)
    }
  }

  function saveImportantToLocalStorage() {
    try {
      localStorage.setItem('kroma-important-activities', JSON.stringify([...importantIds.value]))
    } catch (error) {
      console.error('Failed to save important activities:', error)
    }
  }

  // Fetch Activities
  async function fetchActivities() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching activities:', error)
        return
      }

      if (data) {
        activities.value = data as Activity[]
        console.log('Activities loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    }
  }

  // Realtime Subscription
  function setupRealtimeSubscription() {
    realtimeChannel = supabase
      .channel('activities-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        (payload) => {
          const newActivity = payload.new as Activity
          activities.value.unshift(newActivity)

          // Play notification sound for new activities
          if (initialLoadComplete.value) {
            playNotificationSound()
          }
        }
      )
      .subscribe()
  }

  function cleanup() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // Init Action
  async function init() {
    loadFromLocalStorage()
    await fetchActivities()

    // Generate alerts for existing data
    generateAlerts()

    setupRealtimeSubscription()

    // Mark initial load complete
    setTimeout(() => {
      initialLoadComplete.value = true
    }, 100)
  }

  // Generate alert activities based on order item conditions
  function generateAlerts() {
    const orderStore = useOrderStore()
    const customerStore = useCustomerStore()
    const now = new Date()
    const alertActivities: Activity[] = []

    // Check each order item for alert conditions
    for (const item of orderStore.orderItems) {
      const order = orderStore.orders.find(o => o.id === item.order_id)
      if (!order) continue

      const customer = customerStore.customers.find(c => c.id === order.customer_id)
      if (!customer) continue

      // Skip items in terminal states
      if (['delivered', 'picked_up', 'canceled'].includes(item.status)) continue

      // Check for overdue items
      if (item.due_date) {
        const dueDate = new Date(item.due_date)
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysPastDue > 0) {
          const level = daysPastDue > 7 ? 'critical' : 'warning'
          const alertId = `alert-overdue-${item.id}`

          // Check if alert already exists
          if (!activities.value.find(a => a.id === alertId)) {
            const activity: Activity = {
              id: alertId,
              type: 'alert',
              user_id: 'system',
              user: 'System',
              entity_type: 'order_item',
              entity_id: item.id,
              order_id: order.id,
              printshop_id: item.assigned_printshop,
              timestamp: now.toISOString(),
              details: {
                message: `Item overdue by ${daysPastDue} day${daysPastDue > 1 ? 's' : ''}`,
                rule: 'overdue',
                level,
                daysSince: daysPastDue,
                itemName: item.product_name,
                customerName: customer.name,
                externalId: order.external_id || undefined,
              }
            }
            alertActivities.push(activity)
            if (level === 'critical') {
              importantIds.value.add(alertId)
            }
          }
        }
      }

      // Check for unassigned items that are old
      if (!item.assigned_printshop && item.status === 'new') {
        const createdDate = new Date(item.created_at)
        const daysUnassigned = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUnassigned > 1) {
          const level = daysUnassigned > 3 ? 'critical' : 'warning'
          const alertId = `alert-unassigned-${item.id}`

          if (!activities.value.find(a => a.id === alertId)) {
            const activity: Activity = {
              id: alertId,
              type: 'alert',
              user_id: 'system',
              user: 'System',
              entity_type: 'order_item',
              entity_id: item.id,
              order_id: order.id,
              printshop_id: item.assigned_printshop,
              timestamp: now.toISOString(),
              details: {
                message: `Unassigned for ${daysUnassigned} day${daysUnassigned > 1 ? 's' : ''}`,
                rule: 'unassigned_stale',
                level,
                daysSince: daysUnassigned,
                itemName: item.product_name,
                customerName: customer.name,
                externalId: order.external_id || undefined,
              }
            }
            alertActivities.push(activity)
            if (level === 'critical') {
              importantIds.value.add(alertId)
            }
          }
        }
      }

      // Check for items stuck in production
      if (item.status === 'in_production' && item.production_start_date) {
        const startDate = new Date(item.production_start_date)
        const daysInProduction = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysInProduction > 5) {
          const level = daysInProduction > 10 ? 'critical' : 'warning'
          const alertId = `alert-stuck-${item.id}`

          if (!activities.value.find(a => a.id === alertId)) {
            const activity: Activity = {
              id: alertId,
              type: 'alert',
              user_id: 'system',
              user: 'System',
              entity_type: 'order_item',
              entity_id: item.id,
              order_id: order.id,
              printshop_id: item.assigned_printshop,
              timestamp: now.toISOString(),
              details: {
                message: `In production for ${daysInProduction} day${daysInProduction > 1 ? 's' : ''}`,
                rule: 'stuck_production',
                level,
                daysSince: daysInProduction,
                itemName: item.product_name,
                customerName: customer.name,
                externalId: order.external_id || undefined,
              }
            }
            alertActivities.push(activity)
            if (level === 'critical') {
              importantIds.value.add(alertId)
            }
          }
        }
      }
    }

    // Add new alerts to the beginning of the activities array
    if (alertActivities.length > 0) {
      activities.value.unshift(...alertActivities)
    }
  }

  // Getters
  const allActivities = computed(() => activities.value)

  // Get activities filtered by current user's role
  function getActivitiesForRole(): Activity[] {
    const authStore = useAuthStore()
    const orderStore = useOrderStore()

    // Manager sees everything
    if (authStore.isManager) {
      return activities.value
    }

    // Printshop Manager: sees activities where the item is assigned to their shop(s)
    // + order_created activities (everyone sees new orders)
    if (authStore.isPrintshopManager) {
      const userShops = authStore.userShops
      return activities.value.filter(activity => {
        // Everyone sees new orders
        if (activity.type === 'order_created') return true

        // If activity is for an order_item, check if the item is assigned to user's shop
        if (activity.entity_type === 'order_item') {
          const item = orderStore.orderItems.find(i => i.id === activity.entity_id)
          if (item && item.assigned_printshop && userShops.includes(item.assigned_printshop)) {
            return true
          }
        }

        // If activity is for an order (not item), check if ANY item in that order is assigned to user's shops
        if (activity.entity_type === 'order' && activity.order_id) {
          const orderItems = orderStore.orderItems.filter(i => i.order_id === activity.order_id)
          if (orderItems.some(i => i.assigned_printshop && userShops.includes(i.assigned_printshop))) {
            return true
          }
        }

        return false
      })
    }

    // Driver: sees delivery/pickup activities + order_created + out_for_delivery status changes
    if (authStore.isDriver) {
      return activities.value.filter(activity => {
        // Everyone sees new orders
        if (activity.type === 'order_created') return true

        // Delivery and pickup activities
        if (activity.type === 'delivery' || activity.type === 'pickup') return true

        // Status changes to/from delivery-related statuses
        if (activity.type === 'status_change') {
          const deliveryStatuses = ['ready', 'out_for_delivery', 'delivered', 'picked_up']
          if (activity.details.to && deliveryStatuses.includes(activity.details.to)) return true
          if (activity.details.from && deliveryStatuses.includes(activity.details.from)) return true
        }

        // Assignment activities (driver needs to know when items become available)
        if (activity.type === 'assignment') return true

        return false
      })
    }

    // Fallback: show everything
    return activities.value
  }

  // Sound notification
  const audio = new Audio(pingSound)

  function playNotificationSound() {
    const now = Date.now()
    const timeSinceLastSound = now - lastSoundPlayedAt.value

    // Only play if 30 seconds have passed since last sound
    if (timeSinceLastSound >= 30000) {
      audio.play().catch(err => {
        console.warn('Failed to play notification sound:', err)
      })
      lastSoundPlayedAt.value = now
    }
  }

  // Watch for new activities
  let previousActivityCount = activities.value.length
  watch(activities, (newActivities) => {
    // Skip sound on initial load
    if (!initialLoadComplete.value) {
      return
    }

    // Check if new activities were added
    if (newActivities.length > previousActivityCount) {
      playNotificationSound()
    }

    previousActivityCount = newActivities.length
  }, { deep: false })

  // Add Activity
  async function addActivity(activityData: Omit<Activity, 'id' | 'timestamp'>) {
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...activityData,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding activity:', error)
        return null
      }

      // Note: local state updates via realtime subscription
      // No need to manually push to activities array

      return data as Activity
    } catch (error) {
      console.error('Failed to add activity:', error)
      return null
    }
  }

  // Toggle Seen and Important
  function toggleSeen(activityId: string) {
    if (seenIds.value.has(activityId)) {
      seenIds.value.delete(activityId)
    } else {
      seenIds.value.add(activityId)
    }
    saveSeenToLocalStorage()
  }

  function toggleImportant(activityId: string) {
    if (importantIds.value.has(activityId)) {
      importantIds.value.delete(activityId)
    } else {
      importantIds.value.add(activityId)
    }
    saveImportantToLocalStorage()
  }

  function isSeen(activityId: string): boolean {
    return seenIds.value.has(activityId)
  }

  function isImportant(activityId: string): boolean {
    return importantIds.value.has(activityId)
  }

  return {
    // State
    activities,
    seenIds,
    importantIds,
    // Getters
    allActivities,
    getActivitiesForRole,
    isSeen,
    isImportant,
    // Actions
    init,
    cleanup,
    fetchActivities,
    addActivity,
    toggleSeen,
    toggleImportant,
    generateAlerts,
  }
})
