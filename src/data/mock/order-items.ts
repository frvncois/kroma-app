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
  created_at: string
  updated_at: string
}

export const orderItems: OrderItem[] = [
  // Order 1 items
  {
    id: 'item-1',
    order_id: 'order-1',
    product_name: 'Business Cards',
    description: '500 business cards, 3.5x2", full color both sides',
    quantity: 500,
    specs: { size: '3.5x2', paper: '16pt cardstock', finish: 'matte' },
    assigned_printshop: 'in-house',
    status: 'delivered',
    status_history: [
      { status: 'new', changed_at: '2024-01-20T09:00:00Z', changed_by: 'System' },
      { status: 'assigned', changed_at: '2024-01-20T09:15:00Z', changed_by: 'John Manager', note: 'Assigned to in-house printshop' },
      { status: 'in_production', changed_at: '2024-01-20T10:00:00Z', changed_by: 'Mike Printer' },
      { status: 'ready', changed_at: '2024-01-22T14:00:00Z', changed_by: 'Mike Printer', note: 'Quality check passed' },
      { status: 'out_for_delivery', changed_at: '2024-01-22T15:00:00Z', changed_by: 'Sarah Driver' },
      { status: 'delivered', changed_at: '2024-01-22T16:30:00Z', changed_by: 'Sarah Driver', note: 'Delivered to reception' }
    ],
    notes: '',
    due_date: '2024-01-22',
    production_start_date: '2024-01-20T10:00:00Z',
    production_ready_date: '2024-01-22T14:00:00Z',
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-22T16:30:00Z',
  },
  {
    id: 'item-2',
    order_id: 'order-1',
    product_name: 'Letterhead',
    description: '100 letterhead sheets, 8.5x11"',
    quantity: 100,
    specs: { size: '8.5x11', paper: '24lb bond', color: 'full color' },
    assigned_printshop: 'in-house',
    status: 'delivered',
    status_history: [
      { status: 'new', changed_at: '2024-01-20T09:00:00Z', changed_by: 'System' },
      { status: 'assigned', changed_at: '2024-01-20T09:15:00Z', changed_by: 'John Manager' },
      { status: 'in_production', changed_at: '2024-01-20T10:30:00Z', changed_by: 'Mike Printer' },
      { status: 'ready', changed_at: '2024-01-22T14:30:00Z', changed_by: 'Mike Printer' },
      { status: 'picked_up', changed_at: '2024-01-22T16:30:00Z', changed_by: 'Customer', note: 'Picked up by client' }
    ],
    notes: '',
    due_date: '2024-01-22',
    production_start_date: '2024-01-20T10:30:00Z',
    production_ready_date: '2024-01-22T14:30:00Z',
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-22T16:30:00Z',
  },

  // Order 2 items
  {
    id: 'item-3',
    order_id: 'order-2',
    product_name: 'Banners',
    description: '3x6ft vinyl banner, full color',
    quantity: 2,
    specs: { size: '3x6ft', material: 'vinyl', grommets: true },
    assigned_printshop: 'victor',
    status: 'in_production',
    status_history: [
      { status: 'new', changed_at: '2024-01-21T10:30:00Z', changed_by: 'System' },
      { status: 'assigned', changed_at: '2024-01-21T11:00:00Z', changed_by: 'John Manager', note: 'Rush order - assigned to Victor' },
      { status: 'in_production', changed_at: '2024-01-22T08:00:00Z', changed_by: 'Victor Tech' }
    ],
    notes: 'Rush order',
    due_date: '2024-01-24',
    production_start_date: '2024-01-22T08:00:00Z',
    production_ready_date: null,
    created_at: '2024-01-21T10:30:00Z',
    updated_at: '2024-01-22T14:00:00Z',
  },
  {
    id: 'item-4',
    order_id: 'order-2',
    product_name: 'Yard Signs',
    description: '18x24" coroplast yard signs',
    quantity: 10,
    specs: { size: '18x24', material: 'coroplast', stake: true },
    assigned_printshop: 'victor',
    status: 'ready',
    status_history: [
      { status: 'new', changed_at: '2024-01-21T10:30:00Z', changed_by: 'System' },
      { status: 'assigned', changed_at: '2024-01-21T11:00:00Z', changed_by: 'John Manager' },
      { status: 'in_production', changed_at: '2024-01-21T13:00:00Z', changed_by: 'Victor Tech' },
      { status: 'ready', changed_at: '2024-01-22T15:00:00Z', changed_by: 'Victor Tech', note: 'All 10 signs completed' }
    ],
    notes: '',
    due_date: '2024-01-25',
    production_start_date: '2024-01-21T13:00:00Z',
    production_ready_date: '2024-01-22T15:00:00Z',
    created_at: '2024-01-21T10:30:00Z',
    updated_at: '2024-01-22T15:00:00Z',
  },

  // Order 3 items
  {
    id: 'item-5',
    order_id: 'order-3',
    product_name: 'Flyers',
    description: '1000 flyers, 8.5x11", full color',
    quantity: 1000,
    specs: { size: '8.5x11', paper: '100lb gloss text', sides: 2 },
    assigned_printshop: 'in-house',
    status: 'ready',
    status_history: [
      { status: 'new', changed_at: '2024-01-22T08:15:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-26',
    production_start_date: '2024-01-22T09:00:00Z',
    production_ready_date: '2024-01-23T11:00:00Z',
    created_at: '2024-01-22T08:15:00Z',
    updated_at: '2024-01-23T11:00:00Z',
  },

  // Order 4 items (OVERDUE - due date in the past, still on hold)
  {
    id: 'item-6',
    order_id: 'order-4',
    product_name: 'Posters',
    description: '24x36" posters, full color',
    quantity: 25,
    specs: { size: '24x36', paper: '100lb gloss cover' },
    assigned_printshop: 'in-house',
    status: 'on_hold',
    status_history: [
      { status: 'new', changed_at: '2024-01-22T11:00:00Z', changed_by: 'System' }
    ],
    notes: 'Waiting for customer approval on colors',
    due_date: '2024-01-20', // Overdue!
    production_start_date: '2024-01-22T11:30:00Z',
    production_ready_date: null,
    created_at: '2024-01-22T11:00:00Z',
    updated_at: '2024-01-23T09:30:00Z',
  },
  {
    id: 'item-7',
    order_id: 'order-4',
    product_name: 'Postcards',
    description: '4x6" postcards, full color both sides',
    quantity: 500,
    specs: { size: '4x6', paper: '14pt cardstock', finish: 'UV coating' },
    assigned_printshop: 'in-house',
    status: 'on_hold',
    status_history: [
      { status: 'new', changed_at: '2024-01-22T11:00:00Z', changed_by: 'System' }
    ],
    notes: 'Same approval needed',
    due_date: '2024-01-20', // Overdue!
    production_start_date: '2024-01-22T11:30:00Z',
    production_ready_date: null,
    created_at: '2024-01-22T11:00:00Z',
    updated_at: '2024-01-23T09:30:00Z',
  },

  // Order 5 items
  {
    id: 'item-8',
    order_id: 'order-5',
    product_name: 'Brochures',
    description: 'Tri-fold brochures, 8.5x11"',
    quantity: 250,
    specs: { size: '8.5x11', paper: '100lb gloss text', fold: 'tri-fold' },
    assigned_printshop: 'victor',
    status: 'assigned',
    status_history: [
      { status: 'new', changed_at: '2024-01-23T09:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-28',
    production_start_date: null,
    production_ready_date: null,
    created_at: '2024-01-23T09:00:00Z',
    updated_at: '2024-01-23T09:00:00Z',
  },

  // Order 6 items (new, no dates set yet)
  {
    id: 'item-9',
    order_id: 'order-6',
    product_name: 'Stickers',
    description: 'Custom die-cut stickers, 3" circle',
    quantity: 1000,
    specs: { shape: 'circle', size: '3"', material: 'vinyl', finish: 'gloss' },
    assigned_printshop: null,
    status: 'new',
    status_history: [
      { status: 'new', changed_at: '2024-01-23T13:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-30',
    production_start_date: null,
    production_ready_date: null,
    created_at: '2024-01-23T13:00:00Z',
    updated_at: '2024-01-23T13:00:00Z',
  },
  {
    id: 'item-10',
    order_id: 'order-6',
    product_name: 'Labels',
    description: 'Product labels, 2x3"',
    quantity: 500,
    specs: { size: '2x3', material: 'vinyl', finish: 'matte' },
    assigned_printshop: null,
    status: 'new',
    status_history: [
      { status: 'new', changed_at: '2024-01-23T13:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-30',
    production_start_date: null,
    production_ready_date: null,
    created_at: '2024-01-23T13:00:00Z',
    updated_at: '2024-01-23T13:00:00Z',
  },

  // Order 7 items
  {
    id: 'item-11',
    order_id: 'order-7',
    product_name: 'Canvas Print',
    description: '16x20" canvas print, gallery wrap',
    quantity: 1,
    specs: { size: '16x20', material: 'canvas', wrap: 'gallery' },
    assigned_printshop: 'victor',
    status: 'picked_up',
    status_history: [
      { status: 'new', changed_at: '2024-01-19T14:00:00Z', changed_by: 'System' }
    ],
    notes: 'Customer picked up at shop',
    due_date: '2024-01-21',
    production_start_date: '2024-01-19T15:00:00Z',
    production_ready_date: '2024-01-20T17:00:00Z',
    created_at: '2024-01-19T14:00:00Z',
    updated_at: '2024-01-21T10:00:00Z',
  },

  // Order 8 items
  {
    id: 'item-12',
    order_id: 'order-8',
    product_name: 'T-Shirts',
    description: 'Custom printed t-shirts, size L',
    quantity: 50,
    specs: { size: 'L', color: 'black', print: 'front and back' },
    assigned_printshop: 'in-house',
    status: 'out_for_delivery',
    status_history: [
      { status: 'new', changed_at: '2024-01-21T15:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-24',
    production_start_date: '2024-01-22T08:00:00Z',
    production_ready_date: '2024-01-23T13:00:00Z',
    created_at: '2024-01-21T15:00:00Z',
    updated_at: '2024-01-23T14:00:00Z',
  },

  // Order 9 items
  {
    id: 'item-13',
    order_id: 'order-9',
    product_name: 'Booklets',
    description: '24-page booklets, 8.5x11", saddle stitch',
    quantity: 100,
    specs: { pages: 24, size: '8.5x11', binding: 'saddle stitch' },
    assigned_printshop: 'in-house',
    status: 'in_production',
    status_history: [
      { status: 'new', changed_at: '2024-01-22T16:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-27',
    production_start_date: '2024-01-23T09:00:00Z',
    production_ready_date: null,
    created_at: '2024-01-22T16:00:00Z',
    updated_at: '2024-01-23T10:00:00Z',
  },
  {
    id: 'item-14',
    order_id: 'order-9',
    product_name: 'Folders',
    description: '9x12" presentation folders',
    quantity: 50,
    specs: { size: '9x12', pockets: 2 },
    assigned_printshop: 'in-house',
    status: 'assigned',
    status_history: [
      { status: 'new', changed_at: '2024-01-22T16:00:00Z', changed_by: 'System' }
    ],
    notes: '',
    due_date: '2024-01-27',
    production_start_date: null,
    production_ready_date: null,
    created_at: '2024-01-22T16:00:00Z',
    updated_at: '2024-01-22T16:00:00Z',
  },

  // Order 10 items
  {
    id: 'item-15',
    order_id: 'order-10',
    product_name: 'Menu Boards',
    description: '24x36" menu board, foam core',
    quantity: 3,
    specs: { size: '24x36', material: 'foam core', lamination: true },
    assigned_printshop: 'victor',
    status: 'canceled',
    status_history: [
      { status: 'new', changed_at: '2024-01-20T12:00:00Z', changed_by: 'System' }
    ],
    notes: 'Customer requested cancellation',
    due_date: '2024-01-23',
    production_start_date: '2024-01-20T13:00:00Z',
    production_ready_date: null,
    created_at: '2024-01-20T12:00:00Z',
    updated_at: '2024-01-21T09:00:00Z',
  },
]
