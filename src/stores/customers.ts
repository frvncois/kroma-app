import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@/types'
import { customers as mockCustomers } from '@/data/mock/customers'

export const useCustomerStore = defineStore('customers', () => {
  // State
  const customers = ref<Customer[]>([...mockCustomers])

  // Getters
  const allCustomers = computed(() => customers.value)

  function getCustomerById(id: string): Customer | undefined {
    return customers.value.find((c) => c.id === id)
  }

  return {
    // State
    customers,
    // Getters
    allCustomers,
    getCustomerById,
  }
})
