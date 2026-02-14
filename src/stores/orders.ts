import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, OrderItem, ItemStatus, StatusHistoryEntry, Customer, OrderSource, PaymentStatus, PaymentMethod, Activity } from '@/types'
import { supabase } from '@/lib/supabase'
import { useCustomerStore } from './customers'
import { useActivityStore } from './activities'
import { usePrintshopStore } from './printshops'
import { useAuthStore } from './auth'
import { useNoteStore } from './notes'

export interface OrderWithDetails extends Order {
  customer: Customer
  items: OrderItem[]
  itemsCount: number
  statusRollup: ItemStatus | 'mixed'
  deliveryMethodRollup: 'delivery' | 'customer_pickup' | 'mixed'
}

// Helper to compute order status rollup based on items
function computeOrderStatus(items: OrderItem[]): ItemStatus | 'mixed' {
  if (items.length === 0) return 'new'

  const nonCanceledItems = items.filter((item) => item.status !== 'canceled')
  if (nonCanceledItems.length === 0) return 'canceled'

  const statuses = nonCanceledItems.map((item) => item.status)
  const uniqueStatuses = [...new Set(statuses)]

  // All items have the same status
  if (uniqueStatuses.length === 1 && uniqueStatuses[0]) {
    return uniqueStatuses[0]
  }

  // Check for specific rollup rules
  if (statuses.some((s) => s === 'new')) return 'new'
  if (statuses.some((s) => s === 'assigned' || s === 'in_production' || s === 'on_hold'))
    return 'in_production'
  if (statuses.every((s) => s === 'ready')) return 'ready'
  if (
    statuses.every((s) => s === 'delivered' || s === 'picked_up' || s === 'out_for_delivery')
  ) {
    if (statuses.every((s) => s === 'delivered')) return 'delivered'
    if (statuses.every((s) => s === 'picked_up')) return 'picked_up'
    if (statuses.some((s) => s === 'out_for_delivery')) return 'out_for_delivery'
  }

  return 'mixed'
}

