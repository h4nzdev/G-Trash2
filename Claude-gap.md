I need to implement system health monitoring for the Developer Admin role in the G-TRASH Admin Panel. My capstone document states that the Developer Admin "oversees the platform's technical health, manages bug reports, pushes updates and notifications, and monitors active IoT hardware metrics." Currently, the Admin Panel has a dashboard, user management, master map, reports overview, fleet overview, IoT dashboard, bug reports, announcements, and barangay scores. But it lacks actual system health monitoring — server status, API performance, database connection, and error tracking.

Current setup:
- Admin Panel: React + Vite + Tailwind CSS + Recharts
- Backend: Node.js + Express + MongoDB with Mongoose
- Socket.io for real-time events
- Admin role already exists with full system access

Requirements:

1. BACKEND - System Health Endpoints:

   a. New endpoint: GET /api/admin/system-health
      Returns real-time system health metrics:
      {
        "server": {
          "status": "online",           // online/degraded/offline
          "uptime": "14d 6h 32m",       // time since last restart
          "nodeVersion": "v18.17.0",
          "memoryUsage": {
            "total": "512 MB",
            "used": "245 MB",
            "percentage": 47.8
          },
          "cpuUsage": {
            "percentage": 23.5
          }
        },
        "database": {
          "status": "connected",        // connected/disconnected/error
          "type": "MongoDB",
          "connectionPool": "5 active / 10 max",
          "latency": "12ms",
          "lastBackup": "2026-03-15T08:00:00Z"
        },
        "api": {
          "totalRequests24h": 15420,
          "averageResponseTime": "85ms",
          "errorRate24h": 0.3,          // percentage
          "endpoints": [
            { "path": "/api/reports", "requests": 3420, "avgTime": "45ms", "errors": 2 },
            { "path": "/api/ai/chat", "requests": 890, "avgTime": "320ms", "errors": 5 },
            { "path": "/api/iot/readings", "requests": 5600, "avgTime": "25ms", "errors": 1 }
          ]
        },
        "externalServices": {
          "cloudinary": { "status": "connected", "latency": "180ms" },
          "groqApi": { "status": "connected", "latency": "450ms" },
          "geminiApi": { "status": "connected", "latency": "520ms" },
          "socketio": { "status": "connected", "activeConnections": 47 }
        }
      }

   b. New endpoint: GET /api/admin/error-logs
      Returns recent errors with pagination:
      Query params: page, limit, severity (error/warning/info), startDate, endDate
      Response:
      {
        "logs": [
          {
            "timestamp": "2026-03-15T14:32:10Z",
            "severity": "error",
            "source": "IoT Controller",
            "message": "Sensor SENSOR-005 failed to respond after 3 retries",
            "stack": "...",
            "resolved": false
          }
        ],
        "total": 45,
        "page": 1
      }

   c. New endpoint: GET /api/admin/active-sessions
      Returns count of currently connected users per role:
      {
        "total": 128,
        "residents": 110,
        "drivers": 8,
        "officials": 7,
        "admins": 2,
        "chd": 1
      }

   d. Backend middleware for API tracking:
      - Create a middleware that logs every API request:
        - Endpoint path
        - Response time
        - Status code
        - Timestamp
      - Store in a lightweight collection or in-memory cache (last 24 hours only)
      - Used to populate the API metrics in system-health

   e. Error logging utility:
      - Create a centralized error logger used across all controllers
      - Catches unhandled errors and stores them in an ErrorLog collection
      - ErrorLog schema:
        {
          timestamp: Date,
          severity: String,      // error, warning, info
          source: String,        // controller or service name
          message: String,
          stack: String,
          resolved: { type: Boolean, default: false },
          resolvedBy: String,
          resolvedAt: Date
        }

