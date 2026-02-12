<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orders'
import { useCustomerStore } from '@/stores/customers'
import { useAuthStore } from '@/stores/auth'
import { formatStatus } from '@/lib/formatters'
import { getStatusVariant } from '@/lib/variants'
import Badge from '@/components/ui/Badge.vue'
import { Search, Package, User, Layers, Command } from 'lucide-vue-next'
import type { OrderWithDetails } from '@/stores/orders'
import type { OrderItem, Customer } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const authStore = useAuthStore()

// Dialog state
const isOpen = ref(false)
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInputRef = ref<HTMLInputElement>()

// Debounced search query
const debouncedQuery = ref('')
let debounceTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (newQuery) => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    debouncedQuery.value = newQuery
  }, 150)
})

// Search results
interface SearchResult {
  type: 'order' | 'customer' | 'item'
  id: string
  title: string
  subtitle: string
  badge?: { text: string; variant: any }
  data: OrderWithDetails | Customer | (OrderItem & { order?: OrderWithDetails })
}

const searchResults = computed<SearchResult[]>(() => {
  const query = debouncedQuery.value.toLowerCase().trim()
  const { isManager, isPrintshopManager, isDriver, userShops } = authStore

  if (!query) {
    // Show recent orders filtered by role
    let recentOrders = orderStore.ordersWithDetails

    // Driver: only ready orders for delivery
    if (isDriver) {
      recentOrders = recentOrders.filter(o =>
        o.delivery_method === 'delivery' &&
        o.items.every(i => ['ready', 'out_for_delivery', 'delivered'].includes(i.status))
      )
    }
    // Printshop Manager: only orders with items assigned to their shops
    else if (isPrintshopManager) {
      recentOrders = recentOrders.filter(o =>
        o.items.some(i => i.assigned_printshop && userShops.includes(i.assigned_printshop))
      )
    }

    const recent = recentOrders
      .slice(0, 5)
      .map((order): SearchResult => ({
        type: 'order',
        id: order.id,
        title: order.external_id || order.id,
        subtitle: order.customer.name,
        badge: {
          text: formatStatus(order.statusRollup),
          variant: getStatusVariant(order.statusRollup)
        },
        data: order
      }))
    return recent
  }

  const results: SearchResult[] = []

  // Search orders (for Manager, Printshop Manager, and Driver)
  if (isManager || isPrintshopManager || isDriver) {
    let orders = orderStore.ordersWithDetails

    // Driver: only ready orders for delivery
    if (isDriver) {
      orders = orders.filter(o =>
        o.delivery_method === 'delivery' &&
        o.items.every(i => ['ready', 'out_for_delivery', 'delivered'].includes(i.status))
      )
    }
    // Printshop Manager: only orders with items assigned to their shops
    else if (isPrintshopManager) {
      orders = orders.filter(o =>
        o.items.some(i => i.assigned_printshop && userShops.includes(i.assigned_printshop))
      )
    }

    const orderResults = orders
      .filter(order => {
        const matchesId = order.id.toLowerCase().includes(query)
        const matchesExternalId = order.external_id?.toLowerCase().includes(query)
        const matchesCustomer = order.customer.name.toLowerCase().includes(query)
        const matchesEmail = order.customer.email.toLowerCase().includes(query)
        const matchesCompany = order.customer.company?.toLowerCase().includes(query)
        return matchesId || matchesExternalId || matchesCustomer || matchesEmail || matchesCompany
      })
      .slice(0, 5)
      .map((order): SearchResult => ({
        type: 'order',
        id: order.id,
        title: order.external_id || order.id,
        subtitle: order.customer.name,
        badge: {
          text: formatStatus(order.statusRollup),
          variant: getStatusVariant(order.statusRollup)
        },
        data: order
      }))

    results.push(...orderResults)
  }

  // Search customers (Manager only)
  if (isManager) {
    const customerResults = customerStore.allCustomers
      .filter(customer => {
        const matchesName = customer.name.toLowerCase().includes(query)
        const matchesEmail = customer.email.toLowerCase().includes(query)
        const matchesCompany = customer.company?.toLowerCase().includes(query)
        const matchesPhone = customer.phone?.toLowerCase().includes(query)
        return matchesName || matchesEmail || matchesCompany || matchesPhone
      })
      .slice(0, 5)
      .map((customer): SearchResult => ({
        type: 'customer',
        id: customer.id,
        title: customer.name,
        subtitle: customer.company ? `${customer.company} • ${customer.email}` : customer.email,
        data: customer
      }))

    results.push(...customerResults)
  }

  // Search items (filtered by role)
  let items = orderStore.orderItems

  // Printshop Manager: only items assigned to their shops
  if (isPrintshopManager) {
    items = items.filter(item =>
      item.assigned_printshop && userShops.includes(item.assigned_printshop)
    )
  }
  // Driver: only items ready for delivery
  else if (isDriver) {
    items = items.filter(item =>
      ['ready', 'out_for_delivery', 'delivered'].includes(item.status)
    )
  }

  const itemResults = items
    .filter(item => {
      const matchesProduct = item.product_name.toLowerCase().includes(query)
      const matchesDescription = item.description?.toLowerCase().includes(query)
      return matchesProduct || matchesDescription
    })
    .slice(0, 5)
    .map((item): SearchResult => {
      const order = orderStore.ordersWithDetails.find(o => o.id === item.order_id)
      return {
        type: 'item',
        id: item.id,
        title: item.product_name,
        subtitle: order?.external_id || item.order_id,
        badge: {
          text: formatStatus(item.status),
          variant: getStatusVariant(item.status)
        },
        data: { ...item, order }
      }
    })

  results.push(...itemResults)

  // Limit total results
  return results.slice(0, 15)
})