export const useOrderStore = defineStore('orders', () => {
  // State
  const orders = ref<Order[]>([])
  const orderItems = ref<OrderItem[]>([])
  const isLoading = ref(true)
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

  // Getters
  const ordersWithDetails = computed<OrderWithDetails[]>(() => {
    const customerStore = useCustomerStore()

    return orders.value.map((order) => {
      const customer = customerStore.getCustomerById(order.customer_id)!
      const items = orderItems.value.filter((item) => item.order_id === order.id)
      const statusRollup = computeOrderStatus(items)

      // Compute delivery method rollup from items
      const deliveryMethods = items.map(item => item.delivery_method)
      const uniqueMethods = [...new Set(deliveryMethods)]
      const deliveryMethodRollup = uniqueMethods.length === 1 ? uniqueMethods[0]! : 'mixed'

      return {
        ...order,
        customer,
        items,
        itemsCount: items.length,
        statusRollup,
        deliveryMethodRollup,
      }
    })
  })

  function getOrderById(id: string): OrderWithDetails | undefined {
    return ordersWithDetails.value.find((order) => order.id === id)
  }

  async function filesCount(orderId: string): Promise<number> {
    const items = orderItems.value.filter((item) => item.order_id === orderId)
    const itemIds = items.map((item) => item.id)

    if (itemIds.length === 0) return 0

    // Count only production files (artwork, proof, reference) - not delivery/issue photos
    const { count, error } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'order_item')
      .in('entity_id', itemIds)
      .in('file_type', ['artwork', 'proof', 'reference'])

    if (error) {
      console.error('Error counting files:', error)
      return 0
    }

    return count || 0
  }

  function commentsCount(orderId: string): number {
    const noteStore = useNoteStore()
    // Access the reactive notes map - will be 0 if notes haven't been loaded yet
    const notes = noteStore.getNotesForEntity('order', orderId)
    return notes.length
  }

  // Get all items with order and customer details enriched
  function getAllItems() {
    const customerStore = useCustomerStore()

    return orderItems.value.map((item) => {
      const order = orders.value.find((o) => o.id === item.order_id)!
      const customer = customerStore.getCustomerById(order.customer_id)!

      return {
        ...item,
        order,
        customer,
      }
    })
  }

  // Helper to create activity entries (database will generate id and timestamp)
  function createActivity(
    type: Activity['type'],
    message: string,
    item?: OrderItem,
    orderId?: string,
    extra?: Record<string, any>
  ): Omit<Activity, 'id' | 'timestamp'> {
    const authStore = useAuthStore()
    const customerStore = useCustomerStore()

    // Find the order for context
    const order = orderId ? orders.value.find(o => o.id === orderId) :
      item ? orders.value.find(o => o.id === item.order_id) : undefined

    // Determine entity type and ID
    const entity_type = item ? 'order_item' : (order ? 'order' : 'order')
    const entity_id = item ? item.id : (order?.id || '')

    return {
      type,
      user_id: authStore.currentUser?.id || 'system',
      user: authStore.currentUser?.name || 'System',
      entity_type,
      entity_id,
      order_id: order?.id || null,
      printshop_id: item?.assigned_printshop || null,
      details: {
        message,
        ...extra,
      },
    }
  }

  // Fetch Actions
  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      if (data) {
        orders.value = data as Order[]
        console.log('Orders loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    }
  }

  async function fetchOrderItems() {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching order items:', error)
        return
      }

      if (data) {
        // Items come back without status_history (lazy-loaded)
        orderItems.value = data as OrderItem[]
        console.log('Order items loaded:', data.length)
      }
    } catch (error) {
      console.error('Failed to fetch order items:', error)
    }
  }

  // Realtime Subscriptions
  function setupRealtimeSubscriptions() {
    realtimeChannel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          orders.value.unshift(payload.new as Order)
        } else if (payload.eventType === 'UPDATE') {
          const idx = orders.value.findIndex(o => o.id === payload.new.id)
          if (idx !== -1) orders.value[idx] = payload.new as Order
        } else if (payload.eventType === 'DELETE') {
          orders.value = orders.value.filter(o => o.id !== payload.old.id)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          orderItems.value.push(payload.new as OrderItem)
        } else if (payload.eventType === 'UPDATE') {
          const idx = orderItems.value.findIndex(i => i.id === payload.new.id)
          if (idx !== -1) orderItems.value[idx] = payload.new as OrderItem
        } else if (payload.eventType === 'DELETE') {
          orderItems.value = orderItems.value.filter(i => i.id !== payload.old.id)
        }
      })
      .subscribe()
  }

  function cleanup() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // Init Action
  async function init() {
    isLoading.value = true
    await Promise.all([fetchOrders(), fetchOrderItems()])
    isLoading.value = false
    setupRealtimeSubscriptions()
  }

  // Mutation Actions
  async function updateItemStatus(itemId: string, newStatus: ItemStatus) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (!item) return

    const oldStatus = item.status
    const now = new Date().toISOString()

    try {
      // Build update payload with auto-set dates
      const payload: any = {
        status: newStatus,
        updated_at: now,
      }

      if (newStatus === 'in_production' && oldStatus !== 'in_production') {
        payload.production_start_date = now
      }
      if (newStatus === 'ready' && oldStatus !== 'ready') {
        payload.production_ready_date = now
      }
      if ((newStatus === 'delivered' || newStatus === 'picked_up') && oldStatus !== 'delivered' && oldStatus !== 'picked_up') {
        payload.delivery_date = now
      }

      // Update in Supabase
      const { data, error } = await supabase
        .from('order_items')
        .update(payload)
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Error updating item status:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orderItems.value.findIndex((i) => i.id === itemId)
        if (idx !== -1) {
          orderItems.value[idx] = data as OrderItem
        }
      }

      console.log(`Updated item ${itemId} status from ${oldStatus} to ${newStatus}`)

      // Write to status_history table
      const authStore = useAuthStore()
      await supabase.from('status_history').insert({
        order_item_id: itemId,
        from_status: oldStatus,
        to_status: newStatus,
        changed_by: authStore.currentUser?.id || 'system',
        note: null, // Optional note field
      })

      // Create activity entry (in local store for now)
      const activityStore = useActivityStore()
      let activityType: Activity['type'] = 'status_change'
      if (newStatus === 'delivered') activityType = 'delivery'
      if (newStatus === 'picked_up') activityType = 'pickup'
      if (newStatus === 'out_for_delivery') activityType = 'delivery'

      const formatStatusLabel = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const message = activityType === 'status_change'
        ? 'Status updated'
        : activityType === 'delivery' && newStatus === 'out_for_delivery'
          ? 'Out for delivery'
          : activityType === 'delivery'
            ? 'Successfully delivered'
            : 'Item marked as picked up'

      activityStore.addActivity(
        createActivity(activityType, message, data as OrderItem, undefined, {
          from: formatStatusLabel(oldStatus),
          to: formatStatusLabel(newStatus),
        })
      )
    } catch (error) {
      console.error('Failed to update item status:', error)
    }
  }

  function updateOrderItemsStatus(orderId: string, newStatus: ItemStatus) {
    const items = orderItems.value.filter((item) => item.order_id === orderId)
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated all items in order ${orderId} to status ${newStatus}`)
  }

  function updatePrintshopItemsStatus(
    printshopId: string,
    orderIds: string[],
    newStatus: ItemStatus
  ) {
    const items = orderItems.value.filter(
      (item) => item.assigned_printshop === printshopId && orderIds.includes(item.order_id)
    )
    items.forEach((item) => {
      updateItemStatus(item.id, newStatus)
    })
    console.log(`Updated ${items.length} items from printshop ${printshopId} to status ${newStatus}`)
  }

  async function updateOrderSource(orderId: string, newSource: OrderSource) {
    const order = orders.value.find((o) => o.id === orderId)
    if (!order) return

    const oldSource = order.source
    const now = new Date().toISOString()

    try {
      // Update in Supabase
      const { data, error } = await supabase
        .from('orders')
        .update({
          source: newSource,
          updated_at: now,
        })
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating order source:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orders.value.findIndex((o) => o.id === orderId)
        if (idx !== -1) {
          orders.value[idx] = data as Order
        }
      }

      console.log(`Updated order ${orderId} source from ${oldSource} to ${newSource}`)

      // Create activity entry
      const activityStore = useActivityStore()
      const formatSource = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

      activityStore.addActivity(
        createActivity('status_change', `Order source updated to ${formatSource(newSource)}`, undefined, orderId, {
          from: formatSource(oldSource),
          to: formatSource(newSource),
        })
      )
    } catch (error) {
      console.error('Failed to update order source:', error)
    }
  }

  async function updateOrderPaymentStatus(orderId: string, newPaymentStatus: PaymentStatus) {
    const order = orders.value.find((o) => o.id === orderId)
    if (!order) return

    const oldPaymentStatus = order.payment_status
    const now = new Date().toISOString()

    try {
      // Update in Supabase
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: newPaymentStatus,
          updated_at: now,
        })
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating order payment status:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orders.value.findIndex((o) => o.id === orderId)
        if (idx !== -1) {
          orders.value[idx] = data as Order
        }
      }

      console.log(`Updated order ${orderId} payment_status from ${oldPaymentStatus} to ${newPaymentStatus}`)

      // Create activity entry
      const activityStore = useActivityStore()
      const formatLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

      activityStore.addActivity(
        createActivity('status_change', `Payment updated to ${formatLabel(newPaymentStatus)}`, undefined, orderId, {
          from: formatLabel(oldPaymentStatus),
          to: formatLabel(newPaymentStatus),
        })
      )
    } catch (error) {
      console.error('Failed to update order payment status:', error)
    }
  }

  async function updateItemPrintshop(itemId: string, newPrintshopId: string | null) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (!item) return

    const oldPrintshop = item.assigned_printshop
    const now = new Date().toISOString()

    try {
      // Build update payload
      const payload: any = {
        assigned_printshop: newPrintshopId,
        updated_at: now,
      }

      // Auto-set status to 'assigned' when a printshop is assigned
      if (newPrintshopId && item.status === 'new') {
        payload.status = 'assigned'
      }
      // Reset to 'new' when unassigning printshop
      if (!newPrintshopId && item.status === 'assigned') {
        payload.status = 'new'
      }

      // Update in Supabase
      const { data, error } = await supabase
        .from('order_items')
        .update(payload)
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Error updating item printshop:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orderItems.value.findIndex((i) => i.id === itemId)
        if (idx !== -1) {
          orderItems.value[idx] = data as OrderItem
        }
      }

      console.log(`Updated item ${itemId} printshop from ${oldPrintshop || 'unassigned'} to ${newPrintshopId || 'unassigned'}`)

      // Create activity entry for printshop assignment
      if (newPrintshopId) {
        const activityStore = useActivityStore()
        const printshopStore = usePrintshopStore()
        const shopName = printshopStore.getPrintshopName(newPrintshopId)

        activityStore.addActivity(
          createActivity('assignment', `Assigned to ${shopName}`, data as OrderItem)
        )
      }
    } catch (error) {
      console.error('Failed to update item printshop:', error)
    }
  }

  async function updateItemDueDate(itemId: string, newDueDate: string | null) {
    const item = orderItems.value.find((i) => i.id === itemId)
    if (!item) return

    const now = new Date().toISOString()

    try {
      // Update in Supabase
      const { data, error } = await supabase
        .from('order_items')
        .update({
          due_date: newDueDate,
          updated_at: now,
        })
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Error updating item due date:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orderItems.value.findIndex((i) => i.id === itemId)
        if (idx !== -1) {
          orderItems.value[idx] = data as OrderItem
        }
      }

      console.log(`Updated item ${itemId} due_date to ${newDueDate}`)

      // Create activity entry
      const activityStore = useActivityStore()
      const formatDate = (date: string | null) => {
        if (!date) return 'cleared'
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }

      activityStore.addActivity(
        createActivity('status_change', `Due date ${newDueDate ? 'set to ' + formatDate(newDueDate) : 'cleared'}`, data as OrderItem)
      )
    } catch (error) {
      console.error('Failed to update item due date:', error)
    }
  }

  async function updateOrderPaymentMethod(orderId: string, newMethod: PaymentMethod) {
    const order = orders.value.find((o) => o.id === orderId)
    if (!order) return

    const now = new Date().toISOString()

    try {
      // Update in Supabase
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_method: newMethod,
          updated_at: now,
        })
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating order payment method:', error)
        return
      }

      // Update local state
      if (data) {
        const idx = orders.value.findIndex((o) => o.id === orderId)
        if (idx !== -1) {
          orders.value[idx] = data as Order
        }
      }

      console.log(`Updated order ${orderId} payment_method to ${newMethod}`)

      // Create activity entry
      const activityStore = useActivityStore()
      activityStore.addActivity(
        createActivity('status_change', `Payment method changed to ${newMethod}`, undefined, orderId)
      )
    } catch (error) {
      console.error('Failed to update order payment method:', error)
    }
  }

  function getOrdersByCustomerId(customerId: string): OrderWithDetails[] {
    return ordersWithDetails.value
      .filter((order) => order.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  /**
   * Fetch status history for a specific order item (lazy-loaded)
   * This is NOT cached - it's fetched on demand when detail sheet opens
   */
  async function fetchItemStatusHistory(itemId: string): Promise<StatusHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('status_history')
        .select('*, users:changed_by(name)')
        .eq('order_item_id', itemId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching status history:', error)
        return []
      }

      if (!data) return []

      // Map database structure to StatusHistoryEntry format
      const history: StatusHistoryEntry[] = data.map((entry: any) => ({
        status: entry.to_status as ItemStatus,
        changed_at: entry.created_at,
        changed_by: entry.users?.name || 'Unknown User',
        note: entry.note || undefined,
      }))

      console.log(`Status history loaded for item ${itemId}:`, history.length, 'entries')
      return history
    } catch (error) {
      console.error('Failed to fetch status history:', error)
      return []
    }
  }

  async function createOrder(orderData: {
    customer_id: string
    source: OrderSource
    payment_status?: PaymentStatus
    payment_method?: PaymentMethod
    amount_total?: number
    internal_notes?: string
  }, itemsData: Array<{
    product_name: string
    description?: string
    quantity: number
    unit_price: number
    specs?: Record<string, any>
    assigned_printshop?: string
    delivery_method?: 'delivery' | 'customer_pickup'
    due_date?: string
    notes?: string
  }>): Promise<Order | null> {
    const authStore = useAuthStore()
    const activitiesStore = useActivityStore()

    try {
      // 1. Insert order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: orderData.customer_id,
          source: orderData.source,
          payment_status: orderData.payment_status || 'unpaid',
          payment_method: orderData.payment_method || null,
          amount_total: orderData.amount_total || 0,
          amount_paid: 0,
          internal_notes: orderData.internal_notes || '',
        })
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        return null
      }

      // 2. Insert order items
      const itemsToInsert = itemsData.map(item => ({
        order_id: newOrder.id,
        product_name: item.product_name,
        description: item.description || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        specs: item.specs || {},
        status: 'new' as const,
        assigned_printshop: item.assigned_printshop || null,
        delivery_method: item.delivery_method || 'delivery',
        due_date: item.due_date || null,
        notes: item.notes || '',
      }))

      const { data: newItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        // Try to rollback the order
        await supabase.from('orders').delete().eq('id', newOrder.id)
        return null
      }

      // 3. Local state will be updated automatically by realtime subscriptions
      // No need to manually add to orders/orderItems arrays

      // 4. Create activity
      await activitiesStore.addActivity({
        type: 'order_created',
        user_id: authStore.currentUser?.id || 'system',
        user: authStore.currentUser?.name || 'System',
        entity_type: 'order',
        entity_id: newOrder.id,
        order_id: newOrder.id,
        printshop_id: null,
        details: {
          message: `Order ${newOrder.id} created`,
          itemsCount: itemsData.length,
        },
      })

      return newOrder
    } catch (error) {
      console.error('Error in createOrder:', error)
      return null
    }
  }

  return {
    // State
    orders,
    orderItems,
    isLoading,
    // Getters
    ordersWithDetails,
    getOrderById,
    getOrdersByCustomerId,
    getAllItems,
    filesCount,
    commentsCount,
    // Actions
    fetchOrders,
    fetchOrderItems,
    init,
    cleanup,
    createOrder,
    updateItemStatus,
    updateOrderItemsStatus,
    updatePrintshopItemsStatus,
    updateOrderSource,
    updateOrderPaymentStatus,
    updateOrderPaymentMethod,
    updateItemPrintshop,
    updateItemDueDate,
    fetchItemStatusHistory,
  }
})