2. ADMIN PANEL - System Health Dashboard:

   a. New Page: "System Health" (/admin/system-health)
      Accessible from sidebar with a heartbeat icon

   b. Status Overview Cards (top row):
      - Server Status: Green/Red indicator + uptime
      - Database Status: Green/Red indicator + latency
      - API Health: Response time + error rate (color-coded: green <1%, yellow 1-5%, red >5%)
      - Active Users: Total count with role breakdown

   c. System Resources Section:
      - Memory Usage: Circular progress gauge (0-100%)
        - Green: 0-60%, Yellow: 60-85%, Red: 85-100%
      - CPU Usage: Same gauge style
      - Both update every 10 seconds (polling or Socket.io)

   d. API Performance Table:
      - Columns: Endpoint, Requests (24h), Avg Response Time, Error Count, Error Rate
      - Sort by any column
      - Highlight endpoints with high error rate in red
      - Auto-refresh every 30 seconds

   e. External Services Status:
      - Grid of service cards:
        - Cloudinary: Status indicator + latency
        - Groq AI: Status indicator + latency
        - Gemini AI: Status indicator + latency
        - Socket.io: Active connections count
      - Each card is green if connected, red if down

   f. Error Logs Table:
      - Below the status cards
      - Columns: Timestamp, Severity (color badge), Source, Message (truncated), Status
      - "Resolve" button for each error
      - Filter by: Severity, Date Range, Resolved/Unresolved
      - Click row to expand and see full stack trace
      - Pagination

   g. Active Sessions Panel:
      - Side panel or card showing:
        - Total active connections
        - Breakdown by role with icons:
          - 📱 Residents: 110
          - 🚛 Drivers: 8
          - 🏛️ Officials: 7
          - ⚙️ Admins: 2
          - 🏥 CHD: 1

3. REAL-TIME SYSTEM MONITORING:

   a. New Socket.io events:
      - system:health:update - emitted every 30 seconds with current health metrics
      - system:error:new - emitted when a new error is logged
      - system:service:down - emitted when an external service disconnects
      - system:service:up - emitted when an external service reconnects

   b. Admin Panel listens for these events to update in real-time

4. ALERT THRESHOLDS FOR ADMIN:

   a. Auto-alert when:
      - Memory usage exceeds 85%
      - CPU usage exceeds 90%
      - Database latency exceeds 500ms
      - API error rate exceeds 5%
      - Any external service goes down
      - Disk space below 10%

   b. When threshold is exceeded:
      - Show red banner at top of Admin Panel
      - Log as error in ErrorLogs
      - Emit system:health:update with degraded status

5. DATABASE BACKUP STATUS:
   - Show last backup date/time
   - If no backup in 7 days, show warning
   - "Request Backup" button (can trigger a manual backup script)

6. EDGE CASES:
   - What if MongoDB is the thing that's down? (Health endpoint should still respond for server/API metrics)
   - What if there are thousands of error logs? (Pagination + auto-cleanup of logs older than 30 days)
   - What if CPU/memory data is unavailable? (Show "N/A" instead of error)

Please provide:
- Backend system health endpoint implementation
- API tracking middleware
- Error logging utility
- ErrorLog Mongoose schema
- Admin Panel System Health page with all sections
- Socket.io events for real-time monitoring
- Alert threshold logic

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps:
   - How to access the System Health page as admin
   - How to verify server status, database status, and API metrics are showing
   - How to simulate an error and see it appear in the error logs
   - How to verify external service statuses
   - How to check active sessions
   - How to trigger an alert threshold (e.g., simulate high memory)

2. Test Data:
   Provide a script or instructions to:
   - Generate some fake error logs for display
   - Simulate an external service going down
   - Show different API endpoint performance data

3. Expected Visual Results:
   - What the full System Health page looks like
   - What the status cards look like when all green vs when something is red
   - What the error log table looks like with different severity badges
   - What the alert banner looks like at the top of the page

4. Debugging Checklist:
   - If health metrics show "N/A", check: [list items]
   - If error logs are empty, check: [list items]
   - If real-time updates aren't working, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | View system health | Open /admin/system-health | All status cards show green |
   | Check memory gauge | Observe memory usage gauge | Shows current % with color coding |
   | View error logs | Scroll to error logs table | Shows recent errors with severity |
   | Resolve an error | Click "Resolve" on an error | Status changes to resolved |
   | Filter errors | Select "Error" severity filter | Only error-level logs shown |
   | Service down alert | Disconnect from Cloudinary | Service card turns red; alert banner shows |
   | High memory alert | Memory exceeds 85% | Red banner appears; error logged |
   | Active sessions | Check sessions panel | Shows user count by role |