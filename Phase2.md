# KROMA — Phase 2 Supabase Integration Plan

## Overview

This plan replaces the mock data layer with Supabase. The architecture makes this clean: **only Pinia stores change internally**. Composables and components remain untouched.

**Guiding principle:** Each step is self-contained, testable, and leaves the app in a working state. If a step fails, you can roll back to mock data for that store while debugging.

**Execute steps in order** — each depends on the previous ones.

---

## Pre-Flight: Before Starting

### 1. Create Supabase Project
- Go to supabase.com → New Project
- Save the project URL and anon key
- Run `supabase-schema.sql` in the SQL Editor (Dashboard → SQL Editor → paste → Run)
- Verify all tables exist in the Table Editor

### 2. Create Auth Users in Supabase
In Supabase Dashboard → Authentication → Users, create the initial users:
- manager@example.com (password: whatever you choose)
- victor@example.com
- driver@example.com

After creating auth users, insert matching rows in the `users` table (SQL Editor):
```sql
INSERT INTO users (id, name, email, role, assigned_shops) VALUES
  ('<auth-uuid-for-manager>', 'Manager', 'manager@example.com', 'manager', '{}'),
  ('<auth-uuid-for-victor>', 'Victor', 'victor@example.com', 'printshop_manager', '{"00000000-0000-0000-0000-000000000002"}'),
  ('<auth-uuid-for-driver>', 'Driver', 'driver@example.com', 'driver', '{}'),
```
Replace `<auth-uuid-for-...>` with the actual UUIDs from the Authentication → Users table.

### 3. Create Storage Bucket
In Supabase Dashboard → Storage:
- Create bucket: `files` (set to private/not public)
- Add policy: Allow authenticated users to upload, read, delete (use the "Give users access to a folder" template or create custom policies allowing all operations for authenticated users)

### 4. Seed Test Data (Optional)
If you want test data in Supabase, you can seed it via SQL. Otherwise you'll start with an empty database and create data through the UI.

---

## STEP 1 — Install Supabase Client + Environment Config

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD for full project context. This is a Vue 3 + TypeScript print shop order management app called Kroma. We are starting Phase 2 — replacing mock data with Supabase.

1. Install the Supabase JS client:
   npm install @supabase/supabase-js

