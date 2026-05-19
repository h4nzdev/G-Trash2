I need to implement the heatmap auto-update feature when a garbage truck driver marks a stop as "Cleaned" in the G-TRASH system. My capstone document states: "The actual physical collection of waste and the manual updating of the heatmap to 'Green/Cleaned' rely entirely on the active participation of garbage collectors." Currently, drivers can mark stops as cleaned via the GarbageTruck app, but I need to verify and implement the linkage between that action and the heatmap updating from Red/Yellow to Green in real-time.

Current setup:
- GarbageTruck App: React Native (Expo) with a Map screen
- Backend: Node.js + Express + MongoDB with Mongoose
- Socket.io for real-time events
- Officials Web App: React + Vite + Tailwind CSS + React-Leaflet for heatmap
- Driver "Mark as Clean" flow: Driver navigates to stop → presses "Mark as Clean" → logs weight → collection is saved to database
- Heatmap currently shows pollution levels from IoT sensors and report density
- Existing collections endpoint: POST /api/collections

Requirements:

1. BACKEND - Enhanced Collection Endpoint:

   a. Update POST /api/collections to trigger heatmap update:
      When a driver marks a stop as cleaned, the endpoint should:
      
      1. Save the collection record (already exists)
      2. Find the corresponding garbage area/zone for that location
      3. Update the zone status to "cleaned"
      4. Reset pollution indicators for that zone
      5. Emit Socket.io event to update all connected clients

   b. New/Updated Mongoose Schema for GarbageArea/GarbageZone:
      {
        zoneId: String,                  // unique identifier for the zone
        barangay: String,
        location: {
          lat: Number,
          lng: Number,
          radius: Number                 // coverage area in meters (e.g., 100m)
        },
        status: {
          type: String,
          enum: ['clean', 'moderate', 'dirty', 'critical'],
          default: 'clean'
        },
        currentReadings: {
          ammonia: Number,
          methane: Number,
          binLevel: Number,
          lastUpdated: Date
        },
        lastCollection: {
          collectedBy: String,           // driver name or truck ID
          collectedAt: Date,
          weight: Number,
          collectionId: mongoose.ObjectId
        },
        reportCount: { type: Number, default: 0 },     // active unresolved reports in this zone
        colorCode: {
          type: String,
          enum: ['green', 'yellow', 'red'],
          default: 'green'
        },
        history: [{
          status: String,
          changedAt: Date,
          changedBy: String,
          reason: String                  // e.g., "collection_completed", "report_filed", "sensor_alert"
        }]
      }

   c. Heatmap Color Logic (Priority System):
      A zone's color is determined by the WORST condition:
      
      - 🟢 GREEN (Clean):
        - No active reports AND
        - IoT readings are normal (ammonia < 25ppm, methane < 10% LEL) AND
        - Last collection was within 3 days
      
      - 🟡 YELLOW (Moderate):
        - 1-2 active reports OR
        - IoT readings are moderate (ammonia 25-50ppm, methane 10-25% LEL) OR
        - Last collection was 3-5 days ago
      
      - 🔴 RED (Dirty/Critical):
        - 3+ active reports OR
        - IoT readings are critical (ammonia > 50ppm, methane > 25% LEL) OR
        - Last collection was more than 5 days ago

   d. New Endpoints:
      - GET /api/zones - Get all garbage zones with status and color
      - GET /api/zones/:zoneId - Get single zone details
      - GET /api/zones/:zoneId/history - Get status change history for a zone
      - POST /api/zones/:zoneId/recalculate - Force recalculate zone color (for admin use)

2. BACKEND - Auto-Recalculate Zone Status:

   Create a utility function that recalculates a zone's color based on current data:

   function calculateZoneColor(zoneId) {
     // 1. Get active report count for this zone
     // 2. Get latest IoT sensor readings for this zone
     // 3. Get last collection date for this zone
     // 4. Apply color logic rules
     // 5. Return: { color, status, factors }
   }

   This function should be called:
   - When a driver marks a stop as cleaned
   - When a new report is filed in the zone
   - When an IoT sensor sends a reading above threshold
   - When an admin manually triggers recalculation

3. SOCKET.IO EVENTS:

   a. New event: zone:status:update
      Emitted when any zone changes color
      Payload:
      {
        zoneId: "ZONE-LAHUG-01",
        barangay: "Lahug",
        previousColor: "red",
        newColor: "green",
        reason: "collection_completed",
        details: {
          collectedBy: "Truck TRK-001",
          collectedAt: "2026-03-15T14:30:00Z",
          weight: "245 kg"
        },
        timestamp: "2026-03-15T14:30:05Z"
      }

   b. Updated event: pickup:completed (already exists)
      After emitting pickup:completed, also call calculateZoneColor() and emit zone:status:update

