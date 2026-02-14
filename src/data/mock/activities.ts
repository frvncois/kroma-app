import type { Activity } from '@/types'

// Generate recent activities (most recent first)
const now = new Date()
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString()

export const activities: Activity[] = [
  {
    id: 'act-1',
    type: 'pickup',
    user_id: 'user-3',
    user: 'Sarah Chen',
    entity_type: 'order_item',
    entity_id: 'item-1',
    order_id: 'order-1',
    printshop_id: null,
    timestamp: minutesAgo(5),
    details: {
      message: 'Item marked as picked up',
      itemName: 'Business Cards - 500x',
      customerName: 'Acme Corp',
      externalId: 'IQ-2024-001'
    }
  },
  {
    id: 'act-2',
    type: 'status_change',
    user_id: 'user-2',
    user: 'Marc Dubois',
    entity_type: 'order_item',
    entity_id: 'item-2',
    order_id: 'order-2',
    printshop_id: null,
    timestamp: minutesAgo(12),
    details: {
      message: 'Status updated',
      from: 'in production',
      to: 'ready',
      itemName: 'Vinyl Banner - 4x8ft',
      customerName: 'Tech Startup Inc',
      externalId: 'PF-2024-042'
    }
  },
  {
    id: 'act-3',
    type: 'note_added',
    user_id: 'user-1',
    user: 'Julie Martin',
    entity_type: 'order_item',
    entity_id: 'item-3',
    order_id: 'order-3',
    printshop_id: null,
    timestamp: minutesAgo(23),
    details: {
      message: 'Note added to item',
      note: 'Customer requested matte finish instead of glossy. Updated specs accordingly.',
      itemName: 'Poster Print - A1 size',
      customerName: 'City Museum',
      externalId: 'PROP-2024-089'
    }
  },
  {
    id: 'act-4',
    type: 'delivery',
    user_id: 'user-3',
    user: 'Driver - Jean',
    entity_type: 'order_item',
    entity_id: 'item-4',
    order_id: 'order-4',
    printshop_id: null,
    timestamp: minutesAgo(45),
    details: {
      message: 'Out for delivery',
      itemName: 'Corrugated Signs - 10x',
      customerName: 'Real Estate Agency',
      externalId: 'SP-2024-156'
    }
  },
  {
    id: 'act-5',
    type: 'assignment',
    user_id: 'user-1',
    user: 'Manager - Claude',
    entity_type: 'order_item',
    entity_id: 'item-5',
    order_id: 'order-5',
    printshop_id: null,
    timestamp: minutesAgo(67),
    details: {
      message: 'Assigned to In House printshop',
      itemName: 'Decals Custom - 200x',
      customerName: 'Local Coffee Shop',
      externalId: 'IQ-2024-002'
    }
  },
  {
    id: 'act-6',
    type: 'status_change',
    user_id: 'user-2',
    user: 'Victor Printshop',
    entity_type: 'order_item',
    entity_id: 'item-6',
    order_id: 'order-6',
    printshop_id: null,
    timestamp: minutesAgo(89),
    details: {
      message: 'Status updated',
      from: 'assigned',
      to: 'in production',
      itemName: 'Brochure Printing - 1000x',
      customerName: 'Marketing Agency',
      externalId: 'PF-2024-043'
    }
  },
  {
    id: 'act-7',
    type: 'order_created',
    user_id: 'system',
    user: 'Shopify - Imp. Quebec',
    entity_type: 'order',
    entity_id: 'order-7',
    order_id: 'order-7',
    printshop_id: null,
    timestamp: minutesAgo(105),
    details: {
      message: 'New order received',
      customerName: 'Fashion Boutique',
      externalId: 'IQ-2024-003'
    }
  },
  {
    id: 'act-8',
    type: 'note_added',
    user_id: 'user-3',
    user: 'Sarah Chen',
    entity_type: 'order_item',
    entity_id: 'item-8',
    order_id: 'order-8',
    printshop_id: null,
    timestamp: minutesAgo(134),
    details: {
      message: 'Note added to item',
      note: 'Customer will drop off vehicle on Monday morning. Confirmed availability with Victor.',
      itemName: 'Vehicle Wrap',
      customerName: 'Delivery Service',
      externalId: 'PROP-2024-090'
    }
  },
  {
    id: 'act-9',
    type: 'pickup',
    user_id: 'system',
    user: 'Customer Pickup',
    entity_type: 'order_item',
    entity_id: 'item-9',
    order_id: 'order-9',
    printshop_id: null,
    timestamp: minutesAgo(167),
    details: {
      message: 'Item marked as picked up',
      itemName: 'Photo Prints - 50x',
      customerName: 'Photography Studio',
      externalId: 'SP-2024-157'
    }
  },
  {
    id: 'act-10',
    type: 'status_change',
    user_id: 'user-2',
    user: 'In House Printshop',
    entity_type: 'order_item',
    entity_id: 'item-10',
    order_id: 'order-10',
    printshop_id: null,
    timestamp: minutesAgo(198),
    details: {
      message: 'Status updated',
      from: 'in production',
      to: 'ready',
      itemName: 'T-Shirt Printing - 100x',
      customerName: 'Sports Team',
      externalId: 'IQ-2024-004'
    }
  },
  {
    id: 'act-11',
    type: 'delivery',
    user_id: 'user-3',
    user: 'Driver - Jean',
    entity_type: 'order_item',
    entity_id: 'item-11',
    order_id: 'order-11',
    printshop_id: null,
    timestamp: minutesAgo(223),
    details: {
      message: 'Successfully delivered',
      itemName: 'Window Graphics',
      customerName: 'Restaurant Chain',
      externalId: 'PF-2024-044'
    }
  },
  {
    id: 'act-12',
    type: 'order_created',
    user_id: 'system',
    user: 'Web Form',
    entity_type: 'order',
    entity_id: 'order-12',
    order_id: 'order-12',
    printshop_id: null,
    timestamp: minutesAgo(256),
    details: {
      message: 'New order received',
      customerName: 'Non-Profit Organization'
    }
  }
]
