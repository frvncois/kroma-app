import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Printshop } from '@/types'
import { supabase } from '@/lib/supabase'

export const usePrintshopStore = defineStore('printshops', () => {
  // State
  const printshops = ref<Printshop[]>([])

  // Actions
  async function fetchPrintshops() {
    try {
      const { data, error } = await supabase
        .from('printshops')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching printshops:', error)
        return
      }

      if (data) {
        printshops.value = data as Printshop[]
        console.log('Printshops loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch printshops:', error)
    }
  }

  async function init() {
    await fetchPrintshops()
  }

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

    // Actions
    fetchPrintshops,
    init,
  }
})
