I need to implement the LGU-to-Resident reward distribution flow for the G-TRASH system. This is the process where Barangay Officials approve and distribute rewards to residents who perform well on the leaderboard (e.g., "Best in Segregation"). Currently, the system tracks points and shows a leaderboard, but there is no workflow for officials to actually grant rewards and for residents to claim them.

Current setup:
- Backend: Node.js + Express + MongoDB with Mongoose
- Officials Web App: React + Vite + Tailwind CSS
- Resident App: React Native (Expo)
- Socket.io is used for real-time events
- The scoring system already tracks points per barangay across 4 categories (Report, Response, Collection, IoT)
- Resident model has fields: name, email, barangay, points (I assume, please confirm or add)

Requirements:

1. BACKEND - New Schemas and Endpoints:

   a. Reward Model (new Mongoose schema):
      {
        title: String,                    // e.g., "Best in Segregation - March 2026"
        description: String,              // e.g., "Awarded for achieving the highest segregation accuracy"
        category: String,                 // enum: ['best_segregation', 'most_trash_collected', 'most_reports', 'most_active']
        barangay: String,                 // which barangay this reward is for
        rewardType: String,               // enum: ['physical_prize', 'certificate', 'cash', 'discount', 'recognition']
        rewardValue: String,              // e.g., "₱500 Gift Certificate", "Groceries Package", "Certificate of Recognition"
        status: String,                   // enum: ['draft', 'published', 'claimed', 'expired']
        recipientId: mongoose.ObjectId,   // ref to Resident (the winner)
        recipientName: String,            // denormalized for quick display
        issuedBy: mongoose.ObjectId,      // ref to Official who approved
        issuedDate: Date,
        claimDeadline: Date,              // residents must claim within X days
        claimedDate: Date,               // when the resident actually claimed
        claimCode: String,               // unique code for verification
        notes: String,                    // internal notes for officials
        createdAt: Date,
        updatedAt: Date
      }

   b. New API Endpoints:
      - POST /api/rewards - Official creates a new reward
      - GET /api/rewards - List all rewards (filterable by barangay, status, category)
      - GET /api/rewards/:id - Get single reward details
      - PATCH /api/rewards/:id - Official updates reward (publish, mark as claimed physically)
      - GET /api/rewards/my-rewards/:residentId - Resident views their rewards
      - POST /api/rewards/:id/claim - Resident claims a reward digitally (generates claim confirmation)
      - GET /api/rewards/leaderboard-eligible - Get top residents eligible for rewards per category per barangay

   c. Updated Resident Schema:
      Add fields:
      {
        rewardsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reward' }],
        totalRewardsClaimed: { type: Number, default: 0 }
      }

2. OFFICIALS WEB APP - Reward Management:

   a. New Page: "Rewards Management" (/rewards)
      - Table showing all rewards with columns: Title, Recipient, Barangay, Type, Status, Date
      - Filter by: Barangay, Status (Draft/Published/Claimed/Expired), Category, Date Range
      - "Create Reward" button that opens a modal/form

   b. Create Reward Modal:
      - Select Reward Category (dropdown populated from leaderboard categories)
      - The system should AUTO-SUGGEST eligible residents based on leaderboard rankings
      - Select Recipient from filtered list of top performers in that barangay
      - Input fields: Title, Description, Reward Type, Reward Value
      - "Claim Deadline" date picker (default: 30 days from issuance)
      - "Save as Draft" and "Publish & Notify" buttons

   c. Reward Detail View:
      - Shows all reward information
      - Status timeline: Draft → Published → Claimed
      - "Publish" button (if draft) - triggers notification to resident
      - "Mark as Claimed" button (if published) - for when resident physically claims the reward
      - "Expire" button with confirmation dialog

   d. Dashboard Widget:
      - Add a "Pending Rewards" card on the Officials Dashboard showing:
        - Number of unclaimed rewards
        - Rewards expiring within 7 days (highlighted in yellow/red)

