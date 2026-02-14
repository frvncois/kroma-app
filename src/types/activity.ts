export type ActivityEntityType = 'order' | 'order_item' | 'driver_task'

export interface Activity {
  id: string
  type: 'status_change' | 'note_added' | 'delivery' | 'pickup' | 'assignment' | 'order_created' | 'alert'
  user_id: string
  user: string
  entity_type: ActivityEntityType
  entity_id: string
  order_id: string | null
  printshop_id: string | null
  timestamp: string
  details: Record<string, any>
}
