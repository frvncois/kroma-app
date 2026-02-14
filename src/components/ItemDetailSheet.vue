<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrders } from '@/composables/useOrders'
import { useOrderItems } from '@/composables/useOrderItems'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { ItemStatus, OrderNote, NoteDepartment } from '@/types'
import { formatDate, formatStatus, formatSource } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import NotesSection from '@/components/NotesSection.vue'
import { Package, User, Paperclip, ChevronDown, ChevronRight, Clock } from 'lucide-vue-next'

interface Props {
  itemId: string | null
  isOpen: boolean
  side?: 'left' | 'right'
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
})

const emit = defineEmits<Emits>()

const { getOrderById, updateItemStatus, fetchItemStatusHistory } = useOrders()
const { getItemById } = useOrderItems()
const { toast } = useToast()
const authStore = useAuthStore()

// Get item and order
const item = computed(() => props.itemId ? getItemById(props.itemId) : null)
const order = computed(() => item.value ? getOrderById(item.value.order_id) : null)

// Role-based permissions
const isManager = computed(() => authStore.isManager)
const isPrintshopManager = computed(() => authStore.isPrintshopManager)
const isDriver = computed(() => authStore.isDriver)

// Allowed statuses based on role
const allowedStatuses = computed<ItemStatus[]>(() => {
  if (isManager.value) {
    return ['new', 'assigned', 'in_production', 'on_hold', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'canceled']
  }
  if (isPrintshopManager.value) {
    return ['in_production', 'on_hold', 'ready', 'picked_up', 'canceled']
  }
  if (isDriver.value) {
    return ['out_for_delivery', 'delivered', 'on_hold', 'canceled']
  }
  return []
})

// Section expansion state
const isOrderContextExpanded = ref(false)

// Dummy files (filtered to this item only)
interface OrderFile {
  id: string
  order_item_id: string
  name: string
  type: string
  size: string
  uploaded_at: string
}

const allFiles = ref<OrderFile[]>([
  {
    id: 'file-1',
    order_item_id: 'item-1',
    name: 'artwork-final.pdf',
    type: 'artwork',
    size: '2.4 MB',
    uploaded_at: '2024-01-25T10:30:00Z'
  },
  {
    id: 'file-2',
    order_item_id: 'item-1',
    name: 'logo-highres.png',
    type: 'proof',
    size: '856 KB',
    uploaded_at: '2024-01-25T10:32:00Z'
  },
])

const files = computed(() => {
  if (!item.value) return []
  return allFiles.value.filter(f => f.order_item_id === item.value!.id)
})

// Status history (lazy-loaded)
const statusHistory = ref<any[]>([])
const loadingStatusHistory = ref(false)

// Load status history when item changes
watch(() => props.itemId, async (newItemId) => {
  if (newItemId && props.isOpen) {
    loadingStatusHistory.value = true
    statusHistory.value = []

    try {
      const history = await fetchItemStatusHistory(newItemId)
      statusHistory.value = history
    } catch (error) {
      console.error('Failed to load status history:', error)
    } finally {
      loadingStatusHistory.value = false
    }
  }
}, { immediate: true })

// Also load when sheet opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.itemId) {
    loadingStatusHistory.value = true
    statusHistory.value = []

    try {
      const history = await fetchItemStatusHistory(props.itemId)
      statusHistory.value = history
    } catch (error) {
      console.error('Failed to load status history:', error)
    } finally {
      loadingStatusHistory.value = false
    }
  }
})

// Format specs
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

// Status change handler
const handleStatusChange = (itemId: string, newStatus: ItemStatus) => {
  updateItemStatus(itemId, newStatus)
  toast({
    title: 'Status updated',
    description: `Updated to ${formatStatus(newStatus)}`
  })
}

// Notes
const mockNotes: OrderNote[] = []