// Grouped results
const groupedResults = computed(() => {
  const groups = {
    orders: [] as SearchResult[],
    customers: [] as SearchResult[],
    items: [] as SearchResult[]
  }

  searchResults.value.forEach(result => {
    if (result.type === 'order') groups.orders.push(result)
    else if (result.type === 'customer') groups.customers.push(result)
    else if (result.type === 'item') groups.items.push(result)
  })

  return groups
})

const flatResults = computed(() => searchResults.value)

// Open/close dialog
const openDialog = () => {
  isOpen.value = true
  selectedIndex.value = 0
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

const closeDialog = () => {
  isOpen.value = false
  searchQuery.value = ''
  debouncedQuery.value = ''
  selectedIndex.value = 0
}

// Keyboard navigation
const handleKeyDown = (e: KeyboardEvent) => {
  if (!isOpen.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, flatResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const result = flatResults.value[selectedIndex.value]
    if (result) {
      selectResult(result)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeDialog()
  }
}

// Select result
const selectResult = (result: SearchResult) => {
  const { isManager, isPrintshopManager, isDriver } = authStore

  if (result.type === 'order') {
    const order = result.data as OrderWithDetails
    // Route to appropriate view based on role
    if (isManager) {
      router.push({ path: '/manager/orders', query: { openOrder: order.id } })
    } else if (isPrintshopManager) {
      router.push({ path: '/printshop/queue', query: { openOrder: order.id } })
    } else if (isDriver) {
      router.push({ path: '/driver/deliveries', query: { openOrder: order.id } })
    }
  } else if (result.type === 'customer') {
    // Only managers can access customers page
    if (isManager) {
      router.push('/manager/customers')
    }
  } else if (result.type === 'item') {
    const item = result.data as OrderItem & { order?: OrderWithDetails }
    if (item.order) {
      // Route to appropriate view based on role
      if (isManager) {
        router.push({ path: '/manager/orders', query: { openOrder: item.order.id } })
      } else if (isPrintshopManager) {
        router.push({ path: '/printshop/queue', query: { openOrder: item.order.id } })
      } else if (isDriver) {
        router.push({ path: '/driver/deliveries', query: { openOrder: item.order.id } })
      }
    }
  }
  closeDialog()
}

// Global keyboard shortcut
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    openDialog()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeyDown)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown)
  document.removeEventListener('keydown', handleKeyDown)
  if (debounceTimeout) clearTimeout(debounceTimeout)
})

