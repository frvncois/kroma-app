import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Activity } from '@/types'
import { activities as mockActivities } from '@/data/mock/activities'
import { useAuthStore } from './auth'
import { useOrderStore } from './orders'
import { useCustomerStore } from './customers'
import pingSound from '@/assets/ping.mp3'

export const useActivityStore = defineStore('activities', () => {
  // State
  const activities = ref<Activity[]>([...mockActivities])
  const lastSoundPlayedAt = ref<number>(0)
  const initialLoadComplete = ref(false)

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
            alertActivities.push({
              id: alertId,
              type: 'alert',
              timestamp: now.toISOString(),
              user: 'System',
              seen: false,
              important: level === 'critical',
              item: {
                id: item.id,
                name: item.product_name,
                orderId: order.id
              },
              order: {
                id: order.id,
                externalId: order.external_id || undefined,
                customer: customer.name
              },
              details: {
                message: `Item overdue by ${daysPastDue} day${daysPastDue > 1 ? 's' : ''}`
              },
              alert: {
                rule: 'overdue',
                level,
                daysSince: daysPastDue
              }
            })
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
            alertActivities.push({
              id: alertId,
              type: 'alert',
              timestamp: now.toISOString(),
              user: 'System',
              seen: false,
              important: level === 'critical',
              item: {
                id: item.id,
                name: item.product_name,
                orderId: order.id
              },
              order: {
                id: order.id,
                externalId: order.external_id || undefined,
                customer: customer.name
              },
              details: {
                message: `Unassigned for ${daysUnassigned} day${daysUnassigned > 1 ? 's' : ''}`
              },
              alert: {
                rule: 'unassigned_stale',
                level,
                daysSince: daysUnassigned
              }
            })
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
            alertActivities.push({
              id: alertId,
              type: 'alert',
              timestamp: now.toISOString(),
              user: 'System',
              seen: false,
              important: level === 'critical',
              item: {
                id: item.id,
                name: item.product_name,
                orderId: order.id
              },
              order: {
                id: order.id,
                externalId: order.external_id || undefined,
                customer: customer.name
              },
              details: {
                message: `In production for ${daysInProduction} day${daysInProduction > 1 ? 's' : ''}`
              },
              alert: {
                rule: 'stuck_production',
                level,
                daysSince: daysInProduction
              }
            })
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

        // If activity has an item reference, check if the item is assigned to user's shop
        if (activity.item?.id) {
          const item = orderStore.orderItems.find(i => i.id === activity.item!.id)
          if (item && item.assigned_printshop && userShops.includes(item.assigned_printshop)) {
            return true
          }
        }

        // If activity has an order reference but no item, check if ANY item in that order is assigned to user's shops
        if (activity.order?.id && !activity.item?.id) {
          const orderItems = orderStore.orderItems.filter(i => i.order_id === activity.order!.id)
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

  // Actions
  function addActivity(activity: Activity) {
    // Add to beginning of array (most recent first)
    activities.value.unshift(activity)
  }

  function toggleSeen(activityId: string) {
    const activity = activities.value.find(a => a.id === activityId)
    if (activity) {
      activity.seen = !activity.seen
    }
  }

  function toggleImportant(activityId: string) {
    const activity = activities.value.find(a => a.id === activityId)
    if (activity) {
      activity.important = !activity.important
    }
  }

  // Initialize: generate alerts on store creation
  generateAlerts()

  // Mark initial load complete after a brief delay to ensure alerts are loaded
  setTimeout(() => {
    initialLoadComplete.value = true
  }, 100)

  return {
    // State
    activities,
    // Getters
    allActivities,
    getActivitiesForRole,
    // Actions
    addActivity,
    toggleSeen,
    toggleImportant,
    generateAlerts,
  }
})