const noteItemOptions = computed(() => {
  if (!order.value) return [{ value: 'order', label: 'Order-level note' }]

  const options = [{ value: 'order', label: 'Order-level note' }]

  if (order.value.items) {
    order.value.items.forEach(item => {
      options.push({
        value: item.id,
        label: item.product_name
      })
    })
  }

  return options
})

const noteDepartmentOptions = computed(() => {
  if (isPrintshopManager.value) {
    return [
      { value: 'everyone', label: 'Everyone' },
      { value: 'printshop', label: 'Printshop' }
    ]
  }

  return [
    { value: 'everyone', label: 'Everyone' },
    { value: 'printshop', label: 'Printshop' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'billing', label: 'Billing' }
  ]
})

const handleAddNote = (content: string, departments: NoteDepartment[], itemReference: string | null) => {
  console.log('Add note:', { content, departments, itemReference })
  toast({ title: 'Note added', description: 'Note functionality coming in Phase 2' })
}

const handleEditNote = (noteId: string, newContent: string) => {
  console.log('Edit note:', noteId, newContent)
}

const handleDeleteNote = (noteId: string) => {
  console.log('Delete note:', noteId)
}
</script>

<template>
  <Sheet
    :is-open="isOpen"
    @update:is-open="emit('update:isOpen', $event)"
    :side="side"
  >
    <div v-if="!item || !order" class="flex h-full items-center justify-center">
      <p class="text-sm text-muted-foreground">No item selected</p>
    </div>

    <div v-else class="flex h-full flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 class="text-xl font-semibold">{{ item.product_name }}</h2>
          <p class="text-sm text-muted-foreground">
            Order #{{ order.external_id || order.id.slice(0, 8) }} • {{ order.customer.name }}
          </p>
        </div>
        <Badge :variant="getStatusVariant(item.status)">
          {{ formatStatus(item.status) }}
        </Badge>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <!-- Section 1: Item Details -->
        <Card>
          <CardContent class="pt-6">
            <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
              <div class="p-2 bg-accent rounded-lg">
                <Package class="h-4 w-4" />
              </div>
              Item Details
            </h3>

            <div class="space-y-4">
              <!-- Product Name -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Product</Label>
                <div class="text-sm font-medium">{{ item.product_name }}</div>
              </div>

              <!-- Grid: Quantity, Status -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Quantity</Label>
                  <div class="text-sm">{{ item.quantity }}</div>
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <ItemStatusCombobox
                    :model-value="item.status"
                    :item-id="item.id"
                    :allowed-statuses="allowedStatuses"
                    @update:model-value="handleStatusChange"
                  />
                </div>
              </div>

              <!-- Due Date -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Due Date</Label>
                <div class="text-sm">
                  {{ item.due_date ? formatDate(item.due_date) : 'No due date' }}
                </div>
              </div>

              <!-- Description -->
              <div v-if="item.description">
                <Label class="text-xs text-muted-foreground mb-1 block">Description</Label>
                <div class="text-sm">{{ item.description }}</div>
              </div>

              <!-- Specifications -->
              <div v-if="item.specs">
                <Label class="text-xs text-muted-foreground mb-1 block">Specifications</Label>
                <div class="text-sm">{{ formatSpecs(item.specs) }}</div>
              </div>

              <!-- Timeline -->
              <div class="border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                  <Clock class="h-3 w-3" />
                  Timeline
                </Label>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <div class="text-xs text-muted-foreground">Production Start</div>
                    <div class="text-sm">
                      {{ item.production_start_date ? formatDate(item.production_start_date) : '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-muted-foreground">Production Ready</div>
                    <div class="text-sm">
                      {{ item.production_ready_date ? formatDate(item.production_ready_date) : '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-muted-foreground">Delivered</div>
                    <div class="text-sm">
                      {{ item.delivery_date ? formatDate(item.delivery_date) : '—' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Status History -->
              <div class="border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-2 block">
                  Status History
                </Label>

                <!-- Loading state -->
                <div v-if="loadingStatusHistory" class="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                  <span>Loading history...</span>
                </div>

                <!-- History loaded -->
                <div v-else-if="statusHistory.length > 0" class="space-y-2">
                  <div
                    v-for="(history, index) in statusHistory"
                    :key="index"
                    class="flex items-start gap-2 text-xs"
                  >
                    <Badge :variant="getStatusVariant(history.status)" class="text-xs">
                      {{ formatStatus(history.status) }}
                    </Badge>
                    <span class="text-muted-foreground">
                      {{ formatDate(history.changed_at) }}
                    </span>
                    <span class="text-muted-foreground">by {{ history.changed_by }}</span>
                  </div>
                </div>

                <!-- No history -->
                <div v-else class="text-xs text-muted-foreground py-2">
                  No status changes yet
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 2: Order Context (Collapsible) -->
        <Card>
          <CardContent class="pt-6">
            <button
              @click="isOrderContextExpanded = !isOrderContextExpanded"
              class="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
            >
              <h3 class="text-lg font-medium flex items-center gap-2">
                <div class="p-2 bg-accent rounded-lg">
                  <User class="h-4 w-4" />
                </div>
                Order Context
              </h3>
              <ChevronDown v-if="!isOrderContextExpanded" class="h-5 w-5 text-muted-foreground" />
              <ChevronRight v-else class="h-5 w-5 text-muted-foreground" />
            </button>

            <div v-if="isOrderContextExpanded" class="space-y-4">
              <!-- Customer Info -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Customer</Label>
                <div class="text-sm font-medium">{{ order.customer.name }}</div>
                <div v-if="order.customer.company" class="text-sm text-muted-foreground">
                  {{ order.customer.company }}
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div v-if="order.customer.email">
                  <Label class="text-xs text-muted-foreground mb-1 block">Email</Label>
                  <a :href="`mailto:${order.customer.email}`" class="text-sm text-primary hover:underline">
                    {{ order.customer.email }}
                  </a>
                </div>
                <div v-if="order.customer.phone">
                  <Label class="text-xs text-muted-foreground mb-1 block">Phone</Label>
                  <a :href="`tel:${order.customer.phone}`" class="text-sm text-primary hover:underline">
                    {{ order.customer.phone }}
                  </a>
                </div>
              </div>

              <!-- Order Info -->
              <div class="border-t pt-3">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Source</Label>
                    <Badge variant="outline" class="text-xs">
                      {{ formatSource(order.source) }}
                    </Badge>
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Delivery Method</Label>
                    <Badge variant="secondary" class="text-xs">
                      {{ order.deliveryMethodRollup === 'delivery' ? 'Delivery' : 'Customer Pickup' }}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Created</Label>
                <div class="text-sm">{{ formatDate(order.created_at) }}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 3: Files -->
        <Card>
          <CardContent class="pt-6">
            <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
              <div class="p-2 bg-accent rounded-lg">
                <Paperclip class="h-4 w-4" />
              </div>
              Files
              <Badge variant="secondary" class="text-xs ml-1">{{ files.length }}</Badge>
            </h3>

            <div v-if="files.length === 0" class="text-sm text-muted-foreground text-center py-4">
              No files attached
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="file in files"
                :key="file.id"
                class="flex items-center justify-between p-2 rounded border hover:bg-accent/50 transition-colors"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <Paperclip class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium truncate">{{ file.name }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ file.size }} • {{ formatDate(file.uploaded_at) }}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" class="text-xs ml-2 flex-shrink-0">
                  {{ file.type }}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 4: Notes -->
        <NotesSection
          :notes="mockNotes"
          :item-options="noteItemOptions"
          :department-options="noteDepartmentOptions"
          :readonly="false"
          @add-note="handleAddNote"
          @edit-note="handleEditNote"
          @delete-note="handleDeleteNote"
        />
      </div>
    </div>
  </Sheet>
</template>