2. Create `src/lib/supabase.ts`:
   - Import createClient from @supabase/supabase-js
   - Read VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env
   - Export a singleton supabase client instance
   - Add TypeScript types: create a `Database` type file or use `any` for now (we'll generate types later)
   - Example:
     ```typescript
     import { createClient } from '@supabase/supabase-js'
     
     const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
     const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
     
     if (!supabaseUrl || !supabaseAnonKey) {
       throw new Error('Missing Supabase environment variables')
     }
     
     export const supabase = createClient(supabaseUrl, supabaseAnonKey)
     ```

3. Create `.env.local` (git-ignored) with placeholder values:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Update `.env.example` (if it exists) or create one with the same keys but empty values.

5. Verify the app still compiles: `npm run type-check && npm run build`
```

---

## STEP 2 — Update TypeScript Types

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (especially Section 7 — Data Model). Update the TypeScript types in src/types/ to match the Phase 2 schema. These changes align the types with supabase-schema.sql.

1. Update `src/types/order.ts`:
   - REMOVE `delivery_method` from the `Order` interface (moved to order_items)
   - REMOVE the `DeliveryMethod` export from this file
   - RENAME `notes` field to `internal_notes`
   - Keep OrderSource, PaymentStatus, PaymentMethod, Order exports

2. Update `src/types/order-item.ts`:
   - ADD `DeliveryMethod` type: 'delivery' | 'customer_pickup'
   - ADD `delivery_method: DeliveryMethod` field to `OrderItem` interface (default: 'delivery')
   - CHANGE `status_history` to optional: `status_history?: StatusHistoryEntry[]` (lazy-loaded in Phase 2)
   - Export DeliveryMethod from this file

3. Update `src/types/order-file.ts`:
   - ADD `FileEntityType` = 'order_item' | 'driver_task'
   - REPLACE `order_item_id: string` with `entity_type: FileEntityType` and `entity_id: string`
   - EXPAND `FileType` to include 'delivery_photo' | 'issue_photo'
   - Make `uploaded_by` required (remove nullable): `uploaded_by: string`

4. Update `src/types/note.ts`:
   - ADD `NoteEntityType` = 'order' | 'order_item' | 'driver_task'
   - RENAME `OrderNote` to `Note`
   - REMOVE `item_reference` field
   - ADD `entity_type: NoteEntityType`
   - ADD `entity_id: string`
   - Keep `NoteDepartment` as-is
   - Also export `OrderNote` as a type alias for `Note` for backward compatibility:
     `export type OrderNote = Note`

5. Update `src/types/activity.ts`:
   - ADD `ActivityEntityType` = 'order' | 'order_item' | 'driver_task'
   - ADD fields: `user_id: string`, `entity_type: ActivityEntityType`, `entity_id: string`, `order_id: string | null`, `printshop_id: string | null`
   - CHANGE `details` to `details: Record<string, any>` (flexible jsonb)
   - REMOVE `seen` and `important` from the Activity interface (these become client-side state)
   - REMOVE `item` and `order` nested objects (replaced by entity_type/entity_id + order_id)
   - KEEP `user` field as `user: string` (display name, denormalized for convenience)

6. Create `src/types/driver-task.ts`:
   ```typescript
   export type DriverTaskType = 'pickup' | 'dropoff' | 'errand' | 'other'
   export type DriverTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
   export type DriverTaskStatus = 'pending' | 'in_progress' | 'completed' | 'canceled'
   
   export interface DriverTask {
     id: string
     created_by: string
     assigned_to: string
     title: string
     type: DriverTaskType
     priority: DriverTaskPriority
     details: string
     address: string
     lat: number | null
     lng: number | null
     complete_by: string | null
     status: DriverTaskStatus
     completed_at: string | null
     created_at: string
     updated_at: string
   }
   ```

7. Update `src/types/index.ts` barrel file:
   - Add exports for DriverTask types
   - Move DeliveryMethod export to come from order-item.ts instead of order.ts
   - Add NoteEntityType, FileEntityType, ActivityEntityType exports
   - Add OrderNote alias export

8. IMPORTANT: After changing the types, there WILL be TypeScript errors across the codebase (stores, components, mock data). DO NOT fix them yet — they will be fixed in subsequent steps. Just verify the type files themselves are valid:
   - Check that `src/types/index.ts` compiles without circular imports
   - Each individual type file should have no internal errors
```

---

## STEP 3 — Fix Mock Data + Stores to Match New Types

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. The types were just updated in Step 2 and there are TypeScript errors across the codebase. Fix the mock data and stores to align with the new types. The goal is to get the app compiling again with mock data still working.

1. Update `src/data/mock/orders.ts`:
   - RENAME `notes` field to `internal_notes` in every order object
   - REMOVE `delivery_method` from every order object (it moved to items)

2. Update `src/data/mock/order-items.ts`:
   - ADD `delivery_method: 'delivery'` to every item (or 'customer_pickup' where appropriate — make orders 7 and 10 customer_pickup if they have that currently)
   - Make `status_history` optional on items (keep the existing arrays for now but they'll be lazy-loaded later)

3. Update `src/data/mock/order-files.ts`:
   - REPLACE `order_item_id` with `entity_type: 'order_item'` and `entity_id` (where entity_id = the old order_item_id value) in every file object

4. Update `src/stores/orders.ts`:
   - Fix any references to `order.delivery_method` (now on items)
   - Fix any references to `order.notes` → `order.internal_notes`
   - In `ordersWithDetails` computed, add a `deliveryMethodRollup` computed from items
   - Update `OrderWithDetails` interface to include `deliveryMethodRollup`
   - Fix `filesCount()` to use `entity_type` + `entity_id` instead of `order_item_id`
   - Fix activity creation helper if it references old fields

5. Update `src/stores/activities.ts`:
   - Activities still use mock data for now, but update the Activity type references
   - If `seen`/`important` were part of the store state, make them client-side (Map<string, boolean> in the store, not on the activity objects)
   - Update `getActivitiesForRole()` to work with the new Activity shape (or keep backward compat temporarily)

6. Fix ALL other TypeScript errors across the codebase:
   - `src/components/OrderDetailSheet.vue` — fix references to order.delivery_method, order.notes
   - `src/components/NewOrderSheet.vue` — fix note creation (OrderNote → Note), delivery_method on items not orders
   - `src/components/DriverTaskSheet.vue` — no major changes yet
   - `src/views/driver/DriverDeliveries.vue` — fix delivery_method checks (now item-level)
   - `src/views/manager/order-columns.ts` — fix delivery_method column
   - `src/components/NotesSection.vue` — fix OrderNote references if needed
   - Any other files with errors

7. Run `npm run type-check` — must pass with ZERO errors
8. Run `npm run build` — must succeed
9. Manually verify the app still works with mock data (login, browse orders, open detail sheets)
```

---

## STEP 4 — Auth Store → Supabase Auth

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. Replace the mock auth system with Supabase Auth. This is the first store to swap to Supabase.

1. Rewrite `src/stores/auth.ts`:
   - Import supabase client from `@/lib/supabase`
   - State: currentUser (User | null), isAuthenticated, isLoading (new — for initial auth check)
   - Remove: import of mock users, password validation against mock data
   
   - `login(email, password)`:
     - Call `supabase.auth.signInWithPassword({ email, password })`
     - On success, fetch user profile: `supabase.from('users').select('*').eq('id', authUser.id).single()`
     - Set currentUser from the users table data
     - Return success/failure
   
   - `logout()`:
     - Call `supabase.auth.signOut()`
     - Clear currentUser
   
   - `init()` — NEW action, called on app startup:
     - Call `supabase.auth.getSession()` to check for existing session
     - If session exists, fetch user profile from users table
     - Set up `supabase.auth.onAuthStateChange()` listener to handle token refresh and session expiry
     - Set isLoading = false when done
   
   - Keep ALL existing getters unchanged: userRole, userShops, isManager, isPrintshopManager, isDriver, canAccessShop

2. Update `src/main.ts` (or App.vue):
   - On app mount, call `authStore.init()` to restore session
   - Show a loading state while auth is initializing (prevents flash of login page)

3. Update `src/views/LoginView.vue`:
   - Remove the hint text showing mock passwords (no longer relevant)
   - Keep the same UI, just make sure it calls the updated authStore.login()
   - Handle Supabase-specific errors (invalid credentials, network errors)

4. Update `src/router/index.ts`:
   - The auth guard should check `authStore.isLoading` — if still loading, wait for init to complete before redirecting to login
   - All other routing logic stays the same

5. Update `src/stores/drivers.ts`:
   - The driver session registration (`registerDriverSession`) is called on login — verify it still works
   - No other changes needed yet

6. Test:
   - Login with a Supabase user → should work
   - Refresh the page → session should persist (no re-login needed)
   - Logout → should clear session and redirect to login
   - Invalid credentials → should show error
   - Role-based routing → should still work (manager goes to /manager/orders, etc.)
   
Run `npm run type-check && npm run build`
```

---

## STEP 5 — Printshops Store → Supabase (Simplest Store)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. Swap the printshops store from mock data to Supabase. This is the simplest store — good first test of the pattern.

1. Rewrite `src/stores/printshops.ts`:
   - Import supabase from `@/lib/supabase`
   - Remove: import of mock printshops data
   
   - State: `printshops` ref starts as empty array `[]`
   
   - `fetchPrintshops()` — NEW action:
     - Call `supabase.from('printshops').select('*')`
     - Set printshops.value = data
     - Called once on app init
   
   - Keep ALL existing getters: allPrintshops, getPrintshopById, getPrintshopName
   - They already work off the reactive printshops ref, so they'll work with Supabase data
   
   - `init()` — NEW convenience action that calls fetchPrintshops()

2. Update app initialization (main.ts or App.vue):
   - After auth init, call `printshopStore.init()`
   - This must happen BEFORE other stores that depend on printshops (orders store uses printshop names)

3. The composable `src/composables/usePrintshops.ts` needs ZERO changes — it already wraps the store.

4. Test:
   - App loads → printshops dropdown shows "In House", "Victor", "Studio C" (from Supabase, not mock)
   - Assignment dialog works
   - Kanban board for printshop manager works

Run `npm run type-check && npm run build`
```

---

## STEP 6 — Customers Store → Supabase

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. Swap the customers store from mock data to Supabase.

1. Rewrite `src/stores/customers.ts`:
   - Import supabase from `@/lib/supabase`
   - Remove: import of mock customers data
   
   - State: `customers` ref starts as empty array `[]`
   
   - `fetchCustomers()`:
     - Call `supabase.from('customers').select('*').order('name')`
     - Set customers.value = data
   
   - `addCustomer(customerData)`:
     - Call `supabase.from('customers').insert({ ...customerData }).select().single()`
     - Push returned row to customers.value (optimistic: add to local state immediately)
     - Return the new customer
   
   - `updateCustomer(customerId, updates)`:
     - Call `supabase.from('customers').update(updates).eq('id', customerId).select().single()`
     - Update local state with returned data
     - Return updated customer
   
   - Keep ALL existing getters: allCustomers, getCustomerById, searchCustomers
   - `getCustomerOrderStats()` still computes from the orders store — no change
   
   - `init()` → calls fetchCustomers()

2. Update app initialization:
   - Call `customerStore.init()` after auth init

3. `src/composables/useCustomers.ts` needs ZERO changes.

4. Test:
   - Customer list loads from Supabase
   - Creating a new customer persists to database
   - Editing a customer updates the database
   - Customer search works
   - Order detail shows correct customer info

Run `npm run type-check && npm run build`
```

---

## STEP 7 — Orders + Order Items Store → Supabase (The Big One)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. This is the core store swap. The orders store manages both orders and order_items. Replace mock data with Supabase queries. Keep the computed ordersWithDetails working.

1. Rewrite `src/stores/orders.ts`:
   - Import supabase from `@/lib/supabase`
   - Remove: imports of mock orders, mock orderItems, mock orderFiles
   
   - State:
     - `orders` ref<Order[]> starts as `[]`
     - `orderItems` ref<OrderItem[]> starts as `[]`
     - `isLoading` ref<boolean> = true
   
   - `fetchOrders()`:
     - Call `supabase.from('orders').select('*').order('created_at', { ascending: false })`
     - Set orders.value = data
   
   - `fetchOrderItems()`:
     - Call `supabase.from('order_items').select('*').order('created_at', { ascending: false })`
     - Map the data: items come back WITHOUT status_history (lazy-loaded)
     - Set orderItems.value = data
   
   - `init()`:
     - isLoading = true
     - await Promise.all([fetchOrders(), fetchOrderItems()])
     - isLoading = false
     - Call setupRealtimeSubscriptions() (see below)
   
   - Keep `ordersWithDetails` computed EXACTLY as-is — it joins orders + customers + items in memory. This is fine for ~6-7 users with moderate data.
   
   - Keep `computeOrderStatus()` helper as-is.
   
   - MUTATION ACTIONS — each one now writes to Supabase then updates local state:
   
   - `updateItemStatus(itemId, newStatus)`:
     - Build update payload: { status: newStatus, updated_at: new Date().toISOString() }
     - Add auto-set dates: if in_production → production_start_date, if ready → production_ready_date, if delivered/picked_up → delivery_date
     - Call `supabase.from('order_items').update(payload).eq('id', itemId).select().single()`
     - Update local orderItems ref with returned data
     - Write to status_history table: `supabase.from('status_history').insert({ order_item_id: itemId, from_status: oldStatus, to_status: newStatus, changed_by: authStore.currentUser.id })`
     - Write activity: `supabase.from('activities').insert({ type: 'status_change', user_id, entity_type: 'order_item', entity_id: itemId, order_id, printshop_id, details: { message, from, to } })`
   
   - `updateItemPrintshop(itemId, newPrintshopId)`:
     - Call `supabase.from('order_items').update({ assigned_printshop: newPrintshopId, status: 'assigned' }).eq('id', itemId).select().single()`
     - Update local state
     - Write activity
   
   - `updateItemDueDate(itemId, newDueDate)`:
     - Call `supabase.from('order_items').update({ due_date: newDueDate }).eq('id', itemId)`
     - Update local state
   
   - `updateOrderPaymentStatus(orderId, newStatus)`:
     - Call `supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId)`
     - Update local state
   
   - `updateOrderPaymentMethod(orderId, newMethod)`:
     - Call `supabase.from('orders').update({ payment_method: newMethod }).eq('id', orderId)`
     - Update local state
   
   - `updateOrderSource(orderId, newSource)`:
     - Call `supabase.from('orders').update({ source: newSource }).eq('id', orderId)`
     - Update local state
   
   - `createOrder(orderData, itemsData)`:
     - Insert order: `supabase.from('orders').insert(orderData).select().single()`
     - Insert items: `supabase.from('order_items').insert(itemsData.map(i => ({ ...i, order_id: newOrder.id }))).select()`
     - Add to local state
     - Write activity (order_created)
     - Return new order
   
   - `filesCount(orderId)`:
     - For now, query supabase: `supabase.from('order_files').select('id', { count: 'exact' }).eq('entity_type', 'order_item').in('entity_id', itemIds).in('file_type', ['artwork', 'proof', 'reference'])`
     - OR keep a local cache and update via realtime. Start with a simple query.
   
   - REALTIME SUBSCRIPTIONS:
   
   - `setupRealtimeSubscriptions()`:
     ```typescript
     supabase.channel('orders-realtime')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
         if (payload.eventType === 'INSERT') {
           orders.value.unshift(payload.new as Order)
         } else if (payload.eventType === 'UPDATE') {
           const idx = orders.value.findIndex(o => o.id === payload.new.id)
           if (idx !== -1) orders.value[idx] = payload.new as Order
         } else if (payload.eventType === 'DELETE') {
           orders.value = orders.value.filter(o => o.id !== payload.old.id)
         }
       })
       .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
         if (payload.eventType === 'INSERT') {
           orderItems.value.push(payload.new as OrderItem)
         } else if (payload.eventType === 'UPDATE') {
           const idx = orderItems.value.findIndex(i => i.id === payload.new.id)
           if (idx !== -1) orderItems.value[idx] = payload.new as OrderItem
         } else if (payload.eventType === 'DELETE') {
           orderItems.value = orderItems.value.filter(i => i.id !== payload.old.id)
         }
       })
       .subscribe()
     ```
   
   - Store a reference to the channel so it can be cleaned up:
     ```typescript
     let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
     
     function cleanup() {
       if (realtimeChannel) {
         supabase.removeChannel(realtimeChannel)
         realtimeChannel = null
       }
     }
     ```

2. IMPORTANT: The `ordersWithDetails` computed will automatically recompute when orders.value or orderItems.value change (via realtime). This is the magic — Vue reactivity handles the live updates for free.

3. `src/composables/useOrders.ts` and `src/composables/useOrderItems.ts` need ZERO changes.

4. Update app initialization:
   - Call `orderStore.init()` after customers and printshops are loaded (orders depend on both for the computed join)

5. Test:
   - Orders list loads from Supabase
   - Order detail shows correct data
   - Changing item status persists and other browser tabs see the change (realtime!)
   - Assigning printshop works
   - Creating a new order works
   - Kanban board works for printshop manager
   - Driver delivery queue works

Run `npm run type-check && npm run build`
```

---

## STEP 8 — Notes Store (New — Polymorphic Notes Table)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (Section 7.1 — notes table). Create a new Pinia store for the polymorphic notes system and update the NotesSection component.

1. Create `src/stores/notes.ts`:
   - Import supabase from `@/lib/supabase`
   - Import Note type from `@/types`
   
   - State:
     - `notesByEntity` ref<Map<string, Note[]>> — keyed by `${entity_type}:${entity_id}`
     - `activeSubscriptions` ref<Set<string>> — track which entities we're subscribed to
   
   - `fetchNotes(entityType, entityId)`:
     - Build cache key: `${entityType}:${entityId}`
     - Call `supabase.from('notes').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false })`
     - Store in notesByEntity map
     - Return the notes
   
   - `subscribeToNotes(entityType, entityId)`:
     - If already subscribed, skip
     - Fetch initial notes
     - Set up realtime subscription:
       ```typescript
       supabase.channel(`notes:${entityType}:${entityId}`)
         .on('postgres_changes', {
           event: '*', schema: 'public', table: 'notes',
           filter: `entity_id=eq.${entityId}`
         }, (payload) => {
           // Handle INSERT, UPDATE, DELETE
           // Update the notesByEntity map
         })
         .subscribe()
       ```
     - Track in activeSubscriptions
   
   - `unsubscribeFromNotes(entityType, entityId)`:
     - Remove realtime channel
     - Remove from activeSubscriptions
   
   - `addNote(entityType, entityId, content, departments)`:
     - Insert: `supabase.from('notes').insert({ entity_type: entityType, entity_id: entityId, content, departments, created_by: authStore.currentUser.id }).select().single()`
     - Add to local notesByEntity (optimistic)
     - Write activity: `supabase.from('activities').insert({ type: 'note_added', ... })`
   
   - `updateNote(noteId, newContent)`:
     - Update: `supabase.from('notes').update({ content: newContent }).eq('id', noteId)`
     - Update local state
   
   - `deleteNote(noteId, entityType, entityId)`:
     - Delete: `supabase.from('notes').delete().eq('id', noteId)`
     - Remove from local state
   
   - `getNotesForEntity(entityType, entityId)`:
     - Return from notesByEntity map (computed getter)

2. Update `src/components/OrderDetailSheet.vue`:
   - Import and use the notes store instead of local ref<OrderNote[]> with hardcoded mock notes
   - On sheet open (when orderId changes): call `notesStore.subscribeToNotes('order', orderId)`
   - For item-level notes: `notesStore.fetchNotes('order_item', itemId)`
   - On sheet close: call `notesStore.unsubscribeFromNotes(...)`
   - Replace the local addNote/editNote/deleteNote handlers with notesStore actions
   - The NotesSection component props stay the same — just pass notesStore.getNotesForEntity() as the notes prop

3. Update `src/components/NewOrderSheet.vue`:
   - Notes for new orders are created AFTER the order is saved (need the order ID first)
   - Keep the local notes array during form editing
   - On order creation success, batch-insert all notes via notesStore

4. Update `src/components/DriverTaskSheet.vue`:
   - Same pattern as OrderDetailSheet but with entity_type = 'driver_task'
   - Notes are saved after task creation

5. `src/components/NotesSection.vue` needs MINIMAL changes:
   - It already receives notes as a prop and emits add-note/edit-note/delete-note
   - Just make sure the OrderNote → Note type alias works

6. Test:
   - Add a note to an order → persists to Supabase
   - Open the same order in another browser tab → note appears via realtime
   - Edit/delete notes → changes reflect everywhere
   - Notes on items work
   - Department filtering works

Run `npm run type-check && npm run build`
```

