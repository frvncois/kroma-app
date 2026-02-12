export interface Activity {
  id: string
  type: 'status_change' | 'note_added' | 'delivery' | 'pickup' | 'assignment' | 'order_created' | 'alert'
  timestamp: string
  user: string
  seen: boolean
  important: boolean
  item?: {
    id: string
    name: string
    orderId: string
  }
  order?: {
    id: string
    externalId?: string
    customer: string
  }
  details: {
    message: string
    from?: string
    to?: string
    note?: string
  }
  // Alert-specific fields
  alert?: {
    rule: string // Rule identifier (e.g. 'unassigned_stale', 'overdue', 'stuck_production', 'delivery_issue', 'user_mentioned')
    level: 'warning' | 'critical' // warning = amber, critical = red
    daysSince?: number // How many days the condition has been true (for time-based alerts)
  }
}
