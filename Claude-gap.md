I need to implement the 3-Layer Smart Radius Notification System for the G-TRASH Resident app. This feature alerts residents when a garbage truck is approaching their area at three distance intervals.

Current setup:
- I'm using React Native (Expo) with Socket.io for real-time updates
- Truck GPS coordinates are emitted via the `truck:location:update` Socket.io event
- The resident's location can be obtained using expo-location
- The app already has a Map screen built with WebView + Leaflet.js

Requirements:
1. Three notification layers with these distance thresholds:
   - FAR: 500 meters from resident → Show a subtle notification: "Garbage truck is in your area"
   - MEDIUM: 200 meters from resident → Show a more prominent alert: "Garbage truck is approaching. Prepare your trash."
   - NEAR: 50 meters from resident → Show urgent alert with sound/vibration: "Garbage truck is nearby! Bring your trash out now."

2. Technical requirements:
   - Calculate distance between truck and resident using the Haversine formula
   - Track which layer the resident is currently in to prevent duplicate notifications
   - When the truck moves from MEDIUM back to FAR (truck passes without stopping), reset the notification state
   - The notification should appear as an in-app banner at the top of the screen, not just a push notification
   - Store the current notification layer state so it persists if the user switches screens

3. The system should work on these screens:
   - Map screen
   - Home/Community Feed screen
   - Any screen when the app is in foreground

4. Edge cases to handle:
   - Multiple trucks in the area at the same time (prioritize the nearest one)
   - Resident location permission denied
   - Truck GPS signal lost or delayed
   - Resident moves (walking/driving) while waiting

Please provide the complete implementation including:
- A custom hook (useTruckProximity) that handles all the logic
- The notification banner component
- Integration with the existing Socket.io context
- Distance calculation utility function
- State management for the three layers