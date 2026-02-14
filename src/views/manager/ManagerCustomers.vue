<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useCustomers } from '@/composables/useCustomers'
import { useOrderStore } from '@/stores/orders'
import { useActivityStore } from '@/stores/activities'
import { useToast } from '@/composables/useToast'
import { formatDate, formatCurrency } from '@/lib/formatters'
import DataTable from '@/components/DataTable.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import CustomerDetailSheet from '@/components/CustomerDetailSheet.vue'
import OrderDetailSheet from '@/components/OrderDetailSheet.vue'
import NewCustomerSheet from '@/components/NewCustomerSheet.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import { Search, Eye } from 'lucide-vue-next'
import type { ColumnDef } from '@tanstack/vue-table'
import type { Customer } from '@/types'

const { getCustomers } = useCustomers()
const orderStore = useOrderStore()
const activityStore = useActivityStore()
const { toast } = useToast()

// Activities (role-scoped)
const activities = computed(() => activityStore.getActivitiesForRole())

// Search
const searchQuery = ref('')

// Filter customers
const filteredCustomers = computed(() => {
  const customers = getCustomers()
  if (!searchQuery.value.trim()) return customers

  const query = searchQuery.value.toLowerCase()
  return customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      (customer.company && customer.company.toLowerCase().includes(query)) ||
      customer.phone.toLowerCase().includes(query)
  )
})

// Stats
const totalCustomers = computed(() => getCustomers().length)

const customersWithActiveOrders = computed(() => {
  const terminalStatuses = ['delivered', 'picked_up', 'canceled']
  return getCustomers().filter((customer) => {
    const customerOrders = orderStore.ordersWithDetails.filter(
      (order) => order.customer_id === customer.id
    )
    return customerOrders.some((order) => !terminalStatuses.includes(order.statusRollup as string))
  }).length
})

const newThisMonth = computed(() => {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return getCustomers().filter((customer) => {
    const createdAt = new Date(customer.created_at)
    return createdAt >= firstDayOfMonth
  }).length
})

// Sheet orchestration
const selectedCustomerId = ref<string | null>(null)
const isCustomerSheetOpen = ref(false)

const selectedOrderId = ref<string | null>(null)
const isOrderSheetOpen = ref(false)

const isNewCustomerSheetOpen = ref(false)

const openCustomerDetail = (customerId: string) => {
  selectedCustomerId.value = customerId
  isCustomerSheetOpen.value = true
  // Close order sheet if open
  isOrderSheetOpen.value = false
  selectedOrderId.value = null
}

const handleOrderClick = (orderId: string) => {
  selectedOrderId.value = orderId
  isOrderSheetOpen.value = true
  // Customer sheet stays open on the right
}

const handleCustomerSheetClose = (isOpen: boolean) => {
  isCustomerSheetOpen.value = isOpen
  if (!isOpen) {
    // Also close order sheet when customer sheet closes
    isOrderSheetOpen.value = false
    selectedOrderId.value = null
  }
}

const handleEditCustomer = () => {
  toast({
    title: 'Edit feature coming soon',
    description: 'Customer editing will be available in a future update',
  })
}

const handleCustomerCreated = (customerId: string) => {
  openCustomerDetail(customerId)
}

// Table columns
const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }: any) => {
      const customer = row.original
      return h('div', {}, [
        h('div', { class: 'font-medium' }, customer.name),
        customer.company
          ? h('div', { class: 'text-xs text-muted-foreground' }, customer.company)
          : null,
      ])
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }: any) => {
      return h('span', { class: 'text-sm' }, row.original.email)
    },
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }: any) => {
      return h('span', { class: 'text-sm' }, row.original.phone)
    },
  },
  {
    id: 'orders',
    header: 'Orders',
    cell: ({ row }: any) => {
      const customerOrders = orderStore.ordersWithDetails.filter(
        (order) => order.customer_id === row.original.id
      )
      return h('span', { class: 'text-sm' }, String(customerOrders.length))
    },
  },
  {
    id: 'totalSpent',
    header: 'Total Spent',
    cell: ({ row }: any) => {
      const customerOrders = orderStore.ordersWithDetails.filter(
        (order) => order.customer_id === row.original.id
      )
      const totalSpent = customerOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0)
      return h('span', { class: 'text-sm' }, formatCurrency(totalSpent))
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Customer Since',
    cell: ({ row }: any) => {
      return h('span', { class: 'text-sm' }, formatDate(row.original.created_at))
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }: any) => {
      return h(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick: (e: Event) => {
            e.stopPropagation()
            openCustomerDetail(row.original.id)
          },
        },
        () => [
          h(Eye, { class: 'h-4 w-4 mr-2' }),
          'View client'
        ]
      )
    },
  },
]

