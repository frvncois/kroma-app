# Activity Feed Real-Time Updates Implementation

## Overview
Fixed the Activity Feed to reflect all real-time changes by wiring store actions to automatically create activity entries. Previously, the feed only showed static mock data.

## Problem
Store actions (`updateItemStatus`, `updateItemPrintshop`, `updateOrderPaymentStatus`, etc.) never called `activityStore.addActivity()`. All mutations happened silently with no activity tracking.

## Solution
Implemented automatic activity creation by having the order store call the activity store after each mutation.

## Files Modified

### `/src/stores/orders.ts`

#### Imports Added
```typescript
import type { Activity } from '@/types'
import { useActivityStore } from './activities'
import { usePrintshopStore } from './printshops'
import { useAuthStore } from './auth'
```

#### Helper Function Created
Added `createActivity()` helper function inside the store (~40 lines):
- Builds standardized Activity objects
- Looks up order and customer context
- Gets current user from auth store
- Generates unique activity IDs
- Formats item names with quantity
- Includes order external ID when available

**Signature:**
```typescript
function createActivity(
  type: Activity['type'],
  message: string,
  item?: OrderItem,
  orderId?: string,
  extra?: Partial<Activity['details']>
): Activity
```

#### Actions Updated

**1. `updateItemStatus()`**
- Creates activity after status change
- Activity type varies by status:
  - `'delivery'` for delivered, out_for_delivery
  - `'pickup'` for picked_up
  - `'status_change'` for all others
- Message varies by type:
  - "Status updated" (general)
  - "Out for delivery" (out_for_delivery)
  - "Successfully delivered" (delivered)
  - "Item marked as picked up" (picked_up)
- Includes `from` and `to` status in details

**2. `updateItemPrintshop()`**
- Creates `'assignment'` activity when printshop assigned
- Message: "Assigned to {printshop name}"
- Only creates activity when assigning (not unassigning)
- Uses printshop store to get shop name

**3. `updateItemDueDate()`**
- Creates `'status_change'` activity
- Message: "Due date set to {date}" or "Due date cleared"
- Formats date as "Jan 1, 2024" style

**4. `updateOrderPaymentStatus()`**
- Creates `'status_change'` activity
- Message: "Payment updated to {status}"
- Includes `from` and `to` in details
- Formats status (capitalizes first letter)

**5. `updateOrderPaymentMethod()`**
- Creates `'status_change'` activity
- Message: "Payment method changed to {method}"

**6. `updateOrderSource()`**
- Creates `'status_change'` activity
- Message: "Order source updated to {source}"
- Includes `from` and `to` in details
- Formats source (splits underscores, capitalizes)

## Activity Types Used

| Action | Activity Type | Example Message |
|--------|---------------|-----------------|
| Status → delivered | `delivery` | "Successfully delivered" |
| Status → picked_up | `pickup` | "Item marked as picked up" |
| Status → out_for_delivery | `delivery` | "Out for delivery" |
| Status → other | `status_change` | "Status updated" |
| Printshop assignment | `assignment` | "Assigned to Victor" |
| Due date change | `status_change` | "Due date set to Jan 15, 2024" |
| Payment status | `status_change` | "Payment updated to Paid" |
| Payment method | `status_change` | "Payment method changed to shopify" |
| Order source | `status_change` | "Order source updated to Promo Flash" |

## Activity Entry Structure

Each activity includes:
```typescript
{
  id: 'act-1234567890-a1b2',        // Unique ID
  type: 'status_change',             // Activity type
  timestamp: '2024-01-15T10:30:00Z', // ISO timestamp
  user: 'John Smith',                // Current user name
  seen: false,                       // Always starts unseen
  item: {                            // If item-level change
    id: 'item-1',
    name: 'Business Cards - 500x',
    orderId: 'order-123'
  },
  order: {                           // Order context
    id: 'order-123',
    externalId: '#1234',
    customer: 'Acme Corp'
  },
  details: {
    message: 'Status updated',
    from: 'New',                     // Optional
    to: 'In Production'              // Optional
  }
}
```

## Reactivity Chain