// Check if on Mac
const isMac = computed(() => {
  if (typeof window === 'undefined') return false
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
})
</script>

<template>
  <!-- Trigger Button -->
  <button
    @click="openDialog"
    class="hidden md:flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors w-80"
  >
    <Search class="h-4 w-4" />
    <span class="flex-1 text-left">Search...</span>
    <kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      <Command v-if="isMac" class="h-3 w-3" />
      <span v-else>Ctrl</span>
      <span>K</span>
    </kbd>
  </button>

  <!-- Command Dialog -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
        @click="closeDialog"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            class="w-full max-w-lg rounded-2xl border bg-popover shadow-lg"
            @click.stop
          >
            <!-- Search Input -->
            <div class="flex items-center border-b px-3">
              <Search class="h-4 w-4 text-muted-foreground mr-2" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Search orders, customers, items..."
                class="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <!-- Results -->
            <div class="max-h-[400px] overflow-y-auto p-2">
              <!-- Empty State: No Query -->
              <div v-if="!debouncedQuery && flatResults.length > 0" class="mb-2">
                <div class="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                  Recent Orders
                </div>
              </div>

              <!-- Empty State: No Results -->
              <div
                v-if="debouncedQuery && flatResults.length === 0"
                class="py-8 text-center text-sm text-muted-foreground"
              >
                No results found for "{{ debouncedQuery }}"
              </div>

              <!-- Orders Group -->
              <div v-if="groupedResults.orders.length > 0">
                <div class="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                  Orders
                </div>
                <div
                  v-for="(result, index) in groupedResults.orders"
                  :key="result.id"
                  @click="selectResult(result)"
                  :class="[
                    'flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors',
                    flatResults.indexOf(result) === selectedIndex
                      ? 'bg-accent ring-1 ring-accent'
                      : 'hover:bg-accent/50'
                  ]"
                >
                  <Package class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ result.title }}</div>
                    <div class="text-xs text-muted-foreground truncate">{{ result.subtitle }}</div>
                  </div>
                  <Badge v-if="result.badge" :variant="result.badge.variant" class="text-xs">
                    {{ result.badge.text }}
                  </Badge>
                </div>
              </div>

              <!-- Customers Group -->
              <div v-if="groupedResults.customers.length > 0" class="mt-2">
                <div class="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                  Customers
                </div>
                <div
                  v-for="result in groupedResults.customers"
                  :key="result.id"
                  @click="selectResult(result)"
                  :class="[
                    'flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors',
                    flatResults.indexOf(result) === selectedIndex
                      ? 'bg-accent ring-1 ring-accent'
                      : 'hover:bg-accent/50'
                  ]"
                >
                  <User class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ result.title }}</div>
                    <div class="text-xs text-muted-foreground truncate">{{ result.subtitle }}</div>
                  </div>
                </div>
              </div>

              <!-- Items Group -->
              <div v-if="groupedResults.items.length > 0" class="mt-2">
                <div class="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                  Items
                </div>
                <div
                  v-for="result in groupedResults.items"
                  :key="result.id"
                  @click="selectResult(result)"
                  :class="[
                    'flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors',
                    flatResults.indexOf(result) === selectedIndex
                      ? 'bg-accent ring-1 ring-accent'
                      : 'hover:bg-accent/50'
                  ]"
                >
                  <Layers class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ result.title }}</div>
                    <div class="text-xs text-muted-foreground truncate">Order: {{ result.subtitle }}</div>
                  </div>
                  <Badge v-if="result.badge" :variant="result.badge.variant" class="text-xs">
                    {{ result.badge.text }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
