# G-TRASH — Officials Dashboard: Demo Features

> **Platform:** Web Application (PWA — installable on desktop/mobile)
> **Stack:** React + Vite + Tailwind CSS | Node.js + MongoDB | Socket.io real-time

---

## Role-Based Access Control

The Officials Dashboard supports three distinct role types, each with scoped permissions:

| Role | Access Level | Description |
|---|---|---|
| **Barangay Official** | Own barangay only | Full dashboard access scoped to their assigned barangay |
| **City Health Dept. (CHD)** | View-only | Limited to Dashboard, Heatmap, Reports, Collection History |
| **Super Admin** | All barangays | Unrestricted access across all barangays and data |

- Barangay officials **cannot view** residents or rankings of other barangays
- Attempting restricted access shows a clear **Access Restricted modal**
- CHD users see a dedicated **Health Risk Dashboard** instead of the standard operations view

---

## 1. Dashboard

**Path:** `/dashboard`

The command center for situational awareness.

### Standard (Barangay Official / Super Admin)
- **Live KPI Cards** — total waste collected (kg), active trucks, open reports, pollution alerts
- **Pollution Chart** — real-time IoT sensor readings with line/bar visualization
- **Recent Alerts** — latest IoT threshold breaches and resident reports with time-ago stamps
- **Barangay Ranking Widget** — top-performing barangays based on collection score
- **Truck Status Overview** — which trucks are active, idle, or off-route
- **7-Day Collection Bar Chart** — daily kg collected per barangay

### CHD-Specific Health Dashboard
- **Risk Level Counts** — High / Moderate / Low risk zones at a glance
- **Barangays at Risk** — list of barangays currently exceeding health thresholds
- **Recent Health Alerts** — timestamped environmental health events
- **Air Quality Stats** — ammonia, methane, and particulate readings from IoT sensors

---

## 2. Operations

### Route Monitoring
**Path:** `/routes`

Live operational view of all garbage truck routes.

- **Active Route Cards** — each card shows route name, assigned truck, stop count, completion progress
- **Live Truck Tracker** — real-time truck GPS position via Socket.io
- **Stop Timeline** — visual sequence of stops (completed / current / upcoming) with status colors
- **Assign / Reassign Truck** — scrollable truck picker card list with:
  - Dedicated trucks (own barangay)
  - Shared trucks (cross-barangay) shown with blue **Shared** badge
  - Currently selected truck highlighted with checkmark
- **Off-Route Alerts** — real-time notifications when a truck deviates from its assigned path

---

### Fleet Management
**Path:** `/fleet`

Manage the garbage truck inventory.

- **Add New Truck** — register truck with plate number, type (dedicated/shared), barangay assignment
- **Shared Truck Support** — mark trucks as `shared` and assign to multiple `serviceBarangays`
- **Edit / Delete Trucks** — update truck details inline
- **Fleet Overview Table** — sortable list of all trucks with status, type, and barangay

---

### Route Builder
**Path:** `/route-builder`

Create new collection routes by plotting stops on a map.

- **Interactive Map** — click to add stops; drag to reorder
- **Stop Naming** — each stop gets a label (used in the Resident app as the jeepney-style stop display)
- **Barangay Scoping** — routes are created under the official's assigned barangay
- **Save & Publish** — route becomes immediately available to assign to trucks

---

### Route Manager
**Path:** `/route-manager`

Manage existing published routes.

- **View All Routes** — filterable list of all routes by barangay
- **Edit Stops** — add, remove, or rename stops on an existing route
- **Deactivate / Archive Route** — disable routes without deleting them
- **Route Detail View** — full stop list with status and metadata

---

### Schedule Routes
**Path:** `/schedule`

Calendar-based garbage collection scheduling.

- **Weekly / Monthly Calendar View** — visual schedule of collection days per route
- **Add Schedule Entry** — pick route, truck, date, and time slot
- **Recurring Schedules** — set daily, weekly, or custom repeat rules
- **Resident-Facing Impact** — schedules sync to the Resident app's collection calendar

---

## 3. Analytics

### Barangay Rankings
**Path:** `/barangays`

Leaderboard of barangay performance.

- **Ranking Table** — sorted by collection score; shows total pickups, resolved reports, and activity
- **Drill-Down View** — click a barangay row to see individual resident performance and top contributors
- **Access Restriction Enforcement** — barangay officials can only drill into their own barangay; others show the **Access Restricted modal**
- **Score Breakdown** — collection score, resolution score, and community engagement score shown separately

---

### Reports Management
**Path:** `/reports`

Handle resident-submitted garbage reports.

- **Report Feed** — paginated list of all reports with photo, location, description, and urgency level
- **Filter & Search** — filter by status (open / in-progress / resolved), barangay, date range
- **View Full Report** — modal with photo preview, resident details, map pin, and timestamp
- **Mark as Resolved** — single-click resolution that:
  - Updates report status to `resolved`
  - Automatically awards **+10 points** to the resident who submitted the report (real-time via Socket.io)
  - Triggers a toast notification on the resident's mobile app
- **CHD View** — read-only mode; cannot mark reports as resolved

---

### Heatmap Analytics
**Path:** `/heatmap`

Geospatial pollution visualization from IoT sensors.

- **Live Heatmap Overlay** — color-coded map markers:
  - 🔴 Red = High pollution (above safe threshold)
  - 🟡 Yellow = Moderate
  - 🟢 Green = Safe
- **Sensor Detail Popup** — click any marker to see gas readings (NH₃, CH₄, etc.), timestamp, and sensor ID
- **Historical Playback** — slider to view pollution levels at past timestamps
- **Barangay Filter** — toggle visibility by barangay zone

---

### Collection History
**Path:** `/history`

Log of all completed garbage collection runs.

- **Timeline View** — chronological list of completed pickups with truck, route, and kg collected
- **Export Data** — download history as CSV for reporting
- **Filter by Date Range / Barangay / Truck** — narrow down records quickly
- **Summary Stats** — total collections, average kg per run, busiest days

---

### Rewards Management
**Path:** `/rewards`

Oversee the resident points and rewards system.

- **Points Leaderboard** — top residents ranked by accumulated points
- **Activity Log** — per-resident history of point-earning events (report submitted, bin picked up, report resolved, correct AI scan)
- **Redemption Tracking** — view pending and fulfilled reward claims
- **Manual Adjustment** — grant or deduct points for special cases

---

## 4. System

### Settings
**Path:** `/settings`

Account and notification configuration.

- **Profile Management** — update name, email, password
- **Notification Preferences** — configure which alerts to receive (off-route, high pollution, new reports)
- **Barangay Assignment** — visible info; only super admin can reassign
- **Theme & Display** — accessibility options

---

## Real-Time Features (Socket.io)

All real-time updates happen without page refresh:

| Event | Trigger | Effect |
|---|---|---|
| `truck:location` | Truck GPS updates | Route Monitoring map updates live |
| `truck:off-route` | Truck deviates from path | Red floating alert toast + Admin Panel notification |
| `iot:reading` | Sensor sends new data | Heatmap and Dashboard pollution chart update |
| `report:updated` | Report status changes | Reports feed refreshes |
| `resident:points:update` | Points awarded to resident | Resident mobile app shows amber points toast |

---

## PWA — Progressive Web App

The Officials Dashboard is **installable** as a desktop or mobile app:

- No app store required — install directly from the browser address bar
- Works offline for previously loaded data (Workbox cache)
- API calls use **Network First** strategy — always fetches fresh data when online
- Map tiles use **Cache First** — loads instantly even on slow connections
- Manifest: standalone display, emerald theme color, G-TRASH icon

---

## Summary: Feature Count by Role

| Feature Area | Barangay Official | CHD | Super Admin |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ (Health View) | ✅ |
| Route Monitoring | ✅ | ❌ | ✅ |
| Fleet Management | ✅ | ❌ | ✅ |
| Route Builder | ✅ | ❌ | ✅ |
| Route Manager | ✅ | ❌ | ✅ |
| Schedule Routes | ✅ | ❌ | ✅ |
| Barangay Rankings | ✅ (own only) | ❌ | ✅ (all) |
| Reports Management | ✅ | ✅ (read-only) | ✅ |
| Heatmap Analytics | ✅ | ✅ | ✅ |
| Collection History | ✅ | ✅ | ✅ |
| Rewards Management | ✅ | ❌ | ✅ |
| Settings | ✅ | ✅ | ✅ |

---

*G-TRASH Smart Waste Monitoring System — Officials Platform*
*Version: MVP Demo | Stack: React + Node.js + MongoDB + Socket.io*
