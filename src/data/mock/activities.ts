import type { Activity } from '@/types'

// Generate recent activities (most recent first)
const now = new Date()
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString()

export const activities: Activity[] = [
  {
    id: 'act-1',
    type: 'pickup',
    timestamp: minutesAgo(5),
    user: 'Sarah Chen',
    seen: false,
    important: false,
    item: {
      id: 'item-1',
      name: 'Business Cards - 500x',
      orderId: 'order-1'
    },
    order: {
      id: 'order-1',
      externalId: 'IQ-2024-001',
      customer: 'Acme Corp'
    },
    details: {
      message: 'Item marked as picked up'
    }
  },
  {
    id: 'act-2',
    type: 'status_change',
    timestamp: minutesAgo(12),
    user: 'Marc Dubois',
    seen: false,
    important: false,
    item: {
      id: 'item-2',
      name: 'Vinyl Banner - 4x8ft',
      orderId: 'order-2'
    },
    order: {
      id: 'order-2',
      externalId: 'PF-2024-042',
      customer: 'Tech Startup Inc'
    },
    details: {
      message: 'Status updated',
      from: 'in production',
      to: 'ready'
    }
  },
  {
    id: 'act-3',
    type: 'note_added',
    timestamp: minutesAgo(23),
    user: 'Julie Martin',
    seen: false,
    important: false,
    item: {
      id: 'item-3',
      name: 'Poster Print - A1 size',
      orderId: 'order-3'
    },
    order: {
      id: 'order-3',
      externalId: 'PROP-2024-089',
      customer: 'City Museum'
    },
    details: {
      message: 'Note added to item',
      note: 'Customer requested matte finish instead of glossy. Updated specs accordingly.'
    }
  },
  {
    id: 'act-4',
    type: 'delivery',
    timestamp: minutesAgo(45),
    user: 'Driver - Jean',
    seen: false,
    important: false,
    item: {
      id: 'item-4',
      name: 'Corrugated Signs - 10x',
      orderId: 'order-4'
    },
    order: {
      id: 'order-4',
      externalId: 'SP-2024-156',
      customer: 'Real Estate Agency'
    },
    details: {
      message: 'Out for delivery'
    }
  },
  {
    id: 'act-5',
    type: 'assignment',
    timestamp: minutesAgo(67),
    user: 'Manager - Claude',
    seen: false,
    important: false,
    item: {
      id: 'item-5',
      name: 'Decals Custom - 200x',
      orderId: 'order-5'
    },
    order: {
      id: 'order-5',
      externalId: 'IQ-2024-002',
      customer: 'Local Coffee Shop'
    },
    details: {
      message: 'Assigned to In House printshop'
    }
  },
  {
    id: 'act-6',
    type: 'status_change',
    timestamp: minutesAgo(89),
    user: 'Victor Printshop',
    seen: false,
    important: false,
    item: {
      id: 'item-6',
      name: 'Brochure Printing - 1000x',
      orderId: 'order-6'
    },
    order: {
      id: 'order-6',
      externalId: 'PF-2024-043',
      customer: 'Marketing Agency'
    },
    details: {
      message: 'Status updated',
      from: 'assigned',
      to: 'in production'
    }
  },
  {
    id: 'act-7',
    type: 'order_created',
    timestamp: minutesAgo(105),
    user: 'Shopify - Imp. Quebec',
    seen: false,
    important: false,
    order: {
      id: 'order-7',
      externalId: 'IQ-2024-003',
      customer: 'Fashion Boutique'
    },
    details: {
      message: 'New order received'
    }
  },
  {
    id: 'act-8',
    type: 'note_added',
    timestamp: minutesAgo(134),
    user: 'Sarah Chen',
    seen: false,
    important: false,
    item: {
      id: 'item-8',
      name: 'Vehicle Wrap',
      orderId: 'order-8'
    },
    order: {
      id: 'order-8',
      externalId: 'PROP-2024-090',
      customer: 'Delivery Service'
    },
    details: {
      message: 'Note added to item',
      note: 'Customer will drop off vehicle on Monday morning. Confirmed availability with Victor.'
    }
  },
  {
    id: 'act-9',
    type: 'pickup',
    timestamp: minutesAgo(167),
    user: 'Customer Pickup',
    seen: false,
    important: false,
    item: {
      id: 'item-9',
      name: 'Photo Prints - 50x',
      orderId: 'order-9'
    },
    order: {
      id: 'order-9',
      externalId: 'SP-2024-157',
      customer: 'Photography Studio'
    },
    details: {
      message: 'Item marked as picked up'
    }
  },
  {
    id: 'act-10',
    type: 'status_change',
    timestamp: minutesAgo(198),
    user: 'In House Printshop',
    seen: false,
    important: false,
    item: {
      id: 'item-10',
      name: 'T-Shirt Printing - 100x',
      orderId: 'order-10'
    },
    order: {
      id: 'order-10',
      externalId: 'IQ-2024-004',
      customer: 'Sports Team'
    },
    details: {
      message: 'Status updated',
      from: 'in production',
      to: 'ready'
    }
  },
  {
    id: 'act-11',
    type: 'delivery',
    timestamp: minutesAgo(223),
    user: 'Driver - Jean',
    seen: false,
    important: false,
    item: {
      id: 'item-11',
      name: 'Window Graphics',
      orderId: 'order-11'
    },
    order: {
      id: 'order-11',
      externalId: 'PF-2024-044',
      customer: 'Restaurant Chain'
    },
    details: {
      message: 'Successfully delivered'
    }
  },
  {
    id: 'act-12',
    type: 'order_created',
    timestamp: minutesAgo(256),
    user: 'Web Form',
    seen: false,
    important: false,
    order: {
      id: 'order-12',
      customer: 'Non-Profit Organization'
    },
    details: {
      message: 'New order received'
    }
  }
]