```
User Action (UI)
  ↓
Component Handler
  ↓
Store Action (e.g., updateItemStatus)
  ↓
Mutation + activityStore.addActivity()
  ↓
activityStore.activities.unshift(activity)
  ↓
activityStore.allActivities (computed)
  ↓
ManagerOrders: activities = computed(() => activityStore.allActivities)
  ↓
<ActivityFeed :activities="activities" />
  ↓
Feed Auto-Updates ✅
```

## Features

### Real-Time Updates
- ✅ Activities appear instantly after any mutation
- ✅ New activities appear at top with green "unseen" border
- ✅ Feed scrolls to show latest activities
- ✅ No page refresh needed

### Context-Aware
- ✅ Shows item name and quantity
- ✅ Shows order external ID
- ✅ Shows customer name
- ✅ Links to correct order when clicked

### User Attribution
- ✅ Shows who made the change (current user)
- ✅ Falls back to "System" if no user

### Smart Formatting
- ✅ Status names: "In Production" (not "in_production")
- ✅ Source names: "Promo Flash" (not "promo_flash")
- ✅ Dates: "Jan 15, 2024" (not ISO strings)

### Granular Tracking
- ✅ Each item status change = separate activity
- ✅ Batch operations create multiple entries (by design)
- ✅ Full audit trail of all changes

## Testing Checklist

### Item Status Changes
- ✅ Change status in OrderDetailSheet → activity appears
- ✅ Change status in table expanded row → activity appears
- ✅ Change status in kanban drag-drop → activity appears
- ✅ Activity shows correct from/to status
- ✅ Activity type correct (delivery, pickup, or status_change)

### Printshop Assignment
- ✅ Assign printshop → "Assigned to {shop}" appears
- ✅ Unassign printshop → no activity (intentional)
- ✅ Drag-drop in kanban → assignment activity appears

### Payment Changes
- ✅ Change payment status → activity appears
- ✅ Change payment method → activity appears
- ✅ Activities show correct from/to values

### Due Date Changes
- ✅ Set due date → activity shows formatted date
- ✅ Clear due date → activity shows "cleared"

### Order Source Changes
- ✅ Change source → activity appears with formatted source name

### Feed Behavior
- ✅ New activities appear at top
- ✅ Activities show unseen indicator (green border)
- ✅ Clicking activity opens order detail
- ✅ Feed is scrollable
- ✅ Timestamps show relative time

## Edge Cases Handled

**No User Logged In:**
- Falls back to "System" as user name

**No Order External ID:**
- Uses internal order ID instead

**Item Without Quantity:**
- Shows product name only (no "- 1x")

**Customer Not Found:**
- Shows "Unknown" as customer name

**Batch Operations:**
- `updateOrderItemsStatus()` calls `updateItemStatus()` in loop
- Each item gets its own activity entry
- Provides full audit trail (intentional granularity)

## Performance

**Activity ID Generation:**
- Timestamp + random string for uniqueness
- Format: `act-{timestamp}-{random4}`

**Store References:**
- Stores reference each other via Pinia's composable pattern
- No circular dependency issues
- Proper reactivity maintained

**Array Operations:**
- Uses `unshift()` to add to beginning
- Vue reactivity detects array changes
- No performance issues with reasonable activity counts

## Future Enhancements (Not Implemented)

- [ ] Activity grouping (e.g., "Updated 5 items")
- [ ] Activity filtering by type
- [ ] Activity search
- [ ] Activity deletion/archival
- [ ] Export activity log
- [ ] Activity notifications (browser/email)
- [ ] Silent mode for bulk operations
- [ ] Activity batching for performance

## Code Metrics

**Lines Added:** ~200
**Functions Modified:** 6 (all mutation actions)
**Helper Functions Added:** 1 (`createActivity`)
**Stores Accessed:** 4 (orders, activities, printshops, auth)

## Build Status

- ✅ **Type Check**: `npm run type-check` - PASSED
- ✅ **Build**: `npm run build` - PASSED
- ✅ **Bundle Size**: 355.53 kB (109.77 kB gzipped)

---

**Implementation Date:** 2026-02-08
**Status:** ✅ Complete
**Files Changed:** 1 (`src/stores/orders.ts`)
**Reactivity:** ✅ Working end-to-end
