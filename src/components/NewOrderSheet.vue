<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCustomers } from '@/composables/useCustomers'
import { useOrders } from '@/composables/useOrders'
import { usePrintshops } from '@/composables/usePrintshops'
import { useToast } from '@/composables/useToast'
import type { Customer, PaymentStatus, PaymentMethod, DeliveryMethod, OrderNote, NoteDepartment } from '@/types'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import ItemControls from '@/components/ItemControls.vue'
import NotesSection from '@/components/NotesSection.vue'
import { User, Package, Paperclip, ChevronDown, ChevronRight, X } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'orderCreated', orderId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getCustomers, addCustomer } = useCustomers()
const { createOrder: createOrderInStore } = useOrders()
const { getPrintshops } = usePrintshops()
const { toast } = useToast()

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
const deliveryFees = ref<number>(0)
const amountPaid = ref<number>(0)
const orderNotes = ref('')
const useCustomerAddress = ref(true)
const customDeliveryAddress = ref('')

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

// Computed totals
const itemsSubtotal = computed(() => {
  return items.value.reduce((sum, item) => {
    if (item.pricing_type === 'unit') {
      return sum + (item.unit_price * item.quantity)
    } else {
      return sum + item.flat_price
    }
  }, 0)
})

const amountTotal = computed(() => {
  return itemsSubtotal.value + deliveryFees.value
})

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
  pricing_type: 'unit' | 'flat'
  unit_price: number
  flat_price: number
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
  ...getPrintshops().map((shop) => ({
    value: shop.id,
    label: shop.name,
  })),
])

const handlePrintshopChange = (itemId: string, printshopId: string | null) => {
  const item = items.value.find(i => i.id === itemId)
  if (item) {
    item.assigned_printshop = printshopId
  }
}

