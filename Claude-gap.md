I need to add a simple survey feature to the G-TRASH Resident app that validates whether the gamification (leaderboard and points) actually motivates residents to use the app. My panelist asked: "How can you prove the gamification is really being used?" This survey will collect data directly from residents about what motivates them.

Current setup:
- Resident App: React Native (Expo)
- Backend: Node.js + Express + MongoDB with Mongoose
- The app already has: AI Scanner, Report Submission, Leaderboard screen
- AsyncStorage is used for local data persistence
- The leaderboard shows Barangay rankings and points

Requirements:

1. BACKEND - Survey Model & Endpoints:

   a. SurveyResponse Mongoose Schema:
      {
        residentId: { type: mongoose.ObjectId, ref: 'Resident' },
        barangay: String,
        questionId: String,           // which question was asked
        question: String,             // the actual question text
        answer: String,               // the selected answer
        context: String,              // what the user just did (e.g., "after_scan", "after_report", "viewing_leaderboard")
        submittedAt: { type: Date, default: Date.now }
      }

   b. Simple endpoint:
      - POST /api/survey/response
        Body: { residentId, questionId, question, answer, context }
        Response: { success: true, message: "Thank you for your feedback!" }

      - GET /api/survey/results
        Returns aggregated results:
        {
          "totalResponses": 50,
          "results": [
            { "answer": "I want my barangay to win", "count": 22, "percentage": 44 },
            { "answer": "I want to earn points", "count": 12, "percentage": 24 },
            { "answer": "I just want to keep my area clean", "count": 10, "percentage": 20 },
            { "answer": "Other", "count": 6, "percentage": 12 }
          ],
          "byContext": {
            "after_scan": { ... },
            "after_report": { ... },
            "viewing_leaderboard": { ... }
          }
        }

2. RESIDENT APP - Simple Survey Popup:

   a. When to show the survey:
      Trigger the survey popup after these actions (show ONCE per session):
      - After a successful AI scan
      - After submitting a report
      - After viewing the leaderboard for more than 10 seconds

   b. Survey Popup Component (simple and quick):
      
      A small card that appears at the bottom of the screen:
      
      ┌─────────────────────────────────────────┐
      │  💬 Quick Question                       │
      │                                         │
      │  What motivated you to scan/report       │
      │  today?                                  │
      │                                         │
      │  ○ I want my barangay to win            │
      │  ○ I want to earn points                │
      │  ○ I just want to keep my area clean    │
      │  ○ Other                                │
      │                                         │
      │  [ Submit ]   [ Skip ]                  │
      └─────────────────────────────────────────┘

   c. Survey behavior:
      - Only show ONCE per app session (store in AsyncStorage)
      - If user taps "Skip", don't show again that session
      - If user answers, show a brief "Thank you! 🙏" message
      - The popup should NOT block app usage — user can ignore it
      - Small and unobtrusive — doesn't cover the whole screen

   d. Context tracking:
      - If shown after a scan → context: "after_scan"
      - If shown after a report → context: "after_report"
      - If shown after viewing leaderboard → context: "viewing_leaderboard"

3. OFFICIALS WEB APP - Simple Survey Results View:

   a. Add a small section to the Dashboard or a new tab "User Feedback":
      - Show a simple pie chart or bar chart with survey results
      - Show total responses count
      - Filter by: All Time, This Month, This Week
      - Filter by context: After Scan, After Report, Viewing Leaderboard

   b. Simple stats cards:
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │  44%          │  │  24%          │  │  20%          │
      │ Want to win  │  │ Want points  │  │ Keep clean   │
      └──────────────┘  └──────────────┘  └──────────────┘

   c. Key insight text:
      "68% of residents are motivated by gamification (winning + points)"
      "This proves the leaderboard and rewards system drives engagement"

4. PROVING THE GAMIFICATION WORKS:

   The two answers that prove gamification works:
   - "I want my barangay to win" → Leaderboard motivation
   - "I want to earn points" → Points/rewards motivation

   Combined percentage = proof that gamification drives usage

   If this combined percentage is above 50%, you can confidently say:
   "The majority of our users are motivated by gamification features"

5. EDGE CASES:
   - What if user has no internet? (Save response locally, submit when online)
   - What if user already answered this week? (Don't show again for 7 days)
   - What if user rapidly does multiple actions? (Show survey max once per session)
   - What if survey endpoint fails? (Silently fail — don't disrupt the user)

Please provide:
- Backend: SurveyResponse model, POST endpoint, GET results endpoint
- Resident App: SurveyPopup component, trigger logic, AsyncStorage tracking
- Officials Web App: Simple survey results display with chart and stats cards
- The key insight calculation (combined gamification percentage)

---

TESTING INSTRUCTIONS:

1. Manual Test Steps:
   - Step 1: Open Resident app, perform an AI scan
   - Step 2: Verify the survey popup appears after the scan result
   - Step 3: Select "I want my barangay to win" and submit
   - Step 4: Verify "Thank you!" message appears
   - Step 5: Do another scan — verify survey does NOT appear again (same session)
   - Step 6: Close and reopen app — do a scan — verify survey appears again (new session)
   - Step 7: Open Officials dashboard → check survey results updated
   - Step 8: Verify the combined gamification percentage is showing

2. Test Data Script:
   Provide MongoDB insert script to create sample survey responses:
   - 22 responses: "I want my barangay to win"
   - 12 responses: "I want to earn points"
   - 10 responses: "I just want to keep my area clean"
   - 6 responses: "Other"

3. Expected Visual Results:
   - What the survey popup looks like at the bottom of the screen
   - What the "Thank you" message looks like
   - What the Officials dashboard survey section looks like with pie chart
   - What the stats cards look like

4. Debugging Checklist:
   - If survey doesn't appear after scan, check: [list items]
   - If survey appears twice in same session, check: [list items]
   - If results don't update on dashboard, check: [list items]
   - If percentage calculation is wrong, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | Survey after scan | Complete an AI scan | Survey popup appears at bottom |
   | Submit answer | Select option and submit | "Thank you!" shown; popup dismissed |
   | Skip survey | Tap "Skip" | Popup dismissed; won't show this session |
   | Same session | Do another scan | Survey does NOT appear |
   | New session | Close and reopen app, scan | Survey appears again |
   | View results | Open Officials dashboard | Pie chart shows response breakdown |
   | Combined stat | Check gamification percentage | Shows "68% motivated by gamification" |