<script setup lang="ts">
import { computed } from 'vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import Input from '@/components/ui/Input.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import Badge from '@/components/ui/Badge.vue'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import { formatPayment, formatPrintshop } from '@/lib/formatters'
import { getPaymentVariant } from '@/lib/variants'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
  multiple?: boolean
}

interface Props {
  viewMode?: string
  viewOptions?: { value: string; label: string; icon: string }[]

  // Filter configurations (which filters to show)
  tableFilters?: FilterConfig[]
  kanbanFilters?: FilterConfig[]

  // v-model values
  statusFilter?: string[]
  sourceFilter?: string[]
  paymentFilter?: string[]
  printshopFilter?: string[]
  orderBy?: string
  kanbanColumnsFilter?: string[]
  searchQuery?: string
  showSearch?: boolean

  // Kanban search results
  kanbanSearchResults?: OrderItemWithDetails[]
}

const props = withDefaults(defineProps<Props>(), {
  tableFilters: () => [],
  kanbanFilters: () => [],
  statusFilter: () => ['all'],
  sourceFilter: () => ['all'],
  paymentFilter: () => ['all'],
  printshopFilter: () => ['all'],
  orderBy: () => 'newest',
  kanbanColumnsFilter: () => ['all'],
  searchQuery: () => '',
  showSearch: true,
  kanbanSearchResults: () => [],
})

const emit = defineEmits([
  'update:statusFilter',
  'update:sourceFilter',
  'update:paymentFilter',
  'update:printshopFilter',
  'update:orderBy',
  'update:kanbanColumnsFilter',
  'update:searchQuery',
  'update:viewMode',
  'search-result-click',
])

const activeFilters = computed(() => {
  return props.viewMode === 'table' ? props.tableFilters : props.kanbanFilters
})

const handleFilterUpdate = (key: string, value: string | string[]) => {
  if (key === 'status') emit('update:statusFilter', Array.isArray(value) ? value : [value])
  else if (key === 'source') emit('update:sourceFilter', Array.isArray(value) ? value : [value])
  else if (key === 'payment') emit('update:paymentFilter', Array.isArray(value) ? value : [value])
  else if (key === 'printshop') emit('update:printshopFilter', Array.isArray(value) ? value : [value])
  else if (key === 'orderBy') emit('update:orderBy', Array.isArray(value) ? value[0] : value)
  else if (key === 'kanbanColumns') emit('update:kanbanColumnsFilter', Array.isArray(value) ? value : [value])
}

const getFilterValue = (key: string): string | string[] => {
  if (key === 'status') return props.statusFilter || []
  if (key === 'source') return props.sourceFilter || []
  if (key === 'payment') return props.paymentFilter || []
  if (key === 'printshop') return props.printshopFilter || []
  if (key === 'orderBy') return props.orderBy || 'newest'
  if (key === 'kanbanColumns') return props.kanbanColumnsFilter || []
  return []
}
</script>

<template>
  <div class="flex items-end gap-4 flex-shrink-0">
    <!-- Filters -->
    <div class="flex gap-3">
      <div
        v-for="filter in activeFilters"
        :key="filter.key"
        class="flex flex-col gap-1"
      >
        <label class="text-xs font-medium text-muted-foreground">{{ filter.label }}</label>
        <FilterSelect
          :model-value="getFilterValue(filter.key)"
          :options="filter.options"
          :multiple="filter.multiple !== false"
          @update:model-value="handleFilterUpdate(filter.key, $event)"
          class="w-40"
        />
      </div>
    </div>

    <!-- Search Input with Results Dropdown -->
    <div v-if="showSearch" class="relative flex-1">
      <Input
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        type="text"
        placeholder="Search orders, customers, products..."
        class="w-full"
      />

      <!-- Kanban Search Results Dropdown -->
      <div
        v-if="viewMode === 'kanban' && kanbanSearchResults.length > 0"
        class="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-lg border bg-popover shadow-lg"
      >
        <div
          v-for="item in kanbanSearchResults"
          :key="item.id"
          @click="emit('search-result-click', item.order_id); emit('update:searchQuery', '')"
          class="cursor-pointer border-b p-3 transition-colors hover:bg-accent"
        >
          <div class="font-medium text-sm">{{ item.product_name }}</div>
          <div class="text-xs text-muted-foreground mt-1">
            {{ item.customer.name }} • Qty: {{ item.quantity }}
          </div>
          <div class="flex gap-1 mt-1">
            <Badge variant="outline" class="text-[10px] px-1.5 py-0">
              {{ formatPrintshop(item.assigned_printshop) }}
            </Badge>
            <Badge :variant="getPaymentVariant(item.order.payment_status)" class="text-[10px] px-1.5 py-0">
              {{ formatPayment(item.order.payment_status) }}
            </Badge>
          </div>
        </div>
      </div>
    </div>

    <!-- View Toggle -->
    <ViewToggle
      v-if="viewMode && viewOptions && viewOptions.length > 0"
      :model-value="viewMode"
      @update:model-value="emit('update:viewMode', $event)"
      :options="viewOptions"
      storage-key="kroma_manager_orders_view"
    />
  </div>
</template>

