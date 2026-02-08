import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Activity } from '@/types'
import { activities as mockActivities } from '@/data/mock/activities'

export const useActivityStore = defineStore('activities', () => {
  // State
  const activities = ref<Activity[]>([...mockActivities])

  // Getters
  const allActivities = computed(() => activities.value)

  // Actions
  function addActivity(activity: Activity) {
    // Add to beginning of array (most recent first)
    activities.value.unshift(activity)
  }

  return {
    // State
    activities,
    // Getters
    allActivities,
    // Actions
    addActivity,
  }
})
