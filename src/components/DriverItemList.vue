<script setup lang="ts">
import { computed } from 'vue'
import type { OrderWithDetails } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { Truck } from 'lucide-vue-next'

interface Props {
  orders: OrderWithDetails[]
}

interface Emits {
  (e: 'order-click', orderId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getPrintshopById } = usePrintshops()

// Group orders by urgency
const groupedOrders = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  const overdue: OrderWithDetails[] = []
  const dueToday: OrderWithDetails[] = []
  const dueTomorrow: OrderWithDetails[] = []
  const upcoming: OrderWithDetails[] = []

  for (const order of props.orders) {
    // Find earliest due date among deliverable items
    const earliestDue = order.items
      .filter(i => i.status === 'ready' || i.status === 'out_for_delivery')
      .map(i => i.due_date)
      .filter(Boolean)
      .sort()[0]

    if (!earliestDue) {
      upcoming.push(order)
    } else {
      const dueDate = new Date(earliestDue)
      if (dueDate < today) overdue.push(order)
      else if (dueDate < tomorrow) dueToday.push(order)
      else if (dueDate < new Date(tomorrow.getTime() + 86400000)) dueTomorrow.push(order)
      else upcoming.push(order)
    }
  }

  return [
    { label: '🔴 Overdue', orders: overdue, class: 'text-red-600' },
    { label: '🟠 Due Today', orders: dueToday, class: 'text-orange-600' },
    { label: '🟡 Due Tomorrow', orders: dueTomorrow, class: 'text-amber-600' },
    { label: '⚪ Upcoming & Unscheduled', orders: upcoming, class: 'text-muted-foreground' },
  ].filter(g => g.orders.length > 0)
})

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
</script>

<template>
  <div class="w-full bg-muted/30 rounded-2xl border pb-2">
    <!-- Column Header -->
    <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 text-xs font-medium text-background uppercase tracking-wider py-3 px-4 bg-foreground rounded-t-xl items-center">
      <div>Order</div>
      <div>Customer</div>
      <div>Pickup From</div>
      <div class="text-right pr-4">Items</div>
    </div>

    <!-- Empty State -->
    <div v-if="orders.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground m-2">
      <Truck class="h-12 w-12 mb-4 opacity-50" />
      <p class="text-sm">No orders ready for delivery</p>
    </div>

    <!-- Grouped Sections -->
    <template v-for="group in groupedOrders" :key="group.label">

      <div
        v-for="order in group.orders"
        :key="order.id"
        class="m-2"
      >
        <div
          class="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 rounded-xl border bg-background/50 hover:bg-background transition-colors cursor-pointer py-3 px-4 items-center"
          @click="emit('order-click', order.id)"
        >
        <!-- Order -->
        <div class="min-w-0">
          <div class="text-sm font-medium">#{{ order.external_id || order.id.slice(0, 8) }}</div>
          <div class="text-xs text-muted-foreground truncate">{{ order.customer.company || order.customer.name }}</div>
        </div>
        <!-- Customer -->
        <div class="min-w-0">
          <div class="text-sm">{{ order.customer.name }}</div>
          <div class="text-xs text-muted-foreground truncate">{{ order.customer.address }}</div>
        </div>
        <!-- Pickup From -->
        <div class="min-w-0">
          <div class="text-sm">{{ getPickupShops(order) }}</div>
        </div>
        <!-- Items -->
        <div class="text-right pr-4">
          <div class="text-sm">{{ getDeliverableItemsCount(order) }} item{{ getDeliverableItemsCount(order) !== 1 ? 's' : '' }}</div>
          <div :class="['text-xs', getItemsStatus(order).class]">{{ getItemsStatus(order).text }}</div>
        </div>
        </div>
      </div>
    </template>
  </div>
</template>
