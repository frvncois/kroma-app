<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrders } from '@/composables/useOrders'
import { useOrderItems } from '@/composables/useOrderItems'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { ItemStatus, OrderNote, NoteDepartment } from '@/types'
import { formatDate, formatDateDisplay, formatStatus } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Badge from '@/components/ui/Badge.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import NotesSection from '@/components/NotesSection.vue'
import { Package, User, Paperclip, ChevronDown, ChevronRight, FileText } from 'lucide-vue-next'

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

const { getOrderById, updateItemStatus } = useOrders()
const { getItemById } = useOrderItems()
const { toast } = useToast()
const authStore = useAuthStore()

// Get item and order
const item = computed(() => props.itemId ? getItemById(props.itemId) : null)
const order = computed(() => item.value ? getOrderById(item.value.order_id) : null)

// Allowed statuses for printshop manager
const allowedStatuses: ItemStatus[] = ['in_production', 'on_hold', 'ready', 'picked_up', 'canceled']

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

// Notes (show all order notes)
const notes = ref<OrderNote[]>([
  {
    id: 'note-1',
    content: 'Customer requested rush delivery for this order.',
    departments: ['everyone'],
    created_at: '2024-01-25T09:15:00Z',
    created_by: 'John Smith',
    item_reference: null
  },
  {
    id: 'note-2',
    content: 'Please use premium cardstock for this item.',
    departments: ['printshop'],
    created_at: '2024-01-25T10:30:00Z',
    created_by: 'Sarah Johnson',
    item_reference: null
  },
])

// Department options (limited for printshop manager)
const departmentOptions = [
  { value: 'printshop', label: 'Printshop' },
  { value: 'everyone', label: 'Everyone' },
]

// Item reference options (for notes)
const itemOptions = computed(() => {
  if (!order.value) return []
  return order.value.items.map(item => ({
    value: item.id,
    label: item.product_name
  }))
})

// Handle status change
const handleStatusChange = (itemId: string, newStatus: ItemStatus) => {
  updateItemStatus(itemId, newStatus)
  toast({
    title: 'Status updated',
    description: `Updated to ${formatStatus(newStatus)}`
  })
}

// Note handlers
const handleAddNote = (content: string, departments: NoteDepartment[], itemReference: string | null) => {
  const note: OrderNote = {
    id: `note-${Date.now()}`,
    content,
    departments,
    created_at: new Date().toISOString(),
    created_by: authStore.currentUser?.name || 'Unknown',
    item_reference: itemReference
  }
  notes.value.unshift(note)
  console.log('Added note:', note)
}

const handleEditNote = (noteId: string, newContent: string) => {
  const note = notes.value.find(n => n.id === noteId)
  if (note) {
    note.content = newContent
  }
}

const handleDeleteNote = (noteId: string) => {
  const index = notes.value.findIndex(n => n.id === noteId)
  if (index !== -1) {
    notes.value.splice(index, 1)
  }
}

