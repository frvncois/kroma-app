# KROMA — Master Specification

> **Codename:** Kroma
> **Purpose:** Centralized order management + logistics hub for a print shop operation with 3 printshop locations.
> **Stack:** Vue 3, Shadcn-vue, Pinia, Supabase (Postgres, Auth, Storage, Realtime), Vercel
> **Context:** Internal tool for ~6-7 concurrent users. Not publicly accessible. No sensitive data.

---

## 1. Business Context

The client operates **3 print shops** (In House, Victor, Studio C — more may be added later). Orders come in from multiple channels. Kroma centralizes all orders into one system where employees manage production and drivers handle deliveries.

### Order Sources (Branded Store Names)
- **Impression Québec** (`impression_quebec`) — Shopify store
- **Promo Flash** (`promo_flash`) — Shopify store
- **Propaganda** (`propaganda`) — Shopify store
- **Sticker Pusher** (`sticker_pusher`) — Shopify store
- **Studio C** (`studio_c`) — Shopify store
- **Other** (`other`) — Custom web forms, manual entry, or other channels

---

## 2. Roles & Permissions

There are 3 roles. Each user has exactly one role.

### 2.1 Manager (General Manager)
- Can also act as a Printshop Manager
- Scoped to all shops (full visibility)
- **Can:** See all orders, create manual orders, assign printshop to items, assign items to driver, manage payment status, see full order lifecycle, cancel items, create/edit customers, create driver tasks, add notes to orders and items
- **Cannot:** Optimize delivery routes

### 2.2 Printshop Manager
- Scoped to one or more specific shops (e.g., Victor only, or In House + Studio C)
- **Can:** See items assigned to their shop(s), change status on items, add notes to orders and items, cancel items, mark items as picked up
- **Cannot:** See all orders, assign printshops, create orders, manage payment, deliver

### 2.3 Driver
- No shop scoping
- **Can:** See orders ready for delivery, change status on items, add notes to items, add photos to items/tasks, create driver tasks, optimize routes via AI, mark items as out_for_delivery/delivered/picked_up
- **Cannot:** See all orders, manage production, manage payment, cancel items, create orders

### 2.4 Permission Matrix

| Action                  | Manager | Printshop Manager | Driver |
|-------------------------|---------|-------------------|--------|
| See all orders          | ✅      | ❌                | ❌     |
| See their shop's items  | ✅      | ✅                | ❌     |
| See ready-for-delivery  | ✅      | ❌                | ✅     |
| Assign printshop        | ✅      | ❌                | ❌     |
| Assign items to driver  | ✅      | ❌                | ❌     |
| Manage payment status   | ✅      | ❌                | ❌     |
| Create manual order     | ✅      | ❌                | ❌     |
| Create/edit customer    | ✅      | ❌                | ❌     |
| Create driver tasks     | ✅      | ❌                | ✅     |
| Add notes to orders     | ✅      | ✅                | ❌     |
| Add notes to items      | ✅      | ✅                | ✅     |
| Add photos to items     | ✅      | ❌                | ✅     |
| Set `assigned`          | ✅      | ❌                | ❌     |
| Set `in_production`     | ✅      | ✅                | ❌     |
| Set `on_hold`           | ✅      | ✅                | ❌     |
| Set `ready`             | ✅      | ✅                | ❌     |
| Set `out_for_delivery`  | ✅      | ❌                | ✅     |
| Set `delivered`         | ✅      | ❌                | ✅     |
| Set `picked_up`         | ✅      | ✅                | ✅     |
| Set `canceled`          | ✅      | ✅                | ❌     |
| Route optimization      | ❌      | ❌                | ✅     |

---

## 3. Item Status Flow

**CRITICAL: Tracking is at the ITEM level, not the order level.** A single order can contain items assigned to different printshops, each with independent statuses. The order-level status is a rollup of its items.

### 3.1 Statuses

| Status              | Description                                      |
|---------------------|--------------------------------------------------|
| `new`               | Just ingested, not yet reviewed                  |
| `assigned`          | Manager assigned a printshop, not yet in production |
| `in_production`     | Printshop is actively working on it              |
| `on_hold`           | Paused — needs follow-up or info                 |
| `ready`             | Production complete, waiting for delivery/pickup |
| `out_for_delivery`  | On the truck, driver is delivering               |
| `delivered`         | ✅ Terminal — delivered to customer               |
| `picked_up`         | ✅ Terminal — customer picked up at shop          |
| `canceled`          | ✅ Terminal — item was canceled                   |

### 3.2 Status Flow Diagram

```
new → assigned → in_production → ready ──┬──→ out_for_delivery → delivered
                      ↕             │    │          ↕
                    on_hold         │    │        on_hold
                      ↓             │    │          ↓
                   canceled         │    │       canceled
                                    │    │
                                    │    └──→ picked_up
                                    │
                                    └──→ [billing webhook fires]
```

