import { useCustomerStore } from '@/stores/customers'

/**
 * Thin wrapper around useCustomerStore() for backward compatibility.
 * Components can continue using this composable while the store
 * handles all state management internally.
 */
export function useCustomers() {
  const store = useCustomerStore()

  return {
    getCustomers: () => store.allCustomers,
    getCustomerById: (id: string) => store.getCustomerById(id),
  }
}
