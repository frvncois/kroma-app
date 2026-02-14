<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCustomers } from '@/composables/useCustomers'
import { useOrders } from '@/composables/useOrders'
import { formatDate, formatCurrency, formatSource } from '@/lib/formatters'
import { getStatusVariant, getPaymentVariant } from '@/lib/variants'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Badge from '@/components/ui/Badge.vue'
import Label from '@/components/ui/Label.vue'
import Button from '@/components/ui/Button.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import { User, Package, BarChart } from 'lucide-vue-next'
import { formatDistanceToNow } from 'date-fns'
import type { ItemStatus, PaymentStatus } from '@/types'

interface Props {
  customerId: string | null
  isOpen: boolean
  side?: 'left' | 'right'
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'order-click', orderId: string): void
  (e: 'edit-customer'): void
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
})

const emit = defineEmits<Emits>()

const { getCustomerById, getCustomerOrderStats } = useCustomers()
const { getOrdersByCustomerId } = useOrders()

const customer = computed(() => (props.customerId ? getCustomerById(props.customerId) : null))
const allCustomerOrders = computed(() =>
  props.customerId ? getOrdersByCustomerId(props.customerId) : []
)
const stats = computed(() =>
  props.customerId ? getCustomerOrderStats(props.customerId) : null
)

// Filters
const statusFilter = ref<'all' | ItemStatus>('all')
const paymentFilter = ref<'all' | PaymentStatus>('all')

// Filter options for order status (based on statusRollup)
const statusFilterOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_production', label: 'In Production' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'canceled', label: 'Canceled' },
]

const paymentFilterOptions = [
  { value: 'all', label: 'All Payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

// Filtered orders based on selected filters
const customerOrders = computed(() => {
  let filtered = allCustomerOrders.value

  // Filter by status
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter((order) => order.statusRollup === statusFilter.value)
  }

  // Filter by payment
  if (paymentFilter.value !== 'all') {
    filtered = filtered.filter((order) => order.payment_status === paymentFilter.value)
  }

  return filtered
})

const formatStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatDeliveryMethod = (method: string): string => {
  return method === 'delivery' ? 'Delivery' : 'Customer pickup'
}

const customerSince = computed(() => {
  if (!customer.value) return ''
  return new Date(customer.value.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
})

const formatLastOrder = (date: string | null): string => {
  if (!date) return 'Never'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Never'
  }
}
</script>

<template>
  <Sheet
    :open="isOpen"
    @update:open="(val) => emit('update:isOpen', val)"
    :title="customer ? customer.name : 'Customer Details'"
    :side="side"
  >
    <div v-if="!customer" class="flex h-full items-center justify-center p-6">
      <p class="text-muted-foreground">No customer selected</p>
    </div>

    <div v-else class="space-y-10 p-10">
      <!-- Customer Information -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <User class="h-4 w-4" />
            </div>
            Customer Information
          </h3>
          <Badge variant="secondary">Since {{ customerSince }}</Badge>
        </div>
        <Card>
          <CardContent class="p-4">

            <div class="space-y-3">
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Customer</Label>
                <div class="font-semibold">{{ customer.name }}</div>
                <div v-if="customer.company" class="text-sm text-muted-foreground">
                  {{ customer.company }}
                </div>
              </div>

              <div class="space-y-1 text-sm">
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground">Email:</Label>
                  <a :href="`mailto:${customer.email}`" class="text-primary hover:underline">
                    {{ customer.email }}
                  </a>
                </div>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground">Phone:</Label>
                  <a :href="`tel:${customer.phone}`" class="text-primary hover:underline">
                    {{ customer.phone }}
                  </a>
                </div>
              </div>

              <div class="border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-1 block">Address</Label>
                <div class="text-sm">{{ customer.address }}</div>
              </div>

              <div v-if="customer.notes" class="border-t pt-3">
                <Label class="text-xs text-muted-foreground mb-1 block">Notes</Label>
                <div class="text-sm">{{ customer.notes }}</div>
              </div>

              <div class="border-t pt-3">
                <Button variant="ghost" size="sm" class="w-full" @click="emit('edit-customer')">
                  Edit Customer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Quick Stats -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <div class="p-2 bg-accent rounded-lg">
            <BarChart class="h-4 w-4" />
          </div>
          Statistics
        </h3>
        <Card>
          <CardContent class="p-4">
            <div class="grid grid-cols-4 gap-4">
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Total Orders</Label>
                <div class="font-medium">{{ stats?.totalOrders || 0 }}</div>
              </div>

              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Active</Label>
                <div class="font-medium">{{ stats?.activeOrders || 0 }}</div>
              </div>

              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Total Spent</Label>
                <div class="font-medium">
                  {{ formatCurrency(stats?.totalSpent || 0) }}
                </div>
              </div>

              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Last Order</Label>
                <div class="font-medium">
                  {{ formatLastOrder(stats?.lastOrderDate || null) }}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Order History -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <Package class="h-4 w-4" />
            </div>
            Order History ({{ customerOrders.length }})
          </h3>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label class="text-xs text-muted-foreground mb-1 block">Status</Label>
            <FilterSelect
              :model-value="statusFilter"
              @update:model-value="(val: any) => statusFilter = val as typeof statusFilter"
              :options="statusFilterOptions"
            />
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1 block">Payment</Label>
            <FilterSelect
              :model-value="paymentFilter"
              @update:model-value="(val: any) => paymentFilter = val as typeof paymentFilter"
              :options="paymentFilterOptions"
            />
          </div>
        </div>

        <div v-if="customerOrders.length === 0" class="text-sm text-muted-foreground text-center py-8">
          {{ statusFilter === 'all' && paymentFilter === 'all' ? 'No orders yet' : 'No orders match the selected filters' }}
        </div>

        <div v-else class="space-y-3">
          <Card
            v-for="order in customerOrders"
            :key="order.id"
            class="cursor-pointer"
            @click="emit('order-click', order.id)"
          >
            <CardContent class="p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-semibold">
                    #{{ order.external_id || order.id.slice(0, 8) }}
                  </div>
                  <div class="text-sm text-muted-foreground mt-1">
                    {{ order.items.length }} item(s) • {{ formatDeliveryMethod(order.deliveryMethodRollup) }} • {{ formatSource(order.source) }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1">
                    {{ formatDate(order.created_at) }}
                  </div>
                </div>

                <div class="flex flex-col items-end gap-2">
                  <Badge :variant="getStatusVariant(order.statusRollup as any)">
                    {{ formatStatusLabel(order.statusRollup) }}
                  </Badge>
                  <div class="font-medium">
                    {{ formatCurrency(order.amount_total || 0) }}
                  </div>
                  <Badge :variant="getPaymentVariant(order.payment_status)" size="sm">
                    {{ order.payment_status }}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </Sheet>
</template>