const formatSpecs = (specs: Record<string, any>): string => {
  return Object.entries(specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

const formatFileType = (type: string): string => {
  return type.toUpperCase()
}
</script>

<template>
  <Sheet :open="isOpen" @update:open="emit('update:isOpen', $event)" :side="side">
    <div v-if="item && order" class="flex h-full flex-col">
      <!-- Header -->
      <div class="border-b px-6 py-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ item.product_name }}</h2>
            <p class="text-sm text-muted-foreground">
              Order #{{ order.external_id || order.id.slice(0, 8) }} • {{ order.customer.name }}
            </p>
          </div>
          <Badge :variant="getStatusVariant(item.status)">
            {{ formatStatus(item.status) }}
          </Badge>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <!-- Section 1: Item Details -->
        <Card>
          <CardContent class="pt-6">
            <div class="space-y-4">
              <div>
                <div class="flex items-center gap-2 mb-4">
                  <Package class="h-4 w-4 text-muted-foreground" />
                  <h3 class="font-medium">Item Details</h3>
                </div>

                <div class="space-y-3">
                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <div class="text-xs text-muted-foreground mb-1">Product</div>
                      <div class="text-sm font-medium">{{ item.product_name }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground mb-1">Quantity</div>
                      <div class="text-sm">{{ item.quantity }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground mb-1">Status</div>
                      <ItemStatusCombobox
                        :model-value="item.status"
                        :item-id="item.id"
                        :allowed-statuses="allowedStatuses"
                        @update:model-value="handleStatusChange"
                      />
                    </div>
                  </div>

                  <div v-if="item.description">
                    <div class="text-xs text-muted-foreground mb-1">Description</div>
                    <div class="text-sm">{{ item.description }}</div>
                  </div>

                  <div v-if="item.specs && Object.keys(item.specs).length > 0">
                    <div class="text-xs text-muted-foreground mb-1">Specifications</div>
                    <div class="text-sm">{{ formatSpecs(item.specs) }}</div>
                  </div>

                  <div>
                    <div class="text-xs text-muted-foreground mb-1">Due Date</div>
                    <div class="text-sm">
                      {{ item.due_date ? formatDateDisplay(item.due_date) : 'Not set' }}
                      <span v-if="item.due_date" class="text-xs text-muted-foreground ml-2">(Read-only)</span>
                    </div>
                  </div>

                  <!-- Timeline -->
                  <div class="pt-2 border-t">
                    <div class="text-xs text-muted-foreground mb-2">Timeline</div>
                    <div class="space-y-1 text-xs">
                      <div v-if="item.production_start_date" class="flex justify-between">
                        <span class="text-muted-foreground">Production started:</span>
                        <span>{{ formatDateDisplay(item.production_start_date) }}</span>
                      </div>
                      <div v-if="item.production_ready_date" class="flex justify-between">
                        <span class="text-muted-foreground">Ready:</span>
                        <span>{{ formatDateDisplay(item.production_ready_date) }}</span>
                      </div>
                      <div v-if="item.delivery_date" class="flex justify-between">
                        <span class="text-muted-foreground">Delivered:</span>
                        <span>{{ formatDateDisplay(item.delivery_date) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 2: Order Context (collapsed by default) -->
        <Card>
          <CardContent class="pt-6">
            <button
              @click="isOrderContextExpanded = !isOrderContextExpanded"
              class="flex items-center justify-between w-full text-left"
            >
              <div class="flex items-center gap-2">
                <User class="h-4 w-4 text-muted-foreground" />
                <h3 class="font-medium">Order Context</h3>
              </div>
              <ChevronDown
                :class="['h-4 w-4 transition-transform', isOrderContextExpanded ? 'rotate-180' : '']"
              />
            </button>

            <div v-if="isOrderContextExpanded" class="mt-4 space-y-3 text-sm">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Customer</div>
                  <div>{{ order.customer.name }}</div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Email</div>
                  <div>{{ order.customer.email }}</div>
                </div>
              </div>

              <div v-if="order.customer.company" class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Company</div>
                  <div>{{ order.customer.company }}</div>
                </div>
                <div v-if="order.customer.phone">
                  <div class="text-xs text-muted-foreground mb-1">Phone</div>
                  <div>{{ order.customer.phone }}</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Order Source</div>
                  <Badge variant="secondary" class="text-xs">{{ order.source }}</Badge>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Delivery Method</div>
                  <Badge variant="secondary" class="text-xs">{{ order.delivery_method }}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 3: Files -->
        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 mb-4">
              <Paperclip class="h-4 w-4 text-muted-foreground" />
              <h3 class="font-medium">Files</h3>
              <span class="text-sm text-muted-foreground">({{ files.length }})</span>
            </div>

            <div v-if="files.length === 0" class="text-sm text-muted-foreground text-center py-4">
              No files attached to this item
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="file in files"
                :key="file.id"
                class="flex items-center justify-between p-3 rounded-md border hover:bg-accent/50 transition-colors"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <FileText class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ file.name }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ file.size }} • Uploaded {{ formatDate(file.uploaded_at) }}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" class="text-xs ml-2">{{ formatFileType(file.type) }}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Section 4: Notes -->
        <Card>
          <CardContent class="pt-6">
            <NotesSection
              :notes="notes"
              :item-options="itemOptions"
              :department-options="departmentOptions"
              @add-note="handleAddNote"
              @edit-note="handleEditNote"
              @delete-note="handleDeleteNote"
            />
          </CardContent>
        </Card>
      </div>
    </div>

    <div v-else class="flex h-full items-center justify-center text-muted-foreground">
      <p>No item selected</p>
    </div>
  </Sheet>
</template>
