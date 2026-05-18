I need to implement a "jeepney-style" route visualization for the G-TRASH Resident app. This is a UI feature that displays garbage truck routes in a format familiar to Cebu City residents — similar to how jeepney route signs show sequential stops (e.g., "Ayala → SM → Lahug → IT Park").

Current setup:
- The Resident app uses React Native (Expo)
- The Map screen uses WebView + Leaflet.js for the interactive map
- Routes are fetched from GET /api/routes which returns route objects with waypoints (array of {lat, lng, name})
- The app also has a non-map view for users who prefer a simpler interface

Requirements:

1. Route Display Component (Non-Map View):
   Create a "Route Board" component that mimics a jeepney route sign. This should show:
   
   - A horizontal scrollable card at the top of the Home screen or Map screen
   - Each stop displayed as a labeled circle connected by arrows (→)
   - Example visual layout:
     
     ┌─────────────────────────────────────────────────┐
     │  🟢 Ayala  →  🟢 SM Cebu  →  🔴 Lahug  →  🟢 IT Park  │
     └─────────────────────────────────────────────────┘
     
   - Green circle (🟢) = upcoming stop
   - Red circle (🔴) = current/next stop (where the truck is headed)
   - Gray circle (⚪️) = completed stop
   - The truck's current position should be indicated between stops with a small truck icon

2. Route Details Bottom Sheet:
   When a user taps on the route board, expand a bottom sheet showing:
   - Full list of stops with estimated arrival times
   - Distance between each stop
   - The truck's current progress (e.g., "2 of 5 stops completed")
   - A "Set Alert for My Stop" button that triggers the 3-Layer notification for a specific stop

3. Map View Integration:
   On the Leaflet.js map:
   - Render the route as a colored polyline (use green for the route)
   - Place custom markers for each stop using numbered icons (1, 2, 3, etc.)
   - Completed stops get a checkmark overlay on the marker
   - The current truck position is a moving garbage truck icon
   - Add a "Jeepney View" toggle button on the map that switches between:
     - Full map view
     - Simplified route diagram view (the horizontal scrollable board)

4. Data Format:
   The route data from the API looks like this:
   {
     "_id": "route123",
     "name": "Lahug-Ayala Route",
     "barangay": "Lahug",
     "waypoints": [
       { "name": "Ayala Terminal", "lat": 10.3175, "lng": 123.9050, "order": 1 },
       { "name": "SM Cebu", "lat": 10.3110, "lng": 123.9180, "order": 2 },
       { "name": "Lahug Market", "lat": 10.3254, "lng": 123.9110, "order": 3 },
       { "name": "IT Park", "lat": 10.3310, "lng": 123.9080, "order": 4 }
     ],
     "assignedTruck": { "truckId": "TRK-001", "currentLat": 10.3200, "currentLng": 123.9120 }
   }

5. Styling Requirements:
   - Use colors that match the G-TRASH branding (Primary green: #006A3B)
   - The route board should have a white background with rounded corners and subtle shadow
   - Include the jeepney-inspired design elements (maybe a small jeepney icon)
   - Font should be clear and readable at a glance

6. Edge Cases to Handle:
   - Route has only 1-2 stops (very short route)
   - Route has 15+ stops (very long route) — the horizontal scroll must handle this
   - No active route assigned (show "No active collection route" message)
   - Truck is offline or GPS signal lost (show last known position with a warning)
   - Multiple routes serving the same barangay

Please provide:
- The RouteBoard component (horizontal scrollable jeepney-style view)
- The RouteDetails bottom sheet component
- Updated Map screen with the jeepney-style polyline and markers
- Utility function to determine which stops are completed vs upcoming based on truck position
- The "Jeepney View" toggle implementation

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps (step-by-step):
   - What screens to navigate to
   - What buttons to press
   - What I should see at each step
   - How to simulate different route states (active, completed, no route)

2. Test Data to Use:
   - Provide a sample route JSON I can insert directly into MongoDB to test with
   - Provide a sample truck location update I can emit via Socket.io to simulate movement

3. Expected Visual Results:
   - Describe exactly what the RouteBoard should look like for the test data
   - Describe what happens when a stop is completed
   - Describe the animation/transition when the truck moves between stops

4. Debugging Checklist:
   - If the route board is empty, check: [list items]
   - If the truck icon doesn't move, check: [list items]
   - If the colors are wrong, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | Normal route display | Open app with active route | Route board shows all stops |
   | Truck movement | Simulate truck GPS update | Truck icon moves; stops update color |
   | No active route | Open app with no route assigned | Shows "No active collection route" |
   | Long route (15 stops) | Open app with long route | Horizontal scroll works; all stops visible |
   | Single stop route | Open app with 1-stop route | Shows start and end as same stop |