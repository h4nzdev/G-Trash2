I need to connect my existing IoT sensor to the G-TRASH heatmap so that when a garbage truck driver marks a stop as "Clean" near the sensor, the heatmap updates in real-time. The key idea: zones on the heatmap are defined by WHERE the IoT sensors are physically installed. No manual zone creation needed.

CURRENT IOT SETUP (already working):
- ESP32 with IR sensor (simulating gas detection for demo)
- Sends data to: POST https://g-trash2.onrender.com/api/iot/sensor-data
- Payload format:
  {
    "sensorId": "IR-SENSOR-001",
    "deviceType": "ESP32",
    "location": "Test Area",
    "barangay": "Test Barangay",
    "ammonia": 5,          // 5 when clean, 40 when dirty
    "methane": 0.2,        // 0.2 when clean, 3 when dirty
    "hydrogen": 3,         // 3 when clean, 20 when dirty
    "co2": 300,            // 300 when clean, 1200 when dirty
    "binLevel": 10,        // 10 when clean, 90 when dirty
    "temperature": 28,
    "humidity": 60
  }
- IR sensor logic: Object detected → sends "dirty" values + red LED. No object → sends "clean" values + green LED.
- The sensor currently has NO GPS coordinates in the payload.

CURRENT BACKEND SETUP:
- Node.js + Express + MongoDB with Mongoose
- Socket.io for real-time events
- Existing endpoint: POST /api/iot/sensor-data (receives sensor readings)

CURRENT FRONTEND SETUP:
- Officials Web App: React + Vite + Tailwind CSS + React-Leaflet
- GarbageTruck App: React Native (Expo) with Map screen and "Mark as Clean" button
- Resident App: React Native (Expo) with Map screen

WHAT I NEED (SIMPLE VERSION):

1. BACKEND - SIMPLE CHANGES:

   a. Create a simple SensorZone model (Mongoose schema):
      {
        sensorId: String,          // e.g., "IR-SENSOR-001"
        location: String,          // e.g., "Test Area"
        barangay: String,          // e.g., "Test Barangay"
        lat: Number,               // GPS latitude (hardcoded for now since sensor has no GPS)
        lng: Number,               // GPS longitude (hardcoded for now)
        status: String,            // enum: ['clean', 'moderate', 'dirty']
        color: String,             // enum: ['green', 'yellow', 'red']
        lastReading: {
          ammonia: Number,
          methane: Number,
          binLevel: Number,
          updatedAt: Date
        },
        lastCollection: {
          collectedBy: String,
          collectedAt: Date
        }
      }

   b. Update POST /api/iot/sensor-data:
      When sensor data arrives:
      1. Save the reading (already exists)
      2. Find or create the SensorZone by sensorId
      3. Update the zone's lastReading
      4. Determine color based on readings:
         - ammonia < 25  → 🟢 green
         - ammonia 25-50 → 🟡 yellow
         - ammonia > 50  → 🔴 red
      5. If color changed, emit Socket.io event
      6. Return the zone status in the response

   c. Update POST /api/collections (Mark as Clean):
      When a driver marks a stop as clean:
      1. Save the collection record (already exists)
      2. Get the driver's current GPS location from the request
      3. Find nearby SensorZones within 100 meters
      4. If driver is within 100m of a zone:
         - Update zone status to 'clean' and color to 'green'
         - Update lastCollection with driver info
         - Emit Socket.io event
      5. If driver is NOT within 100m of any zone:
         - Still save the collection but don't update any zone
         - Return message: "Collection logged. No sensor zones nearby to update."

   d. New simple endpoint:
      - GET /api/sensor-zones - Returns all zones with current color and location
        Response: [{ sensorId, lat, lng, color, status, lastReading }]

   e. Socket.io event:
      - Event name: zone:updated
      - Payload: { sensorId, color, status, lat, lng, reason }
      - Emit when: sensor data changes zone color OR driver marks clean near zone

