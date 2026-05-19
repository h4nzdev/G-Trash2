I need to add City Health Department (CHD) access to the existing G-TRASH Officials Web App. My capstone document names the CHD as a beneficiary that uses "G-TRASH's pollution heatmaps and historical analytics to proactively identify high-risk sanitary zones." The CHD does NOT need a separate dashboard — they will use the same Officials Web App but with a limited, health-focused view.

Current setup:
- Officials Web App: React + Vite + Tailwind CSS
- Backend: Node.js + Express + MongoDB with Mongoose
- User roles are managed via a "role" field in the user schema
- Current roles: official, admin
- The Officials dashboard already has: Dashboard, Reports, Route Monitoring, Route Builder, Schedule Routes, Fleet Management, Heatmap Analytics, Collection History, Barangay Performance, Settings

Requirements:

1. BACKEND - Role & Permission Updates:

   a. Add "chd" to the existing role enum:
      - role: { type: String, enum: ['official', 'admin', 'chd'], default: 'official' }

   b. CHD permissions (enforced via middleware):
      - FULL ACCESS to these pages:
        - Dashboard (but with health-focused widgets — see frontend section)
        - Heatmap Analytics
        - Collection History
      - READ-ONLY access to:
        - Reports (can view all, filter, search — but CANNOT change status, assign trucks, or delete)
      - NO ACCESS to these pages (return 403 or hide from sidebar):
        - Route Builder
        - Route Monitoring
        - Schedule Routes
        - Fleet Management
        - Barangay Performance
        - Settings

   c. Updated auth middleware:
      - Add a function that checks if the user's role has access to a specific page/feature
      - Return 403 Forbidden with message: "Your role (CHD) does not have access to this feature."
      - The GET /api/auth/me endpoint should return the user's role and a list of allowed pages

2. OFFICIALS WEB APP - CHD-Specific View:

   a. Sidebar Navigation:
      - When a CHD user logs in, the sidebar shows ONLY these items:
        - 🏠 Dashboard
        - 📊 Heatmap Analytics
        - 📝 Reports (with "(View Only)" label)
        - 📋 Collection History
      - All other sidebar items are hidden for CHD users
      - The sidebar can keep the same green color scheme (no need for separate branding)

   b. Dashboard - CHD View:
      - When role === 'chd', the dashboard shows health-focused widgets instead of the full official view:
        - "Health Risk Overview" card replacing the fleet/routes card:
          - 🔴 High Risk Barangays: Count (ammonia > 50ppm or methane > 25% LEL)
          - 🟡 Moderate Risk Barangays: Count (ammonia 25-50ppm or methane 10-25% LEL)
          - 🟢 Low Risk Barangays: Count (ammonia < 25ppm)
        - "Recent Health Alerts" list (last 7 days of IoT alerts)
        - "Barangays Requiring Attention" - barangays with most days above safe threshold this month
        - Mini heatmap widget showing health risk zones
      - The existing official widgets (fleet status, pending reports, etc.) are hidden for CHD

   c. Heatmap Analytics - CHD Enhancements:
      - Same heatmap page but with an added "Health Risk View" toggle
      - When toggled ON:
        - Color coding changes to health risk levels:
          - Green: Safe (ammonia < 25ppm)
          - Yellow: Moderate (ammonia 25-50ppm)
          - Orange: High (ammonia 50-100ppm)
          - Red: Critical (ammonia > 100ppm)
        - Clicking a zone shows health-specific info:
          - Current ammonia/methane levels
          - Days above safe threshold this month
          - "Export Health Report" button for that zone

   d. Reports Page - CHD View:
      - Same reports table but:
        - All action buttons are hidden (no status change, no assign, no delete)
        - A new "🏥 Flag as Health Concern" button is added
        - When flagged, the report gets a red "Health Concern" badge visible to LGU officials
        - CHD can filter reports by: Health-flagged, Category (hazardous waste, illegal dumping)
        - CHD can add "Health Notes" to a report (internal notes section)

   e. Collection History - CHD View:
      - Same collection history page
      - Added filter: "Show only barangays with health alerts"
      - Added column: "Days Since Last Collection" highlighted in red if > 5 days

3. ADMIN PANEL - CHD User Management:

   a. Add to existing user management:
      - When creating/editing an official account, add "CHD" as a role option in the dropdown
      - CHD-specific fields (optional):
        - Department: (e.g., "City Health Department - Cebu City")
        - Assigned Region: (e.g., "North District", "South District", "All Barangays")
        - Contact Number
      - The role dropdown now shows: Official, CHD, Admin

4. EDGE CASES:
   - What if CHD tries to access a restricted page via direct URL? (Redirect to dashboard with "Access Denied" toast)
   - What if CHD flags a report that's already resolved? (Allow flagging resolved reports for audit/historical purposes)
   - What if there are multiple CHD users? (Each has their own account; all see the same data)
   - What if CHD needs data for a specific time period? (All existing date filters work for CHD too)

Please provide:
- Updated user schema with CHD role
- Backend middleware for CHD permission checking
- Updated GET /api/auth/me to return role and allowed pages
- Officials Web App sidebar component that filters based on role
- Dashboard component with CHD-specific widgets
- Heatmap page with Health Risk View toggle
- Reports page with read-only mode and health flagging
- Admin Panel user management updates

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps:
   - How to create a CHD account from Admin Panel
   - How to log in as CHD and verify correct sidebar appears
   - How to verify restricted pages are inaccessible
   - How to use the Health Risk View on the heatmap
   - How to flag a report as a health concern
   - How to verify LGU officials can see the health flag

2. Test Account:
   - CHD test user: chd@cebucity.gov.ph / password123 / role: chd
   - LGU test user: official@lahug.gov.ph / password123 / role: official

3. Test Data:
   Provide MongoDB script to insert IoT readings at different health risk levels so the CHD dashboard widgets show realistic data

4. Expected Visual Results:
   - What the CHD sidebar looks like (only 4 items)
   - What the CHD dashboard home looks like (health widgets)
   - What the heatmap looks like in Health Risk View mode
   - What happens when CHD tries to access /routes via URL

5. Debugging Checklist:
   - If sidebar shows all items for CHD, check: [list items]
   - If health risk colors are wrong on heatmap, check: [list items]
   - If CHD can still edit reports, check: [list items]

6. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | CHD login | Login with CHD credentials | Dashboard shows health widgets |
   | CHD sidebar | Check sidebar menu | Only 4 items shown |
   | Access restricted page | CHD navigates to /routes | Redirected with "Access Denied" |
   | View heatmap | CHD opens Heatmap Analytics | Can toggle Health Risk View |
   | Flag health concern | CHD clicks flag on a report | Badge appears; visible to officials |
   | Add health note | CHD adds note to report | Note saved in report |
   | LGU sees flag | LGU official opens flagged report | Red "Health Concern" badge visible |