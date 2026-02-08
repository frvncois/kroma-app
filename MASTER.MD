# KROMA — Master Specification

> **Codename:** Kroma
> **Purpose:** Centralized order management + logistics hub for a print shop operation with 2 physical locations.
> **Stack:** Vue 3, Shadcn-vue, Supabase (Postgres, Auth, Storage, Realtime), Vercel

---

## 1. Business Context

The client operates **2 print shops** (Shop A and Shop B). Orders come in from multiple channels. Kroma centralizes all orders into one system where employees manage production and drivers handle deliveries.

### Order Sources
- **Shopify** — 3 separate Shopify stores (Store A, Store B, Store C)
- **Custom web forms** — on external websites
- **Manual entry** — phone or email orders entered by a Manager in Kroma

---

## 2. Roles & Permissions

There are 3 roles. Each user has exactly one role.

### 2.1 Manager
- Can also act as a Printshop Manager
- Scoped to: Shop A, Shop B, or Shop A+B
- **Can:** See all orders, create manual orders, assign printshop to items, manage payment status, see full order lifecycle, cancel items
- **Cannot:** Optimize delivery routes

### 2.2 Printshop Manager
- Scoped to: Shop A, Shop B, or Shop A+B
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

### 3.4 Billing Webhook
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
- 3 Shopify stores, each with its own webhook configuration
- Shopify fires `orders/create` and `orders/updated` webhooks → Kroma Vercel API endpoint
- Each store has its own webhook secret for verification
- Kroma normalizes the Shopify payload into internal schema
- Files attached to Shopify orders are downloaded and stored in Supabase Storage
- Orders arrive with `source: shopify_a | shopify_b | shopify_c`
- Orders arrive with `payment_status: paid`

### 6.2 Custom Web Forms
- External websites POST to `/api/ingest/webform`
- Kroma normalizes into internal schema
- Orders arrive with `source: webform`
- Orders arrive with `payment_status: unpaid` (default)

### 6.3 Manual Entry
- Manager fills out order form in Kroma UI
- Full control over all fields
- Orders arrive with `source: manual`
- Manager sets payment status manually

### 6.4 Customer Matching
- On ingestion, match customer by email
- If no match, create a new customer record
- Managers can merge duplicate customers later

---

## 7. Data Model (High-Level)

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
| source            | enum     | `shopify_a`, `shopify_b`, `shopify_c`, `webform`, `manual` |
| external_id       | text     | Shopify order ID or external ref. Nullable       |
| delivery_method   | enum     | `delivery`, `customer_pickup`                    |
| payment_status    | enum     | `paid`, `unpaid`, `partial`                      |
| payment_method    | enum     | `shopify`, `cash`, `cheque`, `etransfer`, `invoice`, `other` |
| amount_total      | decimal  |                                                  |
| amount_paid       | decimal  |                                                  |
| notes             | text     |                                                  |
| created_at        | timestamp|                                                  |
| updated_at        | timestamp|                                                  |

#### `order_items`
| Column            | Type     | Notes                                          |
|-------------------|----------|-------------------------------------------------|
| id                | uuid     | PK                                              |
| order_id          | uuid     | FK → orders                                     |
| product_name      | text     |                                                  |
| description       | text     | Specs, size, material, etc.                      |
| quantity           | integer  |                                                  |
| specs             | jsonb    | Flexible field for print specs                   |
| assigned_printshop| uuid     | FK → printshops. Nullable until assigned         |
| status            | enum     | See Section 3.1                                  |
| notes             | text     |                                                  |
| created_at        | timestamp|                                                  |
| updated_at        | timestamp|                                                  |

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
| name        | text     | e.g. "Shop A", "Shop B"           |
| address     | text     |                                    |
| lat         | decimal  | For route optimization             |
| lng         | decimal  | For route optimization             |

#### `users`
| Column            | Type     | Notes                                          |
|-------------------|----------|-------------------------------------------------|
| id                | uuid     | PK, matches Supabase Auth user ID               |
| name              | text     |                                                  |
| email             | text     |                                                  |
| role              | enum     | `manager`, `printshop_manager`, `driver`         |
| assigned_shops    | uuid[]   | Array of printshop IDs. Nullable for drivers     |
| created_at        | timestamp|                                                  |
| updated_at        | timestamp|                                                  |

#### `deliveries`
| Column         | Type     | Notes                                          |
|----------------|----------|-------------------------------------------------|
| id             | uuid     | PK                                              |
| driver_id      | uuid     | FK → users                                       |
| date           | date     |                                                  |
| status         | enum     | `planned`, `in_progress`, `completed`            |
| optimized_route| jsonb    | Google Maps response data                        |
| created_at     | timestamp|                                                  |
| updated_at     | timestamp|                                                  |

#### `delivery_stops`
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
- Kroma computes stops: **pickups** at Shop A and/or Shop B + **dropoffs** at customer addresses
- Constraint: pickups must happen before their related dropoffs
- Uses **Google Directions API** with `optimizeWaypoints` (supports up to 25 waypoints)
- Route accounts for both printshop locations as potential starting/intermediate points
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
- Files are linked to specific order items (not just orders)
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

### Phase 1 — UI Foundation (Mock Data)
- Vue 3 + Shadcn-vue project scaffolding
- Mock data layer (`/data/mock`) with JSON/JS objects for all entities
- Data service layer (`useOrders()`, `useCustomers()`, etc.) abstracting data access
- Fake auth (role switcher to test Manager / Printshop Manager / Driver views)
- **Manager views:**
  - Order list (filterable by status, source, payment)
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
- Replace data service internals to use Supabase client
- Real auth flow (login, signup, password reset)
- RLS policies for role-based access
- File upload to Supabase Storage
- Supabase Realtime subscriptions for live updates

### Phase 3 — Ingestion
- Shopify webhook receiver (all 3 stores)
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

---

## 15. Open Items / TBD

- [ ] External billing app (webhook destination URL and payload format)
- [ ] Billing webhook retry logic and failure handling
- [ ] Shopify file attachment method (app, order notes, or separate upload)
- [ ] Notification system (email/SMS on status changes) — future phase
- [ ] Customer-facing portal — future phase
- [ ] Shopify status sync-back (update Shopify when Kroma status changes) — future phase
- [ ] Proof approval workflow (customer approves proof before production) — future phase