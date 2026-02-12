# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kroma** is a centralized order management and logistics hub for a print shop operation with **3 printshop locations** (In House, Victor, Studio C — more may be added). The system manages orders from multiple channels, production workflow across print shops, and delivery route optimization.

**Stack:** Vue 3, TypeScript, Pinia, Vue Router, Shadcn-vue, TanStack Table, Radix Vue, Tailwind CSS, Vite

**Future stack (Phase 2+):** Supabase (Postgres, Auth, Storage, Realtime), Vercel

## Common Commands

```bash
# Install dependencies
npm install

# Run development server with hot-reload
npm run dev

# Type-check TypeScript
npm run type-check

# Build for production (includes type-checking)
npm run build

# Preview production build
npm run preview
```

## Architecture & Key Concepts

### Item-Level Tracking (CRITICAL)

Tracking is at the **ITEM level**, not order level. A single order can contain multiple items assigned to different printshops, each with independent statuses. The order-level status is a rollup of its items.

### Item Status Flow

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

Terminal states: `delivered`, `picked_up`, `canceled`

**Auto-set dates on status change:**
- Status → `in_production`: auto-set `production_start_date`
- Status → `ready`: auto-set `production_ready_date`
- Status → `delivered`: auto-set `delivery_date` (on the item, not the order)

### Three User Roles

1. **Manager** — Sees all orders, assigns printshops, manages payment, creates manual orders
2. **Printshop Manager** — Sees only items assigned to their shop(s), manages production statuses
3. **Driver** — Sees orders ready for delivery, optimizes routes, marks delivery statuses

Refer to the permission matrix in MASTER.MD Section 2.4 for detailed role capabilities.

### Order Sources (Branded Store Names)

- `impression_quebec` — Impression Québec (Shopify store, arrives `paid`)
- `promo_flash` — Promo Flash (Shopify store, arrives `paid`)
- `propaganda` — Propaganda (Shopify store, arrives `paid`)
- `sticker_pusher` — Sticker Pusher (Shopify store, arrives `paid`)
- `studio_c` — Studio C (Shopify store, arrives `paid`)
- `other` — Web forms, manual entry, or other channels

### Delivery Methods

- `delivery` — Goes through driver route optimization (ready → out_for_delivery → delivered)
- `customer_pickup` — Customer picks up at shop (ready → picked_up)

### Payment Tracking

Manager-only concern. Fields: `payment_status` (paid/unpaid/partial), `payment_method`, `amount_total`, `amount_paid`. Payment does NOT block production or delivery flow.

## Data Model

### Core Tables

- `customers` — Customer records with delivery addresses and geocoding (lat/lng)
- `orders` — Order header with customer_id, source, delivery_method, payment fields. **No** `files_count`, `comments_count`, or `delivery_date` — these are computed
- `order_items` — Individual items with product details, assigned_printshop, status. Includes `due_date` (set at creation, editable), `production_start_date`, `production_ready_date`, `delivery_date` (auto-set timestamps)
- `order_files` — Files attached to specific items (stored in Supabase Storage)
- `printshops` — In House, Victor, Studio C (extensible)
- `users` — Auth users with role and assigned_shops array
- `status_history` — Audit trail for item status changes (embedded on items in Phase 1, separate table in Phase 2)
- `deliveries` + `delivery_stops` — Driver delivery runs (Phase 4)

### Key Data Distinctions

- `due_date` (on order_items) = internal production deadline, set at order creation, editable by Manager
- `delivery_date` (on order_items) = actual timestamp when driver marked item as `delivered`. Lives on item because items in the same order can be delivered separately
- `files_count` = computed from `order_files` via items, NOT stored on orders
- `comments_count` = computed from notes/comments, NOT stored on orders
- `statusRollup` = derived from item statuses, NOT stored on orders
- Activity feed = derived from status_history + order events + notes, NOT a separate table

### Order-Level Status Rollup

Since tracking is item-level, order status is derived:
- Order is `new` if any item is `new`
- Order is `in_production` if any item is `assigned` or `in_production`
- Order is `ready` if ALL non-canceled items are `ready`
- Order is terminal if ALL non-canceled items are in terminal states

