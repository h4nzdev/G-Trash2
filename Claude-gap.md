I need to add department-level differentiation for LGU officials in the G-TRASH Officials Web App. My capstone document specifically names two Cebu City government departments as beneficiaries:

- CCENRO (Cebu City Environment and Natural Resources Office): Responsible for environmental protection and policy implementation
- DPS (Department of Public Service): Tasked with physical collection, transportation, and management of solid waste

Currently, all officials are grouped under a single "official" role with no way to differentiate which department they belong to. While they share the same dashboard, their focus areas are different:
- CCENRO focuses on environmental monitoring, pollution data, and policy
- DPS focuses on fleet management, route operations, and collection logistics

Current setup:
- Officials Web App: React + Vite + Tailwind CSS
- Backend: Node.js + Express + MongoDB with Mongoose
- Current user roles: official, admin, chd
- The Officials dashboard has: Dashboard, Reports, Route Monitoring, Route Builder, Schedule Routes, Fleet Management, Heatmap Analytics, Collection History, Barangay Performance, Settings

Requirements:

1. BACKEND - Department Field & Filtering:

   a. Add department field to the User/Official schema:
      {
        department: { 
          type: String, 
          enum: ['ccenro', 'dps', 'lgu_general', 'barangay'],
          default: 'barangay'
        },
        departmentPosition: { type: String },  // e.g., "Environmental Officer", "Fleet Supervisor"
        assignedBarangays: [{ type: String }]   // barangays this official oversees
      }

   b. Department descriptions (stored as constant):
      - ccenro: "Cebu City Environment and Natural Resources Office — Environmental monitoring & policy"
      - dps: "Department of Public Service — Waste collection & fleet operations"
      - lgu_general: "General LGU Administration — Overall waste management oversight"
      - barangay: "Barangay Official — Local community waste management"

   c. Updated GET /api/auth/me response:
      Include department info:
      {
        "user": {
          "id": "...",
          "name": "Maria Santos",
          "email": "maria@cebucity.gov.ph",
          "role": "official",
          "department": "ccenro",
          "departmentName": "Cebu City Environment and Natural Resources Office",
          "position": "Environmental Officer",
          "assignedBarangays": ["Lahug", "Mabolo", "IT Park"]
        }
      }

   d. Optional: API filtering by department
      - No new endpoints needed
      - Existing endpoints can accept ?department=ccenro query param for filtering data

2. OFFICIALS WEB APP - Department-Aware Dashboard:

   a. Dashboard Header:
      - Show the official's department name and logo/badge below their name
      - Example: "Maria Santos — CCENRO Environmental Officer"
      - Department badge with color:
        - CCENRO: Green badge 🟢 (environmental focus)
        - DPS: Blue badge 🔵 (operational focus)
        - LGU General: Gold badge 🟡 (administrative focus)
        - Barangay: Teal badge (community focus)

   b. Department-Specific Dashboard Views:
      The dashboard widgets change priority based on department:

      CCENRO View (Environment-Focused):
      - PRIMARY WIDGETS (shown first, larger):
        - Pollution Heatmap mini-view
        - IoT Sensor Status (active sensors, alerts today)
        - Air Quality Index summary per barangay
        - Environmental Reports (filtered to pollution/illegal dumping categories)
      - SECONDARY WIDGETS (shown below, smaller):
        - Recent Reports
        - Collection History summary
      - HIDDEN: Fleet status, Active trucks, Route schedule

      DPS View (Operations-Focused):
      - PRIMARY WIDGETS (shown first, larger):
        - Fleet Status (active trucks, trucks in maintenance)
        - Today's Active Routes
        - Pending Collections count
        - Driver Status overview
      - SECONDARY WIDGETS (shown below, smaller):
        - Recent Reports (filtered to collection issues)
        - Collection History summary
      - HIDDEN: Pollution heatmap, Air quality details

      LGU General View (Full Access):
      - Shows ALL widgets (current dashboard behavior)
      - Equal priority to all sections

      Barangay View (Local Focus):
      - PRIMARY WIDGETS:
        - Reports from their barangay only
        - Collection schedule for their barangay
        - Local leaderboard position
      - SECONDARY WIDGETS:
        - Nearby truck locations
        - Recent resolutions

   c. Sidebar Adjustments (Optional):
      - Same sidebar for all departments
      - But the default landing page after login could differ:
        - CCENRO → Heatmap Analytics
        - DPS → Fleet Management
        - LGU General → Dashboard
        - Barangay → Reports

3. REPORT FILTERING BY DEPARTMENT RELEVANCE:

   a. On the Reports page, add a "Department View" toggle:
      - CCENRO View: Auto-filters to show reports in categories:
        - Illegal Dumping
        - Hazardous Waste
        - Environmental Concern
        - Pollution
      - DPS View: Auto-filters to show reports in categories:
        - Uncollected Garbage
        - Overflowing Bins
        - Missed Collection
        - Truck Delay
      - All Reports: Shows everything (LGU General)

   b. Report cards show which department is handling it:
      - "Assigned to: DPS" or "Under CCENRO Review"
      - Helps officials know who is responsible

4. CROSS-DEPARTMENT VISIBILITY:

   a. CCENRO can see DPS-assigned reports (read-only)
   b. DPS can see CCENRO environmental flags on reports
   c. When CCENRO flags a report as "Environmental Hazard," DPS sees a red alert on that report
   d. When DPS marks a collection as complete, CCENRO sees the updated heatmap

   This creates collaboration without role confusion.

5. ADMIN PANEL - Department Management:

   a. When creating/editing an official account:
      - Add "Department" dropdown: CCENRO, DPS, LGU General, Barangay
      - Add "Position" text field
      - Add "Assigned Barangays" multi-select
      - Show department description next to dropdown

   b. Officials list table:
      - Add "Department" column with color-coded badge
      - Filter by department

6. EDGE CASES:
   - What if an official belongs to CCENRO but needs to see fleet data? (They can still navigate to Fleet page; only the dashboard widgets are customized)
   - What if an official is reassigned to a different department? (Admin can edit; dashboard updates immediately)
   - What if a small LGU has one person doing both roles? (Use "LGU General" which shows everything)
   - What if barangay officials only need their barangay data? (Barangay role filters to their assigned barangay)

Please provide:
- Updated User schema with department field
- Updated GET /api/auth/me endpoint
- Dashboard component that renders different widgets based on department
- Reports page with department view toggle
- Admin Panel user management updates for department assignment
- Department badge component

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps:
   - How to create officials with different departments from Admin Panel
   - How to log in as CCENRO and verify the dashboard shows environment widgets
   - How to log in as DPS and verify the dashboard shows operations widgets
   - How to switch department views on the Reports page
   - How to verify cross-department visibility (CCENRO flag visible to DPS)

2. Test Accounts:
   - CCENRO: ccenro@cebucity.gov.ph / password123 / department: ccenro
   - DPS: dps@cebucity.gov.ph / password123 / department: dps
   - LGU General: admin@cebucity.gov.ph / password123 / department: lgu_general
   - Barangay: brgy.lahug@cebucity.gov.ph / password123 / department: barangay

3. Expected Visual Results:
   - What the CCENRO dashboard looks like (heatmap + IoT widgets first)
   - What the DPS dashboard looks like (fleet + routes widgets first)
   - What the department badge looks like in the header
   - What the Reports page looks like with department toggle active

4. Debugging Checklist:
   - If dashboard shows wrong widgets, check: [list items]
   - If department badge doesn't appear, check: [list items]
   - If report filtering by department doesn't work, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | CCENRO login | Login as CCENRO user | Dashboard shows heatmap + IoT first |
   | DPS login | Login as DPS user | Dashboard shows fleet + routes first |
   | CCENRO reports view | Toggle "CCENRO View" on Reports | Shows only environmental reports |
   | DPS reports view | Toggle "DPS View" on Reports | Shows only collection reports |
   | Cross-department flag | CCENRO flags report as hazard | DPS sees red alert on that report |
   | Admin creates official | Select department in dropdown | Department saved; badge shows on login |
   | Barangay official login | Login as barangay official | Sees only their barangay data |