const addItem = () => {
  const newItem = {
    id: `temp-item-${itemIdCounter++}`,
    product_name: '',
    description: '',
    quantity: 1,
    pricing_type: 'unit' as const,
    unit_price: 0,
    flat_price: 0,
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
const notes = ref<OrderNote[]>([])

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

// Note handlers
const handleAddNote = (content: string, departments: NoteDepartment[], itemReference: string | null) => {
  // Determine entity_type and entity_id
  let entity_type: 'order' | 'order_item' = 'order'
  let entity_id = 'temp-order-id' // placeholder for new order

  if (itemReference && itemReference !== 'order') {
    // itemReference is product_name or item id, need to find the item
    const item = items.value.find(i => i.product_name === itemReference || i.id === itemReference)
    if (item) {
      entity_type = 'order_item'
      entity_id = item.id
    }
  }

  const note: OrderNote = {
    id: `note-${Date.now()}`,
    entity_type,
    entity_id,
    content,
    departments,
    created_at: new Date().toISOString(),
    created_by: 'Current User',
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

const createOrder = async () => {
  if (!validateForm()) {
    return
  }

  try {
    // 1. Handle customer (create new or use existing)
    let customerId: string
    if (showNewCustomerForm.value) {
      const newCustomerResult = await addCustomer(newCustomer.value)
      if (!newCustomerResult) {
        toast({ title: 'Failed to create customer', variant: 'destructive' })
        return
      }
      customerId = newCustomerResult.id
    } else if (selectedCustomer.value) {
      customerId = selectedCustomer.value.id
    } else {
      toast({ title: 'Please select or create a customer', variant: 'destructive' })
      return
    }

    // 2. Prepare order data
    const orderData = {
      customer_id: customerId,
      source: 'other' as const,
      payment_status: paymentStatus.value,
      payment_method: paymentMethod.value,
      amount_total: amountTotal.value,
      amount_paid: amountPaid.value,
      internal_notes: orderNotes.value,
    }

    // 3. Prepare items data
    const itemsData = items.value.map((item) => ({
      product_name: item.product_name,
      description: item.description || '',
      quantity: item.quantity,
      // Convert flat price to unit price for storage
      unit_price: item.pricing_type === 'unit'
        ? item.unit_price
        : (item.flat_price / item.quantity),
      specs: item.specs || {},
      assigned_printshop: item.assigned_printshop || null,
      delivery_method: deliveryMethod.value,
      due_date: item.due_date || null,
      notes: '',
    }))

    // 4. Create the order
    const newOrder = await createOrderInStore(orderData, itemsData)

    if (!newOrder) {
      toast({ title: 'Failed to create order', variant: 'destructive' })
      return
    }

    // Success!
    toast({ title: 'Order created successfully!', variant: 'success' })
    emit('orderCreated', newOrder.id)
    emit('update:isOpen', false)
    resetForm()
  } catch (error) {
    console.error('Error creating order:', error)
    toast({ title: 'An error occurred while creating the order', variant: 'destructive' })
  }
}

const resetForm = () => {
  selectedCustomer.value = null
  showNewCustomerForm.value = false
  customerSearchQuery.value = ''
  newCustomer.value = { name: '', email: '', phone: '', company: '', address: '' }
  deliveryMethod.value = 'delivery'
  paymentStatus.value = 'unpaid'
  paymentMethod.value = 'cash'
  deliveryFees.value = 0
  amountPaid.value = 0
  useCustomerAddress.value = true
  customDeliveryAddress.value = ''
  orderNotes.value = ''
  items.value = []
  validationErrors.value = []
  expandedItems.value.clear()
  notes.value = []
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

      <!-- Customer -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <User class="h-4 w-4" />
            </div>
            Customer
          </h3>
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
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Order Items -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <Package class="h-4 w-4" />
            </div>
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

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Quantity *</Label>
                  <Input
                    v-model.number="item.quantity"
                    type="number"
                    :min="1"
                    required
                  />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-2 block">Pricing Type</Label>
                  <div class="flex gap-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        v-model="item.pricing_type"
                        value="unit"
                        class="h-4 w-4"
                      />
                      <span class="text-sm">Unit Price</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        v-model="item.pricing_type"
                        value="flat"
                        class="h-4 w-4"
                      />
                      <span class="text-sm">Flat Price</span>
                    </label>
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div v-if="item.pricing_type === 'unit'">
                    <Label class="text-xs text-muted-foreground mb-1 block">Unit Price ($)</Label>
                    <Input
                      v-model.number="item.unit_price"
                      type="number"
                      :min="0"
                      :step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div v-if="item.pricing_type === 'flat'">
                    <Label class="text-xs text-muted-foreground mb-1 block">Flat Price ($)</Label>
                    <Input
                      v-model.number="item.flat_price"
                      type="number"
                      :min="0"
                      :step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label class="text-xs text-muted-foreground mb-1 block">Subtotal</Label>
                    <div class="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-semibold">
                      ${{ item.pricing_type === 'unit'
                        ? (item.quantity * item.unit_price).toFixed(2)
                        : item.flat_price.toFixed(2) }}
                    </div>
                  </div>
                </div>

                <div>
                  <ItemControls
                    :item="{
                      id: item.id,
                      status: 'new',
                      assigned_printshop: item.assigned_printshop,
                      due_date: item.due_date,
                      delivery_date: null,
                      production_start_date: null,
                      production_ready_date: null,
                    }"
                    :show-printshop="true"
                    :show-status="false"
                    :show-due-date="true"
                    :show-timeline="false"
                    layout="inline"
                    @update:printshop="(itemId, shopId) => handlePrintshopChange(itemId, shopId)"
                    @update:due-date="(itemId, date) => { const i = items.find(x => x.id === itemId); if (i) i.due_date = date }"
                  />
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

      <!-- Order Information -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <div class="p-2 bg-accent rounded-lg">
            <Package class="h-4 w-4" />
          </div>
          Order Information
        </h3>

        <Card>
          <CardContent class="p-4 space-y-4">
            <!-- Delivery Method -->
            <div>
              <Label class="text-sm font-medium mb-2 block">Delivery Method</Label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="deliveryMethod = 'delivery'"
                  :class="[
                    'px-4 py-2 rounded-md border-2 transition-all',
                    deliveryMethod === 'delivery'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:border-muted-foreground'
                  ]"
                >
                  Delivery
                </button>
                <button
                  @click="deliveryMethod = 'customer_pickup'"
                  :class="[
                    'px-4 py-2 rounded-md border-2 transition-all',
                    deliveryMethod === 'customer_pickup'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:border-muted-foreground'
                  ]"
                >
                  Customer Pickup
                </button>
              </div>
            </div>

            <!-- Delivery Address (if delivery selected) -->
            <div v-if="deliveryMethod === 'delivery'">
              <Label class="text-sm font-medium mb-2 block">Delivery Address</Label>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    type="radio"
                    id="use-customer-address"
                    :checked="useCustomerAddress"
                    @change="useCustomerAddress = true"
                    class="h-4 w-4"
                  />
                  <Label for="use-customer-address" class="text-sm cursor-pointer">
                    Use customer address
                    <span v-if="selectedCustomer" class="text-muted-foreground ml-1">
                      ({{ selectedCustomer.address }})
                    </span>
                  </Label>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="radio"
                    id="use-custom-address"
                    :checked="!useCustomerAddress"
                    @change="useCustomerAddress = false"
                    class="h-4 w-4"
                  />
                  <Label for="use-custom-address" class="text-sm cursor-pointer">
                    Use custom address
                  </Label>
                </div>
                <Input
                  v-if="!useCustomerAddress"
                  v-model="customDeliveryAddress"
                  placeholder="Enter delivery address"
                  class="mt-2"
                />
              </div>
            </div>

            <!-- Payment Section -->
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <Label class="text-sm font-medium mb-2 block">Payment Status</Label>
                <FilterSelect
                  :options="paymentStatusOptions"
                  :modelValue="[paymentStatus]"
                  @update:modelValue="handlePaymentStatusChange"
                  placeholder="Select status"
                />
              </div>

              <div>
                <Label class="text-sm font-medium mb-2 block">Payment Method</Label>
                <FilterSelect
                  :options="paymentMethodOptions"
                  :modelValue="[paymentMethod]"
                  @update:modelValue="handlePaymentMethodChange"
                  placeholder="Select method"
                />
              </div>
            </div>

            <!-- Pricing Summary -->
            <div class="border-t pt-4 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Items Subtotal:</span>
                <span class="font-medium">${{ itemsSubtotal.toFixed(2) }}</span>
              </div>

              <div v-if="deliveryMethod === 'delivery'" class="flex justify-between text-sm items-center gap-2">
                <span class="text-muted-foreground">Delivery Fees:</span>
                <Input
                  v-model.number="deliveryFees"
                  type="number"
                  :min="0"
                  :step="0.01"
                  placeholder="0.00"
                  class="w-32 text-right"
                />
              </div>

              <div class="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Total:</span>
                <span>${{ amountTotal.toFixed(2) }}</span>
              </div>

              <div class="flex justify-between text-sm items-center gap-2">
                <span class="text-muted-foreground">Amount Paid:</span>
                <Input
                  v-model.number="amountPaid"
                  type="number"
                  :min="0"
                  :max="amountTotal"
                  :step="0.01"
                  placeholder="0.00"
                  class="w-32 text-right"
                />
              </div>

              <div v-if="amountPaid < amountTotal" class="flex justify-between text-sm font-medium text-destructive">
                <span>Balance Due:</span>
                <span>${{ (amountTotal - amountPaid).toFixed(2) }}</span>
              </div>
            </div>

            <!-- Internal Notes -->
            <div>
              <Label class="text-sm font-medium mb-2 block">Internal Notes</Label>
              <Textarea
                v-model="orderNotes"
                placeholder="Add internal notes for this order..."
                :rows="3"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Files -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <div class="p-2 bg-accent rounded-lg">
            <Paperclip class="h-4 w-4" />
          </div>
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
      <NotesSection
        :notes="notes"
        :item-options="itemReferenceOptions"
        :department-options="departmentOptions"
        @add-note="handleAddNote"
        @edit-note="handleEditNote"
        @delete-note="handleDeleteNote"
      />

      <!-- Footer Actions -->
      <div class="flex gap-3 sticky bottom-0 bg-background pt-4 border-t">
        <Button size="lg" class="flex-1" @click="createOrder">Create Order</Button>
        <Button variant="outline" size="lg" @click="cancel">Cancel</Button>
      </div>
    </div>
  </Sheet>
</template>
