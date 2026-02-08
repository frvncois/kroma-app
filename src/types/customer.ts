export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company: string | null
  address: string
  lat: number
  lng: number
  notes: string
  created_at: string
  updated_at: string
}
