<script setup lang="ts">
import { ref } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import type { ItemStatus } from '@/types'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import { MoreVertical, Package } from 'lucide-vue-next'
import { onClickOutside } from '@vueuse/core'

interface Props {
  items: OrderItemWithDetails[]
  allowedStatuses?: ItemStatus[]
  customStatusOptions?: { value: ItemStatus; label: string }[]
}

interface Emits {
  (e: 'item-click', itemId: string): void
  (e: 'update-status', itemId: string, status: ItemStatus): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 3-dot menu state
const openMenuId = ref<string | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const toggleMenu = (itemId: string, event: Event) => {
  event.stopPropagation()
  openMenuId.value = openMenuId.value === itemId ? null : itemId
}

const closeMenu = () => {
  openMenuId.value = null
}

onClickOutside(menuRef, closeMenu)

const handleRowClick = (itemId: string, event: Event) => {
  // Don't trigger if clicking on combobox or menu
  const target = event.target as HTMLElement
  if (target.closest('.status-combobox') || target.closest('.menu-button')) {
    return
  }
  emit('item-click', itemId)
}

const handleMenuAction = (action: string, itemId: string, item: OrderItemWithDetails) => {
  closeMenu()

  if (action === 'view') {
    emit('item-click', itemId)
  } else if (action === 'picked-up') {
    emit('update-status', itemId, 'picked_up')
  } else if (action === 'cancel') {
    emit('update-status', itemId, 'canceled')
  }
}

const formatSpecs = (specs: any): string => {
  if (!specs) return '—'
  if (typeof specs === 'string') return specs
  if (typeof specs === 'object') {
    const entries = Object.entries(specs)
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return '—'
}

const getDueDateDisplay = (dueDate: string | null) => {
  if (!dueDate) return { text: 'No due date', class: 'text-xs text-muted-foreground' }

  const now = new Date()
  const due = new Date(dueDate)

  if (due < now) {
    return {
      text: `Overdue by ${formatDistanceToNow(due)}`,
      class: 'text-xs text-red-600 font-medium'
    }
  } else {
    return {
      text: `Due in ${formatDistanceToNow(due)}`,
      class: 'text-xs text-muted-foreground'
    }
  }
}

const isTerminalStatus = (status: ItemStatus) => {
  return ['delivered', 'picked_up', 'canceled'].includes(status)
}
</script>

<template>
  <div class="w-full bg-muted/30 rounded-2xl border pb-2">
    <!-- Header Row -->
    <div class="grid grid-cols-[1fr_1fr_1fr_minmax(200px,auto)] gap-4 text-xs font-medium text-background tracking-wider rounded-t-xl py-3 px-4 bg-foreground">
      <div>Item</div>
      <div>Details</div>
      <div>Timeline</div>
      <div class="text-right pr-12">Status</div>
    </div>

    <!-- Empty State -->
    <div v-if="items.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground m-2">
      <Package class="h-12 w-12 mb-4 opacity-50" />
      <p class="text-sm">No items in your queue</p>
    </div>

    <!-- Item Rows -->
    <div
      v-for="item in items"
      :key="item.id"
      class="m-2"
    >
      <div
        class="grid grid-cols-[1fr_1fr_1fr_minmax(200px,auto)] gap-4 rounded-xl border bg-background/50 hover:bg-background transition-colors cursor-pointer pt-3 pb-4 px-4"
        @click="handleRowClick(item.id, $event)"
      >
      <!-- Column 1: Item -->
      <div class="min-w-0">
        <button
          @click.stop="emit('item-click', item.id)"
          class="text-sm font-medium truncate hover:text-primary transition-colors text-left w-full"
        >
          {{ item.product_name }}
        </button>
        <div class="text-xs text-muted-foreground">
          Order #{{ item.order.external_id || item.order.id.slice(0, 8) }}
        </div>
      </div>

      <!-- Column 2: Details -->
      <div class="min-w-0">
        <div class="text-sm">Qty: {{ item.quantity }}</div>
        <div class="text-xs text-muted-foreground truncate">
          {{ item.description || formatSpecs(item.specs) }}
        </div>
      </div>

      <!-- Column 3: Timeline -->
      <div class="min-w-0">
        <div class="text-sm text-muted-foreground">
          Received {{ formatDistanceToNow(new Date(item.order.created_at)) }} ago
        </div>
        <div :class="getDueDateDisplay(item.due_date).class">
          {{ getDueDateDisplay(item.due_date).text }}
        </div>
      </div>

      <!-- Column 4: Status + Actions -->
      <div class="flex items-center justify-end gap-2">
        <!-- Status Combobox -->
        <div class="status-combobox flex-1" @click.stop>
          <ItemStatusCombobox
            :model-value="item.status"
            :item-id="item.id"
            :allowed-statuses="allowedStatuses"
            :custom-status-options="customStatusOptions"
            @update:model-value="(itemId, status) => emit('update-status', itemId, status)"
          />
        </div>

        <!-- 3-dot Menu -->
        <div class="menu-button relative flex-shrink-0" ref="menuRef">
          <button
            @click="toggleMenu(item.id, $event)"
            class="p-1 rounded hover:bg-accent"
          >
            <MoreVertical class="h-4 w-4 text-muted-foreground" />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="openMenuId === item.id"
            class="absolute right-0 top-full mt-1 w-48 rounded-md border bg-popover shadow-lg z-50 py-1"
            @click.stop
          >
            <button
              @click="handleMenuAction('view', item.id, item)"
              class="w-full px-3 py-2 text-sm text-left hover:bg-accent"
            >
              View Details
            </button>
            <button
              v-if="item.status === 'ready'"
              @click="handleMenuAction('picked-up', item.id, item)"
              class="w-full px-3 py-2 text-sm text-left hover:bg-accent"
            >
              Mark as Picked Up
            </button>
            <button
              v-if="!isTerminalStatus(item.status)"
              @click="handleMenuAction('cancel', item.id, item)"
              class="w-full px-3 py-2 text-sm text-left hover:bg-accent text-destructive"
            >
              Cancel Item
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