### Phase 1 Mock Users

| Email             | Role              | Assigned Shops | Password |
|-------------------|-------------------|----------------|----------|
| manager@kroma.com | manager           | [] (all)       | 1234     |
| victor@kroma.com  | printshop_manager | ['victor']     | 1234     |
| alex@kroma.com    | driver            | []             | 1234     |
| sam@kroma.com     | driver            | []             | 1234     |
| jordan@kroma.com  | driver            | []             | 1234     |

## Project Structure

```
src/
├── types/                      ← Standalone type definitions (survive Supabase migration)
│   ├── index.ts                   Barrel re-export
│   ├── customer.ts
│   ├── order.ts                   OrderSource, PaymentStatus, PaymentMethod, DeliveryMethod, Order
│   ├── order-item.ts              ItemStatus, StatusHistoryEntry, OrderItem
│   ├── order-file.ts              FileType, OrderFile
│   ├── printshop.ts               Printshop
│   ├── user.ts                    UserRole, User
│   ├── activity.ts                Activity types
│   └── note.ts                    NoteDepartment, OrderNote
├── lib/                        ← Shared utilities (no component dependencies)
│   ├── formatters.ts              formatDate, formatStatus, formatPrintshop, formatCurrency, etc.
│   ├── variants.ts                getStatusVariant, getPaymentVariant, color maps
│   ├── constants.ts               Filter options, kanban columns, domain enums
│   ├── route-service.ts           OpenAI route generation & recalculation
│   └── utils.ts                   cn() and general helpers
├── stores/                     ← Pinia stores (single source of truth)
│   ├── auth.ts                    currentUser, login/logout, role getters
│   ├── orders.ts                  orders + orderItems state, mutations, computed joins
│   ├── customers.ts               customers state
│   ├── printshops.ts              printshops state, getPrintshopById, getPrintshopName
│   ├── drivers.ts                 Active drivers, routes, assignments, locked items
│   └── activities.ts              activity feed state
├── composables/                ← Thin wrappers around stores (stable API for components)
│   ├── useOrders.ts               Wraps useOrderStore()
│   ├── useOrderItems.ts           Wraps useOrderStore() for item queries
│   ├── useCustomers.ts            Wraps useCustomerStore()
│   ├── usePrintshops.ts           Wraps usePrintshopStore()
│   └── useToast.ts                Toast notifications
├── data/mock/                  ← Mock data arrays only (no type definitions)
│   ├── orders.ts
│   ├── order-items.ts
│   ├── order-files.ts
│   ├── customers.ts
│   ├── printshops.ts
│   ├── users.ts
│   └── activities.ts
├── components/
│   ├── ui/                        Primitives (Button, Badge, Card, Sheet, Dialog, etc.)
│   ├── AppLayout.vue              Top nav — role-aware, dynamic links
│   ├── DataTable.vue              Generic TanStack table with expandable rows
│   ├── StatsCards.vue             Config-driven stat cards (reusable across roles)
│   ├── OrderFilters.vue           Configurable filter bar
│   ├── KanbanBoard.vue            Drag/drop kanban (reusable for Manager + Printshop Manager)
│   ├── KanbanCard.vue             Single kanban item card
│   ├── OrderExpandedRow.vue       Expanded table row with item details
│   ├── StatsSheet.vue             Drill-down slide-out for stat clicks
│   ├── AssignmentDialog.vue       Printshop assignment confirmation
│   ├── ItemControls.vue           Reusable item editing (status, printshop, dates)
│   ├── NotesSection.vue           Reusable notes CRUD
│   ├── OrderDetailSheet.vue       Order detail slide-out
│   ├── NewOrderSheet.vue          Manual order creation
│   ├── CustomerDetailSheet.vue    Customer profile + order history sheet
│   ├── NewCustomerSheet.vue       Create new customer form sheet
│   ├── DriverTaskSheet.vue        Ad-hoc driver tasks
│   ├── StartRouteDialog.vue       Shift end time input before route generation
│   ├── TransferDialog.vue         Transfer items between active drivers
│   ├── RouteMap.vue               Mapbox GL route visualization with markers & lines
│   ├── ActivityFeed.vue           Right sidebar activity feed
│   └── ItemStatusCombobox.vue     Status dropdown
├── views/
│   ├── LoginView.vue              Mock auth login screen
│   ├── manager/
│   │   ├── ManagerOrders.vue      Orchestration only (~300 lines)
│   │   ├── ManagerCustomers.vue
│   │   └── order-columns.ts       TanStack column defs (callback pattern, no window events)
│   ├── printshop/
│   │   └── PrintshopQueue.vue     Production kanban queue
│   └── driver/
│       ├── DriverDeliveries.vue   Delivery queue + route
│       └── DriverArchives.vue     Delivery history table
└── router/index.ts                Auth guards, role-based routing
```

