import { usePrintshopStore } from '@/stores/printshops'

/**
 * Thin wrapper around usePrintshopStore() for backward compatibility.
 * Components can continue using this composable while the store
 * handles all state management internally.
 */
export function usePrintshops() {
  const store = usePrintshopStore()

  return {
    getPrintshops: () => store.allPrintshops,
    getPrintshopById: (id: string) => store.getPrintshopById(id),
    getPrintshopName: (id: string | null) => store.getPrintshopName(id),
  }
}
