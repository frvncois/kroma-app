# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kroma** is a centralized order management and logistics hub for a print shop operation with 2 physical locations. The system manages orders from multiple sources (Shopify stores, web forms, manual entry), production workflow across print shops, and delivery route optimization.

**Stack:** Vue 3, Pinia, Vue Router, Shadcn-vue (planned), Supabase (Postgres, Auth, Storage, Realtime), Vercel

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

Items progress through these statuses:

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

### Three User Roles

1. **Manager** - Sees all orders, assigns printshops, manages payment, creates manual orders
2. **Printshop Manager** - Sees only items assigned to their shop(s), manages production statuses
3. **Driver** - Sees orders ready for delivery, optimizes routes, marks delivery statuses

Refer to the permission matrix in MASTER.MD for detailed role capabilities.

### Order Sources

- `shopify_a`, `shopify_b`, `shopify_c` - Three Shopify stores (arrive with `payment_status: paid`)
- `webform` - Custom web form submissions (arrive unpaid)
- `manual` - Manager-entered orders

### Delivery Methods

- `delivery` - Goes through driver route optimization (ready → out_for_delivery → delivered)
- `customer_pickup` - Customer picks up at shop (ready → picked_up)

### Payment Tracking

Manager-only concern. Fields: `payment_status` (paid/unpaid/partial), `payment_method`, `amount_total`, `amount_paid`. Payment does NOT block production or delivery flow.

## Data Model

### Core Tables

- `customers` - Customer records with delivery addresses and geocoding (lat/lng for route optimization)
- `orders` - Order header with customer_id, source, delivery_method, payment fields
- `order_items` - Individual items with product details, assigned_printshop, status (this is where workflow happens)
- `order_files` - Files attached to specific items (stored in Supabase Storage)
- `printshops` - Shop A and Shop B locations with geocoding
- `users` - Auth users with role and assigned_shops array
- `deliveries` - Driver delivery runs with optimized_route
- `delivery_stops` - Individual stops in a delivery run (pickups and dropoffs)
- `status_history` - Audit trail for item status changes

### Order-Level Status Rollup

Since tracking is item-level, order status is derived:
- Order is `new` if any item is `new`
- Order is `in_production` if any item is `assigned` or `in_production`
- Order is `ready` if ALL non-canceled items are `ready`
- Order is terminal if ALL non-canceled items are in terminal states

## Integration Points

### Inbound Webhooks

- **Shopify**: `/api/ingest/shopify` - Receives orders/create and orders/updated events from 3 stores. Verifies HMAC, normalizes payload, downloads files to Supabase Storage.
- **Web Forms**: `/api/ingest/webform` - Receives external form submissions.

### Outbound Webhooks

- **Billing Webhook**: Fires per-item when status changes to `ready`. Sends order + item + customer + payment data to external billing app.

### Google Maps Integration

Driver route optimization uses Google Directions API with `optimizeWaypoints` for up to 25 waypoints. Pickups at shops must occur before their related dropoffs.

## Supabase Configuration

### Auth
- Email/password authentication
- Role and shop scoping in `users` table
- RLS policies enforce role-based access

### RLS Policy Guidelines
- **Manager**: Full read access, write based on permissions
- **Printshop Manager**: Read/write only items where `assigned_printshop` in their `assigned_shops`. NO access to payment fields
- **Driver**: Read only orders where all items `ready` and `delivery_method = 'delivery'`. Write access only to delivery statuses

### Storage
All order files stored in Supabase Storage, linked to specific order_items via `order_files` table.

### Realtime
- Manager dashboard updates when new orders arrive
- Printshop Manager queue updates when items assigned
- Driver queue updates when items become ready
- Status changes reflected live across all clients

## Project Structure

- `src/` - Vue 3 application source
  - `router/` - Vue Router configuration
  - `stores/` - Pinia stores for state management
  - `App.vue` - Root component
  - `main.ts` - Application entry point
- `data/mock/` - Mock data layer (Phase 1 - JSON/JS objects for all entities)
- `public/` - Static assets
- `vite.config.ts` - Vite configuration with path alias `@` → `src/`

### Data Service Layer Pattern

Use composables to abstract all data access (e.g., `useOrders()`, `useCustomers()`, `useOrderItems()`). This allows:
- Phase 1: Service internals use mock data from `/data/mock`
- Phase 2: Service internals switch to Supabase client without UI changes
- Consistent API across the app regardless of data source

## Development Guidelines

### Customer Matching
On order ingestion, match customer by email. If no match, create new customer record. Managers can merge duplicates later.

### File Handling
- Shopify files: Downloaded during ingestion and stored in Supabase
- Manual orders: Manager uploads directly
- Web forms: Files received and stored during ingestion
- Files linked to specific order_items with type: `artwork`, `proof`, `reference`, `other`

### Route Optimization Logic
- Driver selects orders for delivery run
- System computes stops: pickups at Shop A/B + dropoffs at customer addresses
- Constraint: pickups before related dropoffs
- Uses Google Directions API with waypoint optimization
- Driver follows optimized sequence

## Build Phases

The project follows a **UI-first with mock data** approach (see MASTER.MD Section 13):

### Phase 1 — UI Foundation (Mock Data)
- Build all UI with mock data first (no Supabase yet)
- Mock data layer at `/data/mock` with JSON/JS objects
- Data service layer (`useOrders()`, `useCustomers()`, etc.) abstracting data access
- Fake auth with role switcher to test different role views
- Complete Manager, Printshop Manager, and Driver views with mock data

### Phase 2 — Supabase Integration
- Migrate mock data schema to real Postgres tables
- Replace data service internals to use Supabase client
- Real auth flow (login, signup, password reset)
- RLS policies, file upload, Realtime subscriptions

### Phase 3 — Ingestion
- Shopify webhook receiver, payload normalization, file handling
- Web form API endpoint
- Customer matching/dedup

### Phase 4 — Delivery & Route Optimization
- Google Maps API integration
- Route optimization with pickup/dropoff constraints

### Phase 5 — Billing & Polish
- Outbound billing webhook, analytics, notifications

**Key Pattern:** Data services abstract all data access. Phase 1 uses mock data, Phase 2 swaps in Supabase without changing UI code.

## Important Files

- `MASTER.MD` - Complete business requirements and technical specification
- `README.md` - Vue 3/Vite template documentation
- `package.json` - Project dependencies and scripts