4. OFFICIALS WEB APP - Real-Time Heatmap Updates:

   a. Heatmap listens for zone:status:update event
   b. When received:
      - Find the zone polygon/marker on the map
      - Animate the color transition (e.g., red → yellow → green with a brief flash)
      - Show a temporary popup: "✅ Zone cleaned by Truck TRK-001 • 245 kg collected"
      - Popup auto-dismisses after 5 seconds
   c. The heatmap legend should also update the count of red/yellow/green zones

5. GARBAGE TRUCK APP - Enhanced "Mark as Clean" Flow:

   a. Update the "Mark as Clean" screen to:
      - Show which zone(s) will be affected
      - Show current zone status before cleaning (e.g., "Current: 🔴 Critical")
      - After marking, show confirmation with zone status change:
        "✅ Stop completed! Zone status: 🔴 Critical → 🟢 Clean"
      - Log the weight and auto-calculate points

   b. If multiple zones overlap at this stop:
      - Mark all overlapping zones as cleaned
      - Show list of zones affected

6. RESIDENT APP - Map Updates:

   a. The Resident app map should also listen for zone:status:update
   b. When their area's zone changes to green, show a subtle notification:
      "Your area has been cleaned! 🧹"
   c. The heatmap overlay on the resident map updates in real-time

7. ZONE MANAGEMENT (Admin Panel):

   a. Add a page or section to manage garbage zones:
      - Create new zones (draw polygon or set center point + radius)
      - Edit zone boundaries
      - Delete zones
      - View zone history
      - Manually override zone color (for特殊情况)
      - Bulk recalculate all zones

8. EDGE CASES:
   - What if a driver marks as clean but there are still active reports? (Zone goes to yellow instead of green)
   - What if IoT sensor still shows high pollution after cleaning? (Zone stays yellow/red based on sensor data)
   - What if a zone has no IoT sensor? (Color based only on reports and collection date)
   - What if a driver accidentally marks wrong stop as clean? (Admin can manually revert zone status)
   - What if multiple trucks clean overlapping zones? (Each zone updates independently)

Please provide:
- GarbageZone/GarbageArea Mongoose schema
- Updated POST /api/collections endpoint with zone recalculation
- Zone color calculation utility function
- New zone management endpoints
- Socket.io event handlers for zone updates
- Updated Officials heatmap component with real-time animation
- Updated GarbageTruck "Mark as Clean" screen
- Admin Panel zone management interface

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps:
   - How to set up test zones in the database
   - How to create a report that makes a zone red
   - How to log in as driver, navigate to the stop, and mark as clean
   - How to verify the heatmap updates on the Officials dashboard
   - How to verify the Resident app map updates
   - How to test edge cases (sensor still high, reports still active)

2. Test Data Script:
   Provide MongoDB insert scripts to create:
   - Zone A (Red): 3+ active reports, high ammonia, last collection 7 days ago
   - Zone B (Yellow): 1 active report, moderate ammonia, last collection 4 days ago
   - Zone C (Green): 0 reports, normal readings, collected 1 day ago

3. Test Flow:
   | Step | Action | Zone A Color | Zone B Color | Zone C Color |
   |------|--------|--------------|--------------|--------------|
   | Initial state | Load heatmap | 🔴 Red | 🟡 Yellow | 🟢 Green |
   | Driver cleans Zone A | Mark as clean | 🟢 Green (if no reports remain) | 🟡 Yellow | 🟢 Green |
   | Driver cleans Zone B | Mark as clean | 🟢 Green | 🟢 Green | 🟢 Green |

4. Expected Visual Results:
   - What the heatmap looks like with all three zones in different colors
   - What the animation looks like when a zone transitions from red to green
   - What the popup looks like after a zone is cleaned
   - What the driver sees on their "Mark as Clean" confirmation screen

5. Debugging Checklist:
   - If zone color doesn't change after collection, check: [list items]
   - If heatmap animation doesn't play, check: [list items]
   - If Socket.io event not received, check: [list items]
   - If zone recalculation gives wrong color, check: [list items]

6. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | Clean critical zone with no reports | Driver marks as clean | Zone goes from Red → Green |
   | Clean zone with remaining reports | Driver marks as clean | Zone goes from Red → Yellow |
   | Clean zone with high sensor reading | Driver marks as clean | Zone stays Yellow (sensor still high) |
   | Multiple zones at one stop | Driver marks as clean | All overlapping zones update |
   | Admin manual override | Admin changes zone to Green | Zone shows Green regardless of data |
   | New report in green zone | Resident files report | Zone recalculates to Yellow |
   | IoT alert in green zone | Sensor sends critical reading | Zone immediately goes Red |
   | Resident sees zone cleaned | Zone changes to Green | Map updates + "Your area has been cleaned!" |