// Sort customers alphabetically by name
const sortedCustomers = computed(() => {
  return [...filteredCustomers.value].sort((a, b) => a.name.localeCompare(b.name))
})

// Activity handlers
const handleActivityClick = (activityId: string) => {
  const activity = activities.value.find((a) => a.id === activityId)
  if (activity?.order_id) {
    selectedOrderId.value = activity.order_id
    isOrderSheetOpen.value = true
  }
}

const handleToggleSeen = (activityId: string) => {
  activityStore.toggleSeen(activityId)
}

const handleToggleImportant = (activityId: string) => {
  activityStore.toggleImportant(activityId)
}
</script>

<template>
  <div class="h-full mr-80 w-full">
    <!-- Main Content -->
    <div class="flex h-full flex-col space-y-10 p-10 pt-24">
      <!-- Header -->
      <div class="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 class="text-3xl font-medium">Customers</h1>
          <p class="text-sm text-muted-foreground">
            Manage customers and view order history
          </p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-sm text-muted-foreground">
            {{ filteredCustomers.length }} customer{{ filteredCustomers.length !== 1 ? 's' : '' }}
          </div>
          <Button @click="isNewCustomerSheetOpen = true">
            + New Customer
          </Button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="flex gap-6 flex-shrink-0">
        <div>
          <div class="text-2xl font-semibold">{{ totalCustomers }}</div>
          <div class="text-xs text-muted-foreground">Total customers</div>
        </div>
        <div>
          <div class="text-2xl font-semibold">{{ customersWithActiveOrders }}</div>
          <div class="text-xs text-muted-foreground">Customers with active orders</div>
        </div>
        <div>
          <div class="text-2xl font-semibold">{{ newThisMonth }}</div>
          <div class="text-xs text-muted-foreground">New this month</div>
        </div>
      </div>

      <!-- Search -->
      <div class="relative flex-shrink-0 max-w-md">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Search customers by name, email, company, or phone..."
          class="pl-9"
        />
      </div>

      <!-- Table -->
      <div class="flex-1 min-h-0 overflow-auto">
        <DataTable
          :columns="columns"
          :data="sortedCustomers"
          @row-click="(customer: Customer) => openCustomerDetail(customer.id)"
        />
      </div>
    </div>
    <!-- End Main Content -->

    <!-- Right Sidebar: Activity Feed -->
    <div class="fixed right-0 top-16 bottom-0 w-80 border-l bg-background overflow-y-auto">
      <ActivityFeed
        :activities="activities"
        @activity-click="handleActivityClick"
        @toggle-seen="handleToggleSeen"
        @toggle-important="handleToggleImportant"
      />
    </div>

    <!-- Customer Detail Sheet (RIGHT side) -->
    <CustomerDetailSheet
      :customer-id="selectedCustomerId"
      :is-open="isCustomerSheetOpen"
      side="right"
      @update:is-open="handleCustomerSheetClose"
      @order-click="handleOrderClick"
      @edit-customer="handleEditCustomer"
    />

    <!-- Order Detail Sheet (LEFT side, higher z-index) -->
    <OrderDetailSheet
      :order-id="selectedOrderId"
      :is-open="isOrderSheetOpen"
      :show-payment="true"
      side="left"
      :z-index="70"
      @update:is-open="isOrderSheetOpen = $event"
    />

    <!-- New Customer Sheet (RIGHT side) -->
    <NewCustomerSheet
      :is-open="isNewCustomerSheetOpen"
      @update:is-open="isNewCustomerSheetOpen = $event"
      @customer-created="handleCustomerCreated"
    />
  </div>
</template>
