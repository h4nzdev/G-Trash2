# G-TRASH — Smart Waste Monitoring System

G-TRASH is a smart waste management system built for Cebu City, Philippines. It connects residents, garbage truck drivers, and barangay officials through a shared platform that uses IoT sensors, AI, and real-time data to make garbage collection smarter and faster.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [How It Works — Simple Flow](#how-it-works--simple-flow)
4. [Apps Overview](#apps-overview)
5. [Features by Role](#features-by-role)
6. [Tech Stack](#tech-stack)
7. [Project Structure](#project-structure)
8. [Setting Up the Project](#setting-up-the-project)
9. [Environment Variables](#environment-variables)
10. [API Overview](#api-overview)
11. [Real-Time Events](#real-time-events)
12. [Smart Features](#smart-features)
13. [IoT Integration](#iot-integration)
14. [Scoring & Leaderboard System](#scoring--leaderboard-system)
15. [Image Uploads](#image-uploads)

---

## The Problem

Garbage collection in Cebu City follows fixed schedules that do not react to real-world conditions. This causes:

- Overflowing trash bins that go unnoticed for days
- Residents afraid or too busy to report issues
- Barangays sharing trucks with no visibility into timing
- Officials making decisions without data
- No way to tell if a reported problem was actually fixed

---

## The Solution

G-TRASH replaces guesswork with data. It connects four groups of people through four separate apps, all talking to one shared backend.

- **Residents** report garbage issues and track truck arrivals from their phone
- **Truck drivers** follow assigned routes, mark stops as complete, and get schedule notifications
- **Barangay officials** monitor reports, manage routes, and view analytics on a web dashboard
- **Admins** oversee the entire system from a super-dashboard

IoT sensors installed in garbage-prone areas automatically send pollution readings to the system. If gas levels spike, everyone gets alerted — no manual reporting needed.

---

## How It Works — Simple Flow

```
┌─────────────────────────────────────────────────────────┐
│                      DATA SOURCES                       │
│                                                         │
│  📱 Residents         🌡️ IoT Sensors       🚛 Trucks    │
│  (report issues)    (gas/pollution data)  (GPS location)│
└────────────┬───────────────┬──────────────────┬─────────┘
             │               │                  │
             ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + MongoDB)            │
│                                                         │
│  • Stores all data              • Runs SLA timers       │
│  • Calculates scores            • Sends notifications   │
│  • Calls AI for suggestions     • Proxies Groq AI       │
│  • Manages routes & schedules   • Emits Socket events   │
└────────────┬────────────────────────────────────────────┘
             │  Real-time via Socket.io
             │
    ┌────────┴─────────────────────────────────┐
    ▼               ▼              ▼            ▼
┌────────┐    ┌──────────┐   ┌────────┐  ┌──────────┐
│Resident│    │ Officials│   │ Admin  │  │  Truck   │
│  App   │    │  Web App │   │ Panel  │  │  Driver  │
│(Mobile)│    │  (React) │   │(React) │  │  App     │
└────────┘    └──────────┘   └────────┘  └──────────┘
```

**Step-by-step example — Overflowing Bin Report:**

1. Resident opens the app and submits a report with a photo and pin on the map
2. Photo uploads to Cloudinary; report saves to MongoDB with the image URL
3. The report appears live in the Officials web dashboard (via Socket.io)
4. Officials see a **Smart Suggestion**: nearest truck, nearest route, AI recommendation
5. Official assigns a truck and changes status to "In Progress"
6. Truck driver receives a schedule notification on the mobile app
7. Driver navigates to the stop, marks it as cleaned with weight logged
8. Report status updates to "Resolved" — resident gets prompted to confirm
9. Resident confirms → Barangay earns +20 points on the leaderboard
10. If no action in 72 hours → SLA auto-escalates and deducts 10 points

---

## Apps Overview

| App | Platform | Who Uses It | How to Run |
|-----|----------|-------------|------------|
| **Resident** | React Native (Expo) | Residents of Cebu City | `cd Resident && npx expo start` |
| **GarbageTruck** | React Native (Expo) | Garbage truck drivers | `cd GarbageTruck && npx expo start` |
| **Officials** | React + Vite (Web) | Barangay officials | `cd Officials && npm run dev` |
| **AdminPanel** | React + Vite (Web) | System administrators | `cd AdminPanel && npm run dev` |
| **Backend** | Node.js + Express | Server (all apps connect here) | `cd backend && npm run dev` |

---

## Features by Role

### Residents

| Feature | What It Does |
|---------|-------------|
| Community Feed | See reports from your barangay, upvote/downvote urgency, add comments |
| Submit Report | Report garbage issues with photo, category, location pin, and description |
| Map | Live map with heatmap overlay showing pollution levels and truck locations |
| Truck Tracking | See where garbage trucks are in real time |
| 3-Layer Notifications | Get alerts as a truck approaches: Far → Medium → Near your area |
| Calendar | View the garbage collection schedule for your barangay |
| AI Scanner | Scan trash items; AI identifies them and suggests proper disposal |
| Leaderboard | See how your barangay ranks against others |
| Profile | Edit your info, choose route preference, switch language (English/Cebuano) |
| Verify Resolution | Confirm if a reported issue was actually fixed — earns your barangay points |

### Garbage Truck Drivers

| Feature | What It Does |
|---------|-------------|
| Home Dashboard | See today's assigned stops and route info |
| EcoAssist AI | Chat with an AI assistant for route tips and waste management advice |
| Map | Interactive map showing the assigned route and all pickup stops |
| Navigation | Start/stop navigation mode; locks the "Mark as Clean" button until active |
| Mark as Clean | Log each stop completion with waste weight; syncs to collection history |
| History | View all past collections with stop names, weights, and dates |
| Notifications | Receive push notifications when a new schedule is assigned |
| Profile | View assigned truck and driver information |

### Barangay Officials

| Feature | What It Does |
|---------|-------------|
| Dashboard | Live overview of reports, trucks, IoT alerts, and barangay scores |
| Reports Management | View, filter, assign, and resolve resident reports |
| Smart Suggestions | AI-powered suggestions on each report: nearest route, nearest truck, priority escalation |
| Route Builder | Draw and save garbage collection routes on an interactive map |
| Route Monitoring | Live map showing all truck positions, assigned routes, and overflowing bin reports |
| Schedule Routes | Assign routes to trucks on specific dates and times |
| Fleet Management | Manage truck and driver records |
| Heatmap Analytics | Visual pollution map for the whole city; filter by barangay and time |
| Collection History | View a log of all completed garbage pickups |
| Barangay Performance | Score breakdown, ranking, and trend charts per barangay |
| Driver Analytics | Per-driver collection statistics |

### Administrators (Admin Panel)

| Feature | What It Does |
|---------|-------------|
| Master Map | Full city map with all trucks, bins, IoT sensors, and reports |
| IoT Sensor Dashboard | Live sensor readings, historical charts, alert log |
| Fleet Overview | All trucks across all barangays |
| Reports Overview | All resident reports across the entire city |
| Bug Reports | User-submitted bug reports from the Resident app |
| Announcements | Broadcast system-wide messages to all users |
| Barangay Scores | Full leaderboard with point breakdowns |

---

## Tech Stack

### Backend

| Technology | Purpose |
|-----------|---------|
| Node.js + Express 5 | Web server and REST API |
| MongoDB + Mongoose | Database for all app data |
| Socket.io 4 | Real-time communication between all apps |
| Cloudinary | Cloud storage for report photos and profile pictures |
| Groq API (llama-3.1-8b-instant) | AI-powered chat (EcoAssist) and smart report suggestions |
| Gemini API | AI scanner in the Resident app |
| bcryptjs | Password hashing |
| jsonwebtoken | Authentication tokens for Officials |
| Expo Push API | Push notifications to truck driver devices |

### Resident App (Mobile)

| Technology | Purpose |
|-----------|---------|
| React Native 0.81 | Mobile app framework |
| Expo SDK 54 | Development platform and device APIs |
| expo-image-picker | Pick photos from gallery or camera |
| expo-notifications | Receive push notifications |
| expo-location | Get device GPS coordinates |
| React Navigation 7 | Screen navigation and tab bar |
| Socket.io Client | Real-time report and truck updates |
| WebView + Leaflet.js | Interactive map with heatmap |
| i18next | Multi-language support (English / Cebuano) |
| AsyncStorage | Persist login session and preferences locally |
| TensorFlow.js + COCO-SSD | On-device AI for the trash scanner |

### GarbageTruck App (Mobile)

| Technology | Purpose |
|-----------|---------|
| React Native 0.81 | Mobile app framework |
| Expo SDK 54 | Development platform |
| expo-notifications | Receive schedule push notifications |
| expo-location | Real-time GPS tracking |
| WebView + Leaflet.js | Route and stop map |
| Socket.io Client | Live truck location updates |
| AsyncStorage | Persist navigation state and notifications |
| React Navigation 7 | Bottom tab navigation |

### Officials Web App

| Technology | Purpose |
|-----------|---------|
| React 19 + Vite | Fast web app with hot reload |
| Tailwind CSS 4 | Utility-first styling |
| React-Leaflet + Leaflet | Interactive maps for route monitoring and heatmap |
| Recharts | Charts for analytics dashboards |
| Axios | HTTP requests to backend |
| Socket.io Client | Live truck and report updates |
| Lucide React | Icon library |
| React Router 7 | Page routing |

### Admin Panel Web App

| Technology | Purpose |
|-----------|---------|
| React 19 + Vite | Fast web app |
| Tailwind CSS 4 | Styling |
| React-Leaflet | Master map with all overlays |
| Recharts | Analytics charts |
| Axios + Socket.io | Data fetching and real-time updates |

### IoT Hardware

| Component | Purpose |
|-----------|---------|
| ESP32 | Microcontroller — reads sensors and sends data over WiFi |
| MQ-135 Gas Sensor | Detects ammonia, CO2, and harmful gases near bins |
| DHT11 (optional) | Measures temperature and humidity |
| Ultrasonic Sensor (optional) | Measures bin fill level |

---

## Project Structure

```
Get-Trash/
├── backend/              # Node.js + Express API server
│   ├── app.js            # All routes, models, socket events, AI, Cloudinary
│   ├── .env              # API keys and DB connection (never commit this)
│   └── package.json
│
├── Resident/             # React Native app for residents
│   └── src/
│       ├── screens/      # All app screens (Home, Map, Feed, Profile, etc.)
│       ├── context/      # Auth state (login, register, updateProfile)
│       ├── navigation/   # Tab and stack navigators
│       ├── constants/    # Colors and shared values
│       └── config.js     # Backend URL
│
├── GarbageTruck/         # React Native app for drivers
│   └── src/
│       ├── screens/      # Home, Map, History, Notifications, Profile
│       ├── context/      # Auth + push token registration + notification state
│       ├── navigation/   # 5-tab bottom navigator
│       ├── utils/        # notifications.js (shared storage helpers)
│       └── config.js     # Backend URL
│
├── Officials/            # React web app for barangay officials
│   └── src/
│       ├── pages/        # All pages (Dashboard, Reports, Routes, Fleet, etc.)
│       ├── components/   # Shared UI components
│       ├── context/      # Auth context (JWT-based)
│       └── config.js     # Backend URL
│
└── AdminPanel/           # React web app for system admins
    └── src/
        ├── pages/        # All admin pages including MasterMap
        └── components/   # Admin-specific components
```

---

## Setting Up the Project

### Requirements

- Node.js 18 or higher
- MongoDB running locally (or a MongoDB Atlas connection string)
- A smartphone or emulator (for mobile apps)
- Expo Go app installed on your phone (for quick testing)

### 1. Clone and set up the backend

```bash
cd backend
npm install
# Create your .env file (see Environment Variables section below)
npm run dev
```

The backend starts on `http://localhost:5000`.

### 2. Set up the Officials web app

```bash
cd Officials
npm install
npm run dev
```

Opens on `http://localhost:5173` by default.

### 3. Set up the Admin Panel

```bash
cd AdminPanel
npm install
npm run dev
```

### 4. Set up the Resident mobile app

```bash
cd Resident
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone.  
Make sure `src/config.js` points to your machine's local IP (not `localhost`), for example:
```
http://192.168.1.10:5000
```

### 5. Set up the GarbageTruck mobile app

```bash
cd GarbageTruck
npm install
npx expo start
```

Same as Resident — update `src/config.js` with your local IP.

---

## Environment Variables

Create a file called `.env` inside the `backend/` folder with the following:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gtrash

# Auth
JWT_SECRET=your-secret-key-here

# AI
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key

# Image uploads
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

> **Important:** Never commit `.env` to version control. It is already in `.gitignore`.

For the web apps, you can optionally create a `.env` file in the `Officials/` or `AdminPanel/` folder:
```env
VITE_API_URL=http://localhost:5000
```

For the mobile apps, create `.env` in `Resident/` or `GarbageTruck/`:
```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

---

## API Overview

All endpoints are served from the backend. The base URL is `http://localhost:5000`.

### Authentication

| Method | Endpoint | Who Uses It | What It Does |
|--------|----------|-------------|-------------|
| POST | `/api/residents/register` | Resident App | Create a new resident account |
| POST | `/api/residents/login` | Resident App | Login and receive a JWT token |
| PATCH | `/api/residents/:id` | Resident App | Update profile info and picture |
| POST | `/api/auth/login` | Officials Web | Login as an official or admin |
| GET | `/api/auth/me` | Officials Web | Verify session token |

### Reports

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| GET | `/api/reports` | Get all reports (filterable by barangay, userId, category) |
| POST | `/api/reports` | Submit a new report |
| PATCH | `/api/reports/:id` | Update status, assign truck, escalate priority (Officials only) |
| DELETE | `/api/reports/:id` | Delete a report |
| POST | `/api/reports/:id/vote` | Upvote or downvote a report's urgency |
| POST | `/api/reports/:id/comments` | Add a comment to a report |
| POST | `/api/reports/:id/verify` | Resident confirms or disputes a resolution |
| GET | `/api/reports/:id/suggestions` | Get AI-powered action suggestions for a report |

### Routes & Fleet

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| GET | `/api/routes` | Get all routes |
| POST | `/api/routes` | Create a new route |
| PATCH | `/api/routes/:id` | Update route (assign truck, add waypoints, etc.) |
| GET | `/api/fleet` | Get all truck/driver records |
| POST | `/api/fleet` | Add a new truck to the fleet |
| PATCH | `/api/fleet/:truckId` | Update truck or driver info |

### Schedules & Trucks

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| GET | `/api/schedules` | Get all schedules |
| POST | `/api/schedules` | Create a schedule (triggers push notification to driver) |
| GET | `/api/trucks` | Get all live truck positions |
| PUT | `/api/trucks/:truckId/location` | Update truck GPS position (from driver app) |
| PUT | `/api/trucks/:truckId/push-token` | Save Expo push token for a driver |

### Collections & IoT

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| POST | `/api/collections` | Log a completed garbage pickup stop |
| GET | `/api/collections` | Get collection history |
| POST | `/api/iot/readings` | Submit a sensor reading (from ESP32) |
| GET | `/api/iot/readings` | Get sensor readings with filters |
| GET | `/api/iot/alerts` | Get IoT alerts log |

### AI & Uploads

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| POST | `/api/upload` | Upload an image to Cloudinary; returns the URL |
| POST | `/api/ai/chat` | Send a message to EcoAssist AI (Groq-powered chat) |

### Scores & Leaderboard

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| GET | `/api/scores` | Get leaderboard rankings for all barangays |
| GET | `/api/scores/:barangay` | Get score details for one barangay |

---

## Real-Time Events

The backend uses Socket.io to push live updates to all connected apps without any page refresh needed.

| Event | Direction | What Triggers It |
|-------|-----------|-----------------|
| `truck:location:update` | Server → All Apps | Truck sends its GPS position |
| `report:new` | Server → All Apps | A resident submits a new report |
| `report:updated` | Server → All Apps | A report status changes |
| `bin:status:update` | Server → All Apps | An IoT sensor area status changes |
| `schedule:changed` | Server → All Apps | A schedule is created or modified |
| `route:updated` | Server → All Apps | A route is modified or assigned |
| `pickup:completed` | Server → All Apps | A truck completes a full pickup run |
| `truck:off-route` | Server → Officials | A truck deviates from its assigned route |
| `iot:alert` | Server → Officials/Admin | Sensor readings exceed safe thresholds |

---

## Smart Features

### EcoAssist AI (GarbageTruck App)
Truck drivers can chat with an AI assistant powered by Groq's `llama-3.1-8b-instant` model. The chat is context-aware — it knows the driver's current route, assigned stops, and truck ID. Drivers can ask things like "What should I do with hazardous waste?" or "How many stops do I have today?" The AI answers in a conversational way.

**Flow:** App → Backend `/api/ai/chat` → Groq API → Response to app

### Smart Report Suggestions (Officials Web App)
When an official opens a report, the system automatically generates smart suggestions:

1. **Nearest Route** — Uses GPS coordinates to find the closest existing route and suggests adding the report location as a pickup stop. One click adds it.
2. **Nearest Online Truck** — Finds the closest truck that is currently active and suggests assigning it. One click pre-fills the assignment dropdown.
3. **Priority Escalation** — If the community urgency score is +5 or higher, suggests escalating to Critical priority.
4. **AI Recommendation** — Groq AI generates a 1-2 sentence recommendation specific to the report's category, location, and urgency.

**Flow:** Official opens report → Frontend calls `/api/reports/:id/suggestions` → Backend runs Haversine distance calculations + Groq AI → Returns structured suggestions → Frontend renders actionable cards

### AI Trash Scanner (Resident App)
Residents can scan any garbage item using their phone camera. TensorFlow.js with the COCO-SSD model runs on-device to identify the object. The app then tells the user which bin to use (biodegradable, non-biodegradable, special waste).

### SLA Auto-Escalation
Every report has a 72-hour deadline. The backend runs a timer check every hour. If an official has not responded to a report within 72 hours:
- The report is automatically marked as `escalated`
- The barangay loses 10 points from their score
- The community feed shows a red "OVERDUE" banner on the report card

---

## IoT Integration

IoT sensors (ESP32 + MQ-135) are placed near garbage-prone areas and bins. They send readings to the backend over WiFi.

**Sensor data includes:**
- Ammonia level (ppm)
- Methane level (%)
- CO2 level (ppm)
- Temperature (°C)
- Humidity (%)
- Bin fill level (%) — if ultrasonic sensor is connected
- Raw analog value from MQ-135

**How the ESP32 sends data:**
```
POST http://<backend-ip>:5000/api/iot/readings
Content-Type: application/json

{
  "sensorId": "SENSOR-001",
  "barangay": "Lahug",
  "lat": 10.3254,
  "lng": 123.9110,
  "ammonia": 12.5,
  "methane": 3.2,
  "temperature": 30.1,
  "humidity": 78,
  "binLevel": 85
}
```

**Alert thresholds (auto-generates alert when exceeded):**
- Ammonia > 25 ppm → Moderate alert
- Ammonia > 50 ppm → Critical alert
- Methane > 10% LEL → Moderate alert
- Methane > 25% LEL → Critical alert
- Bin level > 80% → Moderate alert
- Bin level > 95% → Critical alert

When a threshold is exceeded, the backend:
1. Saves an alert to the IoT alerts log
2. Emits `iot:alert` via Socket.io to all connected Officials and Admin dashboards
3. Updates the GarbageArea record (used for the heatmap)

---

## Scoring & Leaderboard System

Barangays earn and lose points based on how well they handle waste management. Points are tracked across four categories.

| Category | What Earns Points | What Loses Points |
|----------|-------------------|-------------------|
| **Report Score** | Upvotes on reports (+1 each), resident confirms resolution (+20) | Resident disputes resolution (-15), escalation (-10) |
| **Response Score** | Official responds within 6 hours (+15), within 24h (+10), within 48h (+5) | No response in 72h (-10 from escalation) |
| **Collection Score** | Pickup run logged (+5), resident verifies pickup (+3) | — |
| **IoT Score** | Sensor reads "Good" air quality (+1 per reading) | Sensor reads "Hazardous" (-2 per reading) |

The leaderboard is shown to residents so they can see how their barangay compares. Categories tracked include:
- **Best in Segregation** — based on collection score
- **Most Trash Collected** — based on total weight logged by trucks

---

## Image Uploads

All images in the system (report photos and profile pictures) are stored on Cloudinary, not in the database. The database only stores the Cloudinary URL.

**How it works:**

1. User picks a photo using `expo-image-picker`
2. App converts photo to a base64 data URI
3. App sends base64 to `POST /api/upload` on the backend
4. Backend uploads to Cloudinary using the SDK
5. Cloudinary returns a permanent HTTPS URL
6. App uses that URL in the subsequent report or profile update request

Profile pictures have a **10-day cooldown** — users cannot change their picture more than once every 10 days. This is enforced server-side using the `lastProfilePictureUpdate` timestamp on the resident record.

---

## Multi-Language Support

The Resident app supports two languages:

- **English** (default)
- **Cebuano** — the local language of Cebu City

Users can switch languages from the Profile screen. The selected language is saved locally and persists across app restarts.

---

## Push Notifications

Truck drivers receive push notifications via Expo's notification service when:
- A new schedule is assigned to their truck

**How it works:**
1. Driver logs in → app registers for push notifications → Expo token is saved to the backend via `PUT /api/trucks/:truckId/push-token`
2. When an official creates a schedule, the backend calls `notifyTruck()` which sends an HTTP request to `https://exp.host/--/api/v2/push/send`
3. Expo delivers the notification to the driver's device even if the app is closed

---

*G-TRASH — Making waste management smarter, one barangay at a time.*