### 3.3 Terminal States
Every item ends in one of: **`delivered`**, **`picked_up`**, or **`canceled`**.

### 3.4 Auto-Set Dates on Status Change
- When status → `in_production`: auto-set `production_start_date` to now
- When status → `ready`: auto-set `production_ready_date` to now
- When status → `delivered`: auto-set `delivery_date` to now (on the item)
- When status → `picked_up`: auto-set `delivery_date` to now (on the item)

### 3.5 Billing Webhook
- Fires **per item** when status changes to `ready`
- Sends order + item + customer data to an external billing app (TBD)
- Payload must include payment status so billing app knows if already paid

---

## 4. Payment Tracking

**Payment is a Manager-only concern.** Printshop Managers and Drivers never see payment information.

### 4.1 Payment Fields on Order

| Field              | Type     | Description                                      |
|--------------------|----------|--------------------------------------------------|
| `payment_status`   | enum     | `paid`, `unpaid`, `partial`                      |
| `payment_method`   | enum     | `shopify`, `cash`, `cheque`, `etransfer`, `invoice`, `other` |
| `amount_total`     | decimal  | Total order amount                               |
| `amount_paid`      | decimal  | Amount collected so far                          |

### 4.2 Payment Rules
- **Shopify orders** → arrive as `paid` (Shopify collected payment)
- **Manual / web form orders** → arrive as `unpaid` by default
- Manager can update payment status at any time
- Payment does NOT block production or delivery — unpaid orders flow through the full pipeline
- Driver does not collect payment and does not see payment info

---

## 5. Delivery Method

**Delivery method is per-item, not per-order.** This allows split fulfillment — some items in an order delivered, others picked up by the customer.

| Method              | Flow                                         |
|---------------------|----------------------------------------------|
| `delivery`          | `ready` → `out_for_delivery` → `delivered`   |
| `customer_pickup`   | `ready` → `picked_up`                        |

- Items with `delivery_method = 'delivery'` appear in the Driver's queue when status is `ready`
- Items with `delivery_method = 'customer_pickup'` never appear in the Driver's queue
- Any role (Manager, Printshop Manager, Driver) can mark `picked_up`
- Order-level delivery display is a computed rollup: if all items are `delivery` → show delivery. All `customer_pickup` → show pickup. Mixed → show both.

---

## 6. Order Ingestion

### 6.1 Shopify Webhooks
- Multiple Shopify stores, each with its own webhook configuration
- Shopify fires `orders/create` and `orders/updated` webhooks → Kroma Vercel API endpoint
- Each store has its own webhook secret for verification
- Kroma normalizes the Shopify payload into internal schema
- Files attached to Shopify orders are downloaded and stored in Supabase Storage
- Orders arrive with `source` set to the branded store name (e.g., `impression_quebec`, `promo_flash`)
- Orders arrive with `payment_status: paid`

### 6.2 Custom Web Forms
- External websites POST to `/api/ingest/webform`
- Kroma normalizes into internal schema
- Orders arrive with `source: other`
- Orders arrive with `payment_status: unpaid` (default)

### 6.3 Manual Entry
- Manager fills out order form in Kroma UI
- Full control over all fields
- Manager sets source, payment status, and delivery method per item manually

### 6.4 Customer Matching
- On ingestion, match customer by email
- If no match, create a new customer record
- Managers can merge duplicate customers later

---

## 7. Data Model

### 7.1 Tables

#### `customers`
| Column      | Type        | Notes                              |
|-------------|-------------|------------------------------------|
| id          | uuid        | PK                                 |
| name        | text        | Full name                          |
| email       | text        | Unique, used for matching          |
| phone       | text        |                                    |
| company     | text        | Nullable                           |
| address     | text        | Delivery address                   |
| lat         | decimal     | For route optimization             |
| lng         | decimal     | For route optimization             |
| notes       | text        | Static customer notes              |
| created_at  | timestamptz |                                    |
| updated_at  | timestamptz |                                    |

#### `orders`
| Column            | Type        | Notes                                          |
|-------------------|-------------|-------------------------------------------------|
| id                | uuid        | PK                                              |
| customer_id       | uuid        | FK → customers                                  |
| source            | enum        | `impression_quebec`, `promo_flash`, `propaganda`, `sticker_pusher`, `studio_c`, `other` |
| external_id       | text        | Shopify order ID or external ref. Nullable       |
| payment_status    | enum        | `paid`, `unpaid`, `partial`                      |
| payment_method    | enum        | `shopify`, `cash`, `cheque`, `etransfer`, `invoice`, `other` |
| amount_total      | decimal     |                                                  |
| amount_paid       | decimal     |                                                  |
| internal_notes    | text        | Static manager notes (e.g., "COD - collect on delivery"). Not part of collaborative notes system. |
| created_at        | timestamptz |                                                  |
| updated_at        | timestamptz |                                                  |

