# Status History Implementation Summary

This document summarizes the lazy-loaded status history implementation for the Kroma application.

## Overview

Status history is now loaded **on-demand** from the separate `status_history` table instead of being included with order items. This improves performance by reducing payload size for order queries.

## Implementation Details

### 1. Database Structure

The `status_history` table tracks all status changes:

```sql
CREATE TABLE status_history (
  id UUID PRIMARY KEY,
  order_item_id UUID NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID,              -- FK to users.id
  changed_at TIMESTAMPTZ
);
```

### 2. Store Function (`src/stores/orders.ts`)

Added `fetchItemStatusHistory(itemId)` function:

```typescript
async function fetchItemStatusHistory(itemId: string): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('status_history')
    .select('*, users:changed_by(name)')
    .eq('order_item_id', itemId)
    .order('changed_at', { ascending: true })

  // Map database structure to StatusHistoryEntry format
  const history = data.map((entry) => ({
    status: entry.to_status,         // Destination status
    changed_at: entry.changed_at,
    changed_by: entry.users?.name || 'Unknown User',
    note: undefined
  }))

  return history
}
```

**Key Features:**
- ✅ Joins with `users` table to get user names
- ✅ Maps `to_status` to `status` for display
- ✅ Orders by `changed_at` ascending (oldest first)
- ✅ Returns `StatusHistoryEntry[]` format
- ✅ NOT cached in store - fetched on demand

### 3. OrderDetailSheet.vue Updates

**State Management:**
```typescript
// Track loaded status history per item
const itemStatusHistory = ref<Map<string, any[]>>(new Map())
const loadingHistory = ref<Set<string>>(new Set())
```

**Load on Expand:**
```typescript
const toggleItemExpanded = async (itemId: string) => {
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId)
  } else {
    expandedItems.value.add(itemId)
    await loadStatusHistory(itemId) // Lazy-load history
  }
}

const loadStatusHistory = async (itemId: string) => {
  if (itemStatusHistory.value.has(itemId) || loadingHistory.value.has(itemId)) {
    return // Skip if already loaded or loading
  }

  loadingHistory.value.add(itemId)
  const history = await fetchItemStatusHistory(itemId)
  itemStatusHistory.value.set(itemId, history)
  loadingHistory.value.delete(itemId)
}
```

**Template Display:**
```vue
<!-- Status History -->
<div class="space-y-2">
  <div class="text-sm font-medium">Status History</div>

  <!-- Loading state -->
  <div v-if="loadingHistory.has(item.id)">
    <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
    <span>Loading history...</span>
  </div>

  <!-- History loaded -->
  <div v-else-if="itemStatusHistory.has(item.id) && itemStatusHistory.get(item.id)!.length > 0">
    <div v-for="(history, index) in itemStatusHistory.get(item.id)" :key="index">
      <Badge :variant="getStatusVariant(history.status)">
        {{ formatStatus(history.status) }}
      </Badge>
      <span>{{ formatDateDisplay(history.changed_at) }}</span>
      <span>by {{ history.changed_by }}</span>
    </div>
  </div>

  <!-- No history -->
  <div v-else>No status changes yet</div>
</div>
```

### 4. ItemDetailSheet.vue Updates

Similar pattern applied:

**State Management:**
```typescript
const statusHistory = ref<any[]>([])
const loadingStatusHistory = ref(false)
```

**Load on Sheet Open:**
```typescript
watch(() => props.itemId, async (newItemId) => {
  if (newItemId && props.isOpen) {
    loadingStatusHistory.value = true
    const history = await fetchItemStatusHistory(newItemId)
    statusHistory.value = history
    loadingStatusHistory.value = false
  }
}, { immediate: true })
```

**Template Display:**
- Same as OrderDetailSheet but simpler (no Map, just single item)
- Shows loading spinner while fetching
- Displays history timeline
- Shows "No status changes yet" if empty

### 5. Automatic History Recording

Status changes are automatically recorded in `updateItemStatus()`:

```typescript
async function updateItemStatus(itemId: string, newStatus: ItemStatus) {
  const oldStatus = item.status

  // Update item status in database
  await supabase.from('order_items').update({ status: newStatus })...

  // Write to status_history table
  await supabase.from('status_history').insert({
    order_item_id: itemId,
    from_status: oldStatus,
    to_status: newStatus,
    changed_by: authStore.currentUser?.id || 'system',
    changed_at: new Date().toISOString()
  })
}
```

## User Experience

### OrderDetailSheet Flow

1. User opens order detail sheet
2. Items are collapsed by default
3. User clicks to expand an item
4. **Status history loads automatically** (lazy-loaded)
5. Loading spinner appears briefly
6. History timeline displays with all status changes
7. Each entry shows: status badge, timestamp, user name

### ItemDetailSheet Flow

1. User opens item detail sheet
2. **Status history loads immediately** when sheet opens
3. Loading spinner appears briefly
4. History timeline displays in "Status History" section
5. Located after the timeline (production dates) section

## Performance Benefits

### Before (Eager Loading)
- ❌ Every order item included full status_history array
- ❌ Large payloads for orders with many items
- ❌ History loaded even if never viewed
- ❌ Realtime updates would sync entire history arrays

