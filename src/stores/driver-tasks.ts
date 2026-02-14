import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DriverTask, DriverTaskStatus } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'
import { useActivityStore } from './activities'

export const useDriverTaskStore = defineStore('driver-tasks', () => {
  // State
  const tasks = ref<DriverTask[]>([])
  let realtimeChannel: any = null

  // Actions
  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching driver tasks:', error)
        return
      }

      if (data) {
        tasks.value = data as DriverTask[]
        console.log('Driver tasks loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch driver tasks:', error)
    }
  }

  async function fetchTasksForDriver(userId: string): Promise<DriverTask[]> {
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasks for driver:', error)
        return []
      }

      return (data as DriverTask[]) || []
    } catch (error) {
      console.error('Failed to fetch tasks for driver:', error)
      return []
    }
  }

  async function createTask(taskData: {
    created_by: string
    assigned_to: string
    title: string
    type: DriverTask['type']
    priority: DriverTask['priority']
    details: string
    address: string
    lat: number | null
    lng: number | null
    complete_by: string | null
  }): Promise<DriverTask | null> {
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .insert({
          ...taskData,
          status: 'pending',
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating driver task:', error)
        return null
      }

      if (data) {
        const newTask = data as DriverTask
        tasks.value.unshift(newTask)
        console.log('Driver task created:', newTask.id)

        // Write activity
        const authStore = useAuthStore()
        const activityStore = useActivityStore()

        await activityStore.addActivity({
          type: 'assignment',
          user_id: authStore.currentUser?.id || 'system',
          user: authStore.currentUser?.name || 'System',
          entity_type: 'driver_task',
          entity_id: newTask.id,
          order_id: null,
          printshop_id: null,
          details: {
            message: `Driver task created: ${newTask.title}`,
            taskType: newTask.type,
            priority: newTask.priority,
            assignedTo: newTask.assigned_to,
          },
        })

        return newTask
      }

      return null
    } catch (error) {
      console.error('Failed to create driver task:', error)
      return null
    }
  }

  async function updateTaskStatus(
    taskId: string,
    newStatus: DriverTaskStatus
  ): Promise<DriverTask | null> {
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) {
        console.error('Error updating task status:', error)
        return null
      }

      if (data) {
        const updatedTask = data as DriverTask
        const index = tasks.value.findIndex((t) => t.id === taskId)
        if (index !== -1) {
          tasks.value[index] = updatedTask
        }
        console.log('Task status updated:', taskId, newStatus)

        // Write activity
        const authStore = useAuthStore()
        const activityStore = useActivityStore()

        await activityStore.addActivity({
          type: 'status_change',
          user_id: authStore.currentUser?.id || 'system',
          user: authStore.currentUser?.name || 'System',
          entity_type: 'driver_task',
          entity_id: taskId,
          order_id: null,
          printshop_id: null,
          details: {
            message: `Task status updated to ${newStatus}`,
            to: newStatus,
          },
        })

        return updatedTask
      }

      return null
    } catch (error) {
      console.error('Failed to update task status:', error)
      return null
    }
  }

  function setupRealtimeSubscription() {
    realtimeChannel = supabase
      .channel('driver-tasks-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_tasks' },
        (payload) => {
          const newTask = payload.new as DriverTask
          tasks.value.unshift(newTask)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_tasks' },
        (payload) => {
          const updatedTask = payload.new as DriverTask
          const index = tasks.value.findIndex((t) => t.id === updatedTask.id)
          if (index !== -1) {
            tasks.value[index] = updatedTask
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'driver_tasks' },
        (payload) => {
          const deletedId = payload.old.id
          tasks.value = tasks.value.filter((t) => t.id !== deletedId)
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

  async function init() {
    await fetchTasks()
    setupRealtimeSubscription()
  }

  // Getters
  const getTasksByDriver = computed(() => (userId: string) => {
    return tasks.value.filter((task) => task.assigned_to === userId)
  })

  const getPendingTasks = computed(() => (userId: string) => {
    return tasks.value.filter(
      (task) =>
        task.assigned_to === userId &&
        (task.status === 'pending' || task.status === 'in_progress')
    )
  })

  return {
    // State
    tasks,
    // Getters
    getTasksByDriver,
    getPendingTasks,
    // Actions
    init,
    cleanup,
    fetchTasks,
    fetchTasksForDriver,
    createTask,
    updateTaskStatus,
  }
})
