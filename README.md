# G-TRASH — Smart Waste Monitoring & Environmental Intelligence System

G-TRASH is a smart waste management and environmental monitoring platform built for Cebu City, Philippines. It connects residents, garbage truck drivers, barangay officials, and city health personnel through a unified ecosystem leveraging IoT air-quality sensing, AI-driven routing assistance, and real-time telemetry to optimize municipal waste collection and environmental safety.

---

## Table of Contents

1. [System Architecture & Data Flow](#system-architecture--data-flow)
2. [Apps & Subsystems Overview](#apps--subsystems-overview)
3. [User Roles & Key Features](#user-roles--key-features)
4. [IoT Air-Quality Monitoring (MQ-135 Architecture)](#iot-air-quality-monitoring-mq-135-architecture)
5. [Tech Stack](#tech-stack)
6. [Project Directory Structure](#project-directory-structure)
7. [Getting Started & Installation](#getting-started--installation)
8. [Environment Variables](#environment-variables)
9. [REST API Reference](#rest-api-reference)
10. [Real-Time WebSocket Events (Socket.io)](#real-time-websocket-events-socketio)
11. [AI & Smart Decision Engine](#ai--smart-decision-engine)
12. [Gamification & Community Scoring](#gamification--community-scoring)
13. [Media & Cloud Storage Pipeline](#media--cloud-storage-pipeline)

---

## System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                   │
│                                                                             │
│   📱 Residents             🌡️ ESP32 IoT Sensors          🚛 Garbage Trucks  │
│  (disposal reports,       (MQ-135 raw ADC sampling,     (GPS tracking, stop │
│   verifications, photos)   3-level air quality status)   collection logs)   │
└──────────────┬──────────────────────────┬──────────────────────────┬────────┘
               │                          │                          │
               ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CENTRAL BACKEND (Node.js + Express 5 + MongoDB)          │
│                                                                             │
│  • MVC Modular Routing & Controllers    • Real-Time Socket.io Gateway       │
│  • Unified Authentication (JWT + Bcrypt)• SLA Escalation Timers (72h)       │
│  • Garbage-Area Air-Quality Aggregation • Groq & Gemini AI Integration      │
│  • Gamification & Leaderboard Scoring   • Cloudinary Image Storage Pipeline │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │
               │ Real-Time Broadcasts via Socket.io
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONNECTED CLIENT APPLICATIONS                       │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │   Resident App   │  │ GarbageTruck App │  │   Officials & Admin Web   │  │
│  │  (React Native)  │  │  (React Native)  │  │       (React 19 Vite)     │  │
│  │                  │  │                  │  │                           │  │
│  │ • Submit Reports │  │ • Route Dispatch │  │ • Command Dashboard       │  │
│  │ • Truck Tracking │  │ • Stop Check-in  │  │ • MQ-135 Live Telemetry   │  │
│  │ • AI Bin Scanner │  │ • EcoAssist AI   │  │ • Route Builder & Heatmap │  │
│  │ • Area Heatmap   │  │ • Weight Logging │  │ • Health Dept (CHD) View  │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Operational Workflow

1. **Resident Reporting**: A resident identifies an overflowing bin or hazardous waste pile, snaps a photo, sets a map pin, and submits the report.
2. **Cloud Processing**: The image is uploaded to Cloudinary, and the report is saved with geospatial coordinates and category metadata.
3. **Officials Triage & AI Suggestion**: The report appears instantly on the Officials Command Center via Socket.io. Groq AI evaluates the incident, calculating the nearest truck and recommending route inclusion.
4. **Driver Dispatch**: The assigned driver receives a push notification via Expo Push API with updated waypoint navigation.
5. **Collection & Verification**: The driver navigates to the stop, clears the waste, logs the collected weight, and marks the task as complete.
6. **Community Validation**: The resident is prompted to verify the cleanup. Verification awards the barangay **+20 points** on the municipal leaderboard.
7. **Automated SLA Safety**: If a report remains unaddressed after 72 hours, the backend auto-escalates the priority to Critical and penalizes the barangay score by **-10 points**.

---

## Apps & Subsystems Overview

| App / Component | Platform | Primary Users | How to Run |
|:---|:---|:---|:---|
| **Resident** | React Native (Expo SDK 54) | Residents of Cebu City | `cd Resident && npx expo start` |
| **GarbageTruck** | React Native (Expo SDK 54) | Garbage truck drivers & crew | `cd GarbageTruck && npx expo start` |
| **Officials** | React 19 + Vite (Web) | Barangay officials & City Health Dept (CHD) | `cd Officials && npm run dev` |
| **AdminPanel** | React 19 + Vite (Web) | System Superadministrators | `cd AdminPanel && npm run dev` |
| **Backend** | Node.js + Express 5 | Core API & Real-time Server | `cd backend && npm run dev` |
| **IoT Node** | ESP32 DevKit (Arduino / C++) | Waste bins & collection points | Flashed via Arduino IDE |

---

## User Roles & Key Features

### 1. Residents (Mobile)
- **Community Feed**: View, upvote, and comment on localized barangay reports.
- **Incident Submission**: Submit reports with geolocation, photo attachment, and category tagging.
- **Live Fleet Tracking**: Real-time GPS map tracking truck locations with 3-tier proximity alerts (Far &rarr; Medium &rarr; Near).
- **AI Trash Classifier**: On-device camera recognition (TensorFlow.js / Gemini) identifying biodegradable, recyclable, and hazardous waste.
- **Area Air Quality Heatmap**: View environmental quality conditions around waste containers.
- **Resolution Verification**: Confirm cleanup actions to boost community leaderboard ranking.
- **Bilingual UI**: Full support for **English** and **Cebuano**.

### 2. Garbage Truck Drivers (Mobile)
- **Daily Task Dashboard**: View assigned schedules, routes, and collection stops for the shift.
- **Live Turn-by-Turn Route Navigation**: Map view displaying optimized collection paths.
- **Stop Completion & Weight Check-in**: Log weight (kg/bins) and mark stops as cleaned; unlocks only when navigation is active.
- **EcoAssist AI Assistant**: Context-aware chatbot powered by Groq (`llama-3.1-8b-instant`) answering route and waste-handling queries.
- **Collection History**: Historical log of completed pickups, dates, and tonnage.

### 3. Barangay Officials & City Health Department (Web)
- **Operational Command Center**: Real-time monitoring of pending reports, active fleet status, route completion rate, and waste volume throughput.
- **Smart Dispatch Engine**: AI-calculated nearest truck and route suggestions with one-click assignment.
- **Interactive Route Builder**: Draw, customize, and save collection routes with designated sitio waypoints.
- **Live MQ-135 Telemetry Widget**: Real-time garbage-area air-quality classification (`CLEAN`, `MODERATE`, `CRITICAL`), raw ADC readings, voltage, and threshold tracking.
- **City Health Department (CHD) View**: Dedicated environmental health dashboard tracking high-risk pollution zones and automated critical gas alerts.
- **Collection & Sitio Breakdown**: Granular volume metrics and historical charts per sitio and barangay.

### 4. System Superadministrators (Web)
- **Citywide Master Map**: Unified map layer rendering all active trucks, sensor nodes, garbage areas, and citizen reports across Cebu City.
- **Sensor Infrastructure Management**: Hardware health monitoring, baseline calibrations, and threshold configurations.
- **User & Role Administration**: Manage official credentials, role assignments (`official`, `chd`, `superadmin`), and digital signatures.
- **System Diagnostics & Audit Logs**: Detailed error tracking, telemetry streams, and municipal broadcast announcements.

---

## IoT Air-Quality Monitoring (MQ-135 Architecture)

The G-TRASH IoT node utilizes an **ESP32 DevKit** coupled with an **MQ-135 gas sensor** calibrated specifically for municipal waste environments.

> [!NOTE]
> **Research & Measurement Integrity**  
> The MQ-135 operates as a broad gas-response sensor for monitoring air conditions around garbage/waste decomposition areas. Raw analog-to-digital converter (ADC) readings are categorized into an **operational classification** and are not represented as official national AQI or fabricated gas PPM concentrations.

### 1. Hardware Pinout
- **MQ-135 Analog Out**: `GPIO 34` (ADC1_CH6)
- **Green LED (CLEAN)**: `GPIO 18`
- **Orange LED (MODERATE)**: `GPIO 17`
- **Red LED (CRITICAL)**: `GPIO 2`
- **Buzzer (Alarm)**: `GPIO 16`

### 2. Signal Processing & Calibration
- **20-Sample Smoothing**: Every measurement averages 20 ADC samples over 100ms to eliminate electrical switching noise.
- **Clean-Air Baseline Calibration**: During startup, the node executes a 30-sample reference routine to establish the environmental baseline.
- **Hysteresis Buffer**: A `±15 ADC` count hysteresis prevents rapid state flapping near threshold boundaries.

### 3. Operational Classification Levels

```text
       0 ADC                       200 ADC                      400 ADC                     4095 ADC
         │                            │                            │                           │
         ▼                            ▼                            ▼                           ▼
  ───────┼────────────────────────────┼────────────────────────────┼───────────────────────────┤
         │           CLEAN            │          MODERATE          │         CRITICAL          │
         │   (Normal background air)  │  (Elevated waste odor)     │ (High decomposition odor) │
         │   🟢 Green LED ON          │  🟡 Orange LED ON          │ 🔴 Red LED ON + Buzzer ON │
```

### 4. Telemetry Payload Schema

Transmitted via HTTPS POST every 60 seconds to `/api/iot/sensor-data`:

```json
{
  "sensorId": "SENSOR-001",
  "deviceType": "ESP32",
  "location": "2nd Street",
  "barangay": "Apas",
  "rawValue": 320,
  "airQuality": "MODERATE",
  "cleanThreshold": 200,
  "criticalThreshold": 400,
  "measurementType": "MQ-135 garbage-area air-quality classification",
  "isOfficialAQI": false
}
```

---

## Tech Stack

```
Frontend Clients:
  ├── Resident & Truck Mobile: React Native 0.81 | Expo SDK 54 | React Navigation 7
  ├── Officials & Admin Web:   React 19 | Vite 8 | Tailwind CSS 4 | React-Leaflet | Recharts

Backend & Infrastructure:
  ├── Application Server:      Node.js | Express 5 (MVC Architecture)
  ├── Database:                MongoDB | Mongoose ODM
  ├── Real-time Layer:         Socket.io 4 (WebSockets + Polling fallback)
  ├── Cloud Media Storage:     Cloudinary API
  ├── Intelligence & AI:       Groq (llama-3.1-8b-instant) | Google Gemini | TensorFlow.js

IoT Hardware & Firmware:
  ├── Microcontroller:         ESP32 DevKit (Dual-core 240MHz)
  ├── Gas Sensing:             MQ-135 Sensor Module
  ├── Firmware Framework:      Arduino C++ (WiFiClientSecure, ArduinoJson)
```

---

## Project Directory Structure

```
Get-Trash/
├── backend/
│   ├── config/             # DB connection, Socket.io setup, Cloudinary
│   ├── controllers/        # Business logic (auth, iot, reports, fleet, routes, etc.)
│   ├── middleware/         # JWT auth, roleGuard, barangayScope
│   ├── models/             # Mongoose schemas (Resident, Official, SensorReading, etc.)
│   ├── routes/             # Express route declarations (MVC modular routes)
│   ├── services/           # IoT classification, AI suggestion engine, Gamification
│   ├── app.js              # Server entry point & middleware mounting
│   └── package.json
│
├── Officials/              # Barangay Officials & CHD Web Application
│   └── src/
│       ├── components/     # SensorStatusWidget, PollutionChart, RecentReports
│       ├── context/        # AuthContext (JWT session restore)
│       ├── pages/          # OfficialsDashboard, HeatmapAnalytics, RouteBuilder
│       └── config.js       # Backend endpoint configuration
│
├── AdminPanel/             # Superadmin Web Dashboard
│   └── src/
│       ├── components/     # MasterMap overlays, fleet management tables
│       ├── context/        # AuthContext
│       └── pages/          # ZoneManagement, MasterMap, SystemLogs
│
├── Resident/               # Resident Mobile Application (Expo)
│   └── src/
│       ├── screens/        # HomeScreen, MapScreen, FeedScreen, ScannerScreen
│       ├── context/        # AuthContext, NotificationContext
│       └── i18n/           # English and Cebuano localization
│
├── GarbageTruck/           # Truck Driver Mobile Application (Expo)
│   └── src/
│       ├── screens/        # CollectorHomeScreen, CollectorMapScreen, HistoryScreen
│       └── context/        # Navigation state & push notification handling
│
└── mq135_test/             # ESP32 Firmware
    └── mq135_wifi_alert.ino# C++ firmware with smoothing, calibration, and HTTPS upload
```

---

## Getting Started & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI
- **Expo Go App**: Installed on physical mobile devices or Android/iOS emulator
- **Arduino IDE**: (For flashing ESP32 nodes) with ESP32 board support and `ArduinoJson` library

---

### Step 1: Backend Setup

```bash
cd backend
npm install
# Create and populate .env file (see Environment Variables section)
npm run dev
```
*The backend starts on `http://localhost:5000`.*

---

### Step 2: Officials Dashboard Setup

```bash
cd Officials
npm install
npm run dev
```
*Access the dashboard at `http://localhost:5173`.*

---

### Step 3: Admin Panel Setup

```bash
cd AdminPanel
npm install
npm run dev
```
*Access the admin panel at `http://localhost:5174`.*

---

### Step 4: Mobile Apps (Resident & GarbageTruck)

1. Open `Resident/src/config.js` and `GarbageTruck/src/config.js`.
2. Update the backend URL to your local machine IP (e.g., `http://192.168.1.50:5000`).
3. Start the mobile apps:

```bash
# Resident App
cd Resident
npm install
npx expo start

# Garbage Truck App
cd GarbageTruck
npm install
npx expo start
```
4. Scan the QR code using the **Expo Go** application on your device.

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gtrash

# Authentication Secret
JWT_SECRET=your_secure_jwt_secret_key_2025

# AI Integrations
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

---

## REST API Reference

### 1. Authentication & Sessions (`/api/auth`)

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/auth/login` | Public | Unified login for Officials, Superadmin, CHD, and Residents |
| `GET` | `/api/auth/me` | Authenticated | Validate and restore active JWT session |
| `POST` | `/api/auth/register` | Public | Register a new resident account |
| `PATCH`| `/api/auth/resident/:id` | Authenticated | Update resident profile info (10-day avatar cooldown) |

### 2. IoT Telemetry & Environmental Monitoring (`/api/iot`)

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/iot/sensor-data` | IoT / Public | Ingest ESP32 telemetry with raw ADC and operational status |
| `GET` | `/api/iot/readings` | Authenticated | Query historical sensor readings with filters |
| `GET` | `/api/iot/readings/latest`| Authenticated | Get latest reading snapshot for each registered sensor node |
| `GET` | `/api/iot/trends` | Authenticated | Aggregate hourly/daily ADC trends for chart visualization |
| `GET` | `/api/iot/health-summary`| Authenticated | Risk breakdown for City Health Department monitoring |
| `GET` | `/api/iot/alerts` | Authenticated | List triggered threshold alerts |
| `PATCH`| `/api/iot/alerts/:id/acknowledge`| Official | Acknowledge active IoT alert |

### 3. Citizen Reports & Verification (`/api/reports`)

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `GET` | `/api/reports` | Scoped | Fetch reports (filtered by barangay or citizen) |
| `POST` | `/api/reports` | Resident | Submit a new disposal incident report |
| `PATCH`| `/api/reports/:id` | Official | Update report status (`pending`, `in-progress`, `resolved`) |
| `POST` | `/api/reports/:id/vote` | Resident | Upvote/downvote report urgency |
| `POST` | `/api/reports/:id/verify` | Resident | Confirm or dispute resolution for leaderboard scoring |
| `GET` | `/api/reports/:id/suggestions`| Official | Generate AI truck assignment and route suggestions |

### 4. Routes, Fleet & Scheduling (`/api/routes`, `/api/fleet`, `/api/schedules`)

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `GET` | `/api/routes` | Authenticated | Get all customized collection routes |
| `POST` | `/api/routes` | Official | Create new geographic collection route |
| `GET` | `/api/fleet` | Authenticated | Query fleet truck records and assigned drivers |
| `POST` | `/api/schedules` | Official | Schedule route run (triggers driver push notification) |
| `PUT` | `/api/trucks/:id/location` | Driver | Update live GPS coordinates of collection truck |
| `POST` | `/api/collections` | Driver | Log stop clearance and collected waste weight |

---

## Real-Time WebSocket Events (Socket.io)

| Event Name | Direction | Payload Description |
|:---|:---|:---|
| `iot:reading` | Server &rarr; Clients | Broadcasts latest sensor ADC reading and operational status |
| `iot:alert` | Server &rarr; Officials | Pushes critical threshold alert notification |
| `truck:location:update`| Server &rarr; Clients | Real-time GPS location coordinates of en-route trucks |
| `report:new` | Server &rarr; Officials | New citizen report submitted |
| `report:updated` | Server &rarr; Clients | Report status change (e.g., In Progress &rarr; Resolved) |
| `zone:status:update` | Server &rarr; Clients | Real-time color code and intensity update for heatmap zones |
| `schedule:changed` | Server &rarr; Drivers | Notification of newly assigned route schedule |

---

## AI & Smart Decision Engine

1. **Smart Dispatch Suggestions**: Groq AI evaluates open reports against active fleet GPS positions, recommending optimal truck assignment and route insertions.
2. **EcoAssist Driver Assistant**: Context-aware interactive assistant providing real-time handling guidelines for hazardous and special waste.
3. **On-Device Trash Recognition**: Real-time camera classifier guiding residents on proper waste segregation at the source.
4. **Automated SLA Governance**: 72-hour automated escalation engine protecting community response accountability.

---

## Gamification & Community Scoring

Barangays compete on a live leaderboard to foster community-wide cleanliness and proactive governance:

| Action / Event | Score Impact |
|:---|:---|
| Resident confirms successful cleanup resolution | **+20 Points** |
| Official responds within 6 hours | **+15 Points** |
| Official responds within 24 hours | **+10 Points** |
| Scheduled pickup run completed | **+5 Points** |
| Citizen upvotes on verified community report | **+1 Point** |
| IoT Sensor reading maintains **CLEAN** air quality | **+3 Points** |
| IoT Sensor reading detects **MODERATE** waste odor | **+1 Point** |
| Resident disputes cleanup resolution | **-15 Points** |
| SLA 72-hour response deadline breached | **-10 Points** |
| IoT Sensor reading escalates to **CRITICAL** | **-5 Points** |

---

## Media & Cloud Storage Pipeline

- Image uploads are encoded to Base64 on the client device and dispatched to `POST /api/upload`.
- The backend streams the binary to Cloudinary's secure asset repository.
- Only the signed HTTPS CDN URL is stored in MongoDB records.
- Resident avatar updates enforce a **10-day server-side cooldown** to prevent storage bloat.

---

## License & Attribution

Developed for smart municipal waste management and environmental health research in Cebu City, Philippines. Distributed under the MIT License.

