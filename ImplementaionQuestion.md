3.7 Design Phase

The design phase of G-TRASH focused on translating the system requirements into a concrete interface and data structure that is functional, user-friendly, and role-appropriate. The design was guided by three principles: simplicity for field use (collectors operate the app while on a moving vehicle), clarity for residents (non-technical users must understand pollution levels and truck proximity at a glance), and scalability for administrators (dashboards must present large volumes of data in an organized and actionable format).

The phase is divided into two parts: Interface Design, which defines the layout and interaction design of each module per user role, and Database Design, which defines the data structure and relationships that power the system. Both were designed in parallel to ensure the interface requirements were always supported by an appropriate data model.

Design decisions were informed by the project's core technologies — React Native for mobile and React with Tailwind CSS for web — which shaped the component structure, navigation patterns, and visual language used across all modules. The color system uses green (#006A3B) as the primary accent to reinforce the environmental theme of the system, with neutral backgrounds and role-specific accent overrides for the admin and official dashboards.


3.7.1 Interface Design (Main Modules)

The G-TRASH system is composed of four interface modules, each designed for a specific user role. The mobile apps follow a clean, nature-themed color palette (primary green: #006A3B, background: #FBF9F8, text: #1B1C1C) with card-based layouts and bottom sheet navigation panels. The web dashboards use a dark sidebar (bg-slate-900) with a light content area (bg-slate-50) and teal accent colors consistent with enterprise-grade admin panels.


Module 1: Resident Mobile App (React Native / Expo)

Screen: MapScreen
+------------------------------------------+
|  [Layers]              [My Location]      |  <- Floating action buttons (top right)
|                                           |
|  Air Quality Legend                       |  <- Fixed top-left legend card
|  (red / yellow / green dots)             |
|                                           |
|         Leaflet Map (full screen)         |
|   - Barangay route polyline (green)       |
|   - Heatmap zones (colored circles)       |
|   - Truck marker (emoji + "GT-402")       |
|   - 3-layer proximity radius rings        |
|   - Blue dot = resident's location        |
|                                           |
+------------------------------------------+
|  [Handle bar]                             |  <- Draggable bottom sheet
|  Collector Route          [Lahug v]       |
|  Schedule ID: #CEB-9921                   |
|  ----------------------------------------|
|  Timeline of stops (scrollable):          |
|   [check] Ayala        Completed 08:30AM  |
|   [check] IT Park      Completed 09:15AM  |
|   [ dot ] Apas         In Progress        |
|   [truck] Lahug        Active 10:45AM     |
|  ----------------------------------------|
|  [truck icon] Truck #402 is arriving      |
|               Estimated arrival: 3 min    |
|                           [Track]         |
+------------------------------------------+

Key Design Decisions:
- Full-screen Leaflet map rendered inside a WebView for rich interactivity
- Bottom sheet collapses to show only the header (80px) and expands to 52% of screen height via swipe gesture or expand button
- Truck marker appears lazily only when the truck starts navigation; disappears when truck goes offline
- 3-layer proximity circles (350m red, 700m yellow, 1050m green) centered on the resident's GPS location to visualize how close the truck is


Module 2: Garbage Truck Collector App (React Native / Expo)

Screen: CollectorMapScreen
+------------------------------------------+
|  Route Progress        75%               |  <- Progress card (top left, behind buttons)
|  [Layers]  [Stop Nav / My Location]      |  <- Floating action buttons (top right)
|                                           |
|  Air Quality   Carbon Market (red)       |  <- Legend card (bottom-left of map)
|                Colon St     (yellow)     |
|                IT Park      (green)      |
|                                           |
|         Leaflet Map (full screen)         |
|   - Route polyline between stops          |
|   - Stop markers (green/grey dots)        |
|   - Truck SVG icon (rotates with heading) |
|   - Heatmap zone circles                  |
|                                           |
+------------------------------------------+
|  [Handle bar]                             |  <- Draggable bottom sheet
|  Pickup Locations       2 stops remaining |
|  ----------------------------------------|
|  Current Stop Card:                       |
|   [pin] Lahug, Block 5, Lahug   [Now]    |
|   3 bins | 10:45 AM | General           |
|   [Start Navigation]  [Report]           |
|   [Mark Cleaned]                         |
|  ----------------------------------------|
|  All Stops timeline (scrollable):         |
|   [check] Ayala     08:30AM  Done        |
|   [check] IT Park   09:15AM  Done        |
|   [truck] Lahug     10:45AM  [Mark]      |
|   [ dot ] Banilad   11:30AM  Go          |
|  ----------------------------------------|
|  3 Completed | 2 Remaining | 135kg       |
+------------------------------------------+

Key Design Decisions:
- Top-down SVG truck icon rotates in real time based on GPS heading (0–360 degrees)
- "Start Navigation" triggers GPS streaming via Socket.io; truck position broadcasts to Resident app
- Pollution zone circles are tappable — opens a modal card with ammonia/methane readings, risk level, and recommendation
- Progress bar and stats footer give the collector a quick overview of their daily route completion


Module 3: Official Web Dashboard (React + Tailwind CSS)

Layout:
+------------------+----------------------------------------+
| SIDEBAR          |  CONTENT AREA                          |
| (dark, fixed)    |                                        |
|                  |  Page Title + breadcrumb               |
| G-TRASH logo     |  ----------------------------------------|
|                  |  [Stat Card] [Stat Card] [Stat Card]   |
| Dashboard        |                                        |
| Analytics        |  Analytics Chart (line/bar)            |
| Fleet            |                                        |
| Reports          |  Barangay Performance Table            |
| Settings         |                                        |
|                  |  Route Monitoring Map                  |
| [Official Name]  |                                        |
+------------------+----------------------------------------+

Key screens:
- Dashboard — summary cards (total waste collected, trucks deployed, active sensors, alerts)
- Analytics — pollution trend charts per barangay, time-series sensor data
- Fleet Monitor — live status of all trucks, assigned routes, stop completion
- Reports — submitted complaints from residents, sortable by severity and status


Module 4: Admin Web Panel (React + Tailwind CSS)

Layout: Same sidebar structure as Official, but with teal-600 accent color for admin role.

Key screens:
- Dashboard — system-wide stats (total waste, active users, trucks deployed, critical alerts)
- User Management — searchable/sortable table of all users with role badges (resident/collector/official/admin), edit/suspend/delete actions, pagination
- Fleet Management — all truck records with driver, route, status (active/delayed/maintenance), fuel level, stops done
- Sensor Management — grid of all IoT sensors with type, battery level, last reading, online/offline status
- Bug Reports — table of reported issues with category, severity, status filter
- Audit Logs — timestamped log of all system actions per user with IP address


Design System (shared across web dashboards):
- Color: Sidebar bg-slate-900, Content bg-slate-50, Accent teal-600 (admin) / green-600 (official)
- Typography: System font stack, heading 700 weight, body 400/500 weight
- Components: StatCard, UserTable, DataTable, SystemHealthCard, ConfirmDialog (modal), toast notifications
- Icons: Lucide React throughout
- States handled: Loading (skeleton loaders), Empty (icon + message), Error (red banner + retry), Success (green toast), Confirmation (modal dialog for destructive actions)


3.7.2 Database Design

Database: MongoDB (NoSQL)
Database name: gtrash

Why MongoDB over SQL:
Sensor data schemas vary by hardware type — an MQ-135 produces gas concentration in ppm, a DHT11 produces temperature and humidity, and an ultrasonic sensor produces distance in cm. MongoDB's flexible document model stores all of these in a single sensorReadings collection without requiring schema migrations when new sensor types are added.


Collection Schemas:

1. trucks (currently implemented)
{
  truckId   : String  (unique, required) — e.g. "GT-402"
  lat       : Number  (required)
  lng       : Number  (required)
  heading   : Number  (degrees 0–360, default 0)
  speed     : Number  (m/s, default 0)
  status    : String  ("online" | "offline", default "online")
  updatedAt : Date    (auto-updated on each GPS ping)
}

2. users (recommended)
{
  name      : String  (required)
  email     : String  (unique, required)
  password  : String  (hashed)
  role      : String  ("resident" | "collector" | "official" | "admin")
  barangay  : String
  status    : String  ("active" | "suspended")
  createdAt : Date
}

3. sensors (recommended)
{
  sensorId    : String  (unique)
  location    : String  — e.g. "Carbon Market"
  type        : String  ("MQ-135" | "DHT11" | "Ultrasonic")
  battery     : Number  (percentage)
  lastReading : String  — e.g. "45 ppm"
  status      : String  ("online" | "offline")
  updatedAt   : Date
}

4. sensorReadings (recommended)
{
  sensorId  : String  (ref: sensors.sensorId)
  value     : Number
  unit      : String  — e.g. "ppm", "°C", "cm"
  timestamp : Date
}

5. reports (recommended)
{
  title       : String
  description : String
  reportedBy  : String  (ref: users._id)
  category    : String  ("Mobile App" | "Notifications" | "Web Dashboard" | "Other")
  severity    : String  ("critical" | "high" | "medium" | "low")
  status      : String  ("open" | "in-review" | "fixed")
  date        : Date
}

6. schedules (recommended)
{
  barangay  : String
  date      : Date
  time      : String
  truckId   : String  (ref: trucks.truckId)
  status    : String  ("upcoming" | "in-progress" | "completed")
}

7. notifications (recommended)
{
  recipientId : String  (ref: users._id)
  message     : String
  type        : String  ("alert" | "reminder" | "schedule-change")
  read        : Boolean (default false)
  createdAt   : Date
}

8. auditLogs (recommended)
{
  userId      : String  (ref: users._id)
  user        : String  (display name)
  role        : String
  action      : String  ("Login" | "Update" | "Delete" | "Create")
  description : String
  ip          : String
  status      : String  ("success" | "failed")
  timestamp   : Date
}


Entity Relationship Overview:

users ----< reports          (one user submits many reports)
users ----< notifications    (one user receives many notifications)
users ----< auditLogs        (one user generates many audit log entries)
trucks ---< schedules        (one truck has many scheduled routes)
sensors --< sensorReadings   (one sensor produces many time-series readings)
trucks    - users            (a collector user is assigned to a truck via truckId)


3.8 System Architecture


3.8.1 Architectural Design

+------------------------------------------------------------------+
|                            CLIENTS                               |
|  [Resident App]  [Collector App]  [Admin Web]  [Official Web]   |
+--------+--------------+------------------------------------------+
         | Socket.io    | Socket.io + XHR
         v              v
+----------------+  +----------------------+
| Resident       |  | GarbageTruck         |
| Backend :6000  |<-+ Backend :5000        |<---- IoT (ESP32 -> HTTP)
| (Relay)        |  | (Tracking + REST)    |
+--------+-------+  +----------+-----------+
         |                     |
         +----------+----------+
                    v
             +------------+
             |  MongoDB   |
             |  (gtrash)  |
             +------------+

GPS Data Flow:
Collector App GPS
  -> socket.emit("truck:location")
  -> GarbageTruck Backend (:5000)
  -> saves to MongoDB + socket.broadcast.emit("truck:location:update")
  -> Resident Backend (:6000)
  -> io.emit("truck:location:update")
  -> Resident App
  -> window.updateTruckPosition(lat, lng)
  -> Leaflet marker moves on map

IoT Data Flow (recommended):
ESP32 sensor -> HTTP POST -> GarbageTruck Backend -> MongoDB sensorReadings -> broadcast -> Resident/Admin apps update heatmap


3.8.2 Explanation of the Architectural Design

Two-backend relay pattern — The GarbageTruck backend (port 5000) is the single source of truth: it accepts GPS from the truck driver and writes to MongoDB. The Resident backend (port 6000) is a relay — it connects to port 5000 as a Socket.io client, forwards every truck:location:update event to all Resident app clients, and caches the latest truck position so newly connected residents immediately see the truck without waiting for the next GPS ping.

Why two backends instead of one? It isolates concerns — the GarbageTruck backend manages IoT and GPS writes, while the Resident backend scales independently for read-heavy public traffic. When using ngrok for external testing, only the Resident backend URL needs to be public-facing.

Real-time layer (Socket.io) handles sub-second truck position updates without polling. Transport order ["polling", "websocket"] ensures the connection works on networks that block WebSocket upgrades.

REST fallback — POST /api/trucks/location handles the critical initial GPS upload using XMLHttpRequest, which is more reliable than fetch on physical Android devices in certain network configurations.


3.8 Development Phase


3.9.1 Technology Stack (Tools and Technologies Used)

Layer              | Technology                          | Purpose
-------------------|-------------------------------------|------------------------------------------
Mobile Frontend    | React Native + Expo                 | Cross-platform iOS/Android apps
Web Frontend       | React + Tailwind CSS                | Admin and Official web dashboards
Maps               | Leaflet.js (via WebView)            | Interactive maps, markers, polylines, heatmap circles
GPS                | expo-location                       | watchPositionAsync for continuous real-time truck tracking
Real-time          | Socket.io + socket.io-client        | Bidirectional live GPS event streaming
Backend Framework  | Node.js + Express.js                | REST APIs and socket event handling
Database           | MongoDB + Mongoose                  | Flexible NoSQL storage for trucks, sensors, users
Environment Config | dotenv                              | API keys, URIs, and ports via .env
Icons              | @expo/vector-icons, Lucide React    | UI icons across mobile and web
IoT Hardware       | ESP32 + MQ-135                      | WiFi-enabled microcontroller + gas/ammonia sensor
Route Planning     | OpenRouteService API                | Real driving-route polylines between pickup stops
Dev/Testing        | ngrok, MongoDB Compass, Expo Go     | Tunneling, database inspection, physical device testing

Recommended additions:

Purpose                | Recommendation
-----------------------|------------------------------------------------
Authentication         | Firebase Auth or JWT with bcrypt
Push notifications     | Expo Notifications + Firebase FCM
AI scanner             | Google ML Kit (on-device) or OpenAI Vision API
IoT data ingestion     | MQTT broker (e.g. Mosquitto) for high-frequency sensor streams
Deployment             | Railway or Render (backends), Vercel (web dashboard)


3.9 Implementation and Testing Phase


3.10.1 Test Plan

Phase          | What is Tested                                                                 | Method
---------------|--------------------------------------------------------------------------------|----------------------------------------------------------
Unit           | Individual API endpoints (/api/trucks/location, /ping), socket event handlers, React component rendering | Manual API calls via Postman; component render checks
Integration    | Full GPS upload chain: Collector App -> Backend -> MongoDB -> Resident App marker update | Run both backends and both apps; press Start Navigation, verify DB record and map marker appear
Real-time      | Truck marker moves on Resident map within 3 seconds of physical device movement | Walk with Collector phone; observe Resident device map updating
Reconnection   | Socket reconnects after network drop without data loss                          | Toggle airplane mode on Collector device; verify updates resume automatically
Multi-device   | Multiple Resident devices see the same truck position simultaneously            | Open Resident app on 2 devices; start navigation on Collector device
Role access    | Resident cannot access Collector or Admin screens                              | Attempt to navigate to restricted routes without proper role
UAT            | Real residents, collectors, and officials use the system under actual field conditions | Supervised test run in the target barangay

Recommended tools: Jest (unit tests for backend logic), Detox (React Native end-to-end), Postman collections for API regression testing.


---

Full Idea:

G-TRASH: Smart Waste Monitoring System using IoT, AI, and Mobile Application
1. Introduction
Waste management is a major challenge in urban areas such as Cebu. Garbage collection often follows fixed schedules that do not adapt to real-time conditions, leading to overflowing trash, bad odors, and environmental health risks.
Many residents do not report issues due to:
Busy schedules
Complicated reporting processes
Hesitation or fear of confrontation
Belief that authorities are already aware
Additionally, some barangays lack their own garbage trucks and rely on shared trucks, resulting in delays and inefficient waste collection.
This project proposes a smart system that integrates IoT, Artificial Intelligence (AI), and a mobile/web application to provide real-time monitoring, automation, and improved coordination.

2. Objectives
General Objective
To develop a smart waste monitoring system that uses IoT and AI to improve garbage collection efficiency and reduce pollution.
Specific Objectives
Detect air pollution levels in garbage areas automatically
Provide real-time alerts to users and authorities
Track garbage trucks and visualize routes
Display pollution levels using heatmaps
Reduce reliance on manual reporting
Improve coordination between barangays
Provide data-driven insights for decision-making

3. Proposed Solution
The system introduces an automated, data-driven approach:
IoT sensors are installed in garbage-prone areas
Sensors detect harmful gases and environmental conditions
Data is sent to a central system via the internet
AI analyzes the data and identifies patterns
Alerts are triggered when pollution exceeds safe levels
Users access real-time data through a mobile/web app
The system also includes garbage truck tracking, route visualization, and role-based access for better usability.

4. System Features
4.1 IoT-Based Air Monitoring
Detects ammonia, methane, and pollutants
Installed in garbage bins or critical areas
Sends real-time environmental data

4.2 Real-Time Notification System
Alerts when pollution levels are high
Notifies residents, officials, and collectors

4.3 AI-Based Analysis
Analyzes pollution patterns
Provides recommendations such as:
Increasing collection frequency
Identifying high-risk time periods

4.4 Garbage Truck Tracking
Real-time truck location
Estimated arrival time for users

4.5 Smart Radius Notification (3-Layer System)
Distance-based alerts:
Far -> early notice
Medium -> preparation
Near -> immediate action

4.6 Barangay Route Visualization
Dropdown selection of barangay
Displays route similar to jeepney routes
Example:
Ayala -> SM -> Lahug

4.7 Heatmap Visualization
Map-based pollution display:
Red = High
Yellow = Moderate
Green = Safe

4.8 Data Analytics Dashboard
Pollution trends
Most affected areas
Historical data logs
`
4.9 Calendar and Scheduling
Shows garbage collection schedules
Helps users plan waste disposal

4.10 Waste Management Notifications
Reminders for garbage disposal
Alerts for schedule changes

4.11 Segregation Instruction
Guides users on proper waste segregation
Improves environmental awareness

4.12 AI Scanner
Allows users to scan trash items
AI suggests proper disposal or segregation

5. Role-Based Access System
5.1 Residents (Users)
Features:
View map with heatmap
Track garbage trucks
View routes
Receive real-time notifications (3-layer system)
Submit reports
View calendar schedules
Receive waste management notifications
Access segregation instructions
Use AI scanner

5.2 Garbage Truck Collectors
Features:
View heatmap status
Access routes
See assigned pickup locations
Identify trash-prone areas
Update system:
Mark areas as cleaned (Green)

5.3 Officials (Barangay / Government)
Features:
View data reports on collected trash
Access analytics dashboard
Monitor urgency levels of problems
Evaluate reports and system performance

5.4 Admin Panel (Developers)
Features:
Monitor total trash collected
View heatmap status and urgency levels
Track number of garbage trucks deployed
Analyze problem scaling based on urgency
Manage bug reports and user feedback
Handle system notifications and updates

6. Leaderboard and Reward System
6.1 Barangay Leaderboard
Ranking of barangays based on performance
6.2 Reward System (Pending)
Incentives for officials based on performance
To be finalized after interviews
6.3 Categories
Best in Segregation
Most Trash Collected

7. User Limitation
One account per household
Limit number of users per area
Helps maintain accurate data and avoid spam

8. System Architecture
Data Flow
IoT Sensor -> Microcontroller -> Internet -> Backend -> Database -> Application
Explanation
Sensors collect environmental data
ESP32 sends data via WiFi
Backend processes and analyzes data
Database stores information
Frontend displays data to users

9. Technologies to be Used
Hardware
ESP32
MQ-137 Gas Sensor

Software
Frontend:
React
Backend:
Flask or Node.js
Database:
SQLite / MongoDB / MySQL

10. AI Implementation (Simplified)
Rule-based logic:
High gas level -> alert
Repeated high readings -> recommendation
Advantages:
Easy to implement
Reliable
Real-time capable

11. Expected Outputs
Real-time monitoring system
Notification system
Garbage truck tracking
Route visualization
Heatmap display
Data analytics dashboard
Role-based system access
AI-assisted features

12. Benefits of the System
Improves waste collection efficiency
Reduces pollution and health risks
Provides real-time monitoring
Supports decision-making
Encourages community participation
Enhances barangay coordination

13. Limitations
Requires internet connection
Sensor accuracy may vary
Initial hardware cost

14. Research Methodology
Method Used: Mixed Method
Quantitative:
Sensor data
System analytics
Qualitative:
Interviews
User feedback

15. Participants
Residents (Google Forms survey)
Waste Management Head (Interview)
Barangay Officials (Interview)

16. Interview Focus
How barangays collect waste from:
Hospitals
Stores
Other establishments
This helps improve system accuracy and real-world application.

17. Future Enhancements
Full mobile app deployment
Advanced AI predictions
SMS alerts
Smart city integration
Additional sensors

18. Conclusion
The G-TRASH system provides a smart and efficient solution to modern waste management problems. By integrating IoT, AI, and real-time tracking, the system transforms traditional processes into an automated and proactive approach. It improves efficiency, reduces pollution, and enhances community participation.