**Computed fields (not stored on orders):**
- `files_count` — computed from `order_files` where `entity_type = 'order_item'` and `file_type` in (artwork, proof, reference) across all items in the order
- `notes_count` — computed from `notes` table where `entity_type` in (order, order_item) related to this order
- `statusRollup` — derived from item statuses (see Section 14)
- `deliveryMethodRollup` — derived from item delivery methods

#### `order_items`
| Column              | Type        | Notes                                          |
|---------------------|-------------|-------------------------------------------------|
| id                  | uuid        | PK                                              |
| order_id            | uuid        | FK → orders                                     |
| product_name        | text        |                                                  |
| description         | text        | Specs, size, material, etc.                      |
| quantity            | integer     |                                                  |
| specs               | jsonb       | Flexible field for print specs                   |
| assigned_printshop  | uuid        | FK → printshops. Nullable until assigned         |
| status              | enum        | See Section 3.1                                  |
| delivery_method     | enum        | `delivery`, `customer_pickup`. Default: `delivery` |
| notes               | text        | Legacy field — collaborative notes go through `notes` table |
| due_date            | date        | Nullable. Set at order creation, editable by Manager |
| production_start_date | timestamptz | Nullable. Auto-set when status → `in_production` |
| production_ready_date | timestamptz | Nullable. Auto-set when status → `ready`       |
| delivery_date       | timestamptz | Nullable. Auto-set when driver marks `delivered` or `picked_up` |
| created_at          | timestamptz |                                                 |
| updated_at          | timestamptz |                                                 |

**Key clarifications:**
- `due_date` = internal production deadline, set when order is created, editable
- `delivery_date` = actual timestamp when the driver marked this item as `delivered` or `picked_up`. Lives on the item (not the order) because items in the same order can be delivered at different times.
- `delivery_method` = per-item, enabling split fulfillment within a single order

#### `order_files` (extended — also covers driver photos)
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| entity_type    | enum        | `order_item`, `driver_task`                      |
| entity_id      | uuid        | Polymorphic FK to the parent entity              |
| file_url       | text        | Supabase Storage path                            |
| file_name      | text        | Original filename                                |
| file_type      | enum        | `artwork`, `proof`, `reference`, `delivery_photo`, `issue_photo`, `other` |
| uploaded_by    | uuid        | FK → users. Required.                            |
| created_at     | timestamptz |                                                  |

**File type semantics:**
- `artwork`, `proof`, `reference` = production files (uploaded by manager or ingested from Shopify)
- `delivery_photo`, `issue_photo` = captured by driver at delivery stops
- Production file count in the orders table = only artwork/proof/reference (not delivery photos)

#### `notes` (polymorphic — orders, items, driver tasks)
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| entity_type    | enum        | `order`, `order_item`, `driver_task`             |
| entity_id      | uuid        | Polymorphic FK to the parent entity              |
| content        | text        | Note content (supports @mentions and /mentions)  |
| departments    | enum[]      | `printshop`, `delivery`, `billing`, `everyone`. Default: `{everyone}` |
| created_by     | uuid        | FK → users. Required.                            |
| created_at     | timestamptz |                                                  |
| updated_at     | timestamptz |                                                  |

**Notes design:**
- If a note is about a specific item → `entity_type = 'order_item'`, `entity_id` = item ID
- If a note is about the whole order → `entity_type = 'order'`, `entity_id` = order ID
- If a note is on a driver task → `entity_type = 'driver_task'`, `entity_id` = task ID
- No `item_reference` field — target entities directly via `entity_type/entity_id`
- Departments control visibility filtering (e.g., printshop managers see notes tagged `printshop` or `everyone`)

#### `activities` (write-once event log)
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| type           | enum        | `status_change`, `note_added`, `delivery`, `pickup`, `assignment`, `order_created`, `alert`, `task_created` |
| user_id        | uuid        | FK → users. Who performed the action.            |
| entity_type    | enum        | `order`, `order_item`, `driver_task`             |
| entity_id      | uuid        | What entity was affected                         |
| order_id       | uuid        | FK → orders. Nullable. For quick order-level filtering. |
| printshop_id   | uuid        | FK → printshops. Nullable. For quick shop-level filtering. |
| details        | jsonb       | Flexible payload: message, from, to, note, alert info, etc. |
| created_at     | timestamptz |                                                  |

**Activity design:**
- Every mutation that matters writes an activity row (write-once, never updated)
- Single Supabase Realtime subscription for the feed
- `seen` and `important` are NOT stored on activities — these are per-user client-side state (localStorage)
- Role scoping is computed at read time in the frontend (same logic as `getActivitiesForRole()`)

