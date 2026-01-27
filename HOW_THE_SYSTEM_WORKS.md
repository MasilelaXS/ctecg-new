# CTECG System - How It All Works
**Generated:** January 24, 2026  
**Focus:** Application Flow, User Journeys, and System Relationships

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Mobile App - Complete User Experience](#mobile-app---complete-user-experience)
3. [Admin Panel - Complete Admin Experience](#admin-panel---complete-admin-experience)
4. [How Endpoints Work Together](#how-endpoints-work-together)
5. [Real-World User Scenarios](#real-world-user-scenarios)
6. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

CTECG is an ISP customer management platform that connects customers to their internet service data. Here's what makes it work:

**The Players:**
- **Customers** use a React Native mobile app to check usage, pay bills, get support
- **Support Staff** use a React/Vite admin panel to help customers, manage ads, view logs
- **PHP Backend** acts as the middleman, orchestrating everything
- **Azotel ISP System** is the source of truth for customer data, usage, billing
- **Yoco** processes payments
- **Firebase** sends push notifications
- **MariaDB** stores user accounts, sessions, support tickets, and system data

**The Key Concept:**
The system is a **bridge between Azotel and customers**. Azotel has all the ISP data (who owes what, who used how much data, who's online), but it's not user-friendly. CTECG makes that data accessible through beautiful mobile and web interfaces.

---

## Mobile App - Complete User Experience

### App Structure

The mobile app has **two completely different modes**:

**🔒 Logged Out Mode (Authentication Screens):**
- LoginScreen
- VerifyOTPScreen (for new accounts)
- ResetPasswordScreen
- ForgotEmailScreen
- CreatePasswordScreen (when admin resets password)

**✅ Logged In Mode (Main App with Bottom Tabs):**
- **Dashboard Tab** - Overview of everything
- **Usage Tab** - Data consumption charts
- **Billing Tab** - Invoices and payment
- **Support Tab** - Create tickets, view FAQ

### User Journey 1: New Customer Registration

**What the user sees:**
1. Opens app → sees Login screen
2. Taps "Register" button
3. Enters their **Client Code** (like "WL12345" - this is from their ISP invoice)
4. App validates: "Enter email and phone to create account"
5. User fills in email, phone, creates password
6. App says "Check your email for verification code"
7. User enters 6-digit OTP from email
8. Account activated → redirected to Dashboard

**What actually happens behind the scenes:**

**Step 1-3: Client Code Verification**
```
Mobile App → POST /auth.php?action=verify-client-code
            { client_code: "WL12345" }
            
Backend → Calls Azotel API → searchByInvoicingId("WL12345")
       → Gets customer data from Azotel
       → Returns: { customer_name, customer_id, email }
       
Mobile App ← Receives customer data
          ← Shows registration form with pre-filled email
```

**What's happening:** The backend asks Azotel "Does this client code exist?" If yes, Azotel returns the customer's details. This proves the user is a real CTECG customer.

**Step 4-6: Account Creation**
```
Mobile App → POST /auth.php?action=register
            { client_code, email, phone, password }
            
Backend → Checks if email/phone already registered (in local DB)
       → Verifies client code with Azotel again
       → Hashes password with bcrypt
       → Generates 6-digit OTP (expires in 15 min)
       → Creates user in users table (status: pending_verification)
       → Creates user_account in user_accounts table
       → Sends OTP email via SMTP
       → Logs action in auth_logs
       
Mobile App ← { user_id, email, otp_sent: true }
          ← Redirects to VerifyOTPScreen
```

**What's happening:** User record is created but marked "pending_verification". The OTP is stored in the user record itself (`users.otp_code` and `users.otp_expires_at`).

**Step 7-8: OTP Verification**
```
Mobile App → POST /auth.php?action=verify-otp
            { email, otp_code: "123456" }
            
Backend → Finds user by email
       → Checks if OTP matches and hasn't expired
       → If valid: Updates user.account_status = 'active'
       →           Updates user_accounts.status = 'active'
       →           Generates 30-day auth token (SHA256)
       →           Stores token in user_tokens table
       →           Logs successful verification in auth_logs
       
Mobile App ← { verified: true, token: "abc123..." }
          ← Stores token in AsyncStorage
          ← Redirects to Dashboard
```

**What's happening:** OTP verification activates the account. The token is what the app sends with every future request to prove the user is logged in.

---

### User Journey 2: Daily Use - Checking Dashboard

**What the user sees:**
1. Opens app → automatically logged in (token remembered)
2. Dashboard loads showing:
   - Account name and status badge (Current/Post)
   - Online status indicator (green = online, red = offline)
   - Package name and speed
   - Usage progress bar (or "Uncapped" badge)
   - Quick action buttons (View Usage, Pay Bill, Support)
   - Advertisement banner at top
3. Can pull down to refresh

**What actually happens:**

**Step 1: App Launch & Authentication**
```
Mobile App → Reads token from AsyncStorage
          → Sets Authorization: Bearer <token> header
          → GET /mobile-api.php?endpoint=dashboard
          
Backend → Extracts token from Authorization header
       → Looks up token in user_tokens table
       → Checks if token expired (30 days)
       → Gets user_id from token
       → Gets user's invoicingid and customerid from users table
```

**What's happening:** Every API call starts with authentication. The token tells the backend WHO is making the request.

**Step 2: Fetching Dashboard Data**
```
Backend (mobile-api.php, getDashboard() method):
  
  1. Call Azotel API with customerid:
     → searchByInvoicingId(invoicingid) - gets customer object
     → getCustomer(customerid) - detailed customer info
     → getSubscriptions(customerid) - active packages
     → getUsage(customerid) - data usage this month
     → getInvoices(customerid) - billing history
  
  2. Process Azotel responses:
     → Clean customer name (remove ###, **, ++ markers)
     → Determine account status:
        - If customerstatus1 = 'current' → Status: Active, Badge: Current
        - If customerstatus1 = 'post' → Status: Suspended, Badge: Post
     → Parse package details:
        - Extract package name from productdescription
        - Calculate speed from description (kbps → Mbps)
        - Determine if uncapped or has data limit
     → Calculate usage percentage:
        - Current month usage / package limit × 100
        - If uncapped, return null (shows "Unlimited")
  
  3. Get online status:
     → Query Azotel RADIUS sessions
     → Check if customer has active session
     → Return online: true/false with last_seen timestamp
  
  4. Aggregate everything:
     → customer: { name, number, status, account_type, status_reason }
     → usage: { current_month: { total_gb, download_gb, upload_gb },
                package_details: { name, speed, limit_gb, is_uncapped } }
     → invoices: [{ number, amount, due_date, status }]
     → online_status: { online, last_seen }

Mobile App ← Receives single dashboard object with everything
          ← DashboardScreen.tsx renders all components
          ← Shows usage card with color-coded progress bar
          ← Displays online status indicator
```

**What's happening:** The backend makes **5 separate calls to Azotel**, processes all the responses, cleans up the data, calculates percentages and statuses, and returns ONE clean dashboard object. The mobile app just displays it.

**Why it's designed this way:** Azotel's API returns raw, messy data. The PHP backend does the heavy lifting of cleaning, calculating, and formatting so the mobile app stays simple.

---

### User Journey 3: Multi-Account Linking (Power User Feature)

**Scenario:** John has 2 internet accounts - one at home (WL12345) and one at his office (WL67890). He wants to manage both from one login.

**What the user sees:**
1. Opens hamburger menu → "Link Another Account"
2. Enters the second client code: "WL67890"
3. App shows: "Confirm linking to john@email.com"
4. Enters 6-digit OTP sent to email
5. Success! Now sees "Switch Account" dropdown in header

**What actually happens:**

**Step 1-2: Request Account Link**
```
Mobile App → POST /auth.php?action=link-account
            { client_code: "WL67890" }
            (Authenticated with John's token)
            
Backend → Gets John's user_id from token
       → Calls Azotel to verify WL67890 exists
       → Checks if WL67890 already linked to another user
       → If already linked:
          - Generates OTP
          - Inserts into account_link_otps table:
            { requesting_user_id: John's ID,
              target_invoicing_id: "WL67890",
              target_user_id: other_user_id,
              otp_code: "654321" }
          - Sends OTP to the email of WL67890's owner
       → If not linked (new account):
          - Generates OTP
          - Inserts into account_link_otps
          - Sends OTP to John's email
       
Mobile App ← { link_type: "existing_user" or "new_account",
             target_email: "***@****.com",
             otp_sent: true }
```

**What's happening:** The system needs to figure out if WL67890 is already registered by someone else. If yes, it sends OTP to that person's email (security!). If no, it sends to John's email.

**Step 3-4: Verify and Link**
```
Mobile App → POST /auth.php?action=verify-account-link
            { otp_code: "654321", client_code: "WL67890" }
            
Backend → Finds OTP record in account_link_otps
       → Validates OTP hasn't expired
       → If linking to existing user:
          - Creates bidirectional link in user_account_links:
            { primary_user_id: John's ID, linked_user_id: other_user_id }
            { primary_user_id: other_user_id, linked_user_id: John's ID }
       → If new account:
          - Creates user_account record:
            { user_id: John's ID,
              client_code: "WL67890",
              customer_id: from_azotel,
              account_name: "Office Account",
              is_primary: 0 }
       → Marks OTP as used
       → Logs account_linked in auth_logs
       
Mobile App ← { success: true, linked_accounts: [...] }
          ← Updates UI to show account switcher
```

**What's happening:** The link is created in the database. Now John's token can access data from BOTH accounts.

**Step 5: Switching Accounts**
```
Mobile App → User taps "Office Account" in switcher
          → POST /mobile-api.php?endpoint=switch-account
            { target_user_id: other_user_id }
            
Backend → Gets John's current token from user_tokens table
       → Updates token record:
          { current_viewing_user_id: other_user_id }
       → Does NOT change user_id (still John's token)
       
Mobile App ← { success: true }
          ← Refreshes dashboard
          
Mobile App → GET /mobile-api.php?endpoint=dashboard
            (Same token, but now backend knows to fetch OTHER account's data)
            
Backend → Reads token's current_viewing_user_id
       → Gets OTHER user's invoicingid and customerid
       → Calls Azotel with THOSE IDs
       → Returns office account's dashboard data
       
Mobile App ← Displays office account data
```

**What's happening:** The token stays the same, but the backend tracks "which account is John currently viewing?" All subsequent API calls return that account's data.

**Why it's designed this way:** Security. John's token can only access accounts he's explicitly linked. The backend validates the link exists before allowing the switch.

---

### User Journey 4: Making a Payment

**What the user sees:**
1. Dashboard → taps "Pay Bill" button
2. Sees payment form with amount pre-filled (from latest invoice)
3. Can edit amount
4. Taps "Pay with Yoco"
5. Redirected to Yoco's payment page (opens in browser)
6. Enters card details, pays
7. Redirected back to app
8. Sees "Payment Successful!" message

**What actually happens:**

**Step 1-4: Create Payment Session**
```
Mobile App → POST /mobile-api.php?endpoint=yoco-create-checkout
            { amount: 599.00,
              description: "Internet bill payment" }
            
Backend → Gets user's invoicing_id from token
       → Generates unique payment_reference
       → Calls Yoco API:
          POST https://payments.yoco.com/api/checkouts
          { amount: 59900,  // cents
            currency: "ZAR",
            successUrl: "ctecgapp://payment-success",
            cancelUrl: "ctecgapp://payment-cancel",
            metadata: { user_id, invoicing_id, reference } }
       → Yoco creates checkout session
       → Inserts into yoco_payments table:
          { user_id, invoicing_id, payment_reference,
            checkout_id: from_yoco,
            amount: 599.00,
            status: 'pending',
            redirect_url: yoco_checkout_url }
       
Mobile App ← { checkout_id, redirect_url }
          ← Opens redirect_url in browser via Linking.openURL()
```

**What's happening:** The backend talks to Yoco to create a payment session. Yoco returns a special URL that the app opens in the phone's browser.

**Step 5-6: User Pays on Yoco**
```
Phone Browser → User on Yoco's secure payment page
             → Enters card number, CVV, etc.
             → Yoco processes payment
             → Yoco's server → POST https://app.ctecg.co.za/api/yoco-webhook.php
                               { checkout_id, status: "completed" }
```

**What's happening:** The user is now on Yoco's website, NOT in the app. Yoco handles the payment securely. When payment completes, Yoco sends a webhook to the backend.

**Step 7-8: Webhook Updates Payment**
```
Yoco → POST /yoco-webhook.php
      { checkout_id: "ch_abc123", status: "completed" }
      
Backend (yoco-webhook.php) → Finds payment by checkout_id
                           → Updates yoco_payments:
                             { status: 'completed',
                               completed_at: NOW() }
                           → Logs payment_made in activity_log
                           → Sends push notification:
                             "Payment successful! R599.00 received"
                           
Mobile App ← Yoco redirects to: ctecgapp://payment-success?checkout_id=ch_abc123
          ← App detects deep link
          ← GET /mobile-api.php?endpoint=yoco-payment-status?checkout_id=ch_abc123
          ← Backend returns { status: 'completed' }
          ← Shows success screen
```

**What's happening:** Three things happen simultaneously:
1. Yoco tells backend "payment completed" via webhook
2. Yoco redirects browser back to app via deep link
3. App asks backend "did my payment work?" and gets confirmation

**Why it's designed this way:** The webhook is the source of truth. The deep link just brings the user back to the app. The app then double-checks the status with the backend.

---

### How Mobile App Screens Work Together

**DashboardScreen.tsx:**
- Calls `/mobile-api.php?endpoint=dashboard` on mount
- Displays aggregated data from Azotel
- Shows ads from `/admin-api.php?path=/ads/active?placement=dashboard_top`
- Tracks ad views: POST `/admin-api.php?path=/ads/{id}/view`
- Pull-to-refresh calls dashboard endpoint again
- Online status auto-refreshes every 30 seconds

**UsageScreen.tsx:**
- Calls `/mobile-api.php?endpoint=usage-detailed`
- Displays chart of daily usage
- Shows breakdown: download vs upload
- Compares current month vs previous months
- All data comes from Azotel's usage API

**BillingScreen.tsx:**
- Calls `/mobile-api.php?endpoint=billing-detailed`
- Lists all invoices from Azotel
- Each invoice shows: number, date, amount, status
- Tapping "Pay Now" navigates to MakePaymentScreen
- Payment history shows Yoco payments from local DB

**SupportScreen.tsx:**
- Calls `/support.php?action=list` for user's tickets
- Shows ticket list with status badges
- Create ticket button → opens form
- POST `/support.php?action=create` sends ticket
- Tickets saved in app_support_tickets table
- Email notification sent to support team

---

## Admin Panel - Complete Admin Experience

### App Structure

The admin panel is a **single-page application** with these routes:

- `/login` - Admin authentication
- `/dashboard` - Stats overview (not implemented yet, redirects to support)
- `/support` - Customer search and support tools ⭐ **Main screen**
- `/support/customer/:id` - Detailed customer view
- `/ads` - Advertisement management
- `/logs` - Activity logs viewer

All routes except `/login` require authentication (JWT token).

### Admin Journey 1: First-Time Admin Login

**What the admin sees:**
1. Opens admin panel → sees login form
2. Enters username/email: "john.admin"
3. Enters password field is empty (first time login)
4. Taps "Login"
5. Screen says: "Check your email for OTP to set password"
6. Opens email, gets 6-digit OTP
7. Returns to admin panel, enters OTP and new password
8. Logged in → redirected to Dashboard

**What actually happens:**

**Step 1-4: First Login Attempt**
```
Admin Panel → POST /admin-api.php?path=/admin/login
             { username: "john.admin", password: "" }
             
Backend → SELECT * FROM admin_users WHERE username = 'john.admin'
       → Finds admin user
       → Checks is_active = 1 (yes)
       → Checks password_hash field → IT'S NULL!
       → This means first-time login
       → Generates 6-digit OTP: "789012"
       → INSERT INTO otp_codes:
          { email: admin.email,
            code: "789012",
            type: 'admin_password_setup',
            expires_at: NOW() + 15 minutes }
       → Sends email via EmailService:
          Subject: "[CTECG Admin] Set Your Password - OTP"
          Body: "Your OTP: 789012"
       → Logs action in admin_logs
       
Admin Panel ← { requires_password_setup: true,
               email: "john@ctecg.co.za",
               full_name: "John Smith" }
            ← Shows OTP + password setup screen
```

**What's happening:** The `admin_users` table has `password_hash` that can be NULL. This is intentional for first-time setup. When NULL, the backend doesn't verify password - instead it sends an OTP.

**Step 5-8: Set Password**
```
Admin Panel → POST /admin-api.php?path=/admin/set-password
             { email: "john@ctecg.co.za",
               otp: "789012",
               password: "NewSecurePass123!" }
               
Backend → SELECT * FROM otp_codes 
          WHERE email = 'john@ctecg.co.za'
          AND code = '789012'
          AND type = 'admin_password_setup'
          AND expires_at > NOW()
          AND used_at IS NULL
       → OTP found and valid
       → UPDATE otp_codes SET used_at = NOW() WHERE id = otp_id
       → Hash password with bcrypt
       → UPDATE admin_users SET password_hash = $hash WHERE email = ...
       → Generate JWT token:
          { admin_id, username, role,
            iat: NOW(),
            exp: NOW() + 24 hours }
       → Sign with HMAC-SHA256
       
Admin Panel ← { token: "eyJ0eXAi...",
               admin: { id, username, email, full_name, role } }
            ← Stores token in localStorage
            ← Redirects to /dashboard
```

**What's happening:** OTP is verified, password is set, JWT is generated. The JWT contains admin info and expires in 24 hours. Admin must login again after 24 hours.

---

### Admin Journey 2: Looking Up a Customer

**What the admin sees:**
1. On Support screen, search bar at top
2. Types "john@email.com"
3. List filters to show matching customers
4. Clicks on "John Doe - WL12345"
5. Customer Details screen opens with tabs:
   - Overview (account info, health score)
   - Accounts (linked accounts, online status)
   - Notes (internal staff notes)
   - Activity (timeline of actions)
   - History (login history)
   - Tickets (support tickets)
   - Tools (admin actions: reset password, change email, etc.)

**What actually happens:**

**Step 1-3: Search**
```
Admin Panel → Types in search box (debounced)
           → JavaScript filters local array:
             users.filter(u =>
               u.email.includes(search) ||
               u.invoicing_id.includes(search)
             )
           → No API call needed (users already loaded)
```

**What's happening:** On mount, SupportScreen loads all users with `GET /admin-api.php?path=/admin/users?page=1&limit=50`. The search is client-side filtering for speed.

**Step 4: Load Customer Details**
```
Admin Panel → navigate(`/support/customer/${user.id}`)
           → CustomerDetailsScreen mounts
           → GET /admin-api.php?path=/admin/users/{id}
           
Backend → SELECT u.*, 
                 GROUP_CONCAT(ua.client_code) as linked_codes
          FROM users u
          LEFT JOIN user_accounts ua ON u.id = ua.user_id
          WHERE u.id = {id}
          GROUP BY u.id
       → Gets user record with all linked accounts
       → For each account:
          - Calls Azotel to get current status
          - Gets online status from RADIUS
       → Returns comprehensive user object:
          { id, email, phone, invoicing_id, account_status,
            last_login, created_at,
            accounts: [
              { id, client_code, account_name, customer_name,
                client_type, status, last_accessed_at,
                azotel_data: { balance, package, status },
                online_status: { online, last_seen } }
            ] }
            
Admin Panel ← Displays Overview tab with all info
```

**What's happening:** The backend fetches user from local DB, then enriches with real-time data from Azotel. This gives admin both historical data (from local DB) and current status (from Azotel).

**Step 5: Admin Views Activity Tab**
```
Admin Panel → Clicks "Activity" tab
           → useEffect detects tab change
           → GET /admin-api.php?path=/admin/users/{id}/activity?limit=50
           
Backend → SELECT * FROM notifications  
          (actually customer_activity_log)
          WHERE user_id = {id}
          ORDER BY created_at DESC
          LIMIT 50
       → Returns activity log entries:
          [{ activity_type: 'login',
             description: 'User logged in from mobile app',
             source: 'app',
             ip_address: '102.xxx.xxx.xxx',
             created_at: '2026-01-24 10:30:00' },
           { activity_type: 'payment_made',
             description: 'Payment of R599.00 via Yoco',
             metadata: { amount: 599.00, reference: 'PAY-123' },
             created_at: '2026-01-23 14:15:00' },
           ...]
           
Admin Panel ← Renders timeline with icons and colors
```

**What's happening:** Activity log is pre-populated by the backend whenever significant events happen (login, payment, ticket creation, etc.). It's a read-only audit trail.

---

### Admin Journey 3: Adding Internal Notes

**Scenario:** Customer called support complaining about slow speeds. Admin wants to log the conversation.

**What the admin sees:**
1. On customer details page, clicks "Notes" tab
2. Sees previous notes from other admins
3. Clicks "Add Note" button
4. Fills form:
   - Note type: "Technical"
   - Note text: "Customer reports slow speeds during evening. Advised to restart router. Will monitor."
   - Pin this note: ✓ checked
5. Submits
6. Note appears at top with pushpin icon

**What actually happens:**

```
Admin Panel → POST /admin-api.php?path=/admin/users/{id}/notes
             { note: "Customer reports slow speeds...",
               note_type: "technical",
               is_pinned: true }
             (Authorization: Bearer <jwt_token>)
             
Backend → Verifies JWT token → gets admin_id
       → INSERT INTO customer_notes:
          { user_id: customer_id,
            account_id: NULL,  // note is for user, not specific account
            parent_note_id: NULL,  // not a reply
            note: "Customer reports...",
            note_type: 'technical',
            is_pinned: 1,
            is_deleted: 0,
            created_by: admin_id,
            created_at: NOW() }
       → Logs action in admin_logs:
          { admin_id, action: 'Customer note added',
            entity_type: 'customer_note', entity_id: new_note_id }
            
Admin Panel ← { success: true, note_id: 123 }
           ← Refreshes notes list
           ← GET /admin-api.php?path=/admin/users/{id}/notes
           ← Backend returns all notes ORDER BY is_pinned DESC, created_at DESC
           ← Pinned notes appear first
```

**What's happening:** Notes are stored in `customer_notes` table with soft-delete support. The `is_pinned` flag keeps important notes at the top. The `created_by` field tracks which admin wrote it.

**Admin Reply to Note (Threading):**
```
Admin Panel → Clicks "Reply" on a note
           → Form appears under the note
           → POST /admin-api.php?path=/admin/users/{id}/notes
             { note: "Update: Issue resolved after router restart",
               note_type: "technical",
               parent_note_id: 123 }  // This is the key!
               
Backend → INSERT INTO customer_notes:
          { user_id, parent_note_id: 123,  // Links to original note
            note: "Update: Issue resolved...",
            created_by: admin_id }
            
Admin Panel ← Note appears indented under parent
```

**What's happening:** `parent_note_id` creates a threading relationship. The frontend shows replies indented under their parent note.

---

### Admin Journey 4: Managing Advertisements

**What the admin sees:**
1. Navigates to /ads
2. Sees table of active ads:
   - "Summer Promo" - dashboard_top - Active ✅
   - "Fiber Upgrade" - modal - Scheduled (starts tomorrow)
   - "Black Friday" - billing - Ended (yesterday)
3. Clicks "Create Ad" button
4. Fills form:
   - Title: "Weekend Special"
   - Placement: dashboard_bottom
   - Upload image (selects file)
   - Link URL: https://ctecg.co.za/weekend-special
   - Start date: Today
   - End date: +3 days
   - Active: ✓ checked
5. Submits
6. Ad appears in table

**What actually happens:**

```
Admin Panel → POST /admin-api.php?path=/admin/ads
             (multipart/form-data)
             { title: "Weekend Special",
               placement: "dashboard_bottom",
               image: <File>,
               link_url: "https://ctecg.co.za/weekend-special",
               start_date: "2026-01-24",
               end_date: "2026-01-27",
               is_active: "1" }
               
Backend → Verifies JWT token
       → Checks if placement already has active ad:
          SELECT * FROM advertisements 
          WHERE placement = 'dashboard_bottom'
          AND is_active = 1
          AND start_date <= NOW()
          AND end_date >= NOW()
       → If exists: Return error "Only one ad per placement"
       → If not: Proceed
       → Validates image file (JPG/PNG, max 5MB)
       → Generates unique filename: ad_1706112000_abc123.jpg
       → Moves uploaded file to /uploads/ads/
       → INSERT INTO advertisements:
          { title: "Weekend Special",
            image_path: "/uploads/ads/ad_1706112000_abc123.jpg",
            link_url: "https://ctecg.co.za/weekend-special",
            placement: 'dashboard_bottom',
            start_date: '2026-01-24',
            end_date: '2026-01-27',
            is_active: 1,
            click_count: 0,
            view_count: 0,
            created_by: admin_id }
       → Logs action in admin_logs
       
Admin Panel ← { success: true, ad_id: 456 }
           ← Refreshes ad list
```

**What's happening:** The UNIQUE constraint on `placement` ensures only ONE active ad per slot. The backend enforces this rule. Images are uploaded to server and stored in `/uploads/ads/`.

**Mobile App Fetches Ad:**
```
Mobile App → DashboardScreen mounts
          → Component: <AdBanner placement="dashboard_bottom" />
          → GET /admin-api.php?path=/ads/active?placement=dashboard_bottom
          
Backend → SELECT * FROM advertisements
          WHERE placement = 'dashboard_bottom'
          AND is_active = 1
          AND start_date <= NOW()
          AND end_date >= NOW()
          LIMIT 1
       → If found: Return ad object
       → If not found: Return null
       
Mobile App ← { ad_id: 456,
               image_url: "https://app.ctecg.co.za/api/uploads/ads/ad_1706112000_abc123.jpg",
               link_url: "https://ctecg.co.za/weekend-special" }
           ← <AdBanner> renders image
           ← When visible: POST /admin-api.php?path=/ads/456/view
           ← When clicked: POST /admin-api.php?path=/ads/456/click
```

**What's happening:** The mobile app fetches the ad in real-time. The backend checks date ranges and active status. View/click tracking happens automatically via separate API calls.

---

### How Admin Panel Screens Work Together

**SupportScreen.tsx:**
- Loads all users on mount: `GET /admin/users?page=1&limit=50`
- Client-side search (filters array in memory)
- Clicking user → navigate to CustomerDetailsScreen

**CustomerDetailsScreen.tsx:**
- Tab-based UI with lazy loading
- Each tab loads data when clicked (not all at once)
- Overview tab: user details + health score
- Accounts tab: linked accounts + online status (calls Azotel)
- Notes tab: loads notes, allows CRUD operations
- Activity tab: loads activity log (read-only)
- History tab: login history from auth_logs
- Tools tab: Admin actions (reset password, change email, etc.)

**AdsScreen.tsx:**
- CRUD for advertisements
- Upload image handling
- Preview functionality
- Click/view statistics

---

## How Endpoints Work Together

### The Authentication Chain

**Every mobile API call follows this pattern:**

```
1. Mobile App sends request with header:
   Authorization: Bearer <token>

2. Backend (mobile-api.php) calls SimpleAuth::authenticate():
   → Extracts token from header
   → SELECT * FROM user_tokens WHERE token = ? AND expires_at > NOW()
   → Gets user_id from token record
   → SELECT * FROM users WHERE id = user_id
   → Returns user object { id, invoicingid, customerid, email }

3. Backend checks if viewing linked account:
   → SELECT current_viewing_user_id FROM user_tokens WHERE token = ?
   → If set and different from user_id:
      → SELECT * FROM users WHERE id = current_viewing_user_id
      → Use THAT user's invoicingid for Azotel calls
   → If not set:
      → Use original user's invoicingid

4. Backend makes Azotel calls with correct customerid

5. Backend returns processed data to mobile app
```

**This means:** Every endpoint relies on the authentication step. Without valid token, you get 401 Unauthorized.

**Every admin API call follows this pattern:**

```
1. Admin Panel sends request with header:
   Authorization: Bearer <jwt_token>

2. Backend (admin-api.php) calls $auth->verifyToken():
   → Extracts JWT from header
   → Splits into: header.payload.signature
   → Verifies signature with HMAC-SHA256
   → Decodes payload → { admin_id, username, role, exp }
   → Checks exp > NOW()
   → Returns admin data

3. Backend executes admin action

4. Backend logs action in admin_logs:
   → INSERT INTO admin_logs (admin_id, action, entity_type, entity_id)
```

**This means:** Every admin action is logged. The JWT contains role info for future role-based permissions.

---

### Endpoint Relationship Map

**Registration Flow:**
```
1. /auth.php?action=verify-client-code
   ↓ (validates with Azotel)
2. /auth.php?action=register
   ↓ (creates user, sends OTP)
3. /auth.php?action=verify-otp
   ↓ (activates account, generates token)
4. /mobile-api.php?endpoint=dashboard
   ↓ (fetches Azotel data using invoicingid from step 1)
```

**Login Flow:**
```
1. /auth.php?action=login
   ↓ (validates password, generates token)
2. /mobile-api.php?endpoint=dashboard
   ↓ (uses token to identify user)
```

**Account Linking Flow:**
```
1. /auth.php?action=link-account
   ↓ (verifies client code with Azotel, sends OTP)
2. /auth.php?action=verify-account-link
   ↓ (creates link in user_accounts/user_account_links)
3. /mobile-api.php?endpoint=switch-account
   ↓ (updates token's current_viewing_user_id)
4. /mobile-api.php?endpoint=dashboard
   ↓ (returns OTHER account's data from Azotel)
```

**Payment Flow:**
```
1. /mobile-api.php?endpoint=yoco-create-checkout
   ↓ (creates payment in yoco_payments, calls Yoco API)
2. [User pays on Yoco website]
3. /yoco-webhook.php ← Yoco sends webhook
   ↓ (updates yoco_payments.status = 'completed')
4. /mobile-api.php?endpoint=yoco-payment-status
   ↓ (mobile app checks if payment completed)
```

**Support Ticket Flow:**
```
1. /support.php?action=create
   ↓ (creates ticket in app_support_tickets)
   ↓ (sends email notification to support)
2. Admin panel: GET /admin/users/{id}/tickets
   ↓ (shows ticket in admin view)
3. /support.php?action=message
   ↓ (admin or customer adds message)
4. /support.php?action=messages
   ↓ (fetch conversation thread)
5. /support.php?action=close
   ↓ (updates status to 'closed')
```

**Advertisement Flow:**
```
1. Admin: POST /admin/ads
   ↓ (creates ad, uploads image)
2. Mobile: GET /ads/active?placement=dashboard_top
   ↓ (fetches active ad for placement)
3. Mobile: POST /ads/{id}/view
   ↓ (increments view_count)
4. Mobile: POST /ads/{id}/click
   ↓ (increments click_count, logs in ad_clicks)
5. Admin: GET /admin/ads/{id}/stats
   ↓ (shows click/view statistics)
```

---

### Data Flow: Dashboard Screen Example

Let's trace EVERY step when a user opens the dashboard:

```
┌─────────────┐
│ Mobile App  │ Opens, reads token from AsyncStorage
└──────┬──────┘
       │ GET /mobile-api.php?endpoint=dashboard
       │ Authorization: Bearer sha256_token_abc123
       ▼
┌─────────────────────────────────────────────────┐
│ Backend: mobile-api.php                         │
│                                                 │
│ 1. Authentication:                              │
│    → SimpleAuth::authenticate()                 │
│    → Queries: user_tokens table                 │
│    → Gets: user_id = 5                          │
│    → Queries: users table                       │
│    → Gets: invoicingid = "WL12345"              │
│             customerid = 12345                  │
│                                                 │
│ 2. Check account switching:                     │
│    → Queries: user_tokens.current_viewing_user_id│
│    → Result: NULL (viewing own account)         │
│                                                 │
│ 3. Fetch from Azotel (5 API calls):            │
│                                                 │
│    a) searchByInvoicingId("WL12345")           │
└────────┬────────────────────────────────────────┘
         │ HTTPS request to Azotel API
         ▼
    ┌─────────────┐
    │ Azotel ISP  │ Returns: { customer: [{ id: 12345, name, status }] }
    └──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ Backend continues:                              │
│                                                 │
│    b) getCustomer(12345)                       │
└────────┬────────────────────────────────────────┘
         │
         ▼
    ┌─────────────┐
    │ Azotel ISP  │ Returns: { customer: { name, email, status, balance } }
    └──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ Backend continues:                              │
│                                                 │
│    c) getSubscriptions(12345)                  │
└────────┬────────────────────────────────────────┘
         │
         ▼
    ┌─────────────┐
    │ Azotel ISP  │ Returns: { subscription: [{ productdescription, price }] }
    └──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ Backend continues:                              │
│                                                 │
│    d) getUsage(12345)                          │
└────────┬────────────────────────────────────────┘
         │
         ▼
    ┌─────────────┐
    │ Azotel ISP  │ Returns: { usage: [{ download, upload, total }] }
    └──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ Backend continues:                              │
│                                                 │
│    e) getInvoices(12345)                       │
└────────┬────────────────────────────────────────┘
         │
         ▼
    ┌─────────────┐
    │ Azotel ISP  │ Returns: { invoices: [{ number, amount, date, status }] }
    └──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ Backend processes data:                         │
│                                                 │
│ 4. Clean customer name:                         │
│    "John Doe###" → "John Doe"                  │
│                                                 │
│ 5. Determine account status:                    │
│    customerstatus1 = "current" → Active         │
│    customerstatus1 = "post" → Suspended         │
│                                                 │
│ 6. Parse package details:                       │
│    productdescription: "Monthly Subscription (20GB Uncapped)"│
│    → Extract: "20GB Uncapped"                   │
│    → Detect "Uncapped" → is_uncapped = true     │
│                                                 │
│ 7. Calculate speed:                             │
│    description: "10240 Download / 10240 Upload" │
│    → 10240 kbps = 10 Mbps                       │
│    → speed_description = "10/10MBPS"            │
│                                                 │
│ 8. Calculate usage:                             │
│    total = 15.5 GB, limit = 20 GB              │
│    percentage = (15.5 / 20) * 100 = 77.5%      │
│                                                 │
│ 9. Check online status:                         │
│    getRadiusSessions() → has active session?    │
│    → online = true, last_seen = NOW()           │
│                                                 │
│ 10. Build response object:                      │
│     {                                           │
│       customer: {                               │
│         name: "John Doe",                       │
│         customer_number: "WL12345",             │
│         status: "Active",                       │
│         account_type: "Current",                │
│         status_reason: null                     │
│       },                                        │
│       usage: {                                  │
│         current_month: {                        │
│           total_gb: 15.5,                       │
│           download_gb: 12.3,                    │
│           upload_gb: 3.2                        │
│         },                                      │
│         package_details: {                      │
│           name: "20GB Uncapped",                │
│           speed: "10/10MBPS",                   │
│           limit_gb: 20,                         │
│           is_uncapped: true                     │
│         }                                       │
│       },                                        │
│       invoices: [                               │
│         { number: "INV-2024-001",               │
│           amount: 599.00,                       │
│           due_date: "2026-02-01",               │
│           status: "unpaid" }                    │
│       ],                                        │
│       online_status: {                          │
│         online: true,                           │
│         last_seen: "2026-01-24 14:30:00"        │
│       }                                         │
│     }                                           │
│                                                 │
│ 11. Return JSON response                        │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────┐
│ Mobile App  │ Receives dashboard object
│             │ DashboardScreen.tsx renders:
│             │ → Account card (name, status badge)
│             │ → Usage card (progress bar at 77.5%)
│             │ → Invoice list (shows R599.00 due)
│             │ → Online indicator (green dot)
│             │ → Quick action buttons
└─────────────┘
```

**Time breakdown:**
- Authentication: ~5ms (local DB query)
- Azotel API calls: ~2 seconds total (5 calls × 400ms each)
- Processing: ~10ms (calculations, formatting)
- **Total: ~2.1 seconds**

**Caching opportunity:** The backend could cache Azotel responses for 5 minutes to reduce load.

---

## Real-World User Scenarios

### Scenario 1: Customer Can't Login

**Customer:** "I'm trying to login but it says invalid credentials"

**What happened:**

```
1. User enters: email + password
2. POST /auth.php?action=login
3. Backend: SELECT * FROM users WHERE email = ?
4. User found
5. Backend: password_verify($input, $user['password_hash'])
6. Result: FALSE (wrong password)
7. Backend: UPDATE users SET failed_login_attempts = failed_login_attempts + 1
8. Backend: Logs 'failed_login' in auth_logs
9. Return: "Invalid credentials. 4 attempts remaining."
```

**Support checks:**
1. Admin panel → Search customer by email
2. Views "History" tab → sees 3 failed login attempts in last 5 minutes
3. Views "Overview" → sees account_status = 'active' (not suspended)
4. Admin action → "Reset Login Attempts" button
5. POST /admin/users/{id}/reset-login
6. Backend: UPDATE users SET failed_login_attempts = 0 WHERE id = ?
7. Customer tries again → Login succeeds

---

### Scenario 2: Customer Reports Wrong Usage Data

**Customer:** "My app shows I used 50GB but I barely used internet this month"

**What's actually happening:**

```
Mobile App → GET /mobile-api.php?endpoint=usage-detailed
Backend → getUsage(customerid) from Azotel
       → Azotel returns: { usage: [{ total: 50GB, download: 45GB, upload: 5GB }] }
       → Backend passes through unchanged
Mobile App ← Displays: 50GB
```

**The data comes from Azotel**, not CTECG's database. CTECG just displays it.

**Support investigates:**
1. Admin panel → Customer details
2. Accounts tab → clicks "View Billing" for the account
3. GET /admin/accounts/{account_id}/billing
4. Backend calls Azotel directly (same API)
5. Admin sees same 50GB usage
6. Admin realizes: Data is correct in Azotel
7. Solution: Educate customer about background apps using data

**Key insight:** CTECG is a **read-only view** of Azotel data. Can't change usage, billing, or account status. Only Azotel can.

---

### Scenario 3: Payment Shows as Pending

**Customer:** "I paid 2 hours ago but app still shows unpaid"

**What should happen:**

```
1. User pays on Yoco
2. Yoco → POST /yoco-webhook.php { status: "completed" }
3. Backend updates yoco_payments.status = 'completed'
4. Mobile app checks status → sees "completed"
```

**What went wrong:**

```
Yoco tried to send webhook but:
- Server was down (unlikely)
- Firewall blocked the request
- Webhook URL misconfigured
- Yoco's servers delayed
```

**Support fixes it:**
1. Admin panel → Customer details → Tools tab
2. Clicks "Check Payment Status" (custom tool)
3. Admin manually checks Yoco dashboard
4. Sees payment is completed on Yoco's side
5. Admin manually updates database:
   UPDATE yoco_payments SET status = 'completed' WHERE checkout_id = ?
6. Mobile app refreshes → Shows "Payment successful"

**Better solution:** Backend should have a cron job that periodically checks Yoco API for pending payments and updates them.

---

### Scenario 4: Customer Wants to Link Family Member's Account

**Customer:** "My mom has account WL99999. Can I manage it from my app?"

**Process:**

```
1. User: Link Account → Enters "WL99999"
2. POST /auth.php?action=link-account { client_code: "WL99999" }
3. Backend: searchByInvoicingId("WL99999") → Finds in Azotel
4. Backend: SELECT * FROM user_accounts WHERE client_code = "WL99999"
5. Result: Account exists, belongs to user_id = 42 (mom's account)
6. Backend: Generates OTP, sends to mom's email (security!)
7. Backend: Returns { link_type: "existing_user", target_email: "m**@***.com" }
8. User tells mom to check email
9. Mom gets OTP: "123456"
10. User enters OTP: POST /auth.php?action=verify-account-link
11. Backend: Creates bidirectional link:
    user_account_links: { primary: user1, linked: user42 }
    user_account_links: { primary: user42, linked: user1 }
12. User can now switch to mom's account
13. All API calls will use mom's invoicingid to fetch Azotel data
```

**Security:** OTP is sent to the TARGET account's email. This prevents unauthorized linking.

---

## Summary: How It All Connects

**The Big Picture:**

1. **Mobile App** is the customer-facing interface
   - Built with React Native + Expo
   - Handles authentication with tokens
   - Displays data from Azotel in user-friendly format
   - Manages account linking for power users
   - Processes payments via Yoco integration

2. **Admin Panel** is the support staff interface
   - Built with React + Vite
   - Uses JWT authentication (shorter expiry)
   - Provides customer lookup and support tools
   - Manages advertisements
   - Views logs and analytics

3. **PHP Backend** is the orchestrator
   - **auth.php**: Handles all authentication flows
   - **mobile-api.php**: Aggregates Azotel data for mobile
   - **admin-api.php**: Provides admin tools and user management
   - **support.php**: Manages support tickets
   - Validates all requests
   - Logs all significant actions
   - Enriches Azotel data with local context

4. **Azotel** is the source of truth for ISP data
   - Customer accounts and subscriptions
   - Usage data and billing
   - Online status via RADIUS
   - CTECG can READ but not WRITE

5. **MariaDB** stores application-specific data
   - User accounts and authentication
   - Account linking relationships
   - Support tickets and internal notes
   - Payment records
   - Advertisements and their statistics
   - Activity logs

**Key Design Decisions:**

- **Token-based auth** allows stateless API (no sessions)
- **Azotel as source** means data is always current
- **Account linking** uses OTPs for security
- **Admin logs** provide audit trail
- **Soft deletes** on notes preserve history
- **UNIQUE placement** prevents ad conflicts
- **JWT for admins** has shorter expiry for security

**The Flow in One Sentence:**

User authenticates → Backend validates token → Backend fetches from Azotel → Backend processes & enriches → Backend returns to app → App displays beautifully.

---

**End of Documentation**

This documentation focuses on HOW the applications work, not just WHAT exists in the database.
