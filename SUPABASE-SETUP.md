# Supabase Setup Guide - Kroma Phase 2

This guide walks through setting up Supabase for the Kroma application.

## Prerequisites

- Supabase account (sign up at https://supabase.com)
- Node.js and npm installed locally

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: kroma-production (or kroma-dev for development)
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to provision (~2 minutes)

## Step 2: Configure Environment Variables

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

3. Create a `.env` file in your project root (if it doesn't exist):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI (for route optimization - Phase 1)
VITE_OPENAI_API_KEY=your-openai-key-here

# Mapbox (for route visualization)
VITE_MAPBOX_TOKEN=your-mapbox-token-here
```

4. Add `.env` to your `.gitignore` (should already be there)

## Step 3: Run Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the SQL Editor
5. Click "Run" or press Cmd/Ctrl + Enter
6. Wait for execution to complete (~30 seconds)
7. Verify: You should see "Success. No rows returned" at the bottom

## Step 4: Create Test Users

Supabase Auth requires users to be created through the Auth system. You have two options:

### Option A: Using Supabase Dashboard (Recommended for Development)

1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. For each test user from CLAUDE.md, create with:
   - **Email**: Use the exact emails from the table below
   - **Password**: Set to `1234` for development
   - **Auto Confirm User**: ✅ Check this box

Create these users:

| Email             | Role              | Assigned Shops |
|-------------------|-------------------|----------------|
| manager@kroma.com | manager           | [] (empty)     |
| victor@kroma.com  | printshop_manager | ['victor']     |
| alex@kroma.com    | driver            | [] (empty)     |
| sam@kroma.com     | driver            | [] (empty)     |
| jordan@kroma.com  | driver            | [] (empty)     |

4. After creating each Auth user, note their UUID (shown in the dashboard)

5. Go to **SQL Editor** and run this query to insert user profiles:

```sql
-- Insert user profiles
-- Replace the UUIDs below with the actual UUIDs from Supabase Auth

INSERT INTO users (id, email, name, role, assigned_shops) VALUES
  ('uuid-from-manager-auth', 'manager@kroma.com', 'Manager User', 'manager', '{}'),
  ('uuid-from-victor-auth', 'victor@kroma.com', 'Victor Shop Manager', 'printshop_manager', '{"victor"}'),
  ('uuid-from-alex-auth', 'alex@kroma.com', 'Alex Driver', 'driver', '{}'),
  ('uuid-from-sam-auth', 'sam@kroma.com', 'Sam Driver', 'driver', '{}'),
  ('uuid-from-jordan-auth', 'jordan@kroma.com', 'Jordan Driver', 'driver', '{}');
```

### Option B: Using SQL (For automated setup)

Run this in SQL Editor to create users programmatically:

```sql
-- Note: This requires the postgres role and may not work in all Supabase tiers
-- If this fails, use Option A above

DO $$
DECLARE
  manager_id UUID;
  victor_id UUID;
  alex_id UUID;
  sam_id UUID;
  jordan_id UUID;
BEGIN
  -- Create auth users (simplified - in production use proper Supabase Auth API)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token)
  VALUES
    ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'manager@kroma.com', crypt('1234', gen_salt('bf')), NOW(), NOW(), NOW(), '')
  RETURNING id INTO manager_id;

  -- Repeat for other users...
  -- (Full script available in supabase-seed-users.sql if needed)

  -- Insert user profiles
  INSERT INTO users (id, email, name, role, assigned_shops) VALUES
    (manager_id, 'manager@kroma.com', 'Manager User', 'manager', '{}'),
    (victor_id, 'victor@kroma.com', 'Victor Shop Manager', 'printshop_manager', '{"victor"}'),
    (alex_id, 'alex@kroma.com', 'Alex Driver', 'driver', '{}'),
    (sam_id, 'sam@kroma.com', 'Sam Driver', 'driver', '{}'),
    (jordan_id, 'jordan@kroma.com', 'Jordan Driver', 'driver', '{}');