---

## STEP 9 — Activities Store → Supabase (Write-Once Event Log)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (Section 7.3 — Activity Feed). Replace the mock activities array with the real activities table.

1. Rewrite `src/stores/activities.ts`:
   - Import supabase from `@/lib/supabase`
   - Remove: import of mock activities
   
   - State:
     - `activities` ref<Activity[]> starts as `[]`
     - `seenIds` ref<Set<string>> — loaded from localStorage
     - `importantIds` ref<Set<string>> — loaded from localStorage
   
   - `init()`:
     - Fetch recent activities: `supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(100)`
     - Set activities.value = data
     - Load seenIds and importantIds from localStorage
     - Set up realtime subscription for new activities
   
   - Realtime subscription:
     ```typescript
     supabase.channel('activities-realtime')
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, (payload) => {
         activities.value.unshift(payload.new as Activity)
         // Play notification sound (keep existing logic)
       })
       .subscribe()
     ```
   
   - `addActivity(activityData)`:
     - Insert: `supabase.from('activities').insert(activityData)`
     - Note: local state updates via realtime subscription, no need to push manually
     - This is called by other stores (orders store calls it after status changes)
   
   - `toggleSeen(activityId)`:
     - Toggle in seenIds Set
     - Persist to localStorage
   
   - `toggleImportant(activityId)`:
     - Toggle in importantIds Set
     - Persist to localStorage
   
   - `getActivitiesForRole()`:
     - Same filtering logic as before, but adapted to new Activity shape
     - Manager: return all
     - Printshop Manager: filter by printshop_id matching user's shops, plus order_created
     - Driver: filter by delivery-related types and statuses
     - Use the `order_id` and `printshop_id` fields on activities for efficient filtering
   
   - `isSeen(activityId)` / `isImportant(activityId)`:
     - Check the Sets

