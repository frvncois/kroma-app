<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrders } from '@/composables/useOrders'
import { printshops } from '@/data/mock/printshops'
import type { PaymentStatus, PaymentMethod } from '@/data/mock/orders'
import type { ItemStatus } from '@/data/mock/order-items'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Badge from '@/components/ui/Badge.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import DateInput from '@/components/ui/DateInput.vue'
import Button from '@/components/ui/Button.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import { User, Package, MessageSquare, Paperclip, ChevronDown, ChevronRight, FileText, Download, Edit2, Trash2 } from 'lucide-vue-next'

interface Props {
  orderId?: string | null
  isOpen: boolean
  showPayment?: boolean
  side?: 'left' | 'right'
  zIndex?: number
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  showPayment: true,
  side: 'right',
  zIndex: 60,
})

const emit = defineEmits<Emits>()

const { getOrderById } = useOrders()

const order = computed(() => (props.orderId ? getOrderById(props.orderId) : null))

// Editable state
const paymentStatus = ref<PaymentStatus>('unpaid')
const paymentMethod = ref<PaymentMethod>('cash')
const orderNotes = ref('')

// Track item assignments, statuses, and due dates
const itemAssignments = ref<Record<string, string | null>>({})
const itemStatuses = ref<Record<string, ItemStatus>>({})
const itemDueDates = ref<Record<string, string | null>>({})

// Notes management
type NoteDepartment = 'printshop' | 'delivery' | 'billing' | 'everyone'

interface OrderNote {
  id: string
  content: string
  departments: NoteDepartment[]
  created_at: string
  created_by: string
  item_reference: string | null
}

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
    item_reference: 'Business Cards - Premium Matte'
  },
  {
    id: 'note-3',
    content: 'Awaiting payment confirmation before proceeding.',
    departments: ['billing'],
    created_at: '2024-01-25T11:45:00Z',
    created_by: 'Mike Davis',
    item_reference: null
  }
])
const newNoteContent = ref('')
const selectedDepartment = ref<NoteDepartment>('everyone')
const selectedItemReference = ref<string>('order')

// Edit note state
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')

// Dummy files
interface OrderFile {
  id: string
  name: string
  type: string
  size: string
  uploaded_at: string
  item_name: string
}

const files = ref<OrderFile[]>([
  {
    id: 'file-1',
    name: 'artwork-final.pdf',
    type: 'PDF',
    size: '2.4 MB',
    uploaded_at: '2024-01-25T10:30:00Z',
    item_name: 'Business Cards - Premium Matte'
  },
  {
    id: 'file-2',
    name: 'logo-highres.png',
    type: 'PNG',
    size: '856 KB',
    uploaded_at: '2024-01-25T10:32:00Z',
    item_name: 'Business Cards - Premium Matte'
  },
  {
    id: 'file-3',
    name: 'specifications.docx',
    type: 'DOCX',
    size: '124 KB',
    uploaded_at: '2024-01-25T11:15:00Z',
    item_name: 'Flyers - 8.5x11 Full Color'
  }
])

// Track expanded items
const expandedItems = ref<Set<string>>(new Set())

const toggleItemExpanded = (itemId: string) => {
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId)
  } else {
    expandedItems.value.add(itemId)
  }
}

// Initialize state when order changes
watch(
  () => order.value,
  (newOrder) => {
    if (newOrder) {
      paymentStatus.value = newOrder.payment_status
      paymentMethod.value = newOrder.payment_method
      orderNotes.value = newOrder.notes

      newOrder.items.forEach((item) => {
        itemAssignments.value[item.id] = item.assigned_printshop
        itemStatuses.value[item.id] = item.status
        itemDueDates.value[item.id] = item.due_date
      })
    }
  },
  { immediate: true }
)

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}