#### `status_history`
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| order_item_id  | uuid        | FK → order_items                                 |
| from_status    | enum        | Previous status. Nullable for first entry        |
| to_status      | enum        | New status                                       |
| changed_by     | uuid        | FK → users                                       |
| note           | text        | Optional reason                                  |
| created_at     | timestamptz |                                                  |

**Loading strategy:** Lazy-loaded on demand. Items load WITHOUT history by default. When a user opens the detail sheet, a separate query fetches `status_history` for that item. This keeps list queries fast and realtime payloads small.

**Phase 1 note:** Status history is embedded as an array on `order_items` in mock data. In Phase 2 (Supabase), it becomes this separate table.

#### `driver_tasks`
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| created_by     | uuid        | FK → users. Required.                            |
| assigned_to    | uuid        | FK → users. Required (always assigned to a specific driver). |
| title          | text        |                                                  |
| type           | enum        | `pickup`, `dropoff`, `errand`, `other`           |
| priority       | enum        | `low`, `medium`, `high`, `urgent`                |
| details        | text        |                                                  |
| address        | text        | Required.                                        |
| lat            | decimal     | For route optimization                           |
| lng            | decimal     | For route optimization                           |
| complete_by    | timestamptz | Deadline                                         |
| status         | enum        | `pending`, `in_progress`, `completed`, `canceled` |
| completed_at   | timestamptz | Nullable. Set when status → completed.           |
| created_at     | timestamptz |                                                  |
| updated_at     | timestamptz |                                                  |

**Driver task design:**
- Both Manager and Driver can create tasks, but `assigned_to` is always required
- Tasks appear as route stops (`type: 'task'`) in the driver route system
- Notes on tasks go through the polymorphic `notes` table (`entity_type: 'driver_task'`)
- Photos on tasks go through `order_files` (`entity_type: 'driver_task'`)

#### `printshops`
| Column      | Type        | Notes                              |
|-------------|-------------|------------------------------------|
| id          | uuid        | PK                                 |
| name        | text        | e.g., "In House", "Victor", "Studio C" |
| address     | text        |                                    |
| lat         | decimal     | For route optimization             |
| lng         | decimal     | For route optimization             |

Current printshops: **In House**, **Victor**, **Studio C**. More may be added later.

#### `users`
| Column            | Type        | Notes                                          |
|-------------------|-------------|-------------------------------------------------|
| id                | uuid        | PK, matches Supabase Auth user ID               |
| name              | text        |                                                  |
| email             | text        | Unique                                           |
| role              | enum        | `manager`, `printshop_manager`, `driver`         |
| assigned_shops    | uuid[]      | Array of printshop IDs. Empty for manager/driver |
| created_at        | timestamptz |                                                  |
| updated_at        | timestamptz |                                                  |

**Phase 1 mock users:**

| Email              | Name           | Role              | Assigned Shops | Password |
|--------------------|----------------|-------------------|----------------|----------|
| manager@example.com| Manager        | manager             | [] (all access)| 1234     |
| victor@example.com | Victor         | printshop_manager   | ['victor']     | 1234     |
| driver@example.com | Drivery         | driver             | []             | 1234     |

#### `deliveries` (Phase 4)
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| driver_id      | uuid        | FK → users                                       |
| date           | date        |                                                  |
| status         | enum        | `planned`, `in_progress`, `completed`            |
| optimized_route| jsonb       | Google Maps response data                        |
| created_at     | timestamptz |                                                  |
| updated_at     | timestamptz |                                                  |

#### `delivery_stops` (Phase 4)
| Column         | Type        | Notes                                          |
|----------------|-------------|-------------------------------------------------|
| id             | uuid        | PK                                              |
| delivery_id    | uuid        | FK → deliveries                                  |
| order_id       | uuid        | FK → orders                                      |
| type           | enum        | `pickup`, `dropoff`                              |
| printshop_id   | uuid        | FK → printshops. For pickup stops only           |
| address        | text        |                                                  |
| lat            | decimal     |                                                  |
| lng            | decimal     |                                                  |
| sequence_order | integer     | Position in optimized route                      |
| status         | enum        | `pending`, `completed`                           |
| created_at     | timestamptz |                                                  |
| updated_at     | timestamptz |                                                  |

### 7.2 Relationship Map

```
customers (1) ──────< (N) orders
                           │
                           ├── customer_id → customers.id
                           │
orders (1) ────────< (N) order_items
                           │
                           ├── order_id → orders.id
                           ├── assigned_printshop → printshops.id (nullable)
                           ├── delivery_method (per item)
                           │
order_items (1) ───< (N) order_files     (via entity_type='order_item', entity_id)
order_items (1) ───< (N) notes           (via entity_type='order_item', entity_id)
order_items (1) ───< (N) status_history  (via order_item_id)
                           │
orders (1) ────────< (N) notes           (via entity_type='order', entity_id)
                           │
printshops (1) ────< (N) order_items     (via assigned_printshop)
                           │
users ──── role + assigned_shops[]
  │
  ├──< driver_tasks          (via assigned_to / created_by)
  │       │
  │       ├──< order_files   (via entity_type='driver_task', entity_id)
  │       └──< notes         (via entity_type='driver_task', entity_id)
  │
  └──< activities             (via user_id)
  │
  └──< deliveries ──< delivery_stops   (Phase 4)
```