3. RESIDENT APP - Reward Claiming:

   a. New Screen: "My Rewards" (accessible from Profile or Leaderboard screen)
      - List of rewards earned by this resident
      - Each reward card shows:
        - Reward title and badge/icon based on category
        - "Claimed" or "Available to Claim" status
        - Claim deadline with countdown if approaching
        - Reward value/prize description

   b. Reward Claim Flow:
      - Resident taps "Claim Reward" button
      - App shows reward details with a congratulations animation
      - Resident must tap "Confirm Claim"
      - System generates a unique QR-like claim code
      - App shows: "Show this code to your Barangay Office to receive your reward"
      - Claim code and details are also stored locally in AsyncStorage

   c. Claim Confirmation Screen:
      - Large claim code displayed prominently
      - Barangay office location and contact info
      - "Add to Calendar" button for claim deadline
      - Share button to save screenshot

   d. Notification:
      - When an official publishes a reward, the resident receives an in-app notification:
        "🎉 Congratulations! You've been awarded [Reward Title] by [Barangay]!"
      - Tapping the notification opens the My Rewards screen

4. REAL-TIME UPDATES:
   - New Socket.io events:
     - reward:new - emitted when official publishes a reward
     - reward:claimed - emitted when resident claims a reward
   - The resident app should listen for reward:new and show a celebration modal

5. CLAIM CODE SYSTEM:
   - Generate a unique 8-character alphanumeric code for each reward
   - Format: GTR-XXXX-XXXX (e.g., GTR-A3B7-9K2M)
   - Code is valid until claim deadline
   - Officials can verify the code on their dashboard when the resident comes to claim

6. EDGE CASES:
   - What if a resident doesn't claim within the deadline? (Auto-expire the reward)
   - What if an official accidentally publishes to wrong resident? (Allow revoke within 24 hours)
   - What if a resident moves to a different barangay? (Rewards stay with the original barangay)
   - What if multiple residents tie for the same category? (Allow multiple rewards for same category)

Please provide:
- Complete Reward Mongoose schema
- All API endpoints with request/response examples
- Officials Web App pages and components for reward management
- Resident App screens for viewing and claiming rewards
- Socket.io event handlers
- Claim code generation utility

---

TESTING INSTRUCTIONS:
After implementing, please tell me exactly how to test this feature by providing:

1. Manual Test Steps (step-by-step flow):
   - Step 1: How to seed test data (which official account to use, which resident)
   - Step 2: How to create a reward as an official (exact navigation path)
   - Step 3: How to publish the reward and trigger notification
   - Step 4: How to view the reward as a resident
   - Step 5: How to claim the reward and see the claim code
   - Step 6: How to mark as physically claimed as an official

2. Test Data to Use:
   - Sample resident with high points that qualifies for a reward
   - Sample reward object to insert via Postman or MongoDB
   - Sample official account that has permission to create rewards

3. Expected Visual Results:
   - What the official sees on the Rewards Management page
   - What the resident sees on the My Rewards screen
   - What the claim confirmation screen looks like
   - What notifications appear and where

4. Debugging Checklist:
   - If reward doesn't appear for resident, check: [list items]
   - If claim code isn't generating, check: [list items]
   - If notification isn't received, check: [list items]
   - If deadline isn't auto-expiring, check: [list items]

5. Test Cases Table:
   | Test Case | Action | Expected Result |
   |-----------|--------|-----------------|
   | Create draft reward | Official fills form, saves as draft | Reward appears with "Draft" status |
   | Publish reward | Official clicks "Publish" | Resident gets notification; status changes to "Published" |
   | Resident claims digitally | Resident taps "Claim" | Claim code generated; status changes to "Claimed" |
   | Official marks physical claim | Official clicks "Mark as Claimed" | Status updates; reward moves to history |
   | Reward expires | Deadline passes without claim | Status auto-changes to "Expired" |
   | Multiple winners same category | Official creates 2 rewards | Both residents can claim independently |
   | Revoke within 24 hours | Official clicks "Revoke" | Reward removed from resident's list |