2. Update `src/components/ActivityFeed.vue`:
   - Adapt to new Activity shape (no more activity.item, activity.order nested objects)
   - Use activity.details.message for display text
   - Use activity.entity_type + activity.entity_id for click navigation
   - Use activity.order_id to link to order detail
   - `seen` and `important` come from the store's Sets, not the activity object
   - Update the template bindings accordingly

3. Update activity creation in `src/stores/orders.ts`:
   - The `createActivity()` helper function needs to match the new Activity table schema
   - Remove the nested `item` and `order` objects
   - Use flat fields: entity_type, entity_id, order_id, printshop_id, details (jsonb)

4. Test:
   - Activity feed loads from Supabase
   - Changing an item status creates a new activity that appears in the feed
   - Another user's actions appear in the feed via realtime
   - Mark as seen/important persists in localStorage
   - Role-based filtering works (printshop manager doesn't see payment activities, etc.)

Run `npm run type-check && npm run build`
```

---

## STEP 10 — Driver Tasks Store (New)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (Section 7.1 — driver_tasks table). Create a Pinia store for driver tasks and wire up the DriverTaskSheet.

1. Create `src/stores/driver-tasks.ts`:
   - Import supabase from `@/lib/supabase`
   - Import DriverTask type from `@/types`
   
   - State:
     - `tasks` ref<DriverTask[]> starts as `[]`
   
   - `init()`:
     - Fetch tasks: `supabase.from('driver_tasks').select('*').order('created_at', { ascending: false })`
     - Set up realtime subscription (INSERT, UPDATE on driver_tasks)
   
   - `fetchTasksForDriver(userId)`:
     - `supabase.from('driver_tasks').select('*').eq('assigned_to', userId).order('created_at', { ascending: false })`
   
   - `createTask(taskData)`:
     - Insert: `supabase.from('driver_tasks').insert(taskData).select().single()`
     - Add to local state
     - Write activity (type: 'task_created')
     - Return new task
   
   - `updateTaskStatus(taskId, newStatus)`:
     - Update: `supabase.from('driver_tasks').update({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }).eq('id', taskId)`
     - Update local state
   
   - Getters:
     - `getTasksByDriver(userId)` — filtered from tasks
     - `getPendingTasks(userId)` — status = pending or in_progress

2. Update `src/components/DriverTaskSheet.vue`:
   - Replace `console.log` and `alert()` with actual store calls
   - On createTask(): call driverTaskStore.createTask() with proper data
   - The form stays the same, just wire the submit handler to the store
   - Notes for the task: after task creation, use notesStore to save any notes with entity_type='driver_task'

3. Update `src/stores/drivers.ts`:
   - When building route stops, include driver tasks from driverTaskStore
   - Tasks with status 'pending' and assigned to the current driver become route stops with type='task'

4. Test:
   - Create a driver task → persists to Supabase
   - Task appears in driver's queue
   - Task shows as a stop in route generation
   - Completing a task updates its status

Run `npm run type-check && npm run build`
```

---

## STEP 11 — File Uploads → Supabase Storage

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (Section 11 — File Handling). Replace mock file references with real Supabase Storage uploads.

1. Create `src/lib/file-service.ts` (utility functions for file operations):
   - `uploadFile(entityType, entityId, file: File, fileType, userId)`:
     - Generate storage path: `${entityType}/${entityId}/${Date.now()}-${file.name}`
     - Upload: `supabase.storage.from('files').upload(path, file)`
     - Get public URL: `supabase.storage.from('files').getPublicUrl(path)` (or use createSignedUrl for private)
     - Insert record: `supabase.from('order_files').insert({ entity_type: entityType, entity_id: entityId, file_url: path, file_name: file.name, file_type: fileType, uploaded_by: userId })`
     - Return the file record
   
   - `getFilesForEntity(entityType, entityId)`:
     - Query: `supabase.from('order_files').select('*').eq('entity_type', entityType).eq('entity_id', entityId)`
     - Return files
   
   - `deleteFile(fileId, filePath)`:
     - Delete from storage: `supabase.storage.from('files').remove([filePath])`
     - Delete record: `supabase.from('order_files').delete().eq('id', fileId)`
   
   - `getFileUrl(filePath)`:
     - For private bucket: `supabase.storage.from('files').createSignedUrl(filePath, 3600)` (1 hour expiry)
     - Return the URL

2. Update `src/components/OrderDetailSheet.vue`:
   - Replace mock files with real file queries
   - When sheet opens, fetch files for each item: `getFilesForEntity('order_item', itemId)`
   - Add file upload UI (drag-and-drop or file picker) if not already present
   - File downloads use getFileUrl()

3. Update `src/components/NewOrderSheet.vue`:
   - After order creation, upload any files that were attached during form editing
   - Use uploadFile() for each file with the correct entity_type and entity_id

4. Set up realtime for files:
   - Subscribe to order_files table changes
   - When a new file is uploaded by another user, it appears in the UI automatically

5. The `filesCount()` function in the orders store should query from order_files table (already set up in Step 7, but verify it works with real data)

6. Test:
   - Upload a file to an order item → appears in Supabase Storage
   - File record appears in order_files table
   - Download the file → works
   - Another user sees the file appear in their view
   - File count in orders table is correct

Run `npm run type-check && npm run build`
```

---

## STEP 12 — Status History (Lazy-Loaded)

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD (Section 7.1 — status_history table). Implement lazy-loaded status history from the separate table.

1. Add to `src/stores/orders.ts` (or create a small helper):
   - `fetchItemStatusHistory(itemId)`:
     - Query: `supabase.from('status_history').select('*, users:changed_by(name)').eq('order_item_id', itemId).order('created_at', { ascending: true })`
     - Map the data to StatusHistoryEntry format (convert users.name to changed_by display name)
     - Return the history array
   
   - This is NOT cached in the store — it's fetched on demand when a detail sheet opens

2. Update `src/components/OrderDetailSheet.vue`:
   - When showing an item's status history section, call `fetchItemStatusHistory(item.id)`
   - Use a local ref to store the loaded history
   - Show a loading spinner while fetching
   - Display the timeline as before

3. Update `src/components/ItemDetailSheet.vue` (if it exists):
   - Same pattern — lazy-load history when the sheet opens

4. The status_history INSERT already happens in updateItemStatus (Step 7). Verify it's working — check the table in Supabase after changing a status.

5. Test:
   - Open an item detail → history loads
   - Change status → new entry appears in history (after refresh or if subscribed)
   - History shows correct user names and timestamps

Run `npm run type-check && npm run build`
```

---

## STEP 13 — Remove Mock Data Dependencies

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. All stores now use Supabase. Clean up mock data imports and verify nothing depends on them at runtime.

1. Check every file in `src/stores/` — none should import from `@/data/mock/*`
   - auth.ts ✓ (uses Supabase Auth)
   - orders.ts ✓ (uses Supabase)
   - customers.ts ✓ (uses Supabase)
   - printshops.ts ✓ (uses Supabase)
   - activities.ts ✓ (uses Supabase)
   - drivers.ts — check if it still references mock data for route generation
   - notes.ts ✓ (uses Supabase)
   - driver-tasks.ts ✓ (uses Supabase)

2. Check that NO component imports from `@/data/mock/*` directly

3. The `src/data/mock/` directory can be kept for reference but should have no runtime imports.
   - Add a comment at the top of each mock file: `// DEPRECATED: Phase 1 mock data. Not imported at runtime. Kept for reference.`
   - Or move the entire directory to `src/data/mock-archive/` to make it clear

4. Verify the app initialization order in main.ts / App.vue:
   ```
   1. authStore.init() — restore session
   2. If authenticated:
      a. printshopStore.init()
      b. customerStore.init()
      c. orderStore.init() — depends on customers + printshops
      d. activityStore.init()
      e. driverTaskStore.init() — if user is driver or manager
   ```

5. Run a full clean test:
   - `npm run type-check` — zero errors
   - `npm run build` — succeeds
   - Full user flow test:
     a. Login as manager → create an order → assign printshop → see activity
     b. Login as printshop manager (different browser) → see the assigned item → change status → see it update in manager's view
     c. Login as driver → see ready items → start route → complete deliveries
     d. Verify notes, files, and activities work across all roles
     e. Verify realtime: change something in one browser, see it update in the other WITHOUT refresh
```

---

## STEP 14 — App Init Loading State

### Claude Code Instruction:

```
Read CLAUDE.md and MASTER.MD. Add a proper loading state while the app initializes all stores from Supabase.

1. Create a composable or update App.vue to handle init sequence:
   - Show a full-screen loading spinner (or the Kroma logo with a spinner) while stores are initializing
   - The init sequence:
     ```typescript
     const isAppReady = ref(false)
     
     async function initApp() {
       try {
         await authStore.init()
         
         if (authStore.isAuthenticated) {
           await Promise.all([
             printshopStore.init(),
             customerStore.init(),
           ])
           await orderStore.init() // depends on the above
           
           // These can be parallel
           await Promise.all([
             activityStore.init(),
             driverTaskStore.init(),
           ])
         }
       } finally {
         isAppReady.value = true
       }
     }
     ```
   - Only show the router-view when isAppReady is true
   - If not authenticated, router guard handles redirect to login (no data loading needed)

2. Add error handling:
   - If Supabase is unreachable, show a friendly error: "Cannot connect to server. Please check your connection."
   - Add a retry button

3. Test:
   - Fresh load → see loading state → app renders with data
   - Slow connection → loading state stays visible until data arrives
   - Supabase down → error message shows

Run `npm run type-check && npm run build`
```

---

## Post-Integration Checklist

After all steps are complete, verify:

- [ ] Auth: Login, logout, session persistence, role-based routing
- [ ] Orders: CRUD, status changes, payment updates, source changes
- [ ] Items: Status changes, printshop assignment, due dates, delivery method
- [ ] Customers: CRUD, search, order stats
- [ ] Notes: CRUD on orders, items, and driver tasks. Department filtering.
- [ ] Activities: Feed loads, new activities appear via realtime, role filtering
- [ ] Files: Upload, download, delete. File count in orders table.
- [ ] Driver Tasks: CRUD, appears in route generation
- [ ] Status History: Lazy-loaded in detail sheets
- [ ] Realtime: Change in one browser → updates in another WITHOUT refresh
- [ ] Printshop Manager: Sees only their shop's items, kanban works
- [ ] Driver: Delivery queue, route generation, stop completion
- [ ] Loading states: App init, individual data fetches
- [ ] Error handling: Network failures show user-friendly messages
- [ ] No mock data imports at runtime

---

## Architecture After Integration

```
Browser ──→ Vue Components (unchanged)
                │
                ↓
            Composables (unchanged, thin wrappers)
                │
                ↓
            Pinia Stores (CHANGED — Supabase client instead of mock arrays)
                │
                ├──→ supabase.from('table').select/insert/update/delete
                ├──→ supabase.channel().on('postgres_changes').subscribe()
                └──→ supabase.storage.from('files').upload/download
                         │
                         ↓
                    Supabase (Postgres + Realtime + Storage + Auth)
```

The beauty of this architecture: components and composables are completely unaware of Supabase. If you ever switch backends, only the store internals change.