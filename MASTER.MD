# KROMA — Master Specification

> **Codename:** Kroma
> **Purpose:** Centralized order management + logistics hub for a print shop operation with 3 printshop locations.
> **Stack:** Vue 3, Shadcn-vue, Pinia, Supabase (Postgres, Auth, Storage, Realtime), Vercel

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

### 2.1 Manager
- Can also act as a Printshop Manager
- Scoped to all shops (full visibility)
- **Can:** See all orders, create manual orders, assign printshop to items, manage payment status, see full order lifecycle, cancel items
- **Cannot:** Optimize delivery routes

### 2.2 Printshop Manager
- Scoped to one or more specific shops (e.g., Victor only, or In House + Studio C)
- **Can:** See items assigned to their shop(s), manage production statuses, cancel items, mark items as picked up
- **Cannot:** See all orders, assign printshops, create orders, manage payment, deliver

### 2.3 Driver
- No shop scoping
- **Can:** See orders ready for delivery, optimize routes via Google Maps, mark items as out_for_delivery/delivered/picked_up
- **Cannot:** See all orders, manage production, manage payment, cancel items, create orders

### 2.4 Permission Matrix

| Action                  | Manager | Printshop Manager | Driver |
|-------------------------|---------|-------------------|--------|
| See all orders          | ✅      | ❌                | ❌     |
| See their shop's items  | ✅      | ✅                | ❌     |
| See ready-for-delivery  | ✅      | ❌                | ✅     |
| Assign printshop        | ✅      | ❌                | ❌     |
| Manage payment status   | ✅      | ❌                | ❌     |
| Create manual order     | ✅      | ❌                | ❌     |
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

Each order has a delivery method:

| Method              | Flow                                         |
|---------------------|----------------------------------------------|
| `delivery`          | `ready` → `out_for_delivery` → `delivered`   |
| `customer_pickup`   | `ready` → `picked_up`                        |

- **`delivery`** orders appear in the Driver's queue when all items are `ready`
- **`customer_pickup`** orders never appear in the Driver's queue
- Any role (Manager, Printshop Manager, Driver) can mark `picked_up`

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
- Manager sets source and payment status manually

### 6.4 Customer Matching
- On ingestion, match customer by email
- If no match, create a new customer record
- Managers can merge duplicate customers later

---

## 7. Data Model

### 7.1 Tables

#### `customers`
| Column      | Type     | Notes                              |
|-------------|----------|------------------------------------|
| id          | uuid     | PK                                 |
| name        | text     | Full name                          |
| email       | text     | Unique, used for matching          |
| phone       | text     |                                    |
| company     | text     | Nullable                           |
| address     | text     | Delivery address                   |
| lat         | decimal  | For route optimization             |
| lng         | decimal  | For route optimization             |
| notes       | text     |                                    |
| created_at  | timestamp|                                    |
| updated_at  | timestamp|                                    |

#### `orders`
| Column            | Type     | Notes                                          |
|-------------------|----------|-------------------------------------------------|
| id                | uuid     | PK                                              |
| customer_id       | uuid     | FK → customers                                  |
| source            | enum     | `impression_quebec`, `promo_flash`, `propaganda`, `sticker_pusher`, `studio_c`, `other` |
| external_id       | text     | Shopify order ID or external ref. Nullable       |
| delivery_method   | enum     | `delivery`, `customer_pickup`                    |
| payment_status    | enum     | `paid`, `unpaid`, `partial`                      |
| payment_method    | enum     | `shopify`, `cash`, `cheque`, `etransfer`, `invoice`, `other` |
| amount_total      | decimal  |                                                  |
| amount_paid       | decimal  |                                                  |
| notes             | text     |                                                  |
| created_at        | timestamp|                                                  |
| updated_at        | timestamp|                                                  |

**Computed fields (not stored on orders):**
- `files_count` — computed from `order_files` via items
- `comments_count` — computed from notes/comments related to the order
- `statusRollup` — derived from item statuses (see Section 14)

#### `order_items`
| Column              | Type     | Notes                                          |
|---------------------|----------|-------------------------------------------------|
| id                  | uuid     | PK                                              |
| order_id            | uuid     | FK → orders                                     |
| product_name        | text     |                                                  |
| description         | text     | Specs, size, material, etc.                      |
| quantity            | integer  |                                                  |
| specs               | jsonb    | Flexible field for print specs                   |
| assigned_printshop  | uuid     | FK → printshops. Nullable until assigned         |
| status              | enum     | See Section 3.1                                  |
| notes               | text     |                                                  |
| due_date            | date     | Nullable. Set at order creation, editable by Manager |
| production_start_date | timestamp | Nullable. Auto-set when status → `in_production` |
| production_ready_date | timestamp | Nullable. Auto-set when status → `ready`       |
| delivery_date       | timestamp | Nullable. Auto-set when driver marks `delivered` |
| created_at          | timestamp |                                                 |
| updated_at          | timestamp |                                                 |