### 7.3 Activity Feed

The activity feed is a **write-once event log** stored in the `activities` table. Every significant mutation writes an activity row.

**Activity types:**
- `status_change` — Item status changed
- `note_added` — Note added to order/item/task
- `delivery` — Item out for delivery or delivered
- `pickup` — Item picked up
- `assignment` — Item assigned to printshop
- `order_created` — New order created
- `alert` — System alert (overdue, stuck, etc.)
- `task_created` — Driver task created

**Realtime:** Single Supabase Realtime subscription on the `activities` table. All clients receive all inserts and filter by role in the frontend.

**Per-user state:** `seen` and `important` flags are stored client-side (localStorage), not on the activity row. This avoids per-user state in a shared table.

#### Activity Scoping by Role

The activity feed is filtered based on the current user's role:
- **Manager:** Sees all activities across the system
- **Printshop Manager:** Sees activities for items assigned to their shop(s), plus new order notifications
- **Driver:** Sees delivery/pickup activities, status changes to/from delivery-related statuses (ready, out_for_delivery, delivered, picked_up), assignment notifications, and new order notifications

Scoping is computed at read time in the frontend based on the activity's metadata (order_id, printshop_id, entity assignment, activity type). No separate scope field is stored — this keeps the data model clean and allows dynamic recomputation when items are reassigned.

---

## 8. Views Per Role

### 8.1 Manager Dashboard
- **Order Queue** — All orders, filterable by status, source, printshop, date, payment status
- **Order Detail** — Full view: customer, items, files, payment, status history
- **Order Review** — Assign items to printshops, update payment, change statuses
- **Manual Order Entry** — Full form to create orders (search/create customer, add items with per-item delivery method, upload files)
- **Customer Management** — Customer table with search, inline stats (total, active, new this month). Customer detail sheet shows profile info + full order history with clickable orders. Dual-sheet interaction: customer detail on right, order detail on left. New customer creation via sheet form.
- **Overview/Stats** — Order counts, production status breakdown, revenue (optional)

### 8.2 Printshop Manager Dashboard
- **Production Queue** — Items assigned to their shop(s), filterable by status
- **Suggested view:** Kanban board with columns: `assigned` → `in_production` → `on_hold` → `ready`
- **Item Detail** — Product info, specs, files, notes. NO payment info
- **Mark `picked_up`** — For customer pickup items

### 8.3 Driver Dashboard (Mobile-First)
- **Delivery Queue** — Shows ALL deliverable items (status `ready` or `out_for_delivery`, `delivery_method = 'delivery'`) grouped by priority:
  - 🔴 Overdue
  - 🟠 Due Today
  - 🟡 Due Tomorrow
  - ⚪ Upcoming & Unscheduled
- **AI-Generated Route** — Driver inputs shift end time (e.g., 17:00), AI generates optimized route with pickups and dropoffs
- **Live Route Map** — Mapbox GL map showing completed/current/upcoming stops with color-coded markers and road-following route lines
- **Real-Time New Item Detection** — Watcher detects new ready items during active route, prompts driver to recalculate with new stops added
- **Item Transfer Between Active Drivers** — Transfer items/stops to other active drivers when needed (e.g., route overflow, shift end)
- **Route View** — Ordered stop list with status indicators (pending, current, completed). Shows estimated arrival times, stop durations, and AI notes
- **Stop Completion** — Tap to mark each stop as completed. Pickup stops auto-lock items (prevents unassignment)
- **Mark `picked_up`** — For customer pickup items (if driver is at a shop)
- **Driver Tasks** — Ad-hoc tasks with notes and photos
- **Delivery History** — Table view of completed deliveries (delivered, picked_up, canceled). Search by product, order, customer. Read-only archive.

---

## 9. AI-Powered Route Optimization (OpenAI)

### 9.1 Overview

Kroma uses **OpenAI (gpt-4o)** to generate optimized delivery routes with shift time awareness. The AI system replaces manual order selection with intelligent route planning that considers time constraints, distances, stop priorities, and operational rules.

**Home Base (Montréal):** 4641 Av. Papineau, Montréal, QC H2H 1V3

### 9.2 Route Generation Flow

1. **Driver starts route:**
   - Clicks "Start Route" button in DriverDeliveries view
   - System detects all deliverable items (status `ready` or `out_for_delivery`, `delivery_method = 'delivery'`)
   - StartRouteDialog prompts for shift end time (presets: 15:00, 16:00, 17:00, 18:00, or custom)
   - System builds stops: pickups at printshops + dropoffs at customer addresses
   - System calls `generateRoute()` in `src/lib/route-service.ts` with stop inputs and shift end time

