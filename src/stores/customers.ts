import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@/types'
import { supabase } from '@/lib/supabase'
import { useOrderStore } from './orders'

export const useCustomerStore = defineStore('customers', () => {
  // State
  const customers = ref<Customer[]>([])

  // Actions
  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching customers:', error)
        return
      }

      if (data) {
        customers.value = data as Customer[]
        console.log('Customers loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  async function addCustomer(customerData: {
    name: string
    email: string
    phone: string
    company?: string | null
    address: string
    notes?: string
  }): Promise<Customer | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          company: customerData.company || null,
          address: customerData.address,
          lat: 0, // Phase 4 will geocode
          lng: 0,
          notes: customerData.notes || '',
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding customer:', error)
        return null
      }

      if (data) {
        const newCustomer = data as Customer
        // Realtime subscription will add to local state automatically
        console.log('Customer added:', newCustomer.id)
        return newCustomer
      }

      return null
    } catch (error) {
      console.error('Failed to add customer:', error)
      return null
    }
  }

  async function updateCustomer(
    customerId: string,
    updates: Partial<Customer>
  ): Promise<Customer | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .select()
        .single()

      if (error) {
        console.error('Error updating customer:', error)
        return null
      }

      if (data) {
        const updatedCustomer = data as Customer
        // Update local state
        const index = customers.value.findIndex((c) => c.id === customerId)
        if (index !== -1) {
          customers.value[index] = updatedCustomer
        }
        console.log('Customer updated:', customerId)
        return updatedCustomer
      }

      return null
    } catch (error) {
      console.error('Failed to update customer:', error)
      return null
    }
  }

  async function init() {
    await fetchCustomers()
  }

  // Getters
  const allCustomers = computed(() => customers.value)

  function getCustomerById(id: string): Customer | undefined {
    return customers.value.find((c) => c.id === id)
  }

  function getCustomerOrderStats(customerId: string): {
    totalOrders: number
    totalSpent: number
    lastOrderDate: string | null
    activeOrders: number
  } {
    // Call inside function - Pinia handles circular dependencies safely
    const orderStore = useOrderStore()

    const customerOrders = orderStore.ordersWithDetails.filter(
      (order) => order.customer_id === customerId
    )

    const totalOrders = customerOrders.length
    const totalSpent = customerOrders.reduce(
      (sum, order) => sum + (order.amount_total || 0),
      0
    )

    const terminalStatuses = ['delivered', 'picked_up', 'canceled']
    const activeOrders = customerOrders.filter(
      (order) => !terminalStatuses.includes(order.statusRollup as string)
    ).length

    const sortedOrders = customerOrders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const lastOrderDate = sortedOrders.length > 0 ? sortedOrders[0]!.created_at : null

    return {
      totalOrders,
      totalSpent,
      lastOrderDate,
      activeOrders,
    }
  }

  function searchCustomers(query: string): Customer[] {
    if (!query.trim()) return customers.value

    const lowerQuery = query.toLowerCase()
    return customers.value.filter(
      (customer) =>
        customer.name.toLowerCase().includes(lowerQuery) ||
        customer.email.toLowerCase().includes(lowerQuery) ||
        (customer.company && customer.company.toLowerCase().includes(lowerQuery)) ||
        customer.phone.toLowerCase().includes(lowerQuery)
    )
  }

  return {
    // State
    customers,
    // Getters
    allCustomers,
    getCustomerById,
    // Actions
    fetchCustomers,
    addCustomer,
    updateCustomer,
    getCustomerOrderStats,
    searchCustomers,
    init,
  }
})
