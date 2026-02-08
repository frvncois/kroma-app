<script setup lang="ts">
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import { formatDate, formatPayment, formatPrintshop, isOverdue } from '@/lib/formatters'
import { getPaymentVariant } from '@/lib/variants'
import Badge from '@/components/ui/Badge.vue'

interface Props {
  item: OrderItemWithDetails
  isDragging?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
  readonly: false
})

const emit = defineEmits<{
  'click': []
  'dragstart': []
  'dragend': []
}>()

const handleDragStart = () => {
  if (!props.readonly) {
    emit('dragstart')
  }
}

const handleDragEnd = () => {
  if (!props.readonly) {
    emit('dragend')
  }
}
</script>

<template>
  <div
    :draggable="!readonly"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="emit('click')"
    :class="[
      'rounded-lg border bg-background p-2 shadow-sm transition-all hover:shadow-md space-y-1',
      readonly ? 'cursor-pointer' : 'cursor-move',
      { 'opacity-50': isDragging }
    ]"
  >
    <!-- Line 1: Item title -->
    <div class="text-sm font-semibold truncate">{{ item.product_name }}</div>

    <!-- Line 2: Printshop | Due date -->
    <div class="flex items-center justify-between text-[10px]">
      <span class="text-muted-foreground truncate">{{ formatPrintshop(item.assigned_printshop) }}</span>
      <span class="text-muted-foreground" :class="isOverdue(item) ? 'text-red-600 font-semibold' : ''">
        {{ item.due_date ? formatDate(item.due_date) : 'No due date' }}
      </span>
    </div>

    <!-- Line 3: Quantity -->
    <div class="text-xs text-muted-foreground">
      Qty: {{ item.quantity }}
    </div>

    <!-- Line 4: Order number -->
    <div class="text-xs text-muted-foreground truncate">
      #{{ item.order.external_id || item.order.id.slice(0, 8) }}
    </div>

    <!-- Line 5: Client | Payment -->
    <div class="flex items-center justify-between text-[10px]">
      <span class="text-muted-foreground truncate flex-1 mr-1">{{ item.customer.name }}</span>
      <Badge :variant="getPaymentVariant(item.order.payment_status)" class="text-[10px] px-1.5 py-0 flex-shrink-0">
        {{ formatPayment(item.order.payment_status) }}
      </Badge>
    </div>
  </div>
</template>
