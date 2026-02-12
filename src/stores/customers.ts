import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@/types'
import { customers as mockCustomers } from '@/data/mock/customers'
import { useOrderStore } from './orders'

export const useCustomerStore = defineStore('customers', () => {
  // State
  const customers = ref<Customer[]>([...mockCustomers])

  // Getters
  const allCustomers = computed(() => customers.value)

  function getCustomerById(id: string): Customer | undefined {
    return customers.value.find((c) => c.id === id)
  }

  // Actions
  function addCustomer(customerData: {
    name: string
    email: string
    phone: string
    company?: string | null
    address: string
    notes?: string
  }): Customer {
    const now = new Date().toISOString()
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      company: customerData.company || null,
      address: customerData.address,
      lat: 0, // Phase 4 will geocode
      lng: 0,
      notes: customerData.notes || '',
      created_at: now,
      updated_at: now,
    }

    customers.value.push(newCustomer)
    return newCustomer
  }

  function updateCustomer(customerId: string, updates: Partial<Customer>): Customer | undefined {
    const customer = customers.value.find((c) => c.id === customerId)
    if (!customer) return undefined

    Object.assign(customer, updates, {
      updated_at: new Date().toISOString(),
    })

    return customer
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
    addCustomer,
    updateCustomer,
    getCustomerOrderStats,
    searchCustomers,
  }
})
