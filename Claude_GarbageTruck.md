---

**Prompt for Claude:**

Create a complete React Native (JavaScript, not TypeScript) multi-screen mobile app for the **Garbage Truck Collector role** in the "G-TRASH" smart waste monitoring system. This includes a bottom tab navigator with 4 tabs (Home, Map, History, Profile), all screens, and all supporting components. The collector uses this app to view assigned routes, see pickup locations on an interactive map, mark areas as cleaned, log collection history, and manage their profile.

## Context from G-TRASH System (Section 5.2)
Collectors have these specific features:
- View heatmap status (Red=High, Yellow=Moderate, Green=Safe/Cleaned)
- Access assigned collection routes
- See assigned pickup locations on map with garbage truck tracking
- Identify trash-prone areas via heatmap overlay
- Update system: Mark areas as cleaned (changes status to Green)
- Each collector has unique login, assigned truck (e.g., GT-402), and specific route
- Need to see collection history and personal stats

## Complete Project Structure to Generate

```
src/
├── navigation/
│   └── CollectorTabNavigator.js
├── screens/
│   ├── CollectorHomeScreen.js
│   ├── CollectorMapScreen.js
│   ├── CollectorHistoryScreen.js
│   └── CollectorProfileScreen.js
├── components/
│   ├── StatsCard.js
│   ├── RouteTimelineCollector.js
│   ├── PickupActionCard.js
│   ├── HeatmapMiniCard.js
│   ├── CollectionLogItem.js
│   ├── CollectorMapView.js
│   ├── ProfileMenuItem.js
│   └── QuickActionButton.js
└── constants/
    └── colors.js (already exists, import from '../constants/colors')
```

## Global Design System (Apply to ALL files)
- **Colors**: Background `#FBF9F8`, Cards `#FFFFFF`, Primary `#006A3B`, Secondary `#006E1C`, Error `#BA1A1A`, Outline `#6F7A70`, Surface container `#F6F3F2`, Yellow `#FDD835`, Red `#E53935`
- **Typography**: Large title 34px/700, Headline 17px/600, Body 17px/400, Subheadline 15px/400, Footnote 13px/400, Caption 12px/400
- **Spacing**: padding-card 16px, gutter-stack 12px, element-gap 8px, margin-page 16px
- **Border radius**: Cards 24px, Buttons 12px, Pills 20px, Full 9999px
- **Icons**: Use MaterialIcons from `@expo/vector-icons`
- **Shadows**: elevation 3-5, shadowOpacity 0.04-0.12
- Use `SafeAreaView` with edges top/bottom, `ScrollView` for scrollable content
- Each screen has bottom padding 120px for tab bar clearance
- Import colors from `'../constants/colors'`
- Use `import React, { useState } from 'react'` at top of each file
- Export default each component and screen

---

## 1. Navigation: `CollectorTabNavigator.js`

Create a bottom tab navigator using `@react-navigation/bottom-tabs` with 4 tabs:
- **Home** - home icon (MaterialIcons "home")
- **Map** - map icon (MaterialIcons "map")  
- **History** - history icon (MaterialIcons "history")
- **Profile** - person icon (MaterialIcons "person")

Tab bar styling:
- White background with top border
- Active tab: `#006A3B`, Inactive: `#BECABE`
- Rounded top corners: borderTopLeftRadius 20, borderTopRightRadius 20
- Shadow for elevation
- Show labels below icons in uppercase, 10px, medium weight
- Active tab has slight scale up (110%) and filled icon style

Export a function `CollectorTabNavigator` that returns the navigator wrapped in `NavigationContainer`.

---

## 2. Home Screen: `CollectorHomeScreen.js`

### Header
- Fixed header bar with:
  - Left: Eco leaf icon (MaterialIcons "eco", color `#065F46`) + "G-TRASH" brand title (20px, fontWeight 900, color `#065F46`)
  - Right: Bell icon with red notification badge (8x8, borderRadius 4, `#EF4444`)
- Below header: "Good Morning, Collector!" (34px large-title, `#1B1C1C`)
- Subtitle: "Driver ID: GT-402 | Route: North Cebu" (15px, outline color)