## Data Service Layer Pattern

- **Pinia stores** are the single source of truth for all state
- **Composables** (`useOrders()`, `useCustomers()`, etc.) are thin wrappers providing a stable API
- **Components never import from `/data/mock` directly** — only stores do
- Phase 1: Stores load from `/data/mock`
- Phase 2: Stores swap to Supabase client — composable and component APIs unchanged

## Development Guidelines

### Do NOT
- Put type definitions in mock data files — types live in `src/types/`
- Use `window.dispatchEvent` / `CustomEvent` for component communication — use callbacks, emits, or store actions
- Import directly from `src/data/mock/*` in components — go through stores/composables
- Define formatters or constants inline in view components — use `src/lib/`
- Store `files_count`, `comments_count`, or `delivery_date` on the Order interface — these are computed
- Pass `activityStore.allActivities` directly to ActivityFeed in role views — always use `getActivitiesForRole()`
- Call OpenAI from components directly — always go through `route-service.ts`
- Modify completed stops in a recalculation
- Allow unassigning locked (picked-up) items without a transfer

### Do
- Keep view files under 300 lines — extract sub-components
- Use Pinia stores for shared state and mutations
- Use `src/lib/formatters.ts` and `src/lib/variants.ts` for all display logic
- Use `src/lib/constants.ts` for filter options and domain enums
- Use the `ItemControls.vue` component for any item editing UI (status, printshop, dates)
- Respect role permissions — use auth store getters to conditionally show/hide controls
- Use `getAllItems()` when you need all items regardless of printshop — not `getItemsByPrintshop(null)`
- Use `getOrdersByCustomerId()` to get a customer's orders — don't filter ordersWithDetails manually in components
- Use `addCustomer()` store action for customer creation — don't push to the array directly
- Use `driverStore.isItemAssignedToOtherDriver()` to filter items in driver views
- Use `driverStore.lockItemsAtStop()` when a pickup stop is completed
- Use `recalculateRoute()` (not `generateRoute()`) for mid-route updates
- Use `RouteMap` component only in route mode — don't render it when there's no active route
- Always pass lat/lng on route stops (from printshop/customer data)

### Customer Matching
On order ingestion, match customer by email. If no match, create new customer record. Managers can merge duplicates later.

### File Handling
- Files linked to specific **order items** via `order_files` table
- File types: `artwork`, `proof`, `reference`, `other`
- Phase 1: mock data only (no upload). Phase 2: Supabase Storage

### Activity Feed Scoping
- Activities are scoped per role via `activityStore.getActivitiesForRole()`
- Views pass scoped activities to `<ActivityFeed>` — the component itself is role-agnostic
- Manager sees all, Printshop Manager sees their shop's items, Driver sees delivery-related
- Scoping is computed at read time from activity metadata — no stored scope field

### Dual-Sheet Pattern
The Customers view demonstrates the dual-sheet pattern:
- CustomerDetailSheet opens on the RIGHT (default z-index 50)
- Clicking an order inside it opens OrderDetailSheet on the LEFT (z-index 70)
- Both sheets are visible simultaneously
- Closing the customer sheet also closes the order sheet
- This pattern can be reused wherever a detail sheet needs to link to another entity's detail