2. **OpenAI generates route:**
   - Builds structured prompt with Montréal-specific context (home base, stop details, constraints, shift duration)
   - Calls `gpt-4o` with temperature 0.2 for consistent, deterministic routing
   - AI returns optimized stop sequence with estimated times, durations, distances, notes, and warnings
   - Response includes `stopsOverCapacity` count for stops that may not fit in shift

3. **Route activation:**
   - Driver store creates `DriverRoute` object with enriched stops
   - All relevant items marked as `out_for_delivery`
   - Items assigned to current driver (prevents other drivers from seeing them)
   - Route UI shows optimized stop sequence with status indicators

### 9.3 Key Routing Rules

**Enforced by AI:**
- Home base (4641 Av. Papineau) must be first stop
- All pickups before their related dropoffs
- Time-aware prioritization (overdue items get priority)
- Realistic stop durations (5-10 min pickup, 10-15 min dropoff)
- Distance and drive time optimization for Montréal geography
- Stops beyond shift capacity flagged with warnings

**Stop Structure:**
- **Type:** `pickup` (at printshop) or `dropoff` (at customer) or `task` (ad-hoc driver task)
- **Status:** `pending` → `current` → `completed`
- **Locked items:** Items physically picked up cannot be unassigned (prevents inventory loss)
- **Metadata:** Estimated arrival time, duration, notes, photos, issue flags, cancellation

### 9.4 Mid-Route Updates

When new items become `ready` during an active route:
- System detects new deliverable items via watcher (realtime subscription on `order_items`)
- Shows notification: "New deliveries available. Recalculate route to add them?"
- Driver confirms recalculation
- System calls `recalculateRoute()` (NOT `generateRoute()`)
- **Preserves completed stops** — only re-optimizes pending stops + new items
- Driver route updates seamlessly with new stops inserted

### 9.5 Multi-Driver Coordination

Multiple drivers can be active simultaneously with item assignment isolation:

**Active Driver Sessions:**
- Login auto-registers driver session (via `driverStore.registerDriverSession()`)
- Logout auto-unregisters session
- Active drivers tracked in `driverStore.activeSessions`

**Item Assignment Rules:**
- Items assigned to driver when route starts (on `out_for_delivery` transition)
- Other drivers cannot see assigned items in their deliverable queue
- Filter logic: `!driverStore.isItemAssignedToOtherDriver(item.id)`

**Transfer Between Drivers:**
- TransferDialog shows other active drivers with status (On Route / Available)
- Driver can transfer items to another active driver
- Locked (picked-up) items can only be transferred (cannot be unassigned)
- Transfer updates item assignment and removes stops from source driver's route

---

## 10. Mapbox Route Visualization

The driver route view includes a live Mapbox GL map showing the full route with color-coded stops and road-following lines.

**Component:** `RouteMap.vue` — self-contained map

**Map elements:**
- 🏠 Home base marker (dark circle with house icon) at 4641 Av. Papineau
- ✅ Completed stops — green pins with checkmark
- 📍 Current stop — large blue pulsing pin with sequence number
- ⚪ Upcoming stops — gray pins with sequence numbers
- 🚫 Cancelled stops — red pins with X

**Route lines:**
- Solid green line — completed segments (thicker, 5px)
- Solid blue line — current segment (to active stop, 6px)
- Dashed gray line — upcoming segments (4px, dashed)

**Line rendering:**
- Lines follow actual roads via Mapbox Directions API (`/directions/v5/mapbox/driving/`)
- Supports up to 25 waypoints per request (chunks larger routes)
- Graceful fallback to straight lines if API blocked

**Token:** `VITE_MAPBOX_TOKEN` in `.env`

**Interaction:**
- Click marker → popup with stop info (name, address, ETA, status)
- Click stop in sidebar → map flies to that stop
- Auto-fits bounds to show all markers on initial render

---

## 11. File Handling

- All files are stored in **Supabase Storage** in a single private bucket (`files`)
- Storage path convention: `{entity_type}/{entity_id}/{filename}`
- Shopify files are downloaded during ingestion and stored in Supabase
- Manual orders: Manager uploads files directly
- Web form orders: Files are received and stored during ingestion
- Files are linked to entities via the `order_files` table with polymorphic `entity_type` + `entity_id`
- **Production files** (artwork, proof, reference) → linked to `order_item`
- **Driver photos** (delivery_photo, issue_photo) → linked to `order_item` or `driver_task`
- File count displayed in orders table = production files only (not delivery photos)

---

## 12. Realtime Updates

Uses **Supabase Realtime** subscriptions. With ~6-7 concurrent users, all clients subscribe to all changes and filter by role in the frontend. No per-shop or per-driver channel sharding needed.