### After (Lazy Loading)
- ✅ Order items load without status_history
- ✅ Small payloads - only current item data
- ✅ History loaded only when item is expanded/viewed
- ✅ Realtime updates only sync item status, not history
- ✅ Scales well with large order histories

## Data Flow

```
User Action → Component → Composable → Store → Supabase
──────────────────────────────────────────────────────────

1. User expands item
   ↓
2. OrderDetailSheet.toggleItemExpanded()
   ↓
3. OrderDetailSheet.loadStatusHistory()
   ↓
4. useOrders.fetchItemStatusHistory()
   ↓
5. orderStore.fetchItemStatusHistory()
   ↓
6. Supabase query with join
   ↓
7. Map to StatusHistoryEntry[]
   ↓
8. Return to component
   ↓
9. Store in Map (per item)
   ↓
10. Display in template
```

## Type Mapping

The database structure differs from the display format:

**Database (`status_history` table):**
```typescript
{
  id: string
  order_item_id: string
  from_status: ItemStatus    // Where it came from
  to_status: ItemStatus      // Where it went to
  changed_by: UUID           // User ID
  changed_at: string
}
```

**Display (`StatusHistoryEntry`):**
```typescript
{
  status: ItemStatus         // to_status (where it went)
  changed_at: string
  changed_by: string         // User name (joined)
  note?: string              // Future: optional note
}
```

**Mapping Logic:**
- `to_status` → `status` (we show where it went, not where it came from)
- `changed_by` (UUID) → `changed_by` (name via join)
- `note` is always `undefined` (notes stored separately in `notes` table)

## Testing

### Manual Test Steps

1. **Open an order with items**
   - Navigate to Manager Orders
   - Click on any order
   - Verify OrderDetailSheet opens

2. **Expand an item**
   - Click on an item to expand it
   - ✅ Loading spinner should appear in Status History section
   - ✅ History should load within 1 second

3. **View status history**
   - ✅ Should show all status changes in chronological order
   - ✅ Each entry shows status badge, date, and user name
   - ✅ If no history, shows "No status changes yet"

4. **Change item status**
   - Change the item status using ItemControls
   - Wait a moment for the update to complete
   - Collapse and re-expand the item
   - ✅ New status change should appear in history

5. **Check ItemDetailSheet**
   - Click on an item to open ItemDetailSheet
   - ✅ Status History section should appear after Timeline
   - ✅ Loading spinner while fetching
   - ✅ History displays correctly

6. **Verify database**
   - Go to Supabase → Table Editor → status_history
   - ✅ New row should exist for the status change
   - ✅ Columns: order_item_id, from_status, to_status, changed_by, changed_at

## Troubleshooting

### History not loading

1. Check browser console for errors
2. Verify Supabase connection is working
3. Check RLS policies on status_history table
4. Verify user has permission to read status_history

### Empty history for item with status changes

1. Check if status_history INSERT is working in updateItemStatus
2. Verify changed_by field is a valid user UUID
3. Check status_history table has records for the item:
   ```sql
   SELECT * FROM status_history WHERE order_item_id = 'item-uuid-here';
   ```

### User names showing as "Unknown User"

1. Verify the join is working: `users:changed_by(name)`
2. Check that changed_by UUIDs exist in users table
3. Ensure users table has RLS policies that allow reading names

### Loading spinner stuck

1. Check for JavaScript errors in console
2. Verify fetchItemStatusHistory is completing
3. Check loadingHistory Set is being updated correctly
4. Ensure finally block is running to remove from loadingHistory

## Future Enhancements

### Realtime Updates (Phase 3)

Add realtime subscription to status_history:

```typescript
const channel = supabase
  .channel('status-history-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'status_history',
    filter: `order_item_id=eq.${itemId}`
  }, (payload) => {
    const newEntry = payload.new
    // Append to statusHistory array
  })
  .subscribe()
```

### Notes in Status Changes (Phase 4)

Allow users to add notes when changing status:
- Update UI to include optional note field
- Store in status_history.note column (add to table)
- Display notes in history timeline

### Status Change Reasons (Phase 5)

Track why status changed:
- Add `reason` enum: 'manual', 'auto', 'system', 'webhook'
- Add `source` field: 'user_action', 'cron_job', 'api_call'
- Display in history for audit purposes

## Code Quality

- ✅ **Zero TypeScript errors**
- ✅ **Build succeeds**
- ✅ **Follows established patterns** (lazy-loading like notes/files)
- ✅ **Consistent error handling** (returns empty array on error)
- ✅ **Console logging** for debugging
- ✅ **Loading states** for UX feedback
- ✅ **Map-based caching** prevents duplicate fetches

## Summary

Status history is now **production-ready** with lazy-loading:

- ✅ Fetched on-demand when items are expanded/viewed
- ✅ Reduces payload size for order queries
- ✅ Automatically recorded on status changes
- ✅ Displays user names via join
- ✅ Loading states for better UX
- ✅ Works in both OrderDetailSheet and ItemDetailSheet
- ✅ Scales well with large order histories

The implementation follows the same lazy-loading pattern as notes and files, maintaining architectural consistency across the application.