### AI Route Optimization (OpenAI)
The driver route system uses OpenAI (gpt-4o) to generate optimized delivery routes.

**Flow:**
1. Driver sees all ready deliveries grouped by priority (no manual selection)
2. Driver clicks "Start Route" → enters shift end time
3. System builds a structured prompt with all stops, addresses, priorities, constraints
4. OpenAI returns an ordered route with ETAs and travel times
5. Route is stored in driverStore and driver enters ROUTE MODE

**Key rules:**
- Pickups MUST happen before their related deliveries (constraint sent to AI)
- 15 minutes per stop (pickup or delivery)
- Stops that don't fit in shift are marked `fitsInShift: false`
- API key: `VITE_OPENAI_API_KEY` in `.env` (Phase 1 only, moves to serverless in Phase 2)

**Mid-route updates:**
- When a manager/printshop sets new items to "ready", a watcher detects them
- They appear in `pendingNewItemIds` on the route
- Driver sees a banner and can "Add to Route" which triggers recalculation
- Completed stops are NEVER moved — only remaining stops are reoptimized

**Multi-driver:**
- Active drivers tracked in `driverStore.activeDriverSessions`
- Items assigned to one driver are hidden from other drivers' queues
- Locked items (physically picked up) can only be transferred, not unassigned
- Transfer sends items to another active driver's pending queue

**Adding a new driver:**
1. Add to `src/data/mock/users.ts` with role 'driver'
2. When they log in, auth store auto-registers their session in driverStore

### Mapbox Map (Route Visualization)
The driver route view includes a live Mapbox GL map showing the full route with color-coded stops and road-following lines.

**Component:** `RouteMap.vue` — self-contained map with markers, route lines, and Mapbox Directions API integration

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
- Requires `api.mapbox.com` in allowed network domains
- Graceful fallback to straight lines if API blocked
- Supports up to 25 waypoints per request (chunks larger routes)

**Token:** `VITE_MAPBOX_TOKEN` in `.env`

**Interaction:**
- Click marker → popup with stop info (name, address, ETA, status)
- Click stop in sidebar → map flies to that stop
- Auto-fits bounds to show all markers on initial render

## Integration Points

### Inbound Webhooks (Phase 3)
- **Shopify**: `/api/ingest/shopify` — Receives orders/create and orders/updated from multiple stores
- **Web Forms**: `/api/ingest/webform` — External form submissions

### Outbound Webhooks (Phase 5)
- **Billing Webhook**: Fires per-item when status → `ready`

### Google Maps (Phase 4)
- Driver route optimization with `optimizeWaypoints` (up to 25 waypoints)

## Supabase Configuration (Phase 2)

### Auth
- Email/password authentication
- Role and shop scoping in `users` table
- RLS policies enforce role-based access

### RLS Policy Guidelines
- **Manager**: Full read access, write based on permissions
- **Printshop Manager**: Read/write only items where `assigned_printshop` in their `assigned_shops`. NO access to payment fields
- **Driver**: Read only orders where all items `ready` and `delivery_method = 'delivery'`. Write access only to delivery statuses

### Storage
All order files stored in Supabase Storage, linked to order_items via `order_files` table.

## Build Phases

### Phase 1 — UI Foundation (Mock Data) ← CURRENT
- All UI with mock data, Pinia stores, mock auth with login screen
- Manager, Printshop Manager, and Driver views

### Phase 2 — Supabase Integration
- Real database, auth, storage, realtime — swap store internals only

### Phase 3 — Ingestion
- Shopify webhooks, web form API, customer matching

### Phase 4 — Delivery & Route Optimization
- Google Maps integration, route optimization

### Phase 5 — Billing & Polish
- Billing webhook, analytics, notifications

## Important Files

- `MASTER.MD` — Complete business requirements, data model, and technical specification
- `CLAUDE.md` — This file. Development guidelines and project context for Claude Code
- `KROMA-REFACTOR-PLAN.md` — Step-by-step refactoring plan with Claude Code instructions
- `package.json` — Project dependencies and scripts