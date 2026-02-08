<script setup lang="ts">
import { computed } from 'vue'
import type { OrderWithDetails } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { Truck, CheckCircle2 } from 'lucide-vue-next'
import Checkbox from '@/components/ui/Checkbox.vue'

interface Props {
  orders: OrderWithDetails[]
  selectedIds: Set<string>
}

interface Emits {
  (e: 'toggle-select', orderId: string): void
  (e: 'order-click', orderId: string): void
  (e: 'select-all'): void
  (e: 'deselect-all'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getPrintshopById } = usePrintshops()

const allSelected = computed(() => {
  return props.orders.length > 0 && props.orders.every(o => props.selectedIds.has(o.id))
})

const handleSelectAll = () => {
  if (allSelected.value) {
    emit('deselect-all')
  } else {
    emit('select-all')
  }
}

const getPickupShops = (order: OrderWithDetails): string => {
  // Only consider items ready for delivery
  const deliverableItems = order.items.filter(i => i.status === 'ready' || i.status === 'out_for_delivery')
  const shops = [...new Set(deliverableItems
    .map(i => i.assigned_printshop)
    .filter(Boolean)
    .map(shopId => {
      const shop = getPrintshopById(shopId!)
      return shop?.name || 'Unknown'
    })
  )]
  return shops.join(', ') || 'No shop assigned'
}

const getShopAddress = (order: OrderWithDetails): string => {
  // Only consider items ready for delivery
  const deliverableItems = order.items.filter(i => i.status === 'ready' || i.status === 'out_for_delivery')
  const shopId = deliverableItems.find(i => i.assigned_printshop)?.assigned_printshop
  if (!shopId) return ''
  const shop = getPrintshopById(shopId)
  return shop?.address || ''
}

const getDeliverableItemsCount = (order: OrderWithDetails): number => {
  return order.items.filter(i => i.status === 'ready' || i.status === 'out_for_delivery').length
}

const getItemsStatus = (order: OrderWithDetails): { text: string; class: string } => {
  // Only consider items ready for delivery
  const deliverableItems = order.items.filter(i => i.status === 'ready' || i.status === 'out_for_delivery')
  const allReady = deliverableItems.every(i => i.status === 'ready')
  const someInTransit = deliverableItems.some(i => i.status === 'out_for_delivery')

  if (allReady) {
    return { text: 'All ready ✓', class: 'text-green-600 font-medium' }
  } else if (someInTransit) {
    return { text: 'In transit', class: 'text-amber-600 font-medium' }
  } else {
    return { text: 'Mixed status', class: 'text-muted-foreground' }
  }
}

const handleRowClick = (orderId: string, event: Event) => {
  const target = event.target as HTMLElement
  if (target.closest('.checkbox-cell')) {
    return
  }
  emit('order-click', orderId)
}
</script>

<template>
  <div class="w-full">
    <!-- Header Row -->
    <div class="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-4 border-b bg-muted/30 items-center">
      <div class="checkbox-cell flex items-center justify-center">
        <Checkbox
          :model-value="allSelected"
          @update:model-value="handleSelectAll"
        />
      </div>
      <div>Order</div>
      <div>Customer</div>
      <div>Pickup From</div>
      <div class="text-right pr-4">Items</div>
    </div>

    <!-- Empty State -->
    <div v-if="orders.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Truck class="h-12 w-12 mb-4 opacity-50" />
      <p class="text-sm">No orders ready for delivery</p>
    </div>

    <!-- Order Rows -->
    <div
      v-for="order in orders"
      :key="order.id"
      :class="[
        'grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 border-b hover:bg-accent/50 transition-colors cursor-pointer py-3 px-4 items-center',
        selectedIds.has(order.id) ? 'bg-primary/5 border-primary/30' : ''
      ]"
      @click="handleRowClick(order.id, $event)"
    >
      <!-- Checkbox -->
      <div class="checkbox-cell flex items-center justify-center" @click.stop>
        <Checkbox
          :model-value="selectedIds.has(order.id)"
          @update:model-value="emit('toggle-select', order.id)"
        />
      </div>

      <!-- Column 1: Order -->
      <div class="min-w-0">
        <div class="text-sm font-medium">
          #{{ order.external_id || order.id.slice(0, 8) }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          {{ order.customer.company || order.customer.name }}
        </div>
      </div>

      <!-- Column 2: Customer -->
      <div class="min-w-0">
        <div class="text-sm">{{ order.customer.name }}</div>
        <div class="text-xs text-muted-foreground truncate">
          {{ order.customer.address }}
        </div>
      </div>

      <!-- Column 3: Pickup From -->
      <div class="min-w-0">
        <div class="text-sm">{{ getPickupShops(order) }}</div>
        <div class="text-xs text-muted-foreground truncate">
          {{ getShopAddress(order) }}
        </div>
      </div>

      <!-- Column 4: Items -->
      <div class="text-right pr-4">
        <div class="text-sm">
          {{ getDeliverableItemsCount(order) }} item{{ getDeliverableItemsCount(order) !== 1 ? 's' : '' }}
        </div>
        <div :class="['text-xs', getItemsStatus(order).class]">
          {{ getItemsStatus(order).text }}
        </div>
      </div>
    </div>
  </div>
</template>