const getStatusVariant = (
  status: ItemStatus
): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' => {
  switch (status) {
    case 'new':
      return 'info'
    case 'assigned':
    case 'in_production':
      return 'warning'
    case 'on_hold':
      return 'secondary'
    case 'ready':
      return 'info'
    case 'out_for_delivery':
      return 'warning'
    case 'delivered':
    case 'picked_up':
      return 'success'
    case 'canceled':
      return 'destructive'
    default:
      return 'default'
  }
}

const formatStatus = (status: ItemStatus): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatSpecs = (specs: Record<string, any>): string => {
  return Object.entries(specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

const isOverdue = (item: any): boolean => {
  if (!item.due_date) return false
  const dueDate = new Date(item.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const status = itemStatuses.value[item.id]
  const notReady = !!status && !['ready', 'out_for_delivery', 'delivered', 'picked_up'].includes(status)
  return dueDate < today && notReady
}

const formatDateDisplay = (dateString: string | null): string => {
  if (!dateString) return 'Not set'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Printshop options for FilterSelect
const printshopOptions = computed(() => [
  { value: '', label: 'Unassigned' },
  ...printshops.map((shop) => ({
    value: shop.id,
    label: shop.name,
  })),
])

// Payment options for FilterSelect
const paymentStatusOptions = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

const paymentMethodOptions = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'etransfer', label: 'eTransfer' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
]

// Handle changes
const handlePrintshopChange = (itemId: string, printshopId: string | string[]) => {
  const value = Array.isArray(printshopId) ? (printshopId[0] || '') : printshopId
  itemAssignments.value[itemId] = value === '' ? null : value
  console.log(`Updated item ${itemId} printshop to ${value}`)
}

const handleStatusChange = (itemId: string, status: ItemStatus) => {
  const oldStatus = itemStatuses.value[itemId]
  itemStatuses.value[itemId] = status

  if (status === 'in_production' && oldStatus !== 'in_production') {
    console.log(`Auto-setting production_start_date for item ${itemId} to now`)
  }
  if (status === 'ready' && oldStatus !== 'ready') {
    console.log(`Auto-setting production_ready_date for item ${itemId} to now`)
  }

  console.log(`Updated item ${itemId} status from ${oldStatus} to ${status}`)
}

const handleDueDateChange = (itemId: string, dueDate: string | null) => {
  itemDueDates.value[itemId] = dueDate
  console.log(`Updated item ${itemId} due_date to ${dueDate}`)
}

const handlePaymentStatusChange = (status: string | string[]) => {
  const value = Array.isArray(status) ? status[0] : status
  paymentStatus.value = value as PaymentStatus
  console.log('Updated payment status to', value)
}

const handlePaymentMethodChange = (method: string | string[]) => {
  const value = Array.isArray(method) ? method[0] : method
  paymentMethod.value = value as PaymentMethod
  console.log('Updated payment method to', value)
}

const addNote = () => {
  if (!newNoteContent.value.trim() || !selectedDepartment.value) return

  const note: OrderNote = {
    id: `note-${Date.now()}`,
    content: newNoteContent.value,
    departments: [selectedDepartment.value],
    created_at: new Date().toISOString(),
    created_by: 'Current User', // TODO: Replace with actual user
    item_reference: selectedItemReference.value === 'order' ? null : selectedItemReference.value
  }

  notes.value.unshift(note)
  newNoteContent.value = ''
  selectedDepartment.value = 'everyone'
  selectedItemReference.value = 'order'

  console.log('Added note:', note)
}

const startEditNote = (note: OrderNote) => {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

const saveEditNote = () => {
  if (!editingNoteId.value || !editingNoteContent.value.trim()) return

  const noteIndex = notes.value.findIndex(n => n.id === editingNoteId.value)
  if (noteIndex !== -1) {
    notes.value[noteIndex].content = editingNoteContent.value
  }

  editingNoteId.value = null
  editingNoteContent.value = ''
}

const cancelEditNote = () => {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

const deleteNote = (noteId: string) => {
  const index = notes.value.findIndex(n => n.id === noteId)
  if (index !== -1) {
    notes.value.splice(index, 1)
  }
}

// Item reference options for notes
const itemReferenceOptions = computed(() => [
  { value: 'order', label: 'Order note' },
  ...order.value?.items.map(item => ({
    value: item.product_name,
    label: item.product_name
  })) || []
])

// Department options for notes
const departmentOptions = [
  { value: 'printshop', label: 'Printshop' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'billing', label: 'Billing' },
  { value: 'everyone', label: 'Everyone' },
]

const formatNoteDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getDepartmentLabel = (dept: NoteDepartment): string => {
  switch (dept) {
    case 'printshop':
      return 'Printshop Manager'
    case 'delivery':
      return 'Delivery'
    case 'billing':
      return 'Billing Department'
    case 'everyone':
      return 'Everyone'
  }
}
</script>

<template>
  <Sheet
    :open="isOpen"
    @update:open="(val) => emit('update:isOpen', val)"
    :title="order ? `Order ${order.external_id || order.id.toUpperCase()}` : 'Order Details'"
    :side="side"
    :z-index="zIndex"
  >
    <div v-if="!order" class="flex h-full items-center justify-center p-6">
      <p class="text-muted-foreground">Order not found</p>
    </div>

    <div v-else class="space-y-6 p-6">
      <!-- Customer & Order Info (Combined) -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <User class="h-5 w-5" />
            Customer & Order Information
          </h3>
          <Badge :variant="order.delivery_method === 'delivery' ? 'default' : 'secondary'">
            {{ order.delivery_method === 'delivery' ? 'To deliver' : 'Customer pickup' }}
          </Badge>
        </div>
        <Card>
          <CardContent class="p-4">
            <div class="grid gap-6 md:grid-cols-2">
              <!-- Customer Info -->
              <div class="space-y-3">
                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Customer</Label>
                  <div class="font-semibold">{{ order.customer.name }}</div>
                  <div v-if="order.customer.company" class="text-sm text-muted-foreground">
                    {{ order.customer.company }}
                  </div>
                </div>
                <div class="space-y-1 text-sm">
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground">Email:</Label>
                    <a :href="`mailto:${order.customer.email}`" class="text-primary hover:underline">
                      {{ order.customer.email }}
                    </a>
                  </div>
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground">Phone:</Label>
                    <a :href="`tel:${order.customer.phone}`" class="text-primary hover:underline">
                      {{ order.customer.phone }}
                    </a>
                  </div>
                </div>
                <div class="border-t pt-3">
                  <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address</Label>
                  <div class="text-sm">{{ order.customer.address }}</div>
                </div>
                <div class="border-t pt-3">
                  <Label class="text-xs text-muted-foreground mb-1 block">Billing Address</Label>
                  <div class="text-sm">{{ order.customer.address }}</div>
                </div>
                <div v-if="order.customer.notes" class="border-t pt-3">
                  <Label class="text-xs text-muted-foreground mb-1 block">Customer Notes</Label>
                  <div class="text-sm">{{ order.customer.notes }}</div>
                </div>
              </div>

              <!-- Order Info -->
              <div class="space-y-4">
                <!-- Payment fields - only shown if showPayment is true -->
                <template v-if="showPayment">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <Label class="text-xs text-muted-foreground mb-1 block"
                        >Payment Status</Label
                      >
                      <FilterSelect
                        :model-value="paymentStatus"
                        @update:model-value="handlePaymentStatusChange"
                        :options="paymentStatusOptions"
                      />
                    </div>

                    <div>
                      <Label class="text-xs text-muted-foreground mb-1 block"
                        >Payment Method</Label
                      >
                      <FilterSelect
                        :model-value="paymentMethod"
                        @update:model-value="handlePaymentMethodChange"
                        :options="paymentMethodOptions"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <Label class="text-xs text-muted-foreground mb-1 block">Amount Total</Label>
                      <div class="font-medium">{{ formatCurrency(order.amount_total) }}</div>
                    </div>
                    <div>
                      <Label class="text-xs text-muted-foreground mb-1 block">Amount Paid</Label>
                      <div class="font-medium">{{ formatCurrency(order.amount_paid) }}</div>
                    </div>
                  </div>
                </template>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Created</Label>
                  <div class="text-sm">{{ formatDate(order.created_at) }}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Items Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package class="h-5 w-5" />
          Order Items ({{ order.items.length }})
        </h3>
        <div class="space-y-3">
          <Card
            v-for="item in order.items"
            :key="item.id"
            class="cursor-pointer"
            @click="toggleItemExpanded(item.id)"
          >
            <CardContent class="p-4">
              <!-- Item Header (Always Visible) -->
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-3 flex-1">
                  <button
                    class="mt-1 text-muted-foreground hover:text-foreground transition-colors"
                    @click.stop="toggleItemExpanded(item.id)"
                  >
                    <ChevronRight v-if="!expandedItems.has(item.id)" class="h-4 w-4" />
                    <ChevronDown v-else class="h-4 w-4" />
                  </button>
                  <div class="flex-1">
                    <div class="font-semibold">{{ item.product_name }}</div>
                    <div class="text-sm text-muted-foreground">{{ item.description }}</div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      Qty: {{ item.quantity }} • {{ formatSpecs(item.specs) }}
                    </div>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <Badge :variant="getStatusVariant(itemStatuses[item.id] || 'new')">
                    {{ formatStatus(itemStatuses[item.id] || 'new') }}
                  </Badge>
                  <Badge v-if="isOverdue(item)" variant="destructive" class="text-xs">
                    Overdue
                  </Badge>
                </div>
              </div>

              <!-- Item Details (Expandable) -->
              <div v-if="expandedItems.has(item.id)" class="mt-4 pl-7 space-y-4" @click.stop>
                <div v-if="item.notes" class="text-sm">
                  <span class="font-medium">Notes:</span> {{ item.notes }}
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block"
                      >Assigned Printshop</Label
                    >
                    <FilterSelect
                      :model-value="itemAssignments[item.id] || ''"
                      @update:model-value="(val) => handlePrintshopChange(item.id, val)"
                      :options="printshopOptions"
                    />
                  </div>

                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block"
                      >Status</Label
                    >
                    <ItemStatusCombobox
                      :model-value="itemStatuses[item.id] || 'new'"
                      :item-id="item.id"
                      @update:model-value="handleStatusChange"
                    />
                  </div>
                </div>

                <!-- Date Fields -->
                <div class="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div class="text-sm font-medium">Dates</div>
                  <div class="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label class="text-xs text-muted-foreground mb-1 block"
                        >Due Date</Label
                      >
                      <DateInput
                        :model-value="itemDueDates[item.id]"
                        @update:model-value="(val) => handleDueDateChange(item.id, val)"
                      />
                    </div>

                    <div>
                      <Label class="text-xs text-muted-foreground">Production Start</Label>
                      <div class="mt-1 flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                        {{
                          item.production_start_date
                            ? formatDateDisplay(item.production_start_date)
                            : 'Not started'
                        }}
                      </div>
                    </div>

                    <div>
                      <Label class="text-xs text-muted-foreground">Production Ready</Label>
                      <div class="mt-1 flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                        {{
                          item.production_ready_date
                            ? formatDateDisplay(item.production_ready_date)
                            : 'Not ready'
                        }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status History -->
                <div v-if="item.status_history && item.status_history.length > 0" class="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div class="text-sm font-medium">Status History</div>
                  <div class="space-y-2">
                    <div
                      v-for="(history, index) in item.status_history"
                      :key="index"
                      class="flex items-start gap-3 text-xs"
                    >
                      <div class="mt-0.5 h-2 w-2 rounded-full bg-primary"></div>
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <Badge :variant="getStatusVariant(history.status)" class="text-xs">
                            {{ formatStatus(history.status) }}
                          </Badge>
                          <span class="text-muted-foreground">
                            {{ formatDateDisplay(history.changed_at) }}
                          </span>
                          <span class="text-muted-foreground">by {{ history.changed_by }}</span>
                        </div>
                        <div v-if="history.note" class="mt-1 text-muted-foreground">
                          {{ history.note }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Files Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Paperclip class="h-5 w-5" />
          Files ({{ files.length }})
        </h3>
        <div v-if="files.length === 0">
          <Card>
            <CardContent class="p-8">
              <div class="flex items-center justify-center text-sm text-muted-foreground">
                No files attached
              </div>
            </CardContent>
          </Card>
        </div>
        <div v-else class="space-y-2">
          <Card
            v-for="file in files"
            :key="file.id"
            class="hover:bg-accent/50 transition-colors"
          >
            <CardContent class="p-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="flex-shrink-0">
                    <FileText class="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{{ file.name }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ file.item_name }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ file.type }} • {{ file.size }} • {{ formatDate(file.uploaded_at) }}
                    </div>
                  </div>
                </div>
                <button
                  class="flex-shrink-0 rounded-md p-2 transition-colors hover:bg-accent"
                  title="Download file"
                >
                  <Download class="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Notes Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare class="h-5 w-5" />
          Notes ({{ notes.length }})
        </h3>

        <Card>
          <CardContent class="p-4">
            <!-- Existing Notes -->
            <div v-if="notes.length === 0" class="text-sm text-muted-foreground text-center py-8">
              No notes yet
            </div>
            <div v-else class="space-y-3 mb-4">
              <div
                v-for="note in notes"
                :key="note.id"
                class="border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="text-sm font-semibold">{{ note.created_by }}</div>
                      <Badge v-if="note.item_reference" variant="outline" class="text-xs">
                        {{ note.item_reference }}
                      </Badge>
                    </div>
                    <div class="text-xs text-muted-foreground">{{ formatNoteDate(note.created_at) }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex flex-wrap gap-1">
                      <Badge
                        v-for="dept in note.departments"
                        :key="dept"
                        variant="secondary"
                        class="text-xs"
                      >
                        {{ getDepartmentLabel(dept) }}
                      </Badge>
                    </div>
                    <div class="flex gap-1">
                      <button
                        @click="startEditNote(note)"
                        class="rounded-md p-1 transition-colors hover:bg-accent"
                        title="Edit note"
                      >
                        <Edit2 class="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        @click="deleteNote(note.id)"
                        class="rounded-md p-1 transition-colors hover:bg-destructive/10"
                        title="Delete note"
                      >
                        <Trash2 class="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Edit mode -->
                <div v-if="editingNoteId === note.id" class="space-y-2">
                  <Textarea
                    v-model="editingNoteContent"
                    :rows="3"
                  />
                  <div class="flex gap-2 justify-end">
                    <Button
                      @click="cancelEditNote"
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      @click="saveEditNote"
                      size="sm"
                      :disabled="!editingNoteContent.trim()"
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <!-- View mode -->
                <div v-else class="text-sm whitespace-pre-wrap">{{ note.content }}</div>
              </div>
            </div>

            <!-- Add Note Form -->
            <div class="border-t pt-4 space-y-3">
              <Textarea
                v-model="newNoteContent"
                :rows="3"
                placeholder="Write a note..."
              />
              <div class="flex items-center gap-2">
                <FilterSelect
                  v-model="selectedItemReference"
                  :options="itemReferenceOptions"
                  class="w-48"
                />
                <FilterSelect
                  v-model="selectedDepartment"
                  :options="departmentOptions"
                  class="w-40"
                />
                <Button
                  @click="addNote"
                  :disabled="!newNoteContent.trim()"
                  size="sm"
                  class="ml-auto"
                >
                  Add Note
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  </Sheet>
</template>
