<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOrders } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatStatus as libFormatStatus } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import type { PaymentStatus, PaymentMethod, ItemStatus, OrderNote, NoteDepartment } from '@/types'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Badge from '@/components/ui/Badge.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import Button from '@/components/ui/Button.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import ItemStatusCombobox from '@/components/ItemStatusCombobox.vue'
import ItemControls from '@/components/ItemControls.vue'
import NotesSection from '@/components/NotesSection.vue'
import { User, Package, Paperclip, ChevronDown, ChevronRight, FileText, Download } from 'lucide-vue-next'

interface Props {
  orderId?: string | null
  isOpen: boolean
  showPayment?: boolean
  showAddresses?: boolean
  showFiles?: boolean
  side?: 'left' | 'right'
  zIndex?: number
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  showPayment: true,
  showAddresses: true,
  showFiles: true,
  side: 'right',
  zIndex: 60,
})

const emit = defineEmits<Emits>()

const {
  getOrderById,
  updateItemStatus,
  updateItemPrintshop,
  updateItemDueDate,
  updateOrderPaymentStatus,
  updateOrderPaymentMethod
} = useOrders()
const { getPrintshops, getPrintshopName } = usePrintshops()
const { toast } = useToast()
const authStore = useAuthStore()

const order = computed(() => (props.orderId ? getOrderById(props.orderId) : null))

// Filtered items based on user role
const filteredItems = computed(() => {
  if (!order.value) return []

  // If printshop manager, show only items assigned to their shops
  if (authStore.isPrintshopManager) {
    return order.value.items.filter(item =>
      item.assigned_printshop && authStore.userShops.includes(item.assigned_printshop)
    )
  }

  // For other roles, show all items
  return order.value.items
})

// Filtered files based on filtered items
const filteredFiles = computed(() => {
  const itemNames = new Set(filteredItems.value.map(item => item.product_name))
  return files.value.filter(file => itemNames.has(file.item_name))
})

// Filtered notes based on department and item reference
const filteredNotes = computed(() => {
  // Allowed departments for printshop managers and drivers
  const allowedDepartments: NoteDepartment[] = ['everyone', 'printshop', 'delivery']

  // Item names from filtered items
  const itemNames = new Set(filteredItems.value.map(item => item.product_name))

  return notes.value.filter(note => {
    // Check if note is for an allowed department
    const hasAllowedDepartment = note.departments.some(dept =>
      allowedDepartments.includes(dept)
    )

    if (!hasAllowedDepartment) return false

    // If note has no item reference, include it
    if (!note.item_reference) return true

    // If note has item reference, check if it's in our filtered items
    return itemNames.has(note.item_reference)
  })
})

// Editable state
const paymentStatus = ref<PaymentStatus>('unpaid')
const paymentMethod = ref<PaymentMethod>('cash')
const orderNotes = ref('')

// Track item assignments, statuses, and due dates
const itemAssignments = ref<Record<string, string | null>>({})
const itemStatuses = ref<Record<string, ItemStatus>>({})
const itemDueDates = ref<Record<string, string | null>>({})

