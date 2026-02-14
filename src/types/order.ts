export type OrderSource = 'impression_quebec' | 'promo_flash' | 'propaganda' | 'sticker_pusher' | 'studio_c' | 'other'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial'
export type PaymentMethod = 'shopify' | 'cash' | 'cheque' | 'etransfer' | 'invoice' | 'other'

export interface Order {
  id: string
  customer_id: string
  source: OrderSource
  external_id: string | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  amount_total: number
  amount_paid: number
  internal_notes: string
  created_at: string
  updated_at: string
}