**Tables with Realtime enabled:**

| Table         | Events              | Purpose                                    |
|---------------|---------------------|--------------------------------------------|
| orders        | INSERT, UPDATE      | New orders, payment updates                |
| order_items   | INSERT, UPDATE      | Status changes, assignments, new items     |
| notes         | INSERT, UPDATE, DELETE | Collaborative notes                     |
| activities    | INSERT              | Activity feed                              |
| driver_tasks  | INSERT, UPDATE      | Task assignments, status changes           |
| order_files   | INSERT, DELETE      | File uploads, deletions                    |

**How it works:**
- Manager dashboard updates live when new orders arrive
- Printshop Manager queue updates when items are assigned to their shop
- Driver queue updates when items become `ready`
- Status changes are reflected in real-time across all connected clients
- Notes appear instantly for all users viewing the same order/item
- New driver tasks appear in the assigned driver's queue immediately

**Frontend pattern:** Supabase Realtime pushes changes → Pinia store updates reactive state → Vue computed properties recompute → UI updates automatically. The `computeOrderStatus()` rollup recomputes client-side when item statuses change.

---

## 13. Build Phases

### Phase 1 — UI Foundation (Mock Data) ✅ COMPLETE
- Vue 3 + Shadcn-vue + Pinia project scaffolding
- Mock data layer (`/data/mock`) with JSON/JS objects for all entities
- Data service layer (Pinia stores + composables) abstracting data access
- Mock auth with login screen (test accounts, no Supabase)
- Manager views: Order list (table + kanban), order detail, manual order entry, printshop assignment, customer management
- Printshop Manager views: Production queue (kanban), item detail with status controls
- Driver views: Delivery queue, AI route generation, live route map, stop completion, delivery history

### Phase 2 — Supabase Integration ← NEXT
- Supabase project setup (database, auth, storage)
- Run `supabase-schema.sql` to create all tables, enums, indexes, triggers
- Replace Pinia store internals to use Supabase client (composable/component APIs unchanged)
- Real auth flow (email/password login via Supabase Auth)
- Minimal RLS: `auth.uid() IS NOT NULL` on all tables (role enforcement is frontend-only)
- File upload to Supabase Storage (single private `files` bucket)
- Supabase Realtime subscriptions for live updates on all key tables
- Migrate notes system to polymorphic `notes` table
- Implement `driver_tasks` persistence
- Implement `activities` as write-once event log
- Switch `status_history` from embedded arrays to lazy-loaded separate table

### Phase 3 — Ingestion
- Shopify webhook receiver (all stores)
- Shopify payload normalization
- Shopify file download + storage
- Web form API endpoint
- Customer matching/dedup on ingestion

### Phase 4 — Delivery & Route Optimization
- Google Maps API integration
- Route optimization (Directions API with waypoint optimization)
- Pickup/dropoff sequencing with constraints
- Live route view for driver
- Stop completion tracking

### Phase 5 — Billing & Polish
- Outbound billing webhook at `ready` status
- Dashboard analytics / overview stats
- Customer management (merge, search, history)
- Notifications (optional)
- Shopify status sync-back (optional)

---

## 14. Technical Notes

### Supabase Auth
- Users authenticate via Supabase Auth (email/password)
- Role and shop scoping stored in `users` table
- No complex RLS — single policy per table: `auth.uid() IS NOT NULL`
- Role enforcement handled entirely in the frontend (trusted internal users)