// Notes management
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
  ...getPrintshops().map((shop) => ({
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
const handlePrintshopChange = (itemId: string, printshopId: string | null) => {
  // Update local state for immediate UI feedback
  itemAssignments.value[itemId] = printshopId

  // Propagate to store
  updateItemPrintshop(itemId, printshopId)

  // Re-sync status from store (updateItemPrintshop may auto-set status to 'assigned')
  const updatedOrder = getOrderById(props.orderId!)
  if (updatedOrder) {
    const updatedItem = updatedOrder.items.find(i => i.id === itemId)
    if (updatedItem) {
      itemStatuses.value[itemId] = updatedItem.status
    }
  }

  toast({
    title: 'Printshop updated',
    description: `Assigned to ${getPrintshopName(printshopId)}`
  })
}

const handleStatusChange = (itemId: string, status: ItemStatus) => {
  const oldStatus = itemStatuses.value[itemId] || 'new'

  // Update local state for immediate UI feedback
  itemStatuses.value[itemId] = status

  // Propagate to store
  updateItemStatus(itemId, status)

  toast({
    title: 'Status updated',
    description: `Changed from ${libFormatStatus(oldStatus)} to ${libFormatStatus(status)}`
  })
}

const handleDueDateChange = (itemId: string, dueDate: string | null) => {
  // Update local state for immediate UI feedback
  itemDueDates.value[itemId] = dueDate

  // Propagate to store
  updateItemDueDate(itemId, dueDate)

  toast({
    title: 'Due date updated',
    description: dueDate ? `Set to ${formatDateDisplay(dueDate)}` : 'Due date cleared'
  })
}

const handlePaymentStatusChange = (status: string | string[]) => {
  const value = Array.isArray(status) ? status[0] : status

  // Update local state for immediate UI feedback
  paymentStatus.value = value as PaymentStatus

  // Propagate to store
  if (order.value) {
    updateOrderPaymentStatus(order.value.id, value as PaymentStatus)
    toast({
      title: 'Payment status updated',
      description: `Set to ${value}`
    })
  }
}

const handlePaymentMethodChange = (method: string | string[]) => {
  const value = Array.isArray(method) ? method[0] : method

  // Update local state for immediate UI feedback
  paymentMethod.value = value as PaymentMethod

  // Propagate to store
  if (order.value) {
    updateOrderPaymentMethod(order.value.id, value as PaymentMethod)
    toast({
      title: 'Payment method updated',
      description: `Set to ${value}`
    })
  }
}

// Note handlers
const handleAddNote = (content: string, departments: NoteDepartment[], itemReference: string | null) => {
  const note: OrderNote = {
    id: `note-${Date.now()}`,
    content,
    departments,
    created_at: new Date().toISOString(),
    created_by: 'Current User', // TODO: Replace with actual user
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

    <div v-else class="space-y-10 p-10">
      <!-- Customer & Order Info (Combined) -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <User class="h-4 w-4" />
            </div>
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
                <template v-if="showAddresses">
                  <div class="border-t pt-3">
                    <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address</Label>
                    <div class="text-sm">{{ order.customer.address }}</div>
                  </div>
                  <div class="border-t pt-3">
                    <Label class="text-xs text-muted-foreground mb-1 block">Billing Address</Label>
                    <div class="text-sm">{{ order.customer.address }}</div>
                  </div>
                </template>
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

                <div v-if="order.customer.notes" class="border-t pt-3">
                  <Label class="text-xs text-muted-foreground mb-1 block">Customer Notes</Label>
                  <div class="text-sm">{{ order.customer.notes }}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Items Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <div class="p-2 bg-accent rounded-lg">
            <Package class="h-4 w-4" />
          </div>
          Order Items ({{ filteredItems.length }})
        </h3>
        <div class="space-y-2">
          <Card
            v-for="item in filteredItems"
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

                <ItemControls
                  :item="{
                    id: item.id,
                    status: itemStatuses[item.id] || 'new',
                    assigned_printshop: itemAssignments[item.id] ?? null,
                    due_date: itemDueDates[item.id] ?? null,
                    delivery_date: item.delivery_date ?? null,
                    production_start_date: item.production_start_date ?? null,
                    production_ready_date: item.production_ready_date ?? null,
                  }"
                  :show-printshop="true"
                  :show-status="true"
                  :show-due-date="true"
                  :show-timeline="false"
                  layout="inline"
                  @update:status="handleStatusChange"
                  @update:printshop="handlePrintshopChange"
                  @update:due-date="handleDueDateChange"
                />

                <!-- Status History -->
                <div v-if="item.status_history && item.status_history.length > 0" class="space-y-2">
                  <div class="text-sm font-medium">Status History</div>
                  <div class="space-y-2">
                    <div
                      v-for="(history, index) in item.status_history"
                      :key="index"
                      class="flex items-start gap-3 text-xs"
                    >
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
      <div v-if="showFiles">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <div class="p-2 bg-accent rounded-lg">
            <Paperclip class="h-4 w-4" />
          </div>
          Files ({{ filteredFiles.length }})
        </h3>
        <div v-if="filteredFiles.length === 0">
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
            v-for="file in filteredFiles"
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
      <NotesSection
        :notes="filteredNotes"
        :item-options="itemReferenceOptions"
        :department-options="departmentOptions"
        @add-note="handleAddNote"
        @edit-note="handleEditNote"
        @delete-note="handleDeleteNote"
      />

    </div>
  </Sheet>
</template>
