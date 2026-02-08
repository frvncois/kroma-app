# KROMA — Refactoring & Optimization Plan

## Overview

This plan restructures the Kroma codebase from a vibe-coded Manager-only prototype into a scalable, role-aware application. Each step is a **self-contained Claude Code instruction** you can paste into your terminal.

Execute them **in order** — each step depends on the previous ones.

---

## Pre-Flight: Context Files

Before starting any step, make sure Claude Code has the project context. At the beginning of each session, run:

```
Read CLAUDE.md, MASTER.MD, and this refactoring plan. The codebase is a Vue 3 + TypeScript print shop order management app called Kroma.
```

---

## STEP 1 — Extract Types into `src/types/`

**Goal:** Separate type definitions from mock data so types survive the Supabase migration.

### Claude Code Instruction:

```
Create a new directory `src/types/` and extract all type definitions from the mock data files into clean, standalone type files. Do NOT modify any mock data or component files yet — only create the new type files and update imports.

Create these files:

1. `src/types/customer.ts` — Extract `Customer` interface from `src/data/mock/customers.ts`

2. `src/types/order.ts` — Extract from `src/data/mock/orders.ts`:
   - `OrderSource` type (keep branded names: impression_quebec, promo_flash, propaganda, sticker_pusher, studio_c, other)
   - `DeliveryMethod` type
   - `PaymentStatus` type  
   - `PaymentMethod` type
   - `Order` interface — REMOVE `files_count`, `comments_count`, and `delivery_date` from the interface (these will be computed or moved to items)

3. `src/types/order-item.ts` — Extract from `src/data/mock/order-items.ts`:
   - `ItemStatus` type
   - `StatusHistoryEntry` interface
   - `OrderItem` interface — ADD `delivery_date: string | null` field (timestamp when driver marks delivered)

4. `src/types/printshop.ts` — Extract `Printshop` interface from `src/data/mock/printshops.ts`

5. `src/types/user.ts` — NEW:
   - `UserRole` = 'manager' | 'printshop_manager' | 'driver'
   - `User` interface: id, name, email, password (Phase 1 only), role: UserRole, assigned_shops: string[], created_at

6. `src/types/order-file.ts` — NEW:
   - `FileType` = 'artwork' | 'proof' | 'reference' | 'other'
   - `OrderFile` interface: id, order_item_id, file_url, file_name, file_type: FileType, uploaded_by: string | null, created_at

7. `src/types/activity.ts` — Extract/define the Activity type from `src/data/mock/activities.ts`

8. `src/types/index.ts` — Barrel file re-exporting everything

After creating the type files, update ALL imports across the codebase:
- `src/data/mock/*.ts` files should import types from `@/types/` and only export data arrays
- `src/composables/*.ts` should import from `@/types/`
- `src/views/manager/order-columns.ts` should import from `@/types/`
- `src/components/*.vue` should import from `@/types/`

Make sure the app still compiles with `npm run type-check` after changes.
```

---

## STEP 2 — Create Missing Mock Data + Update Existing

**Goal:** Add users, order files mock data. Fix order data model (remove delivery_date, files_count, comments_count from orders; add delivery_date to items).

### Claude Code Instruction:

```
Update the mock data layer to match our confirmed data model. Import all types from `@/types/`.

1. Create `src/data/mock/users.ts`:
   - 3 users:
     - { id: 'user-1', name: 'Manager', email: 'manager@kroma.com', password: '1234', role: 'manager', assigned_shops: [], created_at: '2024-01-01T00:00:00Z' }
     - { id: 'user-2', name: 'Victor', email: 'victor@kroma.com', password: '1234', role: 'printshop_manager', assigned_shops: ['victor'], created_at: '2024-01-01T00:00:00Z' }
     - { id: 'user-3', name: 'Driver', email: 'driver@kroma.com', password: '1234', role: 'driver', assigned_shops: [], created_at: '2024-01-01T00:00:00Z' }

2. Create `src/data/mock/order-files.ts`:
   - Create 5-8 mock files linked to existing order items
   - Use realistic filenames (artwork-final.pdf, logo-highres.png, etc.)
   - Mix of file_types: artwork, proof, reference
   - file_url can be placeholder strings like '/files/artwork-final.pdf'

3. Update `src/data/mock/orders.ts`:
   - Remove `files_count`, `comments_count`, `delivery_date` from every order object
   - The Order type import from @/types should already not have these fields

4. Update `src/data/mock/order-items.ts`:
   - Add `delivery_date` field to every item object
   - For items with status 'delivered', set delivery_date to a realistic timestamp
   - For all other items, set delivery_date to null

5. Update `src/data/mock/activities.ts`:
   - Make sure types are imported from @/types/

Run `npm run type-check` to confirm everything compiles.
```

---

## STEP 3 — Centralize State with Pinia Stores

**Goal:** Replace the fragmented composable-based state with proper Pinia stores as single source of truth. Composables become thin wrappers.

### Claude Code Instruction:

```
Create Pinia stores to centralize all application state. The stores are the single source of truth. Existing composables will be refactored to use stores internally.

1. Create `src/stores/auth.ts`:
   - State: currentUser (User | null), isAuthenticated (boolean)
   - Actions: login(email, password) — validates against mock users, returns success/failure. logout() — clears currentUser.
   - Getters: userRole, userShops, isManager, isPrintshopManager, isDriver, canAccessShop(shopId)

2. Create `src/stores/orders.ts`:
   - State: orders (Order[]), orderItems (OrderItem[])
   - Initialize from mock data
   - Actions: all mutations currently in useOrders composable — updateItemStatus, updateOrderSource, updateOrderPaymentStatus, updateItemPrintshop, updateItemDueDate, etc.
   - Getters:
     - ordersWithDetails — joins orders + customers + items, computes statusRollup (move computeOrderStatus here)
     - getOrderById(id)
     - filesCount(orderId) — computed from order-files mock data
     - commentsCount(orderId) — placeholder, return 0 for now

3. Create `src/stores/customers.ts`:
   - State: customers (Customer[])
   - Initialize from mock data
   - Getters: getCustomerById(id), allCustomers

4. Create `src/stores/activities.ts`:
   - State: activities array
   - Actions: toggleSeen(activityId), addActivity(...)
   - In Phase 2 this becomes a computed view; for now it wraps the mock array

5. Refactor existing composables to be thin wrappers around stores:
   - `useOrders()` — internally calls `useOrderStore()`, returns same API surface
   - `useOrderItems()` — internally calls `useOrderStore()`, returns item-specific queries
   - `useCustomers()` — internally calls `useCustomerStore()`
   - This keeps existing component imports working while we refactor

6. Make sure Pinia is properly initialized in `src/main.ts` (it's already in package.json but may not be set up).

Run `npm run type-check` and manually verify the app still works.
```

---

## STEP 4 — Extract Shared Utilities

**Goal:** Pull all domain formatters, variant mappings, and option constants out of components into reusable utilities.

### Claude Code Instruction:

```
Extract all shared domain logic from ManagerOrders.vue and other components into utility files.

1. Create `src/lib/formatters.ts`:
   - formatDate(dateString: string): string — format as DD/MM/YY or locale-appropriate
   - formatDateDisplay(dateString: string): string — full format (Month Day, Year HH:MM)
   - formatCurrency(amount: number): string
   - formatStatus(status: ItemStatus): string — human-readable label
   - formatPrintshop(printshopId: string | null): string — printshop name or 'Unassigned'
   - formatPayment(paymentStatus: PaymentStatus): string
   - formatSource(source: OrderSource): string
   - formatRelativeDueDate(item: OrderItemWithDetails): { text: string, isOverdue: boolean }
   - calculateDaysAgo(dateString: string): number
   - isOverdue(item: OrderItemWithDetails): boolean

2. Create `src/lib/variants.ts`:
   - getStatusVariant(status: ItemStatus): BadgeVariant
   - getPaymentVariant(status: PaymentStatus): BadgeVariant
   - getSourceVariant(source: OrderSource): BadgeVariant
   - statusColorMap, paymentColorMap — for kanban cards or anywhere colors are needed

3. Create `src/lib/constants.ts`:
   - statusOptions (with and without 'all')
   - sourceOptions (with and without 'all')
   - paymentOptions (with and without 'all')
   - orderByOptions
   - printshopOptions (computed helper that takes printshops array)
   - deliveryMethodOptions
   - paymentMethodOptions
   - kanbanColumns definition (id, title, status, printshop)

4. Update all imports:
   - ManagerOrders.vue — remove all inline formatters/constants, import from lib/
   - order-columns.ts — import from lib/
   - OrderDetailSheet.vue — import from lib/
   - Any other component using these patterns

Do NOT change any component logic or template yet — only extract and re-import.
Run `npm run type-check` to verify.
```

---

## STEP 5 — Replace Window Events with Proper Patterns

**Goal:** Remove the `window.dispatchEvent(CustomEvent)` pattern used by order-columns.ts to communicate with ManagerOrders.vue.

### Claude Code Instruction:

```
Remove all window.addEventListener / window.dispatchEvent / CustomEvent patterns and replace with proper Vue patterns.

Current problem: `order-columns.ts` dispatches CustomEvents on window for 'update-order-source', 'update-order-payment', and 'open-order-detail'. ManagerOrders.vue listens for these in onMounted/onUnmounted.

Solution: Since TanStack Table column definitions use render functions (h()), we need a callback-based approach.

1. Refactor `order-columns.ts`:
   - Change the exported `columns` from a static array to a function: `createColumns(callbacks: { onOpenDetail: (orderId: string) => void, onUpdateSource: (orderId: string, source: string) => void, onUpdatePayment: (orderId: string, status: string) => void })`
   - Inside column cells, call the callbacks directly instead of dispatching window events

2. Update `ManagerOrders.vue`:
   - Remove all window.addEventListener / removeEventListener code in onMounted / onUnmounted
   - Call createColumns({ ...callbacks }) to generate columns with proper handlers
   - Remove handleUpdateOrderSource, handleUpdateOrderPayment, handleOpenOrderDetail event wrapper functions

3. Verify the table still works — clicking actions, changing source/payment dropdowns in cells, opening order details.

Run `npm run type-check`.
```

---

## STEP 6 — Break Up ManagerOrders.vue

**Goal:** Split the monolithic view into focused, reusable sub-components. This is the biggest step.

### Claude Code Instruction:

```
Break ManagerOrders.vue into focused sub-components. The goal is reusability across Manager, Printshop Manager, and Driver views.

Create these components in `src/components/`:

1. `src/components/StatsCards.vue`:
   - Props: stats object (computed externally and passed in), cardConfigs (array of { title, icon, items: { label, icon, count, onClick }[] })
   - Emits: stat-click(statKey)
   - Extracts the 3 stat cards (Manager, Production, Delivery) from ManagerOrders
   - The Printshop Manager will use a different set of cards, so this must be config-driven

2. `src/components/OrderFilters.vue`:
   - Props: viewMode, available filter configs (which filters to show)
   - v-model bindings for each filter: statusFilter, sourceFilter, paymentFilter, printshopFilter, orderBy, kanbanColumnsFilter, searchQuery
   - Emits: update events for each filter
   - Handles the conditional rendering (table filters vs kanban filters)
   - Reusable: Printshop Manager needs a subset of these filters

3. `src/components/KanbanBoard.vue`:
   - Props: columns config, items (filtered), visibleColumns
   - Emits: item-drop(itemId, newStatus, printshop), item-click(orderId)
   - Contains the full kanban rendering: columns, cards, drag/drop, empty states
   - Search dropdown for kanban mode stays here

4. `src/components/KanbanCard.vue`:
   - Props: item (OrderItemWithDetails)
   - Emits: click, dragstart, dragend
   - Single kanban card with item info, badges, due date
   - Used by KanbanBoard

5. `src/components/OrderExpandedRow.vue`:
   - Props: order (OrderWithDetails), printshops
   - Emits: update-status(itemId, status), update-printshop(itemId, shopId), open-detail(orderId)
   - Extracts the expanded row template from the DataTable slot in ManagerOrders
   - Contains the 4-column grid: item details, controls (printshop + status), timeline, files/comments
   - Reusable: the Printshop Manager will show a similar item view but without payment/source controls

6. `src/components/StatsSheet.vue`:
   - Props: isOpen, title, items (OrderItemWithDetails[])
   - Emits: update:isOpen, item-click(orderId)
   - The slide-out panel with search and item list that appears when you click a stat
   - Currently inline in ManagerOrders.vue

7. `src/components/AssignmentDialog.vue`:
   - Props: isOpen, itemName, printshopName
   - Emits: update:isOpen, confirm, cancel
   - The confirmation dialog for drag-and-drop printshop assignment

Now refactor `src/views/manager/ManagerOrders.vue`:
- Import and use all new sub-components
- The view file should only contain:
  - Page-level layout (header, grid structure, sidebar)
  - Top-level state (filters, sheet open/close)
  - Orchestration logic (what happens when events fire)
  - Stats computation
- Target: under 300 lines

Make sure the app compiles and the Manager view still looks and works exactly the same.
Run `npm run type-check`.
```

---

## STEP 7 — Deduplicate Item Editing Controls

**Goal:** The printshop selector + status combobox + date inputs pattern appears in ManagerOrders expanded rows, OrderDetailSheet, and NewOrderSheet. Unify them.

### Claude Code Instruction:

```
Create a reusable item editing component that replaces the duplicated controls.

1. Create `src/components/ItemControls.vue`:
   - Props:
     - item: OrderItem (or partial with id, status, assigned_printshop, due_date)
     - showPrintshop: boolean (default true)
     - showStatus: boolean (default true)
     - showDueDate: boolean (default true)
     - showTimeline: boolean (default false) — for expanded row's date display
     - readonly: boolean (default false) — for Printshop Manager/Driver with limited permissions
     - layout: 'inline' | 'stacked' (default 'stacked')
   - Emits:
     - update:status(itemId, newStatus)
     - update:printshop(itemId, shopId)
     - update:dueDate(itemId, date)
   - Internally uses FilterSelect for printshop, ItemStatusCombobox for status, DateInput for due date

2. Update `OrderExpandedRow.vue` to use ItemControls instead of inline selects

3. Update `OrderDetailSheet.vue` to use ItemControls for each item's controls

4. Update `NewOrderSheet.vue` to use ItemControls where applicable

The component should respect role-based permissions via the readonly/show* props. When we build the Printshop Manager view, we'll pass showPrintshop=false and limit status options.

Run `npm run type-check` and verify all 3 contexts still work.
```

---

## STEP 8 — Deduplicate Notes UI

**Goal:** OrderDetailSheet and NewOrderSheet both implement notes CRUD with nearly identical code. Extract it.

### Claude Code Instruction:

```
Extract the shared notes pattern into a reusable component.

1. Define note types in `src/types/note.ts`:
   - NoteDepartment = 'printshop' | 'delivery' | 'billing' | 'everyone'
   - OrderNote interface: id, content, departments: NoteDepartment[], created_at, created_by, item_reference: string | null

2. Create `src/components/NotesSection.vue`:
   - Props:
     - notes: OrderNote[]
     - itemOptions: { value: string, label: string }[] — for the item reference dropdown
     - departmentOptions: { value: string, label: string }[] — for department filter
     - readonly: boolean (default false)
   - Emits:
     - add-note(content, department, itemReference)
     - edit-note(noteId, newContent)
     - delete-note(noteId)
   - Contains: notes list with edit/delete actions, add note form with department and item dropdowns
   - Currently this is ~80 lines of template + ~40 lines of script duplicated in both sheets

3. Update OrderDetailSheet.vue to use NotesSection
4. Update NewOrderSheet.vue to use NotesSection

Run `npm run type-check`.
```

---

## STEP 9 — Auth Scaffolding + Login Screen

**Goal:** Add fake auth with a login screen and role-aware routing.

### Claude Code Instruction:

```
Implement Phase 1 auth with mock login and role-based routing.

1. The auth store was already created in Step 3 (`src/stores/auth.ts`). Verify it has:
   - login(email, password) that validates against mock users
   - logout()
   - currentUser, isAuthenticated, userRole, isManager, isPrintshopManager, isDriver getters

2. Create `src/views/LoginView.vue`:
   - Clean, centered login form matching the Kroma design aesthetic (dark/light mode support)
   - Email + password fields
   - Show the Kroma logo (from src/assets/KromaLogo.vue)
   - Error message on wrong credentials
   - On success, redirect to the appropriate default route based on role:
     - manager → /manager/orders
     - printshop_manager → /printshop/queue
     - driver → /driver/deliveries
   - Hint text showing the 3 test accounts for development convenience

3. Update `src/router/index.ts`:
   - Add login route: { path: '/login', component: LoginView }
   - Add route structure for future views (empty placeholder components for now):
     - /printshop/queue (PrintshopQueue.vue — placeholder)
     - /driver/deliveries (DriverDeliveries.vue — placeholder)
   - Add navigation guard: if not authenticated, redirect to /login. If authenticated and hitting /, redirect based on role.
   - Protect role-specific routes (manager can't access /printshop/*, etc.)

4. Create placeholder views:
   - `src/views/printshop/PrintshopQueue.vue` — simple template saying "Printshop Manager Queue — Coming Soon"
   - `src/views/driver/DriverDeliveries.vue` — simple template saying "Driver Deliveries — Coming Soon"

5. Update `src/components/AppLayout.vue`:
   - Navigation items should be dynamic based on the current user's role
   - Manager sees: Orders, Customers
   - Printshop Manager sees: Production Queue
   - Driver sees: Deliveries
   - Add logout button/option in the user dropdown
   - Show current user name/role somewhere in the nav

Run `npm run type-check` and test:
- Going to any page while logged out redirects to /login
- Logging in as manager@kroma.com goes to /manager/orders
- Logging in as victor@kroma.com goes to /printshop/queue
- Logging in as driver@kroma.com goes to /driver/deliveries
- Navigation shows only role-appropriate links
- Logout works and redirects to /login
```

---

## STEP 10 — Final Cleanup & Verification

**Goal:** Clean up any remaining issues, verify everything works end-to-end.

### Claude Code Instruction:

```
Final cleanup pass on the Kroma codebase after refactoring.

1. Check for unused imports across all files — remove any dead imports

2. Verify that `delivery_date` has been properly moved:
   - NOT on the Order interface or mock orders
   - IS on the OrderItem interface and mock items
   - OrderDetailSheet and ManagerOrders read it from item level
   - files_count and comments_count are NOT on Order interface — computed where needed

3. Verify the composable → store chain:
   - useOrders() internally uses useOrderStore() — no local ref() wrapping mock arrays
   - useOrderItems() internally uses useOrderStore()
   - useCustomers() internally uses useCustomerStore()
   - No component directly imports from `src/data/mock/*` except stores

4. Check that all formatters/constants come from `src/lib/` — no inline definitions remain in components

5. Run `npm run type-check` — fix any TypeScript errors

6. Run `npm run build` — fix any build errors

7. Write a summary of the final file structure and component hierarchy to CLAUDE.md, replacing the outdated project structure section
```

---

## Post-Refactor File Structure

After all 10 steps, the project should look like:

```
src/
├── types/                          ← NEW
│   ├── index.ts
│   ├── customer.ts
│   ├── order.ts
│   ├── order-item.ts
│   ├── order-file.ts
│   ├── printshop.ts
│   ├── user.ts
│   ├── activity.ts
│   └── note.ts
├── lib/                            ← NEW
│   ├── formatters.ts
│   ├── variants.ts
│   ├── constants.ts
│   └── utils.ts
├── stores/                         ← NEW (Pinia)
│   ├── auth.ts
│   ├── orders.ts
│   ├── customers.ts
│   └── activities.ts
├── composables/                    ← SLIMMED (thin wrappers)
│   ├── useOrders.ts
│   ├── useOrderItems.ts
│   ├── useCustomers.ts
│   └── useToast.ts
├── data/mock/                      ← UPDATED
│   ├── orders.ts                   (data only, no types)
│   ├── order-items.ts              (data only, delivery_date added)
│   ├── order-files.ts              ← NEW
│   ├── customers.ts                (data only)
│   ├── printshops.ts               (data only)
│   ├── users.ts                    ← NEW
│   └── activities.ts
├── components/
│   ├── ui/                         (unchanged — Button, Badge, etc.)
│   ├── AppLayout.vue               (updated — role-aware nav)
│   ├── DataTable.vue               (unchanged)
│   ├── StatsCards.vue              ← NEW (extracted)
│   ├── OrderFilters.vue            ← NEW (extracted)
│   ├── KanbanBoard.vue             ← NEW (extracted)
│   ├── KanbanCard.vue              ← NEW (extracted)
│   ├── OrderExpandedRow.vue        ← NEW (extracted)
│   ├── StatsSheet.vue              ← NEW (extracted)
│   ├── AssignmentDialog.vue        ← NEW (extracted)
│   ├── ItemControls.vue            ← NEW (deduplicated)
│   ├── NotesSection.vue            ← NEW (deduplicated)
│   ├── OrderDetailSheet.vue        (slimmed)
│   ├── NewOrderSheet.vue           (slimmed)
│   ├── DriverTaskSheet.vue         (unchanged)
│   ├── ActivityFeed.vue            (unchanged)
│   └── ItemStatusCombobox.vue      (unchanged)
├── views/
│   ├── LoginView.vue               ← NEW
│   ├── manager/
│   │   ├── ManagerOrders.vue       (slimmed to ~300 lines)
│   │   ├── ManagerCustomers.vue
│   │   └── order-columns.ts        (uses createColumns callback pattern)
│   ├── printshop/                   ← NEW (placeholder)
│   │   └── PrintshopQueue.vue
│   └── driver/                      ← NEW (placeholder)
│       └── DriverDeliveries.vue
└── router/index.ts                  (updated — auth guards, role routes)
```

---

## Execution Notes

- **One step per Claude Code session** is recommended to keep context manageable
- After each step, **test the app manually** before moving on
- If a step introduces a regression, fix it before proceeding
- Steps 1-5 are low-risk refactors (extracting, not changing logic)
- Step 6 is the highest-risk step (breaking up the monolith) — test thoroughly
- Steps 7-8 are cleanup/dedup
- Step 9 adds new functionality (auth)
- Step 10 is verification