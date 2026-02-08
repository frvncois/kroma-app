import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Printshop } from '@/types'
import { printshops as mockPrintshops } from '@/data/mock/printshops'

export const usePrintshopStore = defineStore('printshops', () => {
  // State
  const printshops = ref<Printshop[]>(mockPrintshops)

  // Getters
  const allPrintshops = computed(() => printshops.value)

  const getPrintshopById = (id: string) => {
    return printshops.value.find((shop) => shop.id === id)
  }

  const getPrintshopName = (id: string | null): string => {
    if (!id) return 'Unassigned'
    const shop = getPrintshopById(id)
    return shop?.name || 'Unknown'
  }

  return {
    // State
    printshops: allPrintshops,

    // Getters
    allPrintshops,
    getPrintshopById,
    getPrintshopName,
  }
})
