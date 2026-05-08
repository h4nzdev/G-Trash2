---

**Prompt for Claude:**

Create a complete React web application for the **Admin Panel (Developers/System Administrators)** of the "G-TRASH" smart waste monitoring system. This is a desktop-first web application for system administrators who manage the entire platform, monitor all data, handle user management, and oversee system operations.

## Context from G-TRASH System (Section 5.4 - Admin Panel)
Admins have these specific features:
- Monitor total trash collected across all barangays
- View heatmap status and urgency levels city-wide
- Track number of garbage trucks deployed and their status
- Analyze problem scaling based on urgency
- Manage bug reports and user feedback
- Handle system notifications and updates
- User management (residents, collectors, officials)
- System configuration and settings
- View comprehensive analytics and exports

## Technology Stack
- **React 18** with functional components and hooks
- **Tailwind CSS** for all styling (use utility classes, no custom CSS files)
- **Lucide React** for all icons (import from `lucide-react`)
- **React Router DOM v6** for navigation between pages
- **Recharts** for charts and data visualization
- Use `axios` for API calls (mock data for now, but structure for real endpoints)
- No TypeScript — plain JavaScript only (.jsx files)

## Design System Requirements
- **Color Palette**: Primary Green `#006A3B`, Secondary `#006E1C`, Admin Accent `#0F766E`, Error Red `#BA1A1A`, Warning Amber `#F59E0B`, Surface `#FFFFFF`, Background `#F8FAFC`, Dark Sidebar `#0F172A`, Text Primary `#F8FAFC` (on dark), Text Secondary `#94A3B8`
- **Typography**: Inter font family, headings bold, body regular
- **Spacing**: Consistent padding of 24px on pages, 16px inside cards
- **Border Radius**: Cards 16px, Buttons 8px, Pills 9999px
- **Dark sidebar** with light content area
- **Admin-specific**: Purple/accent indicators for system-level metrics
- **Shadows**: Use Tailwind shadow-sm, shadow-md, shadow-lg appropriately

## Project Structure

```
src/
├── App.jsx
├── index.js
├── layouts/
│   └── AdminLayout.jsx             # Dark sidebar + Topbar + Content area
├── pages/
│   ├── AdminDashboard.jsx          # System overview & KPIs
│   ├── UserManagement.jsx          # All users (residents, collectors, officials)
│   ├── SystemMonitoring.jsx        # IoT sensors, truck fleet, system health
│   ├── ReportsManagement.jsx       # Bug reports & feedback
│   ├── HeatmapCitywide.jsx         # City-wide pollution heatmap
│   ├── AnalyticsExport.jsx         # Data exports & reports
│   ├── NotificationsCenter.jsx     # Push notifications & alerts
│   ├── SystemSettings.jsx          # Configuration & settings
│   └── AuditLogs.jsx              # System activity logs
├── components/
│   ├── admin/
│   │   ├── AdminSidebar.jsx        # Dark navigation sidebar
│   │   ├── AdminTopBar.jsx         # Top header bar
│   │   ├── SystemHealthCard.jsx    # Server/API health indicator
│   │   ├── ActiveUsersWidget.jsx   # Real-time user count
│   │   ├── FleetOverview.jsx       # All trucks status table
│   │   ├── SensorStatusGrid.jsx    # IoT sensor health grid
│   │   └── QuickActions.jsx        # Admin quick actions panel
│   ├── users/
│   │   ├── UserTable.jsx           # Sortable user table
│   │   ├── UserDetailModal.jsx     # User detail/edit modal
│   │   └── RoleBadge.jsx          # Role indicator badge
│   ├── reports/
│   │   ├── BugReportCard.jsx       # Bug report with severity
│   │   ├── FeedbackCard.jsx        # User feedback card
│   │   └── ReportStatusBadge.jsx   # Status badge
│   └── shared/
│       ├── StatCard.jsx            # Metric card
│       ├── DataTable.jsx           # Reusable table component
│       ├── StatusBadge.jsx         # Status indicator
│       ├── ProgressBar.jsx         # Progress bar
│       ├── ConfirmDialog.jsx       # Confirmation modal
│       └── EmptyState.jsx          # Empty state component
└── data/
    └── mockData.js                 # All mock data
```

## 1. App.jsx & Routing
- Wrap in `BrowserRouter`
- Define routes:
  - `/` — Redirect to `/admin/dashboard`
  - `/admin/dashboard` — AdminDashboard
  - `/admin/users` — UserManagement
  - `/admin/system` — SystemMonitoring
  - `/admin/reports` — ReportsManagement
  - `/admin/heatmap` — HeatmapCitywide
  - `/admin/analytics` — AnalyticsExport
  - `/admin/notifications` — NotificationsCenter
  - `/admin/settings` — SystemSettings
  - `/admin/logs` — AuditLogs
