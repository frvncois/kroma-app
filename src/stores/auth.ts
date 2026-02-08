import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { users } from '@/data/mock/users'

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)

  // Getters
  const isAuthenticated = computed(() => currentUser.value !== null)
  const userRole = computed(() => currentUser.value?.role || null)
  const userShops = computed(() => currentUser.value?.assigned_shops || [])
  const isManager = computed(() => currentUser.value?.role === 'manager')
  const isPrintshopManager = computed(() => currentUser.value?.role === 'printshop_manager')
  const isDriver = computed(() => currentUser.value?.role === 'driver')

  // Actions
  function login(email: string, password: string): { success: boolean; message?: string } {
    const user = users.find((u) => u.email === email && u.password === password)

    if (user) {
      currentUser.value = user
      return { success: true }
    }

    return { success: false, message: 'Invalid email or password' }
  }

  function logout() {
    currentUser.value = null
  }

  function canAccessShop(shopId: string): boolean {
    if (!currentUser.value) return false

    // Managers can access all shops
    if (currentUser.value.role === 'manager') return true

    // Printshop managers can only access their assigned shops
    if (currentUser.value.role === 'printshop_manager') {
      return currentUser.value.assigned_shops.includes(shopId)
    }

    // Drivers can access all shops for delivery purposes
    if (currentUser.value.role === 'driver') return true

    return false
  }

  return {
    // State
    currentUser,
    // Getters
    isAuthenticated,
    userRole,
    userShops,
    isManager,
    isPrintshopManager,
    isDriver,
    // Actions
    login,
    logout,
    canAccessShop,
  }
})
