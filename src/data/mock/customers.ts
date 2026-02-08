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

export const customers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '416-555-0101',
    company: 'Tech Innovations Inc',
    address: '789 Bay St, Toronto, ON M5G 2N8',
    lat: 43.6532,
    lng: -79.3832,
    notes: 'Prefers morning deliveries',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'cust-2',
    name: 'Michael Chen',
    email: 'michael.chen@email.com',
    phone: '416-555-0102',
    company: null,
    address: '321 King St E, Toronto, ON M5A 1L1',
    lat: 43.6514,
    lng: -79.3598,
    notes: '',
    created_at: '2024-01-16T11:30:00Z',
    updated_at: '2024-01-16T11:30:00Z',
  },
  {
    id: 'cust-3',
    name: 'Emily Rodriguez',
    email: 'emily.r@startup.co',
    phone: '647-555-0103',
    company: 'Startup Co',
    address: '555 Richmond St W, Toronto, ON M5V 3B1',
    lat: 43.6476,
    lng: -79.3994,
    notes: 'Large order customer - priority service',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-20T14:00:00Z',
  },
  {
    id: 'cust-4',
    name: 'David Kim',
    email: 'dkim@designstudio.com',
    phone: '416-555-0104',
    company: 'Design Studio',
    address: '888 Dundas St W, Toronto, ON M6J 1V5',
    lat: 43.6531,
    lng: -79.4112,
    notes: 'Needs proofs before production',
    created_at: '2024-01-12T13:45:00Z',
    updated_at: '2024-01-12T13:45:00Z',
  },
  {
    id: 'cust-5',
    name: 'Jessica Taylor',
    email: 'jtaylor@eventscorp.com',
    phone: '647-555-0105',
    company: 'Events Corp',
    address: '200 Front St W, Toronto, ON M5V 3K2',
    lat: 43.6426,
    lng: -79.3871,
    notes: 'Event materials - time sensitive',
    created_at: '2024-01-08T08:00:00Z',
    updated_at: '2024-01-18T16:30:00Z',
  },
  {
    id: 'cust-6',
    name: 'Robert Thompson',
    email: 'robert.t@email.com',
    phone: '416-555-0106',
    company: null,
    address: '450 Yonge St, Toronto, ON M4Y 1X5',
    lat: 43.6629,
    lng: -79.3849,
    notes: '',
    created_at: '2024-01-18T12:00:00Z',
    updated_at: '2024-01-18T12:00:00Z',
  },
]