**Key clarifications:**
- `due_date` = internal production deadline, set when order is created, editable
- `delivery_date` = actual timestamp when the driver marked this item as `delivered`. Lives on the item (not the order) because items in the same order can be delivered at different times.

#### `order_files`
| Column         | Type     | Notes                                          |
|----------------|----------|-------------------------------------------------|
| id             | uuid     | PK                                              |
| order_item_id  | uuid     | FK → order_items                                 |
| file_url       | text     | Supabase Storage URL                             |
| file_name      | text     | Original filename                                |
| file_type      | enum     | `artwork`, `proof`, `reference`, `other`         |
| uploaded_by    | uuid     | FK → users. Nullable for auto-ingested files     |
| created_at     | timestamp|                                                  |

#### `printshops`
| Column      | Type     | Notes                              |
|-------------|----------|------------------------------------|
| id          | uuid     | PK                                 |
| name        | text     | e.g., "In House", "Victor", "Studio C" |
| address     | text     |                                    |
| lat         | decimal  | For route optimization             |
| lng         | decimal  | For route optimization             |

Current printshops: **In House**, **Victor**, **Studio C**. More may be added later.

#### `users`
| Column            | Type     | Notes                                          |
|-------------------|----------|-------------------------------------------------|
| id                | uuid     | PK, matches Supabase Auth user ID               |
| name              | text     |                                                  |
| email             | text     |                                                  |
| role              | enum     | `manager`, `printshop_manager`, `driver`         |
| assigned_shops    | uuid[]   | Array of printshop IDs. Empty for manager/driver |
| created_at        | timestamp|                                                  |
| updated_at        | timestamp|                                                  |

**Phase 1 mock users:**

| Email              | Name    | Role              | Assigned Shops | Password |
|--------------------|---------|-------------------|----------------|----------|
| manager@kroma.com  | Manager | manager           | [] (all access)| 1234     |
| victor@kroma.com   | Victor  | printshop_manager | ['victor']     | 1234     |
| driver@kroma.com   | Driver  | driver            | []             | 1234     |

#### `status_history`
| Column         | Type     | Notes                                          |
|----------------|----------|-------------------------------------------------|
| id             | uuid     | PK                                              |
| order_item_id  | uuid     | FK → order_items                                 |
| from_status    | enum     | Previous status. Nullable for first entry        |
| to_status      | enum     | New status                                       |
| changed_by     | uuid     | FK → users                                       |
| notes          | text     | Optional reason                                  |
| created_at     | timestamp|                                                  |

**Phase 1 note:** Status history is embedded as an array on `order_items` in mock data. In Phase 2 (Supabase), it becomes a separate table.

#### `deliveries` (Phase 4)
| Column         | Type     | Notes                                          |
|----------------|----------|-------------------------------------------------|
| id             | uuid     | PK                                              |
| driver_id      | uuid     | FK → users                                       |
| date           | date     |                                                  |
| status         | enum     | `planned`, `in_progress`, `completed`            |
| optimized_route| jsonb    | Google Maps response data                        |
| created_at     | timestamp|                                                  |
| updated_at     | timestamp|                                                  |

#### `delivery_stops` (Phase 4)
| Column         | Type     | Notes                                          |
|----------------|----------|-------------------------------------------------|
| id             | uuid     | PK                                              |
| delivery_id    | uuid     | FK → deliveries                                  |
| order_id       | uuid     | FK → orders                                      |
| type           | enum     | `pickup`, `dropoff`                              |
| printshop_id   | uuid     | FK → printshops. For pickup stops only           |
| address        | text     |                                                  |
| lat            | decimal  |                                                  |
| lng            | decimal  |                                                  |
| sequence_order | integer  | Position in optimized route                      |
| status         | enum     | `pending`, `completed`                           |
| created_at     | timestamp|                                                  |
| updated_at     | timestamp|                                                  |

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
                           │
order_items (1) ───< (N) order_files
                           │
                           ├── order_item_id → order_items.id
                           │
order_items (1) ───< (N) status_history
                           │
                           ├── order_item_id → order_items.id
                           ├── changed_by → users.id
                           │
