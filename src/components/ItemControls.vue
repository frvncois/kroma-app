<script setup lang="ts">
import { computed } from 'vue'
import type { OrderItem, Printshop, ItemStatus } from '@/types'
import { usePrintshops } from '@/composables/usePrintshops'
import { formatDate, isOverdue, formatRelativeDueDate } from '@/lib/formatters'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import DatePicker from '@/components/ui/DatePicker.vue'

const { getPrintshops } = usePrintshops()

interface Props {
  item: Pick<OrderItem, 'id' | 'status' | 'assigned_printshop' | 'due_date' | 'delivery_date' | 'production_start_date' | 'production_ready_date'> & {
    order?: { created_at: string }
    customer?: { name: string }
  }
  showPrintshop?: boolean
  showStatus?: boolean
  showDueDate?: boolean
  showTimeline?: boolean
  readonly?: boolean
  layout?: 'inline' | 'stacked'
  printshops?: Printshop[]
}

const props = withDefaults(defineProps<Props>(), {
  showPrintshop: true,
  showStatus: true,
  showDueDate: true,
  showTimeline: false,
  readonly: false,
  layout: 'stacked',
})

const emit = defineEmits<{
  'update:status': [itemId: string, status: ItemStatus]
  'update:printshop': [itemId: string, shopId: string | null]
  'update:dueDate': [itemId: string, date: string | null]
}>()

// Use prop if provided, otherwise fetch from store
const effectivePrintshops = computed(() => props.printshops || getPrintshops())

const printshopOptions = computed(() => [
  { value: '', label: 'Unassigned' },
  ...effectivePrintshops.value.map(s => ({ value: s.id, label: s.name }))
])

const handlePrintshopUpdate = (value: string | string[]) => {
  const shopId = typeof value === 'string' ? value : value[0]
  emit('update:printshop', props.item.id, shopId || null)
}

const handleStatusUpdate = (itemId: string, status: ItemStatus) => {
  emit('update:status', itemId, status)
}

const handleDueDateUpdate = (date: string | null) => {
  emit('update:dueDate', props.item.id, date)
}
</script>

<template>
  <div :class="layout === 'inline' ? 'flex gap-3 items-end' : 'space-y-3'">
    <!-- Printshop Selector -->
    <div v-if="showPrintshop">
      <label class="text-xs text-muted-foreground mb-1 block">Printshop</label>
      <FilterSelect
        v-if="!readonly"
        :model-value="item.assigned_printshop || ''"
        :options="printshopOptions"
        @update:model-value="handlePrintshopUpdate"
        class="w-full text-xs"
      />
      <div v-else class="text-sm">
        {{ effectivePrintshops.find(s => s.id === item.assigned_printshop)?.name || 'Unassigned' }}
      </div>
    </div>

    <!-- Status Selector -->
    <div v-if="showStatus">
      <label class="text-xs text-muted-foreground mb-1 block">Status</label>
      <ItemStatusCombobox
        v-if="!readonly"
        :model-value="item.status"
        :item-id="item.id"
        @update:model-value="handleStatusUpdate"
      />
      <div v-else class="text-sm capitalize">
        {{ item.status.split('_').join(' ') }}
      </div>
    </div>

    <!-- Due Date Input -->
    <div v-if="showDueDate">
      <label class="text-xs text-muted-foreground mb-1 block">Due Date</label>
      <DatePicker
        v-if="!readonly"
        :model-value="item.due_date"
        @update:model-value="handleDueDateUpdate"
        class="w-full text-xs"
      />
      <div v-else class="text-sm">
        {{ item.due_date ? formatDate(item.due_date) : 'Not set' }}
      </div>
    </div>

    <!-- Timeline Display -->
    <div v-if="showTimeline" class="space-y-2 text-xs">
      <label class="text-xs text-muted-foreground mb-1 block">Timeline</label>

      <div v-if="item.order?.created_at" class="flex justify-between">
        <span class="text-muted-foreground">Received:</span>
        <span class="font-medium">{{ formatDate(item.order.created_at) }}</span>
      </div>

      <div v-if="item.due_date" class="flex justify-between">
        <span class="text-muted-foreground">Due:</span>
        <span
          class="font-medium"
          :class="isOverdue(item as any) ? 'text-red-600' : ''"
        >
          {{ formatDate(item.due_date) }}
        </span>
      </div>

      <div v-if="item.delivery_date" class="flex justify-between">
        <span class="text-muted-foreground">Delivery:</span>
        <span class="font-medium">{{ formatDate(item.delivery_date) }}</span>
      </div>

      <div v-if="item.production_start_date" class="flex justify-between">
        <span class="text-muted-foreground">Started:</span>
        <span class="font-medium">{{ formatDate(item.production_start_date) }}</span>
      </div>

      <div v-if="item.production_ready_date" class="flex justify-between">
        <span class="text-muted-foreground">Ready:</span>
        <span class="font-medium">{{ formatDate(item.production_ready_date) }}</span>
      </div>

      <div v-if="item.order && item.customer" class="pt-2 border-t">
        <span
          class="text-xs"
          :class="formatRelativeDueDate(item as any).isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'"
        >
          {{ formatRelativeDueDate(item as any).text }}
        </span>
      </div>
    </div>
  </div>
</template>
