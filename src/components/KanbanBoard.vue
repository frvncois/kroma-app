<script setup lang="ts">
import { ref } from 'vue'
import type { OrderItemWithDetails } from '@/composables/useOrderItems'
import type { ItemStatus } from '@/types'
import KanbanCard from '@/components/KanbanCard.vue'
import Badge from '@/components/ui/Badge.vue'

interface KanbanColumn {
  id: string
  title: string
  status: ItemStatus
  printshop: string | null
}

interface Props {
  columns: KanbanColumn[]
  visibleColumns: KanbanColumn[]
  items: OrderItemWithDetails[]
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  'item-drop': [itemId: string, newStatus: ItemStatus, printshop: string | null]
  'item-click': [itemId: string]
}>()

const draggedItemId = ref<string | null>(null)

const handleDragStart = (itemId: string) => {
  draggedItemId.value = itemId
  emit('item-drop', itemId, '' as ItemStatus, null) // Signal drag start
}

const handleDragEnd = () => {
  draggedItemId.value = null
}

const handleDrop = (status: ItemStatus, printshop: string | null) => {
  if (draggedItemId.value) {
    emit('item-drop', draggedItemId.value, status, printshop)
  }
}

const handleDragOver = (event: DragEvent) => {
  if (!props.readonly) {
    event.preventDefault()
  }
}

const handleDropWrapper = (status: ItemStatus, printshop: string | null) => {
  if (!props.readonly) {
    handleDrop(status, printshop)
  }
}

const getColumnItems = (status: ItemStatus, printshop: string | null) => {
  return props.items.filter((item) => {
    if (printshop) {
      // For printshop columns, filter by status AND printshop
      return item.status === status && item.assigned_printshop === printshop
    }
    // For regular columns, filter by status only
    return item.status === status
  })
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-hidden max-w-full">
    <div class="h-full overflow-x-auto max-w-full">
      <div class="flex h-full gap-4 pb-4 w-max">
        <!-- Column -->
        <div
          v-for="column in visibleColumns"
          :key="column.id"
          class="flex flex-col rounded-lg border bg-muted/50 transition-all flex-shrink-0 w-[240px]"
        >
          <!-- Column Header -->
          <div class="border-b bg-background p-2 rounded-t-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">{{ column.title }}</h3>
              <Badge variant="secondary" class="text-xs px-1.5 py-0">
                {{ getColumnItems(column.status, column.printshop).length }}
              </Badge>
            </div>
          </div>

          <!-- Column Items -->
          <div
            @dragover="handleDragOver"
            @drop="handleDropWrapper(column.status, column.printshop)"
            class="flex-1 space-y-2 overflow-auto p-2 transition-colors"
            :class="{ 'bg-accent/20': !readonly && draggedItemId }"
          >
            <KanbanCard
              v-for="item in getColumnItems(column.status, column.printshop)"
              :key="item.id"
              :item="item"
              :is-dragging="draggedItemId === item.id"
              :readonly="readonly"
              @dragstart="handleDragStart(item.id)"
              @dragend="handleDragEnd"
              @click="emit('item-click', item.id)"
            />

            <!-- Empty state -->
            <div
              v-if="getColumnItems(column.status, column.printshop).length === 0"
              class="flex h-32 items-center justify-center text-sm text-muted-foreground"
            >
              No items
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