### Today's Stats (2-column grid)
- **Card 1 - Stops Completed**:
  - Large "8/12" text in primary green (#006A3B, 24px, bold)
  - "Stops Completed" label in caption style
  - Progress bar: Grey background track, 67% green fill, height 4, borderRadius 2
- **Card 2 - Next Pickup**:
  - Clock icon + "10:45 AM" in bold
  - "Lahug, Block 5" subtitle
  - Green "On Time" badge (pill shape, green bg, white text)

### Current Route Section
- Section header "Assigned Route" with pill dropdown "Route: North Cebu ▼"
- Vertical timeline showing 6 stops:
  ```js
  [
    { name: "Ayala", time: "08:30 AM", status: "completed", bins: 4, weight: "52kg" },
    { name: "IT Park", time: "09:15 AM", status: "completed", bins: 3, weight: "38kg" },
    { name: "Apas", time: "09:45 AM", status: "completed", bins: 5, weight: "45kg" },
    { name: "Lahug", time: "10:45 AM", status: "in-progress", bins: 3, weight: null },
    { name: "Banilad", time: "11:30 AM", status: "upcoming", bins: 2, weight: null },
    { name: "Talamban", time: "12:15 PM", status: "upcoming", bins: 6, weight: null },
  ]
  ```
- Each stop shows:
  - Left: Timeline indicator (24px circle)
    - Completed: Green circle with white checkmark
    - In-progress: Large green circle (28px) with truck icon, pulsing ring effect (optional: just larger size + green border)
    - Upcoming: Grey circle with small grey dot inside
  - Vertical line (2px wide) connecting stops, green for completed sections
  - Right content:
    - Stop name and time
    - Status badge (Completed/In Progress/Upcoming)
    - For in-progress: Card with green tint background, border, padding

### Current Pickup Actions (rendered when a stop is "in-progress")
- Prominent action card at bottom of route:
  - Header: "📍 Lahug, Block 5" title
  - Subtitle: "3 bins to collect"
  - Two side-by-side buttons:
    - **"Mark as Cleaned"**: Green bg `#006A3B`, white text, check icon, flex 1
      - On press: Alert.alert confirmation "Confirm Cleanup", "Mark Lahug as cleaned?", on confirm update state to change stop to completed
    - **"Report Issue"**: White bg, red border 1.5px, red text, warning icon, flex 1
      - On press: Alert.alert with options ["Overflowing Bin", "Hazardous Waste", "Road Blocked", "Other"]
  - After marking cleaned: Card transforms to show green success state "✓ Cleaned Successfully" with animated opacity

### Heatmap Status Mini Cards
- Section header "Area Status"
- Horizontal row of 3 mini cards (flexDirection row, gap 8):
  - **Critical**: `#FFDAD6` bg tint, red dot, "Carbon Market", "2 areas"
  - **Moderate**: `#FFF9C4` bg tint, yellow dot, "Colon Street", "1 area"  
  - **Clean**: `#E8F5E9` bg tint, green dot, "IT Park", "All clear"
- Each card: borderRadius 12, padding 12, flex 1, tappable

### Quick Action Floating Button
- Position absolute, bottom 100, right 16, zIndex 50
- Large green circle (56x56, borderRadius 28, bg `#006A3B`)
- White flag icon (MaterialIcons "flag")
- Shadow for elevation
- On press: Scroll to current in-progress stop in timeline

---

## 3. Map Screen: `CollectorMapScreen.js`

This is the most important screen for collectors. It shows an interactive map with pickup locations, heatmap overlay, truck position, and route visualization.

### Map Container (top 60% of screen)
- Use `react-native-webview` with Leaflet map centered on Cebu City (10.3157, 123.8854, zoom 14)
- Bounded to Cebu City area (SW: 10.275, 123.845, NE: 10.355, 123.925)
- Use CartoDB Voyager tiles for clean modern look
- **Pickup Location Markers** on map:
  - Green markers for completed stops
  - Red marker with pulsing effect for current/in-progress stop
  - Grey markers for upcoming stops
  - Each marker shows stop name as label
- **Heatmap overlay**:
  - Red circle at Carbon Market area (10.295, 123.895) - high pollution
  - Yellow circle at Colon Street (10.308, 123.895) - moderate
  - Green circle at IT Park (10.328, 123.900) - clean
- **Truck marker**: Green truck icon with "GT-402" label at current position
- **Route line**: Polyline connecting all stops in order, dashed green line
- Map floating actions (top-right):
  - Layers button (48x48, white bg, borderRadius 16, shadow)
  - My Location button

### Heatmap Legend
- Position: top-left of map, floating card
- Three rows: Critical (Red dot), Moderate (Yellow dot), Clean (Green dot)
- White background, borderRadius 12, padding 10, shadow

### Bottom Sheet (40% of screen, swipeable)
- Handle bar at top (40x5, grey, borderRadius 3, centered)
- Header: "Pickup Locations" title, "6 stops remaining" subtitle
- ScrollView list of all stops with:
  - Left: Status indicator circle
  - Center: Location name, address
  - Right: Action button
    - Completed: Green checkmark, "Cleaned"
    - In-progress: "Mark Cleaned" green button (compact)
    - Upcoming: "Navigate" with arrow icon
- Tapping "Mark Cleaned" on in-progress stop:
  - Shows confirmation
  - Updates marker on map to green
  - Updates stop in list

### Route Controls
- Below stops list: "Optimize Route" button and "View Full Route" text link
- Estimated completion time: "Est. completion: 1:30 PM"

---

## 4. History Screen: `CollectorHistoryScreen.js`

### Header
- "Collection History" title (34px large-title)
- Date filter tabs: "Today", "This Week", "This Month" (horizontal ScrollView of pill buttons)
- Active tab: Green bg, white text. Inactive: Grey bg, dark text

### Daily Summary Card
- Large card with gradient-like green bg (`#006A3B` to `#268451`)
- White text showing:
  - "Total Collected Today: 135kg"
  - "Stops: 3/6 | Efficiency: 92%"
  - Progress bar for daily goal

### Collection Log List
- FlatList of completed collections:
  ```js
  [
    { time: "09:45 AM", location: "Apas", type: "Mixed", weight: "45kg", bins: 5, status: "completed" },
    { time: "09:15 AM", location: "IT Park", type: "Recyclables", weight: "38kg", bins: 3, status: "completed" },
    { time: "08:30 AM", location: "Ayala", type: "General", weight: "52kg", bins: 4, status: "completed" },
  ]
  ```
- Each item shows:
  - Left: Time stamp
  - Center: Location name, waste type (caption), bins count
  - Right: Weight collected in bold green
  - Green left border (4px) for completed items
  - White card bg, borderRadius 12, padding 16, marginBottom 8

### Weekly Performance Card
- "Weekly Performance" section title
- Mini bar chart (simple View-based bars of different heights):
  - 7 bars for Mon-Sun
  - Green bars for completed days, grey for remaining
  - Labels below each bar
- Stats below: "Best Day: Wednesday (68kg)", "Average: 45kg/day"

### Empty State
- If no collection history: Show illustration placeholder (recycling icon), "No collections yet" message, "Start your route to begin logging" subtitle

---

## 5. Profile Screen: `CollectorProfileScreen.js`

### Profile Header
- Large avatar circle (96x96, grey placeholder with person icon, white border 4px, shadow)
- Edit button overlay (small green circle with pencil icon at bottom-right of avatar)
- Collector name: "Juan Dela Cruz" (34px large-title)
- Driver ID: "GT-402" (subheadline, outline color)
- Route assignment: "North Cebu Route" with location pin icon

### Stats Grid (2 columns)
- **Total Collected**: "1,245kg" (primary green, large)
- **Stops Completed**: "186" (secondary green)
- **Rating**: "4.8 ⭐"
- **On-Time Rate**: "94%"

### Settings Menu (iOS-style list)
- Card 1 (white bg, borderRadius 12):
  - **Notification Settings** - bell icon in green circle bg, toggle switch (default on)
  - **Route Preferences** - map icon, chevron right
  - **Vehicle Info** - truck icon, "Truck GT-402" value, chevron right
- Card 2:
  - **Segregation Guide** - book icon, chevron right
  - **Report Problem** - warning icon in amber circle, chevron right
  - **Help & Support** - question mark icon, chevron right
- Card 3:
  - **Logout** - logout icon in red circle (`#FFDAD6`), red text "Logout" (color `#BA1A1A`, fontWeight 600)
- Each menu item: 52px height, icon container (32x32, borderRadius 8), label text, right chevron or toggle

### Truck Info Card
- Styled card showing assigned truck details:
  - Truck icon
  - "Truck GT-402 | Capacity: 2.5 tons"
  - "Last Maintenance: Dec 15, 2024"
  - "Status: Operational" with green dot

---

## Component Details

### `StatsCard.js`
- Props: `icon`, `value`, `label`, `subtitle`, `progress` (0-1), `color`
- White card with shadow, borderRadius 16, padding 16
- Icon at top-left, value large and bold, label below in caption style
- Optional progress bar: grey track, colored fill based on progress prop

### `RouteTimelineCollector.js`
- Props: `stops` (array), `currentStopIndex` (number), `onMarkCleaned` (function)
- Maps through stops array rendering vertical timeline
- Completed stops: green 24px circle with checkmark, grey text
- In-progress: larger 28px green circle with truck icon, green tint card
- Upcoming: grey circle with dot, grey text
- Vertical connector lines between stops

### `PickupActionCard.js`
- Props: `location`, `binCount`, `status`, `onMarkCleaned`, `onReportIssue`
- Renders prominent action card with two buttons
- Success state after marking cleaned: green overlay with checkmark
- Uses `useState` for local cleaned state

### `HeatmapMiniCard.js`
- Props: `status` ('critical'/'moderate'/'clean'), `location`, `count`
- Small card with tinted background based on status
- Colored dot indicator, location name, count text

### `CollectionLogItem.js`
- Props: `time`, `location`, `type`, `weight`, `bins`
- White card with green left border (4px)
- Horizontal layout: time | location+type | weight

### `CollectorMapView.js`
- Props: `stops`, `currentStopIndex`, `truckLocation`
- Leaflet HTML in WebView with all markers, heatmap circles, route polyline
- Handles touch events for map interaction
- `onMarkerPress` callback for stop selection

### `ProfileMenuItem.js`
- Props: `icon`, `label`, `value`, `showToggle`, `toggleValue`, `onToggle`, `onPress`
- Horizontal row: icon container | label | value/toggle/chevron
- 52px height, bottom border except last item

### `QuickActionButton.js`
- Props: `onPress`, `icon`, `label`
- Floating circular button (56x56, green, white icon, shadow)
- Position absolute at bottom-right

---

## States to Handle in Each Screen

### CollectorHomeScreen
- **Loading**: Show 3 skeleton placeholder cards (grey rectangles with shimmer)
- **Empty route**: "No route assigned for today. Contact dispatch." with phone icon
- **Success**: After marking cleaned, brief green flash on the stop card
- **Error**: If update fails, red banner "Failed to update. Tap to retry."

### CollectorMapScreen
- **Loading**: Map shows grey placeholder until tiles load
- **Empty**: If no stops, show "No pickup locations" centered on map
- **Error**: If map fails to load, show "Map unavailable" with retry button

### CollectorHistoryScreen
- **Loading**: Skeleton list items
- **Empty**: "No collections yet. Start your route to begin logging."
- **Error**: "Failed to load history. Pull to refresh."

### CollectorProfileScreen
- **Loading**: Skeleton for avatar and menu items
- **Logout**: Alert confirmation "Are you sure you want to logout?"

---

## Data & Mock Data

Use these mock data objects in each screen:

```js
// Collector info
const COLLECTOR = {
  id: 'GT-402',
  name: 'Juan Dela Cruz',
  route: 'North Cebu',
  truck: 'GT-402',
  capacity: '2.5 tons',
  avatar: null,
};

// Route stops
const ROUTE_STOPS = [
  { id: 1, name: 'Ayala', address: 'Ayala Center, Cebu', lat: 10.318, lng: 123.905, time: '08:30 AM', status: 'completed', bins: 4, weight: '52kg', type: 'General' },
  { id: 2, name: 'IT Park', address: 'IT Park, Lahug', lat: 10.327, lng: 123.898, time: '09:15 AM', status: 'completed', bins: 3, weight: '38kg', type: 'Recyclables' },
  { id: 3, name: 'Apas', address: 'Apas, Cebu City', lat: 10.333, lng: 123.902, time: '09:45 AM', status: 'completed', bins: 5, weight: '45kg', type: 'Mixed' },
  { id: 4, name: 'Lahug', address: 'Block 5, Lahug', lat: 10.325, lng: 123.893, time: '10:45 AM', status: 'in-progress', bins: 3, weight: null, type: 'General' },
  { id: 5, name: 'Banilad', address: 'Banilad, Cebu', lat: 10.340, lng: 123.910, time: '11:30 AM', status: 'upcoming', bins: 2, weight: null, type: 'Recyclables' },
  { id: 6, name: 'Talamban', address: 'Talamban, Cebu', lat: 10.350, lng: 123.915, time: '12:15 PM', status: 'upcoming', bins: 6, weight: null, type: 'Mixed' },
];
```

---

## Global Notes
- No TypeScript - plain .js files only
- Use `import React, { useState } from 'react'` in every file
- Use `import { View, Text, StyleSheet, ... } from 'react-native'` as needed
- Use `import { MaterialIcons } from '@expo/vector-icons'` for all icons
- Use `import colors from '../constants/colors'` for color references
- Consistent StyleSheet.create at bottom of each file
- Include brief comments explaining key functionality
- Match the Stitch design aesthetic: clean, modern, card-based with soft shadows
- Each screen wrapped in SafeAreaView with ScrollView
- Generate ALL files with COMPLETE, WORKING code — do not abbreviate or skip sections
- Include all StyleSheet definitions
- Make the app feel professional and modern, matching the Resident UI quality
