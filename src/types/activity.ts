export interface Activity {
  id: string
  type: 'status_change' | 'note_added' | 'delivery' | 'pickup' | 'assignment' | 'order_created'
  timestamp: string
  user: string
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
}