2. OFFICIALS WEB APP - SIMPLE HEATMAP:

   a. On the Heatmap Analytics page:
      - Fetch zones from GET /api/sensor-zones
      - For each zone, place a CIRCLE MARKER on the map at (lat, lng)
      - Circle color matches zone.color:
        - 🟢 Green circle for clean
        - 🟡 Yellow circle for moderate
        - 🔴 Red circle for dirty
      - Circle radius: 100 meters (visual representation of the zone)
      - Click on a circle to see popup with:
        - Sensor ID and location
        - Current readings (ammonia, methane, bin level)
        - Status and last collection info

   b. Real-time update:
      - Listen for zone:updated Socket.io event
      - When received, find the circle on the map by sensorId
      - Update its color immediately (smooth transition if possible)
      - Show a brief popup: "Zone [sensorId] updated to [color]"

   c. Simple legend on the map:
      - 🟢 Clean (ammonia < 25)
      - 🟡 Moderate (ammonia 25-50)
      - 🔴 Dirty (ammonia > 50)

3. GARBAGE TRUCK APP - SIMPLE PROXIMITY CHECK:

   a. When driver presses "Mark as Clean":
      - Send driver's current GPS coordinates to the backend
      - Backend checks proximity to zones (already in step 1c)
      - Frontend shows result:
        - If zone updated: "✅ Zone cleaned! 🔴 → 🟢"
        - If no zone nearby: "✅ Collection logged. (No sensor zone nearby)"

4. RESIDENT APP - SIMPLE MAP UPDATE:

   a. On the Resident map:
      - Same circle markers as Officials heatmap (read-only)
      - Listen for zone:updated event
      - Update circle colors in real-time
      - Optional: Show toast when a nearby zone turns green

5. SEED DATA FOR TESTING:

   Since the sensor doesn't send GPS coordinates, add this seed data to MongoDB:

   {
     "sensorId": "IR-SENSOR-001",
     "location": "Test Area",
     "barangay": "Test Barangay",
     "lat": 10.3254,          // Replace with your actual test location
     "lng": 123.9110,         // Replace with your actual test location
     "status": "clean",
     "color": "green"
   }

6. EDGE CASES:
   - What if sensor hasn't sent data yet? (Show gray circle with "No data")
   - What if sensor is offline? (Show last known color with "Offline" badge)
   - What if two sensors are very close? (Both circles show, may overlap)
   - What if driver marks clean but sensor still shows dirty? (Zone stays yellow/red because sensor is the source of truth)

Please provide SIMPLE, MINIMAL code that is easy to test:
- Backend: SensorZone model, updated sensor-data endpoint, updated collections endpoint, zone endpoint
- Officials: Simple heatmap circles with real-time color update
- GarbageTruck: Proximity check in Mark as Clean flow
- Resident: Simple map circles with real-time update

---

TESTING INSTRUCTIONS:

1. SETUP:
   - Add the seed SensorZone document to MongoDB with YOUR actual test location coordinates
   - Start all apps (backend, Officials, GarbageTruck, Resident)

2. TEST FLOW:
   Step 1: Open Officials dashboard → Heatmap page
           → You should see a GREEN circle at the seed coordinates
   
   Step 2: Trigger the IR sensor (put object in front)
           → ESP32 sends "dirty" data (ammonia: 40)
           → Officials heatmap circle should turn RED
           → Resident map should also show RED
   
   Step 3: Open GarbageTruck app near the sensor location
           → Press "Mark as Clean"
           → If within 100m: Circle turns GREEN, shows "Zone cleaned!"
           → If too far: Shows "No sensor zone nearby"
   
   Step 4: Remove object from IR sensor
           → ESP32 sends "clean" data (ammonia: 5)
           → Circle should stay GREEN

3. EXPECTED RESULTS:
   | Action | Heatmap Color | Reason |
   |--------|--------------|--------|
   | Sensor sends ammonia: 5 | 🟢 Green | Clean |
   | Sensor sends ammonia: 40 | 🔴 Red | Dirty (above 25) |
   | Driver marks clean near sensor | 🟢 Green | Collection completed |
   | Driver marks clean far from sensor | No change | Outside zone radius |
   | Sensor sends ammonia: 30 | 🟡 Yellow | Moderate (25-50) |

4. DEBUGGING:
   - If circles don't appear: Check GET /api/sensor-zones response
   - If color doesn't update: Check Socket.io connection and zone:updated event
   - If proximity check fails: Verify driver coordinates and zone coordinates are close enough