END $$;
```

## Step 5: Verify RLS Policies

1. Go to **Authentication** → **Policies**
2. You should see policies for all tables:
   - users (3 policies)
   - printshops (2 policies)
   - customers (2 policies)
   - orders (4 policies)
   - order_items (6 policies)
   - order_files (3 policies)
   - status_history (2 policies)
   - notes (4 policies)
   - activities (2 policies)
   - driver_tasks (5 policies)
   - deliveries (3 policies)
   - delivery_stops (2 policies)

3. If any are missing, re-run the schema script

## Step 6: Configure Storage (For File Uploads)

File uploads are now fully implemented. Follow these steps to configure Supabase Storage:

### Create Storage Bucket

1. Go to **Storage** → **New bucket**
2. Fill in bucket details:
   - **Name**: `files` (must be exactly "files")
   - **Public bucket**: ❌ Unchecked (private bucket)
   - **Allowed MIME types**: Leave empty (allow all)
   - **File size limit**: Leave default or set to your preference (e.g., 50MB)
3. Click "Create bucket"

### Add Storage Policies

The bucket is private, so you need to add RLS policies for access control.

1. Click on the `files` bucket
2. Go to **Policies** tab
3. Click "New policy"

#### Policy 1: Authenticated users can upload files

```sql
-- Policy name: Authenticated users can upload files
-- Allowed operation: INSERT
-- Policy definition:

((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL))
```

Or use the UI:
- **Policy name**: Authenticated users can upload files
- **Allowed operation**: INSERT
- **Target roles**: authenticated
- **USING expression**: `bucket_id = 'files'`
- **WITH CHECK expression**: `true`

#### Policy 2: Users can read files for entities they have access to

```sql
-- Policy name: Users can read accessible files
-- Allowed operation: SELECT
-- Policy definition:

((bucket_id = 'files'::text) AND (
  -- Managers can see everything
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'
  OR
  -- Others can see files they have access to via order_files RLS
  EXISTS (
    SELECT 1 FROM public.order_files
    WHERE order_files.file_url = storage.objects.name
  )
))
```

Or use the UI:
- **Policy name**: Users can read accessible files
- **Allowed operation**: SELECT
- **Target roles**: authenticated
- **USING expression**: (paste the expression above)

#### Policy 3: Users can delete files they uploaded (optional)

```sql
-- Policy name: Users can delete own files
-- Allowed operation**: DELETE
-- Policy definition:

((bucket_id = 'files'::text) AND (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'
  OR
  EXISTS (
    SELECT 1 FROM public.order_files
    WHERE order_files.file_url = storage.objects.name
    AND order_files.uploaded_by = auth.uid()
  )
))
```

### Verify Storage Setup

1. Go to **Storage** → **files** bucket
2. You should see:
   - ✅ Bucket is private
   - ✅ 2-3 policies are active
   - ✅ Policies tab shows your policies

3. Test file path structure:
   - Files will be organized as: `order_item/{item_id}/{timestamp}-{filename}`
   - Example: `order_item/abc123.../1707123456789-artwork.pdf`

## Step 7: Enable Realtime

Realtime should be enabled by default, but verify:

1. Go to **Database** → **Replication**
2. Ensure these tables have Realtime enabled:
   - ✅ orders
   - ✅ order_items
   - ✅ notes
   - ✅ activities
   - ✅ driver_tasks
   - ✅ deliveries
   - ✅ delivery_stops

3. If not enabled, click the toggle for each table

## Step 8: Test the Application

### Basic Auth Test

1. Start your development server:
```bash
npm run dev
```

2. Navigate to http://localhost:5173

3. Try logging in with a test user:
   - Email: `manager@kroma.com`
   - Password: `1234`

4. You should:
   - ✅ See a loading screen while auth initializes
   - ✅ Successfully log in
   - ✅ See the Manager dashboard (no orders yet - database is empty)
   - ✅ Not see any console errors

5. Open browser DevTools → Network tab:
   - Filter by "supabase"
   - You should see successful requests to your Supabase project

### File Upload Test (After Step 9 - Seed Data)

Once you have test data in the database, test file uploads:

1. **Upload a file:**
   - Log in as `manager@kroma.com`
   - Go to Orders view
   - Click on an order to open OrderDetailSheet
   - Click "Upload File" button
   - Select a file (PDF, PNG, AI, etc.)
   - ✅ File should upload successfully
   - ✅ Toast notification: "File uploaded"

2. **Verify in Supabase:**
   - Go to Supabase **Storage** → **files** bucket
   - ✅ File appears in `order_item/{item-id}/` folder
   - Go to **Table Editor** → **order_files** table
   - ✅ New record exists with correct `entity_type`, `entity_id`, `file_url`, `file_name`, `file_type`

3. **Download the file:**
   - In the OrderDetailSheet, click the download button next to the file
   - ✅ File downloads to your computer
   - ✅ File opens correctly

4. **Test realtime updates:**
   - Open the same order in two browser tabs (or two different browsers)
   - Upload a file in one tab
   - ✅ File appears automatically in the other tab (realtime subscription)

5. **Test file count:**
   - Go to the Orders table view
   - Look at the "Files" column
   - ✅ Count matches the number of production files (artwork/proof/reference only, not delivery photos)

6. **Test role-based access:**
   - Log in as a printshop manager (`victor@kroma.com`)
   - Open an order with items NOT assigned to their shop
   - ✅ Should not see files for items they don't have access to
   - Open an order with items assigned to their shop
   - ✅ Should see files for those items
   - ✅ Can upload files to their items

7. **Test file types:**
   - Try uploading different file types:
     - PDF (artwork)
     - PNG/JPG (reference images)
     - AI/PSD (design files)
     - DOCX (specifications)
   - ✅ All should upload successfully
   - ✅ File type badge shows correctly in UI

## Step 9: Seed Sample Data (Optional)

To test with sample data, you can:

1. Manually create a customer in the app (ManagerCustomers view)
2. Manually create an order (ManagerOrders view → New Order)
3. Or create a seed data script (see below)

### Sample Seed Script

Run this in SQL Editor to create a test customer and order:

```sql
-- Insert a test customer
INSERT INTO customers (id, name, email, phone, address, lat, lng) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Customer', 'test@example.com', '555-1234', '123 Test St, Montréal, QC H1A 1A1', 45.5017, -73.5673);

-- Insert a test order
INSERT INTO orders (id, customer_id, source, payment_status, amount_total) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'other', 'unpaid', 100.00);

-- Insert test order items
INSERT INTO order_items (order_id, product_name, quantity, unit_price, assigned_printshop, status, delivery_method) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Business Cards', 1000, 50.00, 'in_house', 'new', 'delivery'),
  ('00000000-0000-0000-0000-000000000002', 'Brochures', 500, 50.00, 'victor', 'new', 'delivery');
```

## Troubleshooting

### "Missing Supabase environment variables" error

- Ensure `.env` file exists in project root
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart dev server after adding `.env` variables

### Users can't log in

- Verify user exists in **Authentication** → **Users**
- Verify user profile exists in `users` table (run `SELECT * FROM users`)
- Check browser console for auth errors
- Ensure RLS policies are enabled

### Data not showing up

- Check browser Network tab for 401/403 errors (RLS blocking access)
- Verify user role is correct (`SELECT role FROM users WHERE email = 'your@email.com'`)
- Check that realtime is enabled for the table
- Look for console errors

### RLS Policy Errors

If you see "new row violates row-level security policy":

1. Check the relevant policy in **Authentication** → **Policies**
2. Verify the policy's USING/WITH CHECK clauses
3. Test the policy with SQL:
```sql
-- Test as specific user
SET request.jwt.claims.sub = 'user-uuid-here';
-- Then try your INSERT/UPDATE/DELETE
```

### Realtime Not Working

- Verify table is enabled in **Database** → **Replication**
- Check browser console for WebSocket connection errors
- Ensure Supabase plan supports realtime (should work on free tier)

## Production Considerations

Before going to production:

1. **Change all passwords** - Don't use `1234` for test users
2. **Review RLS policies** - Ensure they match your security requirements
3. **Set up database backups** - Configure in Supabase dashboard
4. **Enable email confirmation** - In **Authentication** → **Settings**
5. **Configure SMTP** - For password resets and confirmations
6. **Set up monitoring** - Use Supabase logs and metrics
7. **Move API keys to server** - OpenAI key should not be in client (Phase 2+)
8. **Enable rate limiting** - Protect against abuse
9. **Set up CI/CD** - Automated deployments with Vercel
10. **Review storage limits** - Ensure plan supports expected file upload volume

## Next Steps

- ✅ Phase 2 Complete - Supabase integration done
- 📋 Phase 3 - Webhook ingestion (Shopify, web forms)
- 📋 Phase 4 - Google Maps route optimization
- 📋 Phase 5 - Billing webhooks and analytics

## Support

- Supabase Docs: https://supabase.com/docs
- Kroma Project Docs: See `MASTER.MD` and `CLAUDE.md`
- Issues: Create an issue in your project repository
