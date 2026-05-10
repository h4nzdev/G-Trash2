# G-TRASH: Barangay Leaderboard Implementation Plan

This document outlines the logic, metrics, and technical implementation for the city-wide Barangay Leaderboard. The goal of this system is to encourage efficiency and transparency in waste management across all jurisdictions.

## 1. Objective
To create a dynamic ranking system that evaluates Barangay performance based on real-time data from residents, trucks, and collection logs.

## 2. Core Metrics (The Scoring Formula)
The **Performance Score** is a weighted average of two primary Key Performance Indicators (KPIs):

### **Score = (Resolution Rate × 0.60) + (Collection Efficiency × 0.40)**

---

### KPI 1: Resolution Rate (60% Weight)
**Definition:** How effectively the Barangay resolves issues reported by residents.
*   **Data Source:** `Reports` Collection.
*   **Calculation:** `(Resolved Reports / Total Reports assigned to Barangay) × 100`
*   **Goal:** High responsiveness to community complaints (Overflowing bins, illegal dumping, etc.).

### KPI 2: Collection Efficiency (40% Weight)
**Definition:** How consistently the garbage trucks complete their assigned routes.
*   **Data Source:** `CollectionLogs` + `Routes` Collection.
*   **Calculation:** `(Unique Stops Visited / Total Stops in Route) × 100`
*   **Goal:** Ensure trucks are actually following the map and visiting every scheduled stop.

---

## 3. Bonus & Penalty System (Optional Enhancements)
To make the leaderboard more advanced for Capstone requirements:

| Action | Impact | Metric |
| :--- | :--- | :--- |
| **Rapid Response** | +5 Points | Resolving a report in less than 24 hours. |
| **Off-Route Violation** | -10 Points | High frequency of "Off-Route" alerts triggered by trucks. |
| **Consistency** | +5 Points | Maintaining a 90%+ efficiency for 7 consecutive days. |

---

## 4. Technical Implementation Strategy

### Backend (Node.js/Express)
We will use MongoDB Aggregation Pipelines in the `/api/admin/stats` endpoint to calculate these scores on the fly.

**Aggregation Logic:**
1.  **Group** reports by `barangay`.
2.  **Count** total vs. resolved.
3.  **Lookup** collection logs for that barangay.
4.  **Compute** final score using the weighted formula.

### Frontend (Admin Dashboard)
*   **Leaderboard Chart:** A bar chart (`Recharts`) showing the top 5 barangays by score.
*   **Top Performer Card:** A highlighted card showing the #1 ranked barangay with a "Performance Badge."
*   **Real-time Updates:** The leaderboard should refresh every 30-60 seconds to reflect new resolutions.

---

## 5. Data Schema Requirements
To ensure the leaderboard works, every data entry must include the `barangay` tag:
*   **Reports:** Already includes `barangay`.
*   **Routes:** Already includes `barangay`.
*   **CollectionLogs:** Will be linked to `barangay` via the `routeId`.

---

## 6. Development Phases
1.  **Phase 1:** Implement simple "Resolved Reports" ranking (Current state).
2.  **Phase 2:** Integrate "Collection Efficiency" by tracking stops in `CollectionLogs`.
3.  **Phase 3:** Add "Time-to-Resolve" tracking for bonus points.
4.  **Phase 4:** Final UI Polish in the Superadmin Command Center.
