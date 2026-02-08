<script setup lang="ts">
import { ref, computed } from 'vue'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import type { Printshop } from '@/types'
import { usePrintshops } from '@/composables/usePrintshops'
import { formatDate, formatStatus, formatPrintshop } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import Sheet from '@/components/ui/Sheet.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import { Search } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  title: string
  items: OrderItemWithDetails[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'item-click': [orderId: string]
}>()

const { getPrintshopById } = usePrintshops()
const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.items
  }

  const query = searchQuery.value.toLowerCase()
  return props.items.filter((item) => {
    // Search in product name
    if (item.product_name.toLowerCase().includes(query)) return true

    // Search in description
    if (item.description?.toLowerCase().includes(query)) return true

    // Search in customer name
    if (item.customer.name.toLowerCase().includes(query)) return true

    // Search in company name
    if (item.customer.company?.toLowerCase().includes(query)) return true

    // Search in order ID
    if (item.order.external_id?.toLowerCase().includes(query)) return true
    if (item.order.id.toLowerCase().includes(query)) return true

    // Search in printshop name
    if (item.assigned_printshop) {
      const shop = getPrintshopById(item.assigned_printshop)
      if (shop?.name.toLowerCase().includes(query)) return true
    }

    return false
  })
})
</script>

<template>
  <Sheet :open="isOpen" @update:open="emit('update:isOpen', $event)" :title="title" side="left">
    <div class="flex flex-col h-full">
      <!-- Search Input -->
      <div class="p-4 border-b bg-background">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search items..."
            class="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <!-- Items List -->
      <div class="flex-1 overflow-auto p-4">
        <div v-if="filteredItems.length === 0" class="text-center text-muted-foreground py-8">
          {{ searchQuery ? 'No items match your search' : 'No items found.' }}
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            @click="emit('item-click', item.order_id)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="font-semibold text-lg mb-1">{{ item.product_name }}</div>
                <div class="text-sm text-muted-foreground mb-2">{{ item.description }}</div>
                <div class="flex flex-wrap gap-2">
                  <Badge variant="outline">{{ item.customer.name }}</Badge>
                  <Badge variant="outline">Qty: {{ item.quantity }}</Badge>
                  <Badge variant="outline">{{ item.assigned_printshop ? formatPrintshop(item.assigned_printshop) : 'Unassigned' }}</Badge>
                  <Badge :variant="getStatusVariant(item.status)">{{ formatStatus(item.status) }}</Badge>
                  <Badge v-if="item.due_date" variant="outline">Due: {{ formatDate(item.due_date) }}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
</template>
