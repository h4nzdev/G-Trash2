# G-TRASH: Simple Project Explanation

Welcome! This document explains how the **G-TRASH** (Smart Waste Monitoring System) project works in plain, simple English. Whether you are new to the project or just need a quick overview, this guide breaks down the structure, tools, and everyday flow of the system without complex jargon.

---

## 1. Current Structure of the Application

The project is divided into **five main applications** and **hardware sensors** that all connect to one central server. Think of it as a team where everyone has a specific tool tailored to their job:

### 📁 The Core Folders
*   **`backend/` (The Brain & Server)**
    *   This is the central control hub of the whole system. It connects all the apps together, stores data in the database, runs countdown timers, sends notifications, and talks to Artificial Intelligence (AI) models.
*   **`Resident/` (Mobile App for Citizens)**
    *   An app for regular residents of Cebu City. Citizens use it to report overflowing trash bins (with photos and GPS pins), track garbage trucks on a live map, check collection schedules, and scan trash with their camera to learn how to properly dispose of it.
*   **`GarbageTruck/` (Mobile App for Drivers)**
    *   An app specifically for garbage truck drivers. It shows them their assigned pickup routes on a map, lets them log completed stops and trash weights, and includes an AI chat assistant (**EcoAssist**) to answer their questions while on the road.
*   **`Officials/` (Web Dashboard for Barangay Officials)**
    *   A web dashboard used by local neighborhood (Barangay) leaders. They use it to view citizen reports, see AI recommendations on how to handle issues, assign trucks to routes, and monitor neighborhood cleanliness scores.
*   **`AdminPanel/` (Web Dashboard for System Admins)**
    *   A master web dashboard for city-wide administrators. Admins can see the entire city map, monitor all trucks and IoT sensor alerts, manage user accounts, and send out city-wide announcements.
*   **`IoT Hardware` (Physical Smart Sensors)**
    *   Physical sensors placed near public garbage bins and trash areas. They automatically measure bad odors (ammonia and methane), temperature, and how full the bins are, sending this data over Wi-Fi to the backend server.

---

## 2. Tech Stacks Being Used

Here is the simple breakdown of the technologies and tools used to build each part of the system:

### 🌐 Central Server & Database (Backend)
*   **Node.js & Express.js:** The web server framework that handles all incoming requests and APIs.
*   **MongoDB & Mongoose:** The database where all reports, user profiles, truck routes, and scores are permanently stored.
*   **Socket.io:** The real-time communication engine. It makes sure that when someone reports a full bin or a truck moves, everyone's map updates instantly without refreshing the screen.
*   **Cloudinary:** A cloud storage service used to save photos (like pictures of overflowing trash or user profile pictures).
*   **JSON Web Tokens (JWT) & bcryptjs:** Used to keep passwords secure and ensure only authorized users can log in.

### 📱 Mobile Applications (Resident & GarbageTruck)
*   **React Native & Expo:** The framework used to build mobile apps that run smoothly on smartphones (iOS and Android).
*   **Expo SDK & Plugins:** Provides access to phone features like the camera (for taking photos), GPS location (for live tracking), and push notifications.
*   **Leaflet.js & WebView:** Used to display interactive maps and heatmaps inside the mobile apps.
*   **TensorFlow.js (COCO-SSD):** An on-device AI model that lets the Resident app scan physical trash items with the camera and instantly identify them.
*   **i18next:** Adds multi-language support so users can easily switch between **English** and **Cebuano**.

### 💻 Web Dashboards (Officials & Admin Panel)
*   **React 19 & Vite:** Modern web technologies used to build fast, responsive web pages.
*   **Tailwind CSS 4:** A styling tool used to make the dashboards look clean, modern, and professional.
*   **React-Leaflet:** Displays interactive city maps, truck tracking, and pollution heatmaps on the web.
*   **Recharts:** Creates visual charts and graphs to show barangay performance, analytics, and historical trends.
*   **Axios:** Helps the web dashboards talk to the backend server to fetch or send data.

### 🤖 Artificial Intelligence (AI)
*   **Groq API (`llama-3.1-8b-instant`):** An ultra-fast AI model that powers two key features:
    *   **EcoAssist:** A chatbot that answers drivers' questions about routes and hazardous waste disposal.
    *   **Smart Suggestions:** Automatically advises officials on the nearest available truck and route whenever a new trash report comes in.
*   **Gemini API:** Helps analyze and classify trash items in the citizen app.

### 🔌 IoT Hardware (Smart Sensors)
*   **ESP32 Microcontroller:** The tiny computer chip inside the sensor box that connects to Wi-Fi and sends data to the server.
*   **MQ-135 Gas Sensor:** Detects harmful gases and bad odors (like ammonia and methane) near trash bins.
*   **DHT11 & Ultrasonic Sensors:** Measures temperature, humidity, and how full the garbage bin is in real time.

---

## 3. The Flow of the Project

How does everything work together in real life? Here is the simple step-by-step story of how data flows through the G-TRASH system:

### Step 1: Spotting the Problem (The Inputs)
There are three main ways the system gathers information:
1.  **By Citizens:** A resident sees an overflowing trash bin. They open the **Resident App**, snap a picture, add a quick note, and tap *Submit*. The app automatically grabs their GPS location.
2.  **By Smart Sensors:** An **IoT Sensor** installed on a public bin smells high levels of methane or detects that the bin is 95% full. It automatically sends an alert to the server—no human needed!
3.  **By Trucks:** Garbage trucks driving around the city continuously send their live GPS coordinates to the server.

### Step 2: The Brain at Work (Real-Time Processing & AI)
1.  When a report or sensor alert reaches the **Backend Server**, the photo is saved to the cloud (**Cloudinary**) and the details are saved in the database (**MongoDB**).
2.  Instantly, the server broadcasts this new report to the **Officials Web Dashboard** using **Socket.io**. The new pin pops up on their map in real time!
3.  At the exact same time, the server asks **Groq AI** to analyze the problem. The AI looks at the map and prepares **Smart Suggestions**: *"Truck #3 is only 500 meters away on Route A. Assign this truck to clean it up!"*

### Step 3: Taking Action (Assigning & Cleaning)
1.  A **Barangay Official** looks at their web dashboard, reviews the AI's smart suggestion, and clicks **Assign Truck**. The status changes to *"In Progress"*.
2.  The assigned driver receives a **Push Notification** on their **GarbageTruck App**.
3.  The driver follows the interactive map to the overflowing bin. Once cleaned, they log the weight of the garbage collected and tap **Mark as Cleaned**.

### Step 4: Closing the Loop (Verification & Rewards)
1.  The system notifies the resident who reported the issue that their trash has been cleaned up.
2.  The resident checks the area and taps **Confirm Resolution** in their app.
3.  **Reward:** Because the issue was reported and fixed quickly, the Barangay earns points on the city-wide **Leaderboard**!
4.  *(Note: If an official ignores a resident's report for more than 72 hours, an automated timer escalates the problem to critical status and deducts points from the barangay's score.)*

---

### Summary
In short, **G-TRASH** connects **Residents**, **Drivers**, **Officials**, and **Smart Sensors** into one fast, automated loop. Instead of relying on guesswork or fixed schedules, the city uses **real-time data and AI** to keep streets clean and efficient!
