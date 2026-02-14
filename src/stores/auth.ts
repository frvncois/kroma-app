import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { supabase } from '@/lib/supabase'
import { useDriverStore } from './drivers'

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)
  const isLoading = ref(true)

  // Getters
  const isAuthenticated = computed(() => currentUser.value !== null)
  const userRole = computed(() => currentUser.value?.role || null)
  const userShops = computed(() => currentUser.value?.assigned_shops || [])
  const isManager = computed(() => currentUser.value?.role === 'manager')
  const isPrintshopManager = computed(() => currentUser.value?.role === 'printshop_manager')
  const isDriver = computed(() => currentUser.value?.role === 'driver')

  // Actions
  async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        console.error('Auth error:', authError)
        return { success: false, message: authError.message || 'Invalid email or password' }
      }

      if (!authData.user) {
        return { success: false, message: 'Login failed' }
      }

      // Fetch user profile from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (userError || !userData) {
        console.error('User fetch error:', userError)
        await supabase.auth.signOut()
        return { success: false, message: 'User profile not found' }
      }

      // Set current user
      currentUser.value = userData as User

      // Register driver session
      if (userData.role === 'driver') {
        const driverStore = useDriverStore()
        driverStore.registerDriverSession(userData.id)
      }

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'An unexpected error occurred' }
    }
  }

  async function logout() {
    try {
      // Unregister driver session if applicable
      if (currentUser.value?.role === 'driver') {
        const driverStore = useDriverStore()
        driverStore.unregisterDriverSession(currentUser.value.id)
      }

      // Sign out from Supabase
      await supabase.auth.signOut()
      currentUser.value = null
    } catch (error) {
      console.error('Logout error:', error)
      currentUser.value = null
    }
  }

  async function init() {
    try {
      isLoading.value = true

      // Check for existing session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error:', sessionError)
        isLoading.value = false
        return
      }

      if (session?.user) {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!userError && userData) {
          currentUser.value = userData as User

          // Register driver session if applicable
          if (userData.role === 'driver') {
            const driverStore = useDriverStore()
            driverStore.registerDriverSession(userData.id)
          }
        }
      }

      // Set up auth state change listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state change:', event)

        if (event === 'SIGNED_OUT' || !session) {
          currentUser.value = null
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Fetch/refresh user profile
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (userData) {
            currentUser.value = userData as User
          }
        }
      })

      isLoading.value = false
    } catch (error) {
      console.error('Init error:', error)
      isLoading.value = false
    }
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
    isLoading,
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
    init,
    canAccessShop,
  }
})