printshops (1) ────< (N) order_items        (via assigned_printshop)

users ──── role + assigned_shops[]
  │
  └──< deliveries ──< delivery_stops        (Phase 4)
```

### 7.3 Activity Feed

The activity feed is **not a separate table**. It is computed/derived from all system events:
- Status changes (from `status_history`)
- New orders created
- New notes added to orders/items
- Printshop assignments
- Deliveries and pickups

In Phase 1, a mock activities array is used for UI development. In Phase 2+, the activity feed will be a computed view across `status_history`, orders, and notes.

---

## 8. Views Per Role

### 8.1 Manager Dashboard
- **Order Queue** — All orders, filterable by status, source, printshop, date, payment status
- **Order Detail** — Full view: customer, items, files, payment, status history
- **Order Review** — Assign items to printshops, update payment, change statuses
- **Manual Order Entry** — Full form to create orders (search/create customer, add items, upload files)
- **Customer Management** — Customer list, profiles, order history, merge duplicates
- **Overview/Stats** — Order counts, production status breakdown, revenue (optional)

### 8.2 Printshop Manager Dashboard
- **Production Queue** — Items assigned to their shop(s), filterable by status
- **Suggested view:** Kanban board with columns: `assigned` → `in_production` → `on_hold` → `ready`
- **Item Detail** — Product info, specs, files, notes. NO payment info
- **Mark `picked_up`** — For customer pickup orders

### 8.3 Driver Dashboard (Mobile-First)
- **Delivery Queue** — Orders where ALL items are `ready` AND delivery method is `delivery`
- **Route Planner** — Select orders for a delivery run, Google Maps optimizes the route
- **Route View** — Ordered stop list (pickups at shops, then dropoffs to customers)
- **Stop Completion** — Tap to mark each stop as completed
- **Mark `picked_up`** — For customer pickup orders (if driver is at a shop)

---

## 9. Route Optimization Logic

- Driver selects which orders to include in a delivery run
- Kroma computes stops: **pickups** at printshop locations + **dropoffs** at customer addresses
- Constraint: pickups must happen before their related dropoffs
- Uses **Google Directions API** with `optimizeWaypoints` (supports up to 25 waypoints)
- Route accounts for all printshop locations as potential starting/intermediate points
- Driver follows the optimized sequence and marks stops as completed

---

## 10. Webhook Integrations

### 10.1 Inbound — Shopify Webhooks
- **Endpoint:** `/api/ingest/shopify`
- **Events:** `orders/create`, `orders/updated`
- **Auth:** Webhook secret per store (HMAC verification)
- **Action:** Normalize payload → upsert order + items + files → match/create customer

### 10.2 Inbound — Web Form Submissions
- **Endpoint:** `/api/ingest/webform`
- **Auth:** API key or shared secret
- **Action:** Normalize payload → create order + items → match/create customer

### 10.3 Outbound — Billing Webhook
- **Trigger:** Item status changes to `ready`
- **Fires:** Per item, not per order
- **Payload:** Order details, item details, customer info, payment status, amounts
- **Destination:** TBD (external billing app, configurable URL)
- **Retry logic:** TBD

---

## 11. File Handling

- All order files are stored in **Supabase Storage**
- Shopify files are downloaded during ingestion and stored in Supabase
- Manual orders: Manager uploads files directly
- Web form orders: Files are received and stored during ingestion
- Files are linked to specific **order items** (not just orders) via `order_files` table
- File types: `artwork`, `proof`, `reference`, `other`

---

## 12. Realtime Updates

- Uses **Supabase Realtime** subscriptions
- Manager dashboard updates live when new orders arrive
- Printshop Manager queue updates when items are assigned to their shop
- Driver queue updates when items become `ready`
- Status changes are reflected in real-time across all connected clients

---

## 13. Build Phases

### Phase 1 — UI Foundation (Mock Data) ← CURRENT
- Vue 3 + Shadcn-vue + Pinia project scaffolding
- Mock data layer (`/data/mock`) with JSON/JS objects for all entities
- Data service layer (Pinia stores + composables) abstracting data access
- Mock auth with login screen (3 test accounts, no Supabase)
- **Manager views:**
  - Order list (table + kanban, filterable by status, source, payment)
  - Order detail (customer, items, files, payment, status)
  - Manual order entry form
  - Printshop assignment flow
  - Customer list and detail
- **Printshop Manager views:**
  - Production queue (Kanban: assigned → in_production → on_hold → ready)
  - Item detail with status controls
- **Driver views:**
  - Delivery queue (orders ready for delivery)
  - Route view (static, no Google Maps yet)
  - Stop completion UI

### Phase 2 — Supabase Integration
- Supabase project setup (database, auth, storage)
- Migrate mock data schema to real Postgres tables
- Replace data service internals to use Supabase client (stores swap from mock to Supabase, composable/component APIs unchanged)
- Real auth flow (login, signup, password reset)
- RLS policies for role-based access
- File upload to Supabase Storage
- Supabase Realtime subscriptions for live updates

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
- RLS policies enforce role-based data access

### Supabase RLS Policy Guidelines
- **Manager:** Full read access to all tables. Write access based on permission matrix.
- **Printshop Manager:** Read/write only on `order_items` where `assigned_printshop` is in their `assigned_shops`. No access to payment fields.
- **Driver:** Read only on orders where all items are `ready` and `delivery_method = 'delivery'`. Write access to delivery-related statuses only.

### Vercel Deployment
- Vue 3 SPA deployed on Vercel
- Serverless functions for webhook endpoints (`/api/ingest/shopify`, `/api/ingest/webform`)
- Google Maps API key stored server-side in Vercel environment variables
- Billing webhook outbound calls made from serverless functions

### Order-Level Status Rollup
Since tracking is at the item level, the order's "effective status" is derived:
- Order is `new` if any item is `new`
- Order is `in_production` if any item is `assigned` or `in_production`
- Order is `ready` if ALL non-canceled items are `ready`
- Order is `delivered` / `picked_up` if ALL non-canceled items are in a terminal state
- Order is `canceled` if ALL items are `canceled`

### Project Structure (Post-Refactor Target)

```
src/
├── types/                      ← Standalone type definitions (survive Supabase migration)
│   ├── index.ts                   Barrel re-export
│   ├── customer.ts
│   ├── order.ts
│   ├── order-item.ts
│   ├── order-file.ts
│   ├── printshop.ts
│   ├── user.ts
│   ├── activity.ts
│   └── note.ts
├── lib/                        ← Shared utilities
│   ├── formatters.ts              Domain formatters (dates, statuses, currency)
│   ├── variants.ts                Badge/color variant mappings
│   ├── constants.ts               Filter options, kanban columns, enums
│   └── utils.ts                   General helpers (cn, etc.)
├── stores/                     ← Pinia stores (single source of truth)
│   ├── auth.ts
│   ├── orders.ts
│   ├── customers.ts
│   └── activities.ts
├── composables/                ← Thin wrappers around stores
│   ├── useOrders.ts
│   ├── useOrderItems.ts
│   ├── useCustomers.ts
│   └── useToast.ts
├── data/mock/                  ← Mock data (Phase 1 only, data arrays, no types)
│   ├── orders.ts
│   ├── order-items.ts
│   ├── order-files.ts
│   ├── customers.ts
│   ├── printshops.ts
│   ├── users.ts
│   └── activities.ts
├── components/
│   ├── ui/                        Primitives (Button, Badge, Card, Sheet, etc.)
│   ├── AppLayout.vue              Top nav (role-aware)
│   ├── DataTable.vue              Generic TanStack table
│   ├── StatsCards.vue             Config-driven stat cards
│   ├── OrderFilters.vue           Reusable filter bar
│   ├── KanbanBoard.vue            Reusable kanban with drag/drop
│   ├── KanbanCard.vue             Single kanban card
│   ├── OrderExpandedRow.vue       Expanded row for table view
│   ├── StatsSheet.vue             Drill-down sheet for stats
│   ├── AssignmentDialog.vue       Confirmation dialog
│   ├── ItemControls.vue           Reusable item editing (status, printshop, dates)
│   ├── NotesSection.vue           Reusable notes CRUD
│   ├── OrderDetailSheet.vue       Order detail slide-out
│   ├── NewOrderSheet.vue          Manual order creation
│   ├── DriverTaskSheet.vue        Ad-hoc driver tasks
│   ├── ActivityFeed.vue           Right sidebar feed
│   └── ItemStatusCombobox.vue     Status dropdown
├── views/
│   ├── LoginView.vue              Login screen
│   ├── manager/
│   │   ├── ManagerOrders.vue      Orchestration only (~300 lines)
│   │   ├── ManagerCustomers.vue
│   │   └── order-columns.ts       TanStack column defs (callback pattern)
│   ├── printshop/
│   │   └── PrintshopQueue.vue     Kanban production queue
│   └── driver/
│       └── DriverDeliveries.vue   Delivery queue + route
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
- [ ] Comments/notes table structure (currently embedded, needs formal schema for Phase 2)