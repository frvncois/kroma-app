export type ItemStatus =
  | 'new'
  | 'assigned'
  | 'in_production'
  | 'on_hold'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'picked_up'
  | 'canceled'

export interface StatusHistoryEntry {
  status: ItemStatus
  changed_at: string
  changed_by: string
  note?: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  description: string
  quantity: number
  specs: Record<string, any>
  assigned_printshop: string | null
  status: ItemStatus
  status_history: StatusHistoryEntry[]
  notes: string
  due_date: string | null
  production_start_date: string | null
  production_ready_date: string | null
  delivery_date: string | null
  created_at: string
  updated_at: string
}
