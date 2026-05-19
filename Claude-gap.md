I need to implement resident-level performance tracking in the G-TRASH system. Currently, the scoring system only tracks points at the Barangay level. My capstone document states that LGU officials will identify "residents with outstanding performance as shown in the G-TRASH data and analytics" and give them rewards. But right now, there is no way for officials to see which individual residents contributed the most to their Barangay's score.

Current setup:
- Backend: Node.js + Express + MongoDB with Mongoose
- Officials Web App: React + Vite + Tailwind CSS
- Resident App: React Native (Expo)
- Resident model has fields: name, email, barangay, profilePicture
- Existing scoring actions that should now track per resident:
  - AI Scanner: Resident scans trash and gets correct segregation result
  - Report Submission: Resident submits a garbage report
  - Report Upvotes: Resident upvotes other reports
  - Report Comments: Resident comments on reports
  - Resolution Verification: Resident confirms a reported issue was fixed

Requirements:

1. BACKEND - Resident Scoring System:

   a. Add points field to Resident Schema:
      {
        totalPoints: { type: Number, default: 0 },
        monthlyPoints: { type: Number, default: 0 },
        pointsHistory: [{
          points: Number,
          action: String,        // enum: ['correct_scan', 'report_submit', 'report_upvote', 'report_comment', 'verify_resolution']
          description: String,   // e.g., "Correctly scanned biodegradable waste"
          reportId: mongoose.ObjectId,  // reference if applicable
          date: { type: Date, default: Date.now }
        }],
        stats: {
          totalScans: { type: Number, default: 0 },
          correctScans: { type: Number, default: 0 },
          reportsSubmitted: { type: Number, default: 0 },
          reportsUpvoted: { type: Number, default: 0 },
          commentsMade: { type: Number, default: 0 },
          resolutionsVerified: { type: Number, default: 0 }
        }
      }

   b. Point Values per Action:
      - Correct AI scan: +5 points
      - Submit a report: +10 points
      - Report upvoted by others: +1 point (awarded to the report author)
      - Add a comment: +2 points
      - Verify a resolution: +15 points
      - Report marked as false/fake by official: -20 points (penalty)

   c. Update existing endpoints to award resident points:
      - POST /api/reports - When resident submits report, add +10 to their points
      - POST /api/reports/:id/vote - When someone upvotes, give +1 to the report author
      - POST /api/reports/:id/comments - When resident comments, add +2 points
      - POST /api/reports/:id/verify - When resident verifies resolution, add +15 points
      - AI Scanner endpoint - When scan is correct, add +5 points

   d. New Endpoints:
      - GET /api/residents/:id/points - Get a resident's total points and stats
      - GET /api/residents/:id/points/history - Get point history with pagination
      - GET /api/barangays/:barangayName/top-residents - Get top 10 residents in a barangay
        Query params: period (month/quarter/year/all), category (all/segregation/reports/verification)
        Response format:
        {
          "barangay": "Lahug",
          "period": "March 2026",
          "topResidents": [
            {
              "rank": 1,
              "residentId": "...",
              "name": "Juan Dela Cruz",
              "totalPoints": 320,
              "stats": {
                "correctScans": 45,
                "reportsSubmitted": 12,
                "resolutionsVerified": 8
              },
              "profilePicture": "url"
            },
            // ... more residents
          ]
        }

2. OFFICIALS WEB APP - Resident Performance View:

   a. New Tab on Barangay Leaderboard Page: "Top Residents"
      - When an official clicks on a Barangay name in the leaderboard, it opens a drill-down view
      - This view shows the top 10 residents in that Barangay ranked by points
      - Each resident card shows:
        - Rank (1st, 2nd, 3rd with medal icons)
        - Profile picture and name
        - Total points
        - Breakdown icons with counts: 🗑️ Scans | 📝 Reports | ✅ Verifications
        - A mini bar chart showing their point trend over the last 3 months

   b. Filter Controls:
      - Time period dropdown: This Month, Last Month, This Quarter, This Year, All Time
      - Category filter: All, Segregation (scans), Reporting (reports + comments), Verification
      - Default: This Month, All Categories

   c. Resident Detail Modal:
      - When official clicks on a resident card, opens a detailed modal showing:
        - Full point history table with date, action, points, description
        - Stats summary cards: Total Scans, Accuracy Rate, Reports, Verifications
        - Activity timeline (last 30 days) showing each action as a timeline entry
        - "Award History" section showing past rewards given to this resident (if any)

   d. "Select for Reward" Feature:
      - Checkbox next to each resident in the top 10 list
      - Official can select one or multiple residents
      - "Create Reward for Selected" button
      - This pre-fills the reward creation form with the resident's name and stats
      - This connects to the reward management system

