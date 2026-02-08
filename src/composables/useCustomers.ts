import { ref } from 'vue'
import { customers, type Customer } from '@/data/mock/customers'

export function useCustomers() {
  const allCustomers = ref<Customer[]>(customers)

  const getCustomers = () => {
    return allCustomers.value
  }

  const getCustomerById = (id: string) => {
    return allCustomers.value.find((customer) => customer.id === id)
  }

  return {
    getCustomers,
    getCustomerById,
  }
}