### Supabase RLS Approach
This is an internal app with ~6-7 trusted users. RLS is minimal — just prevents unauthenticated access. The frontend hides options based on role (e.g., drivers can't see payment fields, printshop managers only see their items). This is "dumb-proof" protection, not security.

### Vercel Deployment
- Vue 3 SPA deployed on Vercel
- Serverless functions for webhook endpoints (`/api/ingest/shopify`, `/api/ingest/webform`)
- Google Maps API key stored server-side in Vercel environment variables
- Billing webhook outbound calls made from serverless functions
- OpenAI API key moves from client-side `.env` to serverless function in Phase 2+

### Order-Level Status Rollup
Since tracking is at the item level, the order's "effective status" is derived:
- Order is `new` if any item is `new`
- Order is `in_production` if any item is `assigned` or `in_production`
- Order is `ready` if ALL non-canceled items are `ready`
- Order is `delivered` / `picked_up` if ALL non-canceled items are in a terminal state
- Order is `canceled` if ALL items are `canceled`

### Order-Level Delivery Method Rollup
Since delivery method is per-item, the order's display value is derived:
- All items `delivery` → show `delivery`
- All items `customer_pickup` → show `customer_pickup`
- Mixed → show `mixed` (both icons)

### Storage
- Single private bucket: `files`
- Path convention: `{entity_type}/{entity_id}/{filename}`
- Authenticated users can upload, read, delete. No public access.

### Project Structure

```
src/
├── types/                      ← Standalone type definitions (survive Supabase migration)
│   ├── index.ts                   Barrel re-export
│   ├── customer.ts
│   ├── order.ts                   OrderSource, PaymentStatus, PaymentMethod, Order
│   ├── order-item.ts              ItemStatus, DeliveryMethod, StatusHistoryEntry, OrderItem
│   ├── order-file.ts              FileType, FileEntityType, OrderFile
│   ├── printshop.ts               Printshop
│   ├── user.ts                    UserRole, User
│   ├── activity.ts                Activity types
│   ├── note.ts                    NoteEntityType, NoteDepartment, Note
│   └── driver-task.ts             DriverTask types
├── lib/                        ← Shared utilities (no component dependencies)
│   ├── formatters.ts              Domain formatters (dates, statuses, currency)
│   ├── variants.ts                Badge/color variant mappings
│   ├── constants.ts               Filter options, kanban columns, domain enums
│   ├── route-service.ts           OpenAI route generation & recalculation
│   └── utils.ts                   General helpers (cn, etc.)
├── stores/                     ← Pinia stores (single source of truth)
│   ├── auth.ts                    currentUser, login/logout, role getters
│   ├── orders.ts                  orders + orderItems state, mutations, computed joins
│   ├── customers.ts               customers state
│   ├── printshops.ts              printshops state
│   ├── drivers.ts                 Active drivers, routes, assignments, locked items
│   └── activities.ts              activity feed state
├── composables/                ← Thin wrappers around stores (stable API for components)
│   ├── useOrders.ts
│   ├── useOrderItems.ts
│   ├── useCustomers.ts
│   ├── usePrintshops.ts
│   └── useToast.ts
├── data/mock/                  ← Mock data arrays only (Phase 1, no type definitions)
│   ├── orders.ts
│   ├── order-items.ts
│   ├── order-files.ts
│   ├── customers.ts
│   ├── printshops.ts
│   ├── users.ts
│   └── activities.ts
├── components/
│   ├── ui/                        Primitives (Button, Badge, Card, Sheet, Dialog, etc.)
│   ├── AppLayout.vue              Top nav (role-aware)
│   ├── DataTable.vue              Generic TanStack table
│   ├── StatsCards.vue             Config-driven stat cards
│   ├── OrderFilters.vue           Reusable filter bar
│   ├── KanbanBoard.vue            Reusable kanban with drag/drop
│   ├── KanbanCard.vue             Single kanban card
│   ├── OrderExpandedRow.vue       Expanded row for table view
│   ├── StatsSheet.vue             Drill-down sheet for stats
│   ├── AssignmentDialog.vue       Confirmation dialog
│   ├── StartRouteDialog.vue       Shift end time input for route generation
│   ├── TransferDialog.vue         Transfer items between active drivers
│   ├── ItemControls.vue           Reusable item editing (status, printshop, dates)
│   ├── NotesSection.vue           Reusable notes CRUD
│   ├── OrderDetailSheet.vue       Order detail slide-out
│   ├── NewOrderSheet.vue          Manual order creation
│   ├── DriverTaskSheet.vue        Ad-hoc driver tasks
│   ├── ActivityFeed.vue           Right sidebar feed
│   ├── ItemStatusCombobox.vue     Status dropdown
│   └── RouteMap.vue               Mapbox GL route visualization
├── views/
│   ├── LoginView.vue              Login screen
│   ├── manager/
│   │   ├── ManagerOrders.vue      Orchestration only (~300 lines)
│   │   ├── ManagerCustomers.vue
│   │   └── order-columns.ts       TanStack column defs (callback pattern)
│   ├── printshop/
│   │   └── PrintshopQueue.vue     Kanban production queue
│   └── driver/
│       ├── DriverDeliveries.vue   AI-powered delivery queue + route
│       └── DriverArchives.vue     Delivery history archives
└── router/index.ts                Role-aware routing with auth guards
```

### Data Service Layer Pattern
- **Pinia stores** are the single source of truth for all state
- **Composables** (`useOrders()`, `useCustomers()`, etc.) are thin wrappers providing a stable API
- Phase 1: Stores load from `/data/mock`
- Phase 2: Stores swap to Supabase client — composable and component APIs unchanged
- Components never import from `/data/mock` directly

---

## 15. Open Items / TBD

- [ ] External billing app (webhook destination URL and payload format)
- [ ] Billing webhook retry logic and failure handling
- [ ] Shopify file attachment method (app, order notes, or separate upload)
- [ ] Notification system (email/SMS on status changes) — future phase
- [ ] Customer-facing portal — future phase
- [ ] Shopify status sync-back (update Shopify when Kroma status changes) — future phase
- [ ] Proof approval workflow (customer approves proof before production) — future phase
- [ ] Geocoding addresses to lat/lng for route optimization (Phase 4)