3. RESIDENT APP - Personal Points Display:

   a. Profile Screen Update:
      - Show resident's total points prominently at the top of Profile
      - Show monthly points with a progress ring
      - Show stats in a grid: Scans, Reports, Verifications
      - Show current rank within their Barangay (e.g., "You're #3 of 156 residents in Lahug")

   b. Points History Screen:
      - Accessible from Profile
      - Chronological list of all point transactions
      - Each entry shows: icon, description, points earned, date
      - Positive points in green, negative in red
      - Pull-to-refresh

   c. Real-Time Point Updates:
      - When a resident earns points, show a brief toast/animation:
        "+5 points! Correct scan 🎉"
      - Points update in real-time on Profile screen using Socket.io

4. SOCKET.IO EVENTS:
   - New event: resident:points:update
     Payload: { residentId, newTotal, pointsEarned, action, description }
   - Resident app listens for this to update their display
   - Officials dashboard listens to refresh top residents list

5. EDGE CASES:
   - What if a resident has 0 points? (Show "No activity yet. Start scanning or reporting!")
   - What if a resident's report is deleted by admin? (Deduct the points that were awarded)
   - What if it's a new month and monthlyPoints resets? (Move current monthlyPoints to a monthlyHistory array)
   - What if two residents have the same points? (Sort by most recent activity)

6. MONTHLY RESET LOGIC:
   - On the 1st of each month, automatically:
     - Save current monthlyPoints to a monthlyHistory array
     - Reset monthlyPoints to 0
     - Total points never reset (lifetime accumulation)
   - This can be a cron job or a function that runs when points are queried

Please provide:
- Updated Resident Mongoose schema with points fields
- Updated API endpoints that award points
- New endpoint for top residents per barangay
- Officials Web App components for resident drill-down view
- Resident App Profile screen updates with points display
- Monthly reset utility function

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps:
   - How to perform actions as a resident to earn points (scan, report, verify)
   - How to check points on the Resident Profile screen
   - How to view top residents as an official
   - How to drill down into a specific resident's activity
   - How to verify points update in real-time

2. Test Data Script:
   Provide MongoDB insert scripts to create 5-6 residents in the same barangay with different point totals and activity mixes:
   - Resident A: High scanner, low reports
   - Resident B: High reports, low scans
   - Resident C: Balanced all-rounder
   - Resident D: New user with low points
   - Resident E: Inactive user with 0 points

3. Expected Visual Results:
   - What the Profile screen looks like with points displayed
   - What the Officials top residents drill-down looks like
   - What the resident detail modal looks like
   - What the toast animation looks like when points are earned

4. Debugging Checklist:
   - If points aren't being awarded, check: [list items]
   - If top residents list is empty, check: [list items]
   - If monthly reset isn't working, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | Earn scan points | Resident scans trash correctly | +5 points; toast appears; total updates |
   | Earn report points | Resident submits report | +10 points; stats reflect new report |
   | View top residents | Official clicks barangay name | Top 10 residents shown ranked by points |
   | Filter by category | Official selects "Segregation" filter | Residents re-ranked by scan points only |
   | Zero-point resident | View profile of inactive user | Shows "No activity yet" message |
   | Monthly reset | Wait for month rollover | monthlyPoints resets; total remains |
   | Tie in points | Two residents have same points | Sorted by most recent activity date |