- All routes wrapped in `AdminLayout`

## 2. AdminLayout.jsx
- **Dark sidebar** (280px wide, `bg-slate-900`):
  - Top: "G-TRASH" logo with Leaf icon, "ADMIN PANEL" badge in `bg-teal-600`
  - Navigation items with icons:
    - Dashboard (`LayoutDashboard`)
    - User Management (`Users`)
    - System Monitoring (`Activity`)
    - Bug Reports (`Bug`)
    - Heatmap Analytics (`MapPin`)
    - Analytics & Export (`Download`)
    - Notifications (`Bell`)
    - System Settings (`Settings`)
    - Audit Logs (`FileText`)
  - Active item: `bg-slate-800`, left border `bg-teal-500`, text white
  - Inactive: text `text-slate-400`, hover `text-slate-200`
  - Bottom: Admin profile with avatar, name "Admin", role "System Administrator"
  - Collapse toggle for mobile
- **Right side**: TopBar (`bg-white`, shadow) + scrollable content area (`bg-slate-50`)

## 3. AdminDashboard.jsx (Main Overview)

### Top Stats Row (4 cards)
- **Total Waste Collected**: `Scale` icon, "45,892kg", "+8% this month", green trend
- **Active Users**: `Users` icon, "2,450", "185 online now", blue
- **Trucks Deployed**: `Truck` icon, "12/15", "80% fleet utilization", teal
- **Critical Alerts**: `AlertTriangle` icon, "5", "3 require immediate action", red

### System Health Cards (2 cards)
- **API Status**: Green dot "Operational", uptime 99.9%, last checked "2 min ago"
- **IoT Sensors**: "48/50 Online", 96% operational, 2 offline sensors listed
- **Database**: "Healthy", 45% storage used, last backup "1 hour ago"

### Charts Row (2 columns)
- **Waste Collection Trend** (LineChart): Daily collection over 30 days, comparisons
- **User Registrations** (BarChart): New users per week, broken by role

### Bottom Section (3 columns)
- **Recent System Logs**: Last 10 log entries with timestamps
- **Active Trucks Map**: Mini map showing all 12 truck locations
- **Quick Actions**: Buttons for common admin tasks (Add User, Send Notification, Export Data, System Backup)

## 4. UserManagement.jsx

### Filter Bar
- Search by name, email, ID
- Role filter: All / Residents / Collectors / Officials / Admins
- Status filter: Active / Suspended / Pending
- Date range for registration

### User Table
- Columns: Avatar, Name, Email, Role (with colored badge), Barangay, Status, Registered Date, Actions
- Sortable columns
- Checkbox for bulk actions
- Pagination (25 per page)
- Role badges:
  - Resident: `bg-blue-100 text-blue-800`
  - Collector: `bg-green-100 text-green-800`
  - Official: `bg-purple-100 text-purple-800`
  - Admin: `bg-red-100 text-red-800`

### Actions per row
- Edit (opens modal)
- Suspend/Activate toggle
- Reset password
- Delete (with confirmation dialog)

### Add User Modal
- Form fields: Name, Email, Role dropdown, Barangay dropdown, Phone
- Generate random password button
- Send welcome email checkbox

## 5. SystemMonitoring.jsx

### Fleet Overview
- Table of all 15 trucks:
  - Truck ID, Driver, Route, Status (Active/Inactive/Maintenance), Last Location, Stops Completed, Fuel Level
  - Status indicators: Green dot (active), Yellow (delayed), Red (stopped), Grey (maintenance)
  - Click row to see truck detail modal

### IoT Sensor Status
- Grid of sensor cards:
  - Sensor ID, Location, Type (MQ-135/DHT11/Ultrasonic), Battery, Last Reading, Status
  - Green border (online), Red border (offline)
  - Offline sensors have "Troubleshoot" button

### System Resources
- CPU Usage: 42% (progress bar)
- Memory: 3.2GB / 8GB (progress bar)
- Storage: 45.6GB / 100GB (progress bar)
- API Requests: 12,450 today
- Uptime: 99.9% (last 30 days)

## 6. ReportsManagement.jsx (Bug Reports & Feedback)

### Tabs
- Bug Reports | User Feedback | Feature Requests

### Bug Reports Table
- Columns: ID, Title, Reported By, Category, Severity, Status, Date, Actions
- Severity badges: Critical (red), High (orange), Medium (yellow), Low (green)
- Status: Open, In Review, Fixed, Closed, Won't Fix
- Actions: View detail, Assign to dev, Change status

### Bug Detail Modal
- Full description with reproduction steps
- Attachments/screenshots (placeholders)
- System info (browser, OS, app version)
- Timeline of updates
- Comments section
- Assign to developer dropdown
- Status change buttons

### Feedback Cards
- Grid of feedback cards with ratings (1-5 stars)
- User info, date, category
- "Mark as Reviewed" button

## 7. HeatmapCitywide.jsx

### Full-screen map
- Leaflet map centered on Cebu City (10.3157, 123.8854, zoom 13)
- Heatmap layer showing pollution intensity across the city
- Color gradient: Green → Yellow → Orange → Red
- Opacity slider for heatmap intensity

### Filter Controls
- Toggle: Live / Last Hour / Today / This Week
- Gas type: Ammonia / Methane / Both
- Barangay filter dropdown

### Zone List Panel (side panel)
- List of all monitored zones with:
  - Zone name, Barangay, Status badge, Gas readings
  - Mini sparkline chart for each zone
  - Click to zoom to zone on map

### Alert Threshold Configuration
- Set threshold values for:
  - Warning level (ammonia > 20 ppm)
  - Critical level (ammonia > 40 ppm)
  - Auto-notification toggle

## 8. AnalyticsExport.jsx

### Date Range Selector
- Preset: Today, This Week, This Month, This Quarter, Custom Range

### Export Cards
- **Waste Collection Report**: PDF/CSV export, summary statistics
- **User Activity Report**: Registration, logins, reports submitted
- **Truck Fleet Report**: Routes completed, fuel consumption, efficiency
- **Pollution Analysis**: Ammonia/Methane trends, hotspot areas
- **Financial Summary**: Operational costs, fuel, maintenance
- Each card has: Icon, title, description, "Export PDF" and "Export CSV" buttons

### Preview Table
- Shows preview of selected export data
- Columns vary based on selected report type

## 9. NotificationsCenter.jsx

### Compose Notification
- Title input
- Message body (textarea)
- Target audience: All Users / Residents / Collectors / Officials / Specific User(s)
- Priority: Normal / Important / Urgent
- Schedule: Send now / Schedule for later
- Preview card showing how notification will appear

### Notification History
- Table of sent notifications:
  - Date, Title, Target, Recipients, Opened %, Actions
  - Status: Sent, Delivered, Failed

### Automated Alerts Configuration
- Toggle for auto-alerts:
  - High pollution detected
  - Truck breakdown
  - Sensor offline
  - Collection missed

## 10. SystemSettings.jsx

### Sections (tabbed or accordion)
- **General Settings**: App name, timezone, date format, language default
- **Collection Settings**: Default collection schedule, bin capacity limits, route optimization toggle
- **Notification Settings**: Email provider config, SMS gateway, push notification keys
- **Security**: Password policy, 2FA toggle, session timeout, IP whitelist
- **Data Management**: Backup schedule, data retention policy, archive old data
- **API Keys**: Generate/manage API keys for external integrations
- **Maintenance Mode**: Toggle to put app in maintenance with custom message

## 11. AuditLogs.jsx

### Filter Bar
- Date range picker
- User filter
- Action type: Login, Create, Update, Delete, Export, Settings Change
- Search by description

### Logs Table
- Columns: Timestamp, User, Role, Action, Description, IP Address, Status
- Color-coded rows based on action type
- Infinite scroll or pagination
- Export logs button

---

## Mock Data (data/mockData.js)

```js
export const systemStats = {
  totalWaste: { value: "45,892kg", change: "+8%", trend: "up" },
  activeUsers: { value: "2,450", online: 185 },
  trucksDeployed: { value: "12/15", utilization: "80%" },
  criticalAlerts: { value: 5, immediate: 3 },
};

export const systemHealth = {
  api: { status: "operational", uptime: "99.9%", lastChecked: "2 min ago" },
  sensors: { online: 48, total: 50, offline: 2 },
  database: { status: "Healthy", storage: "45%", lastBackup: "1 hour ago" },
};

export const users = [
  { id: 1, name: "Jane Doe", email: "jane@email.com", role: "resident", barangay: "Lahug", status: "active", registered: "2024-01-15" },
  { id: 2, name: "Juan Dela Cruz", email: "juan@email.com", role: "collector", barangay: "North Cebu", status: "active", registered: "2024-02-20" },
  { id: 3, name: "Maria Reyes", email: "maria@email.com", role: "collector", barangay: "IT Corridor", status: "active", registered: "2024-03-10" },
  { id: 4, name: "Pedro Santos", email: "pedro@email.com", role: "official", barangay: "Lahug", status: "active", registered: "2024-01-05" },
  { id: 5, name: "Admin User", email: "admin@gtrash.com", role: "admin", barangay: "N/A", status: "active", registered: "2023-12-01" },
];

export const fleet = [
  { id: "GT-401", driver: "Juan Dela Cruz", route: "North Cebu", status: "active", location: "Lahug", stopsDone: 4, totalStops: 6, fuel: "75%" },
  { id: "GT-402", driver: "Pedro Santos", route: "South Cebu", status: "active", location: "Mandaue", stopsDone: 3, totalStops: 8, fuel: "60%" },
  { id: "GT-403", driver: "Maria Reyes", route: "IT Corridor", status: "delayed", location: "IT Park", stopsDone: 2, totalStops: 5, fuel: "45%" },
  { id: "GT-404", driver: "Jose Bautista", route: "Lahug District", status: "active", location: "Banilad", stopsDone: 5, totalStops: 7, fuel: "80%" },
  { id: "GT-405", driver: "N/A", route: "N/A", status: "maintenance", location: "Depot", stopsDone: 0, totalStops: 0, fuel: "100%" },
];

export const sensors = [
  { id: "S-001", location: "Carbon Market", type: "MQ-135", battery: "85%", lastReading: "45 ppm", status: "online" },
  { id: "S-002", location: "Colon Street", type: "MQ-135", battery: "72%", lastReading: "22 ppm", status: "online" },
  { id: "S-003", location: "IT Park", type: "MQ-135", battery: "90%", lastReading: "5 ppm", status: "online" },
  { id: "S-004", location: "Ayala", type: "DHT11", battery: "15%", lastReading: "32°C", status: "offline" },
  { id: "S-005", location: "Mabolo", type: "Ultrasonic", battery: "60%", lastReading: "85cm", status: "online" },
];

export const bugReports = [
  { id: 1, title: "App crashes on map view", reportedBy: "Resident #452", category: "Mobile App", severity: "critical", status: "open", date: "2024-12-15" },
  { id: 2, title: "Notification not received", reportedBy: "Collector GT-402", category: "Notifications", severity: "high", status: "in-review", date: "2024-12-14" },
  { id: 3, title: "Heatmap not loading", reportedBy: "Official Lahug", category: "Web Dashboard", severity: "medium", status: "fixed", date: "2024-12-13" },
];

export const auditLogs = [
  { id: 1, timestamp: "2024-12-15 14:30", user: "Admin", role: "admin", action: "Update", description: "Updated system settings", ip: "192.168.1.1", status: "success" },
  { id: 2, timestamp: "2024-12-15 14:15", user: "Jane Doe", role: "resident", action: "Login", description: "User logged in", ip: "192.168.1.100", status: "success" },
  { id: 3, timestamp: "2024-12-15 13:45", user: "Juan Dela Cruz", role: "collector", action: "Update", description: "Marked Lahug as cleaned", ip: "192.168.1.50", status: "success" },
];
```

## Component Requirements

### AdminSidebar.jsx
- Dark theme sidebar with fixed positioning
- Active state based on `useLocation()`
- Smooth transitions on hover
- Collapse/expand for mobile with hamburger menu
- Admin profile section at bottom

### StatCard.jsx
- Props: `icon`, `title`, `value`, `subtitle`, `trend`, `color`
- White card with colored icon container, hover shadow increase

### UserTable.jsx
- Props: `users` array, `onEdit`, `onSuspend`, `onDelete`
- Sortable headers, search filter, pagination
- Role badges with appropriate colors

### SystemHealthCard.jsx
- Props: `title`, `status`, `metrics`
- Green/red status dot, metric rows

### DataTable.jsx
- Reusable generic table component
- Props: `columns`, `data`, `onSort`, `onRowClick`, `pagination`

### ConfirmDialog.jsx
- Modal with title, message, confirm/cancel buttons
- Props: `open`, `title`, `message`, `onConfirm`, `onCancel`

## States to Handle
- **Loading**: Skeleton loaders for tables, cards, and charts
- **Empty**: "No data available" with relevant icon per section
- **Error**: Red error banners with retry functionality
- **Success**: Green toast notifications for actions (user created, settings saved, etc.)
- **Confirmations**: Modal dialogs for destructive actions (delete user, reset system)

## Global Notes
- Use Tailwind CSS exclusively — no custom CSS
- All icons from Lucide React
- Mock data in `data/mockData.js`
- React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
- Dark sidebar `bg-slate-900`, light content `bg-slate-50`
- Admin-specific accent color: `teal-600` for active states
- Responsive: Collapsible sidebar on mobile
- Export defaults for all pages and components
- Professional enterprise-grade UI similar to Vercel/Datadog admin panels
- Include brief comments explaining key functionality

---