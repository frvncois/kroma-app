-- Kroma Phase 2 Database Schema
-- Run this in Supabase SQL Editor to create all tables, indexes, and RLS policies

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geocoding (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'printshop_manager', 'driver')),
  assigned_shops TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Printshops table
CREATE TABLE printshops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('impression_quebec', 'promo_flash', 'propaganda', 'sticker_pusher', 'studio_c', 'other')),
  internal_notes TEXT DEFAULT '',
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  payment_method TEXT CHECK (payment_method IN ('credit_card', 'paypal', 'bank_transfer', 'cash', 'check', 'other')),
  amount_total NUMERIC(10, 2) DEFAULT 0,
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10, 2) DEFAULT 0,
  assigned_printshop TEXT REFERENCES printshops(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_production', 'on_hold', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'canceled')),
  delivery_method TEXT NOT NULL DEFAULT 'delivery' CHECK (delivery_method IN ('delivery', 'customer_pickup')),
  due_date TIMESTAMPTZ,
  production_start_date TIMESTAMPTZ,
  production_ready_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Files table (polymorphic - supports order_item and driver_task)
CREATE TABLE order_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order_item', 'driver_task')),
  entity_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('artwork', 'proof', 'reference', 'delivery_photo', 'issue_photo', 'other')),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status History table
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes table (polymorphic)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order', 'order_item', 'driver_task')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  departments TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('status_change', 'note_added', 'delivery', 'pickup', 'assignment', 'order_created', 'alert')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order', 'order_item', 'driver_task')),
  entity_id UUID NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  printshop_id TEXT REFERENCES printshops(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'::jsonb
);

-- Driver Tasks table
CREATE TABLE driver_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pickup', 'dropoff', 'errand', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  details TEXT DEFAULT '',
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  complete_by TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deliveries table (Phase 4 - driver routes)
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  route_data JSONB NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Stops table (Phase 4)
CREATE TABLE delivery_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pickup', 'delivery')),
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  eta TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Orders
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order Items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_assigned_printshop ON order_items(assigned_printshop);
CREATE INDEX idx_order_items_status ON order_items(status);
CREATE INDEX idx_order_items_delivery_method ON order_items(delivery_method);
CREATE INDEX idx_order_items_due_date ON order_items(due_date);

-- Order Files (polymorphic index)
CREATE INDEX idx_order_files_entity ON order_files(entity_type, entity_id);

-- Status History
CREATE INDEX idx_status_history_order_item_id ON status_history(order_item_id);
CREATE INDEX idx_status_history_changed_at ON status_history(changed_at DESC);

-- Notes (composite index for polymorphic queries)
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- Activities
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_order_id ON activities(order_id);
CREATE INDEX idx_activities_printshop_id ON activities(printshop_id);
CREATE INDEX idx_activities_timestamp ON activities(timestamp DESC);

-- Driver Tasks
CREATE INDEX idx_driver_tasks_assigned_to ON driver_tasks(assigned_to);
CREATE INDEX idx_driver_tasks_status ON driver_tasks(status);
CREATE INDEX idx_driver_tasks_created_at ON driver_tasks(created_at DESC);

-- Deliveries
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- Delivery Stops
CREATE INDEX idx_delivery_stops_delivery_id ON delivery_stops(delivery_id);
CREATE INDEX idx_delivery_stops_order_item_id ON delivery_stops(order_item_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE printshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_stops ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user's assigned shops
CREATE OR REPLACE FUNCTION get_user_shops()
RETURNS TEXT[] AS $$
  SELECT assigned_shops FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Managers can read all users
CREATE POLICY "Managers can read all users"
  ON users FOR SELECT
  USING (get_user_role() = 'manager');

-- Users can update their own profile (except role and assigned_shops)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- ============================================================================
-- PRINTSHOPS TABLE POLICIES
-- ============================================================================

-- Everyone can read printshops
CREATE POLICY "All authenticated users can read printshops"
  ON printshops FOR SELECT
  TO authenticated
  USING (true);

-- Only managers can modify printshops
CREATE POLICY "Only managers can modify printshops"
  ON printshops FOR ALL
  USING (get_user_role() = 'manager');

-- ============================================================================
-- CUSTOMERS TABLE POLICIES
-- ============================================================================

-- Everyone can read customers
CREATE POLICY "All authenticated users can read customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- Managers can modify customers
CREATE POLICY "Managers can modify customers"
  ON customers FOR ALL
  USING (get_user_role() = 'manager');

-- ============================================================================
-- ORDERS TABLE POLICIES
-- ============================================================================

-- Managers can see all orders
CREATE POLICY "Managers can read all orders"
  ON orders FOR SELECT
  USING (get_user_role() = 'manager');

-- Printshop managers can see orders with items assigned to their shops
CREATE POLICY "Printshop managers can read their shop orders"
  ON orders FOR SELECT
  USING (
    get_user_role() = 'printshop_manager' AND
    EXISTS (
      SELECT 1 FROM order_items
      WHERE order_items.order_id = orders.id
      AND order_items.assigned_printshop = ANY(get_user_shops())
    )
  );

-- Drivers can see orders with items ready for delivery
CREATE POLICY "Drivers can read delivery orders"
  ON orders FOR SELECT
  USING (
    get_user_role() = 'driver' AND
    EXISTS (
      SELECT 1 FROM order_items
      WHERE order_items.order_id = orders.id
      AND order_items.status IN ('ready', 'out_for_delivery')
      AND order_items.delivery_method = 'delivery'
    )
  );

-- Only managers can create/modify orders
CREATE POLICY "Managers can modify orders"
  ON orders FOR ALL
  USING (get_user_role() = 'manager');

-- ============================================================================
-- ORDER ITEMS TABLE POLICIES
-- ============================================================================

-- Managers can see all items
CREATE POLICY "Managers can read all items"
  ON order_items FOR SELECT
  USING (get_user_role() = 'manager');

-- Printshop managers can see items assigned to their shops
CREATE POLICY "Printshop managers can read their shop items"
  ON order_items FOR SELECT
  USING (
    get_user_role() = 'printshop_manager' AND
    assigned_printshop = ANY(get_user_shops())
  );

-- Drivers can see items ready for delivery
CREATE POLICY "Drivers can read delivery items"
  ON order_items FOR SELECT
  USING (
    get_user_role() = 'driver' AND
    status IN ('ready', 'out_for_delivery') AND
    delivery_method = 'delivery'
  );

-- Managers can modify all items
CREATE POLICY "Managers can modify all items"
  ON order_items FOR ALL
  USING (get_user_role() = 'manager');

-- Printshop managers can update status of their shop items (not payment fields)
CREATE POLICY "Printshop managers can update their shop items"
  ON order_items FOR UPDATE
  USING (
    get_user_role() = 'printshop_manager' AND
    assigned_printshop = ANY(get_user_shops())
  );

-- Drivers can update delivery status
CREATE POLICY "Drivers can update delivery status"
  ON order_items FOR UPDATE
  USING (
    get_user_role() = 'driver' AND
    status IN ('ready', 'out_for_delivery') AND
    delivery_method = 'delivery'
  );

-- ============================================================================
-- ORDER FILES TABLE POLICIES
-- ============================================================================

-- Users can read files for entities they can see
CREATE POLICY "Users can read files for accessible entities"
  ON order_files FOR SELECT
  USING (
    CASE entity_type
      WHEN 'order_item' THEN EXISTS (SELECT 1 FROM order_items WHERE id = order_files.entity_id::uuid)
      WHEN 'driver_task' THEN EXISTS (SELECT 1 FROM driver_tasks WHERE id = order_files.entity_id::uuid)
      ELSE false
    END
  );

-- Managers can manage all files
CREATE POLICY "Managers can manage all files"
  ON order_files FOR ALL
  USING (get_user_role() = 'manager');

-- Printshop managers can upload files to their items
CREATE POLICY "Printshop managers can upload files to their items"
  ON order_files FOR INSERT
  WITH CHECK (
    get_user_role() = 'printshop_manager' AND
    entity_type = 'order_item' AND
    EXISTS (
      SELECT 1 FROM order_items
      WHERE order_items.id = order_files.entity_id::uuid
      AND order_items.assigned_printshop = ANY(get_user_shops())
    )
  );

-- Drivers can upload photos to their tasks
CREATE POLICY "Drivers can upload files to their tasks"
  ON order_files FOR INSERT
  WITH CHECK (
    get_user_role() = 'driver' AND
    entity_type = 'driver_task' AND
    EXISTS (
      SELECT 1 FROM driver_tasks
      WHERE driver_tasks.id = order_files.entity_id::uuid
      AND driver_tasks.assigned_to = auth.uid()
    )
  );

-- ============================================================================
-- STATUS HISTORY TABLE POLICIES
-- ============================================================================

-- Users can read status history for items they can see
CREATE POLICY "Users can read status history for accessible items"
  ON status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM order_items
      WHERE order_items.id = status_history.order_item_id
    )
  );

-- Anyone can insert status history (handled by store logic)
CREATE POLICY "Authenticated users can insert status history"
  ON status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- NOTES TABLE POLICIES
-- ============================================================================

-- Users can read notes for entities they can see
CREATE POLICY "Users can read notes for accessible entities"
  ON notes FOR SELECT
  USING (
    CASE entity_type
      WHEN 'order' THEN EXISTS (SELECT 1 FROM orders WHERE id = notes.entity_id::uuid)
      WHEN 'order_item' THEN EXISTS (SELECT 1 FROM order_items WHERE id = notes.entity_id::uuid)
      WHEN 'driver_task' THEN EXISTS (SELECT 1 FROM driver_tasks WHERE id = notes.entity_id::uuid)
      ELSE false
    END
  );

-- Users can create notes on entities they can see
CREATE POLICY "Users can create notes on accessible entities"
  ON notes FOR INSERT
  WITH CHECK (
    CASE entity_type
      WHEN 'order' THEN EXISTS (SELECT 1 FROM orders WHERE id = entity_id::uuid)
      WHEN 'order_item' THEN EXISTS (SELECT 1 FROM order_items WHERE id = entity_id::uuid)
      WHEN 'driver_task' THEN EXISTS (SELECT 1 FROM driver_tasks WHERE id = entity_id::uuid)
      ELSE false
    END
  );

-- Users can update/delete their own notes
CREATE POLICY "Users can modify own notes"
  ON notes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- ACTIVITIES TABLE POLICIES
-- ============================================================================

-- Everyone can read activities (scoping done in app layer)
CREATE POLICY "Authenticated users can read activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can insert activities (activity creation is app-driven)
CREATE POLICY "Authenticated users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- DRIVER TASKS TABLE POLICIES
-- ============================================================================

-- Managers can see all tasks
CREATE POLICY "Managers can read all driver tasks"
  ON driver_tasks FOR SELECT
  USING (get_user_role() = 'manager');

-- Drivers can see tasks assigned to them
CREATE POLICY "Drivers can read assigned tasks"
  ON driver_tasks FOR SELECT
  USING (
    get_user_role() = 'driver' AND
    assigned_to = auth.uid()
  );

-- Managers can create/modify tasks
CREATE POLICY "Managers can manage driver tasks"
  ON driver_tasks FOR ALL
  USING (get_user_role() = 'manager');

-- Drivers can update status of their assigned tasks
CREATE POLICY "Drivers can update assigned task status"
  ON driver_tasks FOR UPDATE
  USING (
    get_user_role() = 'driver' AND
    assigned_to = auth.uid()
  );

-- Drivers can create tasks for themselves
CREATE POLICY "Drivers can create own tasks"
  ON driver_tasks FOR INSERT
  WITH CHECK (
    get_user_role() = 'driver' AND
    assigned_to = auth.uid()
  );

-- ============================================================================
-- DELIVERIES & DELIVERY STOPS POLICIES (Phase 4)
-- ============================================================================

-- Managers can see all deliveries
CREATE POLICY "Managers can read all deliveries"
  ON deliveries FOR SELECT
  USING (get_user_role() = 'manager');

-- Drivers can see their own deliveries
CREATE POLICY "Drivers can read own deliveries"
  ON deliveries FOR SELECT
  USING (
    get_user_role() = 'driver' AND
    driver_id = auth.uid()
  );

-- Drivers can create and update their own deliveries
CREATE POLICY "Drivers can manage own deliveries"
  ON deliveries FOR ALL
  USING (
    get_user_role() = 'driver' AND
    driver_id = auth.uid()
  );

-- Delivery stops follow delivery access
CREATE POLICY "Users can read stops for accessible deliveries"
  ON delivery_stops FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM deliveries WHERE id = delivery_stops.delivery_id)
  );

CREATE POLICY "Users can manage stops for accessible deliveries"
  ON delivery_stops FOR ALL
  USING (
    EXISTS (SELECT 1 FROM deliveries WHERE id = delivery_stops.delivery_id)
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_tasks_updated_at
  BEFORE UPDATE ON driver_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Optional - for development)
-- ============================================================================

-- Insert printshops
INSERT INTO printshops (id, name, address, lat, lng) VALUES
  ('in_house', 'In House', '4641 Av. Papineau, Montréal, QC H2H 1V4', 45.5413, -73.5798),
  ('victor', 'Victor', '123 Victor St, Montréal, QC H1V 2B3', 45.5500, -73.5900),
  ('studio_c', 'Studio C', '456 Studio Ave, Montréal, QC H2X 1Y5', 45.5600, -73.5700)
ON CONFLICT (id) DO NOTHING;

-- Note: User creation must be done through Supabase Auth UI or API
-- After creating auth users, insert them into the users table with roles
