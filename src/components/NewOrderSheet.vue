<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCustomers } from '@/composables/useCustomers'
import { printshops } from '@/data/mock/printshops'
import type { Customer } from '@/data/mock/customers'
import type { PaymentStatus, PaymentMethod, DeliveryMethod } from '@/data/mock/orders'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import DateInput from '@/components/ui/DateInput.vue'
import { User, Package, Paperclip, ChevronDown, ChevronRight, X, MessageSquare, Edit2, Trash2 } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'orderCreated', orderId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getCustomers } = useCustomers()

// Customer section
const showNewCustomerForm = ref(false)
const selectedCustomer = ref<Customer | null>(null)
const customerSearchQuery = ref('')

// New customer form
const newCustomer = ref({
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
})

// Customer search/autocomplete
const filteredCustomers = computed(() => {
  if (!customerSearchQuery.value) return []
  const query = customerSearchQuery.value.toLowerCase()
  return getCustomers()
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query)
    )
    .slice(0, 5)
})

const selectCustomer = (customer: Customer) => {
  selectedCustomer.value = customer
  customerSearchQuery.value = ''
  showNewCustomerForm.value = false
}

const clearCustomer = () => {
  selectedCustomer.value = null
  customerSearchQuery.value = ''
}

const toggleNewCustomerForm = () => {
  showNewCustomerForm.value = !showNewCustomerForm.value
  if (showNewCustomerForm.value) {
    selectedCustomer.value = null
    customerSearchQuery.value = ''
  }
}

// Order details
const deliveryMethod = ref<DeliveryMethod>('delivery')
const paymentStatus = ref<PaymentStatus>('unpaid')
const paymentMethod = ref<PaymentMethod>('cash')
const amountTotal = ref<number>(0)
const amountPaid = ref<number>(0)
const orderNotes = ref('')

// Payment options
const paymentStatusOptions = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'etransfer', label: 'eTransfer' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
]

// Auto-update amount paid when payment status changes
const handlePaymentStatusChange = (status: string | string[]) => {
  const value = Array.isArray(status) ? status[0] : status
  paymentStatus.value = value as PaymentStatus

  if (paymentStatus.value === 'paid') {
    amountPaid.value = amountTotal.value
  } else if (paymentStatus.value === 'unpaid') {
    amountPaid.value = 0
  }
}

const handlePaymentMethodChange = (method: string | string[]) => {
  const value = Array.isArray(method) ? method[0] : method
  paymentMethod.value = value as PaymentMethod
}

// Items section
interface OrderItem {
  id: string
  product_name: string
  description: string
  quantity: number
  specs: string
  assigned_printshop: string | null
  due_date: string | null
}

const items = ref<OrderItem[]>([])
let itemIdCounter = 1

// Track expanded items
const expandedItems = ref<Set<string>>(new Set())

const toggleItemExpanded = (itemId: string) => {
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId)
  } else {
    expandedItems.value.add(itemId)
  }
}

// Printshop options
const printshopOptions = computed(() => [
  { value: '', label: 'Unassigned' },
  ...printshops.map((shop) => ({
    value: shop.id,
    label: shop.name,
  })),
])

const handlePrintshopChange = (itemId: string, printshopId: string | string[]) => {
  const value = Array.isArray(printshopId) ? (printshopId[0] || '') : printshopId
  const item = items.value.find(i => i.id === itemId)
  if (item) {
    item.assigned_printshop = value === '' ? null : value
  }
}

const addItem = () => {
  const newItem = {
    id: `temp-item-${itemIdCounter++}`,
    product_name: '',
    description: '',
    quantity: 1,
    specs: '',
    assigned_printshop: null,
    due_date: null,
  }
  items.value.push(newItem)
  expandedItems.value.add(newItem.id)
}

const removeItem = (itemId: string) => {
  const index = items.value.findIndex(i => i.id === itemId)
  if (index !== -1 && items.value.length > 1) {
    items.value.splice(index, 1)
    expandedItems.value.delete(itemId)
  }
}

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

const notes = ref<OrderNote[]>([])
const newNoteContent = ref('')
const selectedDepartment = ref<NoteDepartment>('everyone')
const selectedItemReference = ref<string>('order')

// Edit note state
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')

// Department options for notes
const departmentOptions = [
  { value: 'printshop', label: 'Printshop' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'billing', label: 'Billing' },
  { value: 'everyone', label: 'Everyone' },
]

// Item reference options for notes
const itemReferenceOptions = computed(() => [
  { value: 'order', label: 'Order note' },
  ...items.value.map(item => ({
    value: item.product_name || item.id,
    label: item.product_name || `Item ${items.value.indexOf(item) + 1}`
  }))
])

const addNote = () => {
  if (!newNoteContent.value.trim() || !selectedDepartment.value) return

  const note: OrderNote = {
    id: `note-${Date.now()}`,
    content: newNoteContent.value,
    departments: [selectedDepartment.value],
    created_at: new Date().toISOString(),
    created_by: 'Current User',
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

// Reset form when sheet is opened
watch(() => props.isOpen, (newVal) => {
  if (newVal && items.value.length === 0) {
    addItem()
  }
})

// Validation
const validationErrors = ref<string[]>([])

const validateForm = (): boolean => {
  validationErrors.value = []

  // Customer required
  if (!selectedCustomer.value && !showNewCustomerForm.value) {
    validationErrors.value.push('Customer is required')
  }

  // New customer validation
  if (showNewCustomerForm.value) {
    if (!newCustomer.value.name.trim()) {
      validationErrors.value.push('Customer name is required')
    }
    if (!newCustomer.value.email.trim()) {
      validationErrors.value.push('Customer email is required')
    }
    if (!newCustomer.value.phone.trim()) {
      validationErrors.value.push('Customer phone is required')
    }
    if (!newCustomer.value.address.trim()) {
      validationErrors.value.push('Customer address is required')
    }
  }

  // At least one item required
  if (items.value.length === 0) {
    validationErrors.value.push('At least one item is required')
  }

  // Item validation
  items.value.forEach((item, index) => {
    if (!item.product_name.trim()) {
      validationErrors.value.push(`Item ${index + 1}: Product name is required`)
    }
    if (!item.description.trim()) {
      validationErrors.value.push(`Item ${index + 1}: Description is required`)
    }
    if (item.quantity <= 0) {
      validationErrors.value.push(`Item ${index + 1}: Quantity must be greater than 0`)
    }
  })

  // Amount total required
  if (amountTotal.value <= 0) {
    validationErrors.value.push('Amount total must be greater than 0')
  }

  return validationErrors.value.length === 0
}

const createOrder = () => {
  if (!validateForm()) {
    return
  }

  const orderData = {
    customer: showNewCustomerForm.value ? newCustomer.value : selectedCustomer.value,
    delivery_method: deliveryMethod.value,
    payment_status: paymentStatus.value,
    payment_method: paymentMethod.value,
    amount_total: amountTotal.value,
    amount_paid: amountPaid.value,
    notes: orderNotes.value,
    items: items.value.map((item) => ({
      product_name: item.product_name,
      description: item.description,
      quantity: item.quantity,
      specs: item.specs,
      assigned_printshop: item.assigned_printshop,
      status: item.assigned_printshop ? 'assigned' : 'new',
    })),
    source: 'manual',
  }

  console.log('Creating order:', orderData)

  const mockOrderId = 'order-new-1'
  alert('Order created successfully!')

  emit('orderCreated', mockOrderId)
  emit('update:isOpen', false)

  // Reset form
  resetForm()
}

const resetForm = () => {
  selectedCustomer.value = null
  showNewCustomerForm.value = false
  customerSearchQuery.value = ''
  newCustomer.value = { name: '', email: '', phone: '', company: '', address: '' }
  deliveryMethod.value = 'delivery'
  paymentStatus.value = 'unpaid'
  paymentMethod.value = 'cash'
  amountTotal.value = 0
  amountPaid.value = 0
  orderNotes.value = ''
  items.value = []
  validationErrors.value = []
  expandedItems.value.clear()
  notes.value = []
  newNoteContent.value = ''
  selectedDepartment.value = 'everyone'
  selectedItemReference.value = 'order'
  editingNoteId.value = null
  editingNoteContent.value = ''
}

const cancel = () => {
  if (confirm('Are you sure you want to cancel? All entered information will be lost.')) {
    emit('update:isOpen', false)
    resetForm()
  }
}
</script>

<template>
  <Sheet
    :open="isOpen"
    @update:open="emit('update:isOpen', $event)"
    title="Create New Order"
    side="right"
    :z-index="60"
  >
    <div class="space-y-6 p-6">
      <!-- Validation Errors -->
      <div v-if="validationErrors.length > 0" class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div class="mb-2 font-semibold text-destructive">Please fix the following errors:</div>
        <ul class="list-inside list-disc space-y-1 text-sm text-destructive">
          <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <!-- Customer & Order Information -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <User class="h-5 w-5" />
            Customer & Order Information
          </h3>
          <Badge :variant="deliveryMethod === 'delivery' ? 'default' : 'secondary'">
            {{ deliveryMethod === 'delivery' ? 'To deliver' : 'Customer pickup' }}
          </Badge>
        </div>

        <Card>
          <CardContent class="p-4">
            <div class="space-y-4">
              <!-- Customer Selection/Creation -->
              <div v-if="selectedCustomer" class="rounded-lg border bg-muted/50 p-3">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <Label class="text-xs text-muted-foreground mb-1 block">Customer</Label>
                    <div class="font-semibold">{{ selectedCustomer.name }}</div>
                    <div v-if="selectedCustomer.company" class="text-sm text-muted-foreground">
                      {{ selectedCustomer.company }}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" @click="clearCustomer">Change</Button>
                </div>
                <div class="space-y-1 text-sm border-t pt-2">
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground">Email:</Label>
                    {{ selectedCustomer.email }}
                  </div>
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground">Phone:</Label>
                    {{ selectedCustomer.phone }}
                  </div>
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground">Address:</Label>
                    {{ selectedCustomer.address }}
                  </div>
                </div>
              </div>

              <!-- Customer Search -->
              <div v-if="!selectedCustomer && !showNewCustomerForm">
                <Label class="text-xs text-muted-foreground mb-1 block">Search Customer</Label>
                <Input
                  v-model="customerSearchQuery"
                  placeholder="Search by name, email, or company..."
                />

                <!-- Search Results -->
                <div v-if="customerSearchQuery && filteredCustomers.length > 0" class="mt-2 space-y-2">
                  <div
                    v-for="customer in filteredCustomers"
                    :key="customer.id"
                    @click="selectCustomer(customer)"
                    class="cursor-pointer rounded-lg border bg-background p-2 hover:bg-muted text-sm"
                  >
                    <div class="font-medium">{{ customer.name }}</div>
                    <div v-if="customer.company" class="text-xs text-muted-foreground">
                      {{ customer.company }}
                    </div>
                    <div class="text-xs text-muted-foreground">{{ customer.email }}</div>
                  </div>
                </div>

                <div v-if="customerSearchQuery && filteredCustomers.length === 0" class="mt-2 text-sm text-muted-foreground">
                  No customers found
                </div>

                <div class="mt-3">
                  <Button variant="outline" size="sm" @click="toggleNewCustomerForm" class="w-full">
                    + Create New Customer
                  </Button>
                </div>
              </div>

              <!-- New Customer Form -->
              <div v-if="showNewCustomerForm" class="space-y-3">
                <div class="flex items-center justify-between mb-2">
                  <Label class="text-sm font-medium">New Customer</Label>
                  <Button variant="ghost" size="sm" @click="toggleNewCustomerForm">
                    Use Existing
                  </Button>
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Name *</Label>
                  <Input v-model="newCustomer.name" placeholder="Customer name" required />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Email *</Label>
                  <Input v-model="newCustomer.email" type="email" placeholder="customer@example.com" required />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Phone *</Label>
                  <Input v-model="newCustomer.phone" type="tel" placeholder="416-555-0123" required />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Company (Optional)</Label>
                  <Input v-model="newCustomer.company" placeholder="Company name" />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address *</Label>
                  <Textarea
                    v-model="newCustomer.address"
                    placeholder="123 Main St, Toronto, ON M5V 2T6"
                    :rows="2"
                    required
                  />
                </div>
              </div>

              <!-- Delivery Method -->
              <div class="border-t pt-4">
                <Label class="text-xs text-muted-foreground mb-2 block">Delivery Method *</Label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      v-model="deliveryMethod"
                      value="delivery"
                      class="h-4 w-4"
                    />
                    <span class="text-sm">Delivery</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      v-model="deliveryMethod"
                      value="customer_pickup"
                      class="h-4 w-4"
                    />
                    <span class="text-sm">Customer Pickup</span>
                  </label>
                </div>
              </div>

              <!-- Payment Information -->
              <div class="border-t pt-4 space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Payment Status</Label>
                    <FilterSelect
                      :model-value="paymentStatus"
                      @update:model-value="handlePaymentStatusChange"
                      :options="paymentStatusOptions"
                    />
                  </div>

                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Payment Method</Label>
                    <FilterSelect
                      :model-value="paymentMethod"
                      @update:model-value="handlePaymentMethodChange"
                      :options="paymentMethodOptions"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Amount Total ($) *</Label>
                    <Input
                      v-model="amountTotal"
                      type="number"
                      :min="0"
                      :step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Amount Paid ($)</Label>
                    <Input
                      v-model="amountPaid"
                      type="number"
                      :min="0"
                      :max="amountTotal"
                      :step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Order Items -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Package class="h-5 w-5" />
            Order Items ({{ items.length }})
          </h3>
          <Button size="sm" @click="addItem">+ Add Item</Button>
        </div>

        <div class="space-y-3">
          <Card
            v-for="(item, index) in items"
            :key="item.id"
            class="cursor-pointer"
            @click="toggleItemExpanded(item.id)"
          >
            <CardContent class="p-4">
              <!-- Item Header -->
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
                    <div class="font-semibold">{{ item.product_name || `Item ${index + 1}` }}</div>
                    <div class="text-sm text-muted-foreground">{{ item.description || 'No description' }}</div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      Qty: {{ item.quantity }}
                    </div>
                  </div>
                </div>
                <button
                  @click.stop="removeItem(item.id)"
                  :disabled="items.length === 1"
                  class="rounded-md p-1 transition-colors hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove item"
                >
                  <X class="h-4 w-4 text-destructive" />
                </button>
              </div>

              <!-- Item Details (Expandable) -->
              <div v-if="expandedItems.has(item.id)" class="mt-4 pl-7 space-y-3" @click.stop>
                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Product Name *</Label>
                  <Input
                    v-model="item.product_name"
                    placeholder="e.g., Business Cards, Banners"
                    required
                  />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Description *</Label>
                  <Input
                    v-model="item.description"
                    placeholder="e.g., 500 cards, 3.5x2 inches, full color"
                    required
                  />
                </div>

                <div class="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Quantity *</Label>
                    <Input
                      v-model="item.quantity"
                      type="number"
                      :min="1"
                      required
                    />
                  </div>

                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Assigned Printshop</Label>
                    <FilterSelect
                      :model-value="item.assigned_printshop || ''"
                      @update:model-value="(val) => handlePrintshopChange(item.id, val)"
                      :options="printshopOptions"
                    />
                  </div>

                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Due Date</Label>
                    <DateInput v-model="item.due_date" />
                  </div>
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Specifications</Label>
                  <Textarea
                    v-model="item.specs"
                    placeholder="e.g., 16pt cardstock, matte finish, full bleed"
                    :rows="2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Files -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Paperclip class="h-5 w-5" />
          Files
        </h3>
        <Card>
          <CardContent class="p-8">
            <div class="flex items-center justify-center text-sm text-muted-foreground">
              File upload coming soon
            </div>
          </CardContent>
        </Card>
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

      <!-- Footer Actions -->
      <div class="flex gap-3 sticky bottom-0 bg-background pt-4 border-t">
        <Button size="lg" class="flex-1" @click="createOrder">Create Order</Button>
        <Button variant="outline" size="lg" @click="cancel">Cancel</Button>
      </div>
    </div>
  </Sheet